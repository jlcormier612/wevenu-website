# Vendor Network — Domain Model & Product Architecture Review

**Status:** Architecture review only, no code. Follows `docs/vendor-network-charter-review.md` (the implementation-level review) — this document steps back from bugs to the conceptual model those bugs sit inside. Checked against `docs/product-strategy-charter.md` in full.
**Method:** Every claim below is traced to the actual schema and RLS policies, and the single most load-bearing claim was verified with a real rolled-back-transaction test against a live per-role session, not asserted from reading code alone — consistent with this project's standing verification discipline. Verifying a fact is not the same as proposing code; nothing here is an implementation.

---

## Question 1 — What is the true System of Record for a vendor?

There isn't one today. There are four partial records, each genuinely authoritative for a *slice* of "vendor," with one real leak between two of them:

| Concept | Table | What it should be the one true answer to |
|---|---|---|
| **Identity** | `vendors` | Who this business *is* — name, category, contact info, logo, self-written description |
| **Relationship** | `venue_vendor_relationships` | How *this venue* relates to them — preference, notes, active/removed |
| **Invitation** | `vendor_invitations` | The one-time historical event of inviting them |
| **Assignment** | `event_vendor_assignments` | Their involvement in *one event* |

Two of these are already clean. Two are not — detailed under Question 4.

## Question 2 — Global entities with relationships, or venue-owned records that optionally join the network?

**Already decided, in this exact codebase, correctly.** This isn't a hypothetical to re-litigate — I read the migration history: Sprint 14 (`20260626280000_vendors_foundation.sql`) originally built `vendors` as venue-owned (`vendors.venue_id not null`, comment: *"the venue's reusable vendor directory"*). Sprint 104.5 (`20260706110000_sprint104_5_vendor_foundation.sql`) deliberately migrated existing rows into a new `venue_vendor_relationships` join table and then **dropped** `vendors.venue_id` entirely. That migration comment says it plainly: *"venue_vendor_relationships is the many-to-many join (replaces vendors.venue_id)."*

This is the identical question already asked and answered on the customer side this program (Person vs. Relationship). The vendor side answered it first, and answered it the same way: **global identity, per-venue relationship.** The recommendation here is to confirm this, not revisit it — the actual problems are that the write path doesn't honor it (no dedup, so the "global" table doesn't behave globally in practice) and one field never finished migrating to the relationship where it belongs (below).

## Question 3 & 4 — Where the current model conflates concepts

### Clean already (confirmed, not just assumed)

**Assignment is correctly separated from Relationship.** `event_vendor_assignments` (per-event: arrival time, day-of notes) is a genuinely distinct table from `venue_vendor_relationships` (per-venue: preference, ongoing notes). No conflation here — worth stating for balance, since not every finding in this review is a problem.

**Most of Identity is correctly separated from Relationship.** `category`, `business_name`, `contact_name`, `email`, `logo_url` live on the global `vendors` row; `is_preferred`, `preference_level`, `display_order`, and this-venue's-own `notes` live on `venue_vendor_relationships`. That split is exactly right — a florist's category doesn't change depending on who's asking; one venue's opinion of them does.

### Conflation 1 — commercial terms living on shared identity, and a verified live bug because of it

`pricing_tier` and (arguably) `description` are columns on the global `vendors` table, not on `venue_vendor_relationships`. Traced the actual coordinator-facing update path (`updateVendor()` in `lib/vendors/repository.ts`) and the RLS policies on `vendors`: the **only** UPDATE policy on `vendors` is `vendor_users_update_profile`, scoped to the vendor's *own* claimed account (`vendor_users` with role owner/manager) — there is no venue-side UPDATE policy on this table at all.

I verified this directly rather than asserting it from reading alone: created a test vendor, linked it to a real venue via `venue_vendor_relationships`, impersonated that venue's actual coordinator in a real per-role session, and ran the exact update the vendor-edit form performs.

```
UPDATE 0
```

Zero rows changed, no error thrown. **A coordinator editing a vendor's name, category, pricing tier, description, website, or logo today silently does nothing** — the relationship-scoped fields (preference level, notes) save correctly in the same call, so the UI very plausibly reports success while the identity fields underneath never actually change. This is the exact shape this project's Trust Risk Register exists to catch (a system reporting success while failing) — flagged here as a finding for the domain model discussion, not filed as a fix, per the scope of this review.

**Why this matters architecturally, not just as a bug:** it's evidence that `pricing_tier` was never cleanly decided to be identity-level or relationship-level, and the RLS was written as if it's identity-level (vendor-owned) while the UI was written as if it's relationship-level (venue-editable). Fixing the bug without first deciding *which one pricing actually is* would just move the conflation, not resolve it.

**Open product question, not assumed:** does a vendor's pricing genuinely vary per venue (negotiated rates differ), or is it one rate the vendor sets themselves regardless of venue? If the latter, `pricing_tier` belongs on Identity and the fix is RLS (let the vendor's own claimed account be the only writer, and stop offering venues an edit control for it at all). If the former, it belongs on the Relationship, alongside preference level and notes, and a venue editing it should never touch the shared `vendors` row.

### Conflation 2 — three overlapping signals for one fact: "has this vendor accepted"

Confirmed three separate fields, on three separate tables, none guaranteed to move together:

- `vendors.is_claimed` (boolean) — has this vendor ever claimed their account, platform-wide
- `vendor_invitations.status` (`pending`/`accepted`/`expired`/`revoked`) — has *this specific invitation* been accepted
- `venue_vendor_relationships.status` (`invited`/`active`/`preferred`/`removed`) — the relationship's own lifecycle state, which independently encodes an "invited" phase

Traced `claim_vendor_profile()` directly: it updates `vendors.is_claimed` and inserts into `vendor_users`. It touches neither `vendor_invitations.status` nor `venue_vendor_relationships.status`. A vendor can be fully claimed and actively working with a venue while both of the other two signals still read as if nothing has happened yet — and `vendor_invitations.status` is read by three real HQ screens today, per the prior implementation review.

This is a textbook instance of the exact pattern Engineering Standard #9 names: the same real-world question ("is this vendor relationship live") answerable in three places, none reconciled, because each was added at a different time for a locally-reasonable purpose.

### Not yet built, but worth confirming stays right: Communication

Vendor messaging doesn't exist yet. It's already correctly scoped in `docs/conversation-lifecycle-design.md` to anchor on the *Relationship* (`venue_vendor_relationships`), not on Identity or Assignment — the same reasoning already validated on the customer side (a conversation outlives any single event, and a vendor identity isn't venue-specific enough to anchor a venue's own conversation to it). Naming this only to confirm the existing plan is still the right one, not to propose a change.

---

## Question 5 — The cleanest long-term domain model

Five concepts, five single responsibilities, each with exactly one authoritative home:

1. **Vendor (Identity)** — global. Owns name, category, contact info, logo, self-written description, and *claim state*. On claim state: recommend **`is_claimed` stops being a stored column at all** and becomes a computed fact (`exists(select 1 from vendor_users where vendor_id = vendors.id and is_active)`) — the same "recompute derived values, don't store a second copy" discipline (Engineering Standard #1) already applied elsewhere this program. One fewer field that can drift.

2. **Venue-Vendor Relationship** — per (venue, vendor) pair. Owns this venue's preference/ranking, internal notes, and the *single* authoritative lifecycle status for this relationship (see below). If pricing genuinely varies per venue, it belongs here, not on Identity.

3. **Invitation** — a pure, append-only historical record: who was invited, when, by whom, with what message, and its own terminal outcome. It should be **read by nothing else as a live-state signal.** Anything that currently asks "is this vendor pending/accepted" should ask the Relationship's own status instead.

4. **Assignment** — already correct, per-event, no change.

5. **Communication (future)** — anchors to the Relationship, already correctly planned.

**The single-status recommendation, stated plainly:** collapse the three-way status ambiguity into one state machine, owned by the Relationship: `prospective → invited → active → removed`. Claiming a profile transitions the Relationship directly (not a separate table an unrelated screen has to cross-reference). Invitation keeps its own terminal status for its own historical record, but nothing outside the invitation flow itself ever reads it as the current source of truth again.

This is the same shape of decision already made for Person vs. Relationship on the customer side, and for Assignment vs. Relationship on the vendor side where it's already correct — applying it consistently is what makes the whole Vendor Network legible as one model instead of three overlapping ones.

No code has been written or proposed. This is the architecture discussion requested, ahead of any implementation decision.
