# Vendor Relationship Lifecycle

**Status:** Design only, no code. Refines and supersedes the state-machine section of `docs/vendor-domain-model-review.md` (Question 5) — that document recommended collapsing three overlapping status signals into "a single relationship-owned state machine"; this document is that state machine, specified in full as a lifecycle rather than a schema note, per explicit request to design the lifecycle rather than the database.
**Checked against:** `docs/product-strategy-charter.md`. Reuses `docs/vendor-onboarding-and-assets-design.md` (the four acquisition paths) and `docs/notification-system-redesign.md` (Vendor Activity category) rather than re-deriving either.
**Method:** every stage below is checked against the actual current schema — not assumed — including one concrete "collected but not spent" finding (Performance Recorded) verified by grep, matching this project's standing verification discipline.

---

## The lifecycle, stated as a sequence a venue actually lives through

```
Global Vendor
     ↓
Venue Discovers Vendor
     ↓
Venue Creates Relationship
     ↓
Invite Vendor  ───────────────┐
     ↓                        │ (skipped for manual/import/paste-website adds —
Vendor Claims Profile         │  see "Two ways in," below)
     ↓                        │
Relationship Active  ◄────────┘
     ↓
Assigned to Event
     ↓
Performance Recorded
     ↓
Preferred Vendor
     ↓
Inactive Relationship
```

This isn't one state machine — it's **four concepts handing off to each other in sequence**, exactly matching the five-concept model already agreed in the domain review (Identity, Relationship, Invitation, Assignment, and now Performance as a sub-concern of Communication). Stating it as a lifecycle rather than a single enum matters because it makes explicit which stages are stored state changes and which are just the *experience* of moving between concepts — conflating those two is exactly how the current three-overlapping-fields problem happened in the first place.

| Stage | Owning concept | Stored today? |
|---|---|---|
| Global Vendor | Identity (`vendors`) | Yes |
| Venue Discovers Vendor | *(none — a moment, not a record)* | No, and shouldn't be |
| Venue Creates Relationship | Relationship (`venue_vendor_relationships`) | Yes |
| Invite Vendor | Invitation (`vendor_invitations`) | Yes |
| Vendor Claims Profile | Identity + Relationship (`vendors.is_claimed`, should also move Relationship status) | Partially — see Finding 1 |
| Relationship Active | Relationship `status` | Yes |
| Assigned to Event | Assignment (`event_vendor_assignments`) | Yes |
| Performance Recorded | `vendor_reviews` | Yes, but unread — see Finding 2 |
| Preferred Vendor | Relationship (currently 3 overlapping fields) | Yes — see Finding 3 |
| Inactive Relationship | Relationship (currently 2 overlapping fields) | Yes — see Finding 3 |

---

## Two ways in, converging on the same lifecycle

Not every vendor enters at "Discovers." The four acquisition paths already designed enter at different points, and this lifecycle should make that explicit rather than pretend every vendor is invited and claimed:

- **Import / Manual Entry / Paste Website** → the venue already works with this vendor. The relationship should land directly at **Active**, no invitation, no claiming expected — this is a venue-managed record, and today's schema already supports this correctly (`venue_vendor_relationships.status` defaults to `'active'`, not `'invited'`). The vendor *may* claim their own profile later (through a separate, vendor-initiated path) — if they do, that's a welcome upgrade in who maintains Identity, not a lifecycle stage the venue needs to trigger or wait for.
- **Search Existing Wevenu Vendors** (Marketplace) → this is the "Discovers" stage made real. The vendor already has global Identity, quite possibly already claimed by someone else. Connecting to them here should default to **Invited**, since the vendor's own account — not the discovering venue — should confirm the relationship, matching System Proposes/Human Confirms on *both* sides of a two-sided marketplace relationship, not just the venue's side.

Both paths converge on **Active** — the lifecycle doesn't care how a relationship got there, only that everything downstream (Assignment, Performance, Preferred, Inactive) behaves identically regardless of entry path.

---

## Findings, verified against the live schema

### Finding 1 — Claiming still doesn't advance the Relationship (repeats the domain review's Conflation 2, now named as the specific lifecycle-boundary fix)

`claim_vendor_profile()` sets `vendors.is_claimed = true` and inserts into `vendor_users`. It does not update `venue_vendor_relationships.status`. In this lifecycle's terms: **"Vendor Claims Profile" today does not actually cause "Relationship Active"** for any relationship that started at `invited` — the relationship silently stays `invited` forever even after the vendor is fully onboarded and working. This is the same gap the domain review named; restating it here because this lifecycle document is what makes it concrete enough to fix: the claim function's job should be to transition every one of that vendor's `invited` relationships to `active`, not just to flip a flag on Identity.

### Finding 2 — "Performance Recorded" already has a table, and it's read by nothing

`vendor_reviews` exists (`rating` 1–5, `body`, `reviewer_type: 'venue' | 'couple'`, linked to `event_id`), with RLS already written (`venues_manage_reviews`, `vendors_see_own_reviews`). I grepped every service, repository, and component in the app for it: zero reads, zero writes, anywhere. The `VendorReview` type is defined in `lib/vendors/types.ts` and used by nothing. This is the same "collected but not spent" shape already found twice this program (venue brand colors, Playbook task visibility) — schema built ahead of the feature, then the feature never arrived. Naming it now, before this lifecycle gets built, so it's built as the thing that finally uses this table rather than a fifth thing that duplicates it.

**Recommendation:** Performance Recorded should be a **proposed, not automatic** prompt — after an event's date has passed (a fact Calendar already projects, per Standard #10, not a new trigger to invent), the venue is asked once whether they'd like to rate the vendors assigned to that event. Never auto-generated, never required. This is a direct Trust First application: a performance record is a subjective human judgment: the system's only job is to ask at the right moment, per Assignment completion.

### Finding 3 — "Preferred" and "Inactive" are each already split across overlapping fields

Today's `venue_vendor_relationships` has **four** fields that between them encode what this lifecycle treats as two single stages:

- `status` (enum: `invited`/`active`/`preferred`/`removed`)
- `is_preferred` (boolean)
- `preference_level` (enum: `featured`/`preferred`/`recommended`)
- `is_active` (boolean, separate from `status`)

`status = 'preferred'` and `is_preferred = true` and `preference_level = 'preferred'` can all independently be true or false of the same row — three ways to ask "is this vendor preferred," with no code enforcing they agree. Same shape as `is_active` (boolean) sitting alongside `status = 'removed'` (enum) — two ways to ask "is this relationship over," also not enforced to agree.

**Recommendation, reusing this lifecycle's own stage names as the canonical enum:**

```
status: 'invited' | 'active' | 'preferred' | 'inactive'
```

- Drop `is_preferred` entirely — `status = 'preferred'` is the single answer.
- Keep `preference_level`, but repurpose it as a **sub-tier that only applies once `status = 'preferred'`** (`featured` vs. `preferred` vs. `recommended` becomes "how preferred," not "whether preferred") — this is the one place two fields genuinely encode two different questions, not the same one twice.
- Drop `is_active` — rename the terminal `removed` value to **`inactive`**, matching this lifecycle's own language and the Charter's Hospitality-over-Software instinct: "removed" reads as something the venue did *to* the vendor; "inactive" reads as a neutral, reversible pause, which is closer to how a venue actually thinks about a florist they haven't booked in two years but might again.

**Open product question, named rather than assumed:** should "inactive" be reversible (a vendor can move back to `active` without re-inviting) while some *other*, rarer action ("delete this relationship entirely") stays a separate, harder-to-reach action? My recommendation is yes — a single soft `inactive` state that's one click to reactivate, with true deletion reserved for a distinct, deliberately less convenient action, matching how this project has already treated soft-delete vs. hard-delete elsewhere (contracts, per Engineering Standard #4's append-only principle, though a vendor relationship isn't a legal artifact, just a relationship in the Charter's own sense).

---

## What this lifecycle becomes the foundation for

### Permissions
`status != 'inactive'` (today `!= 'removed'`) already gates real RLS policies (`venues_select_related_vendors`, `vendor_users_see_own_team`, `venues_see_vendor_packages`, `venues_see_vendor_availability`) — no new permission logic needed, just the field rename above. `vendor_users` access (portal login) is correctly already gated on Identity's own claim state, not the Relationship — a vendor's login doesn't disappear just because one particular venue marks the relationship inactive, which is correct: the vendor's account is theirs, independent of any one venue's opinion of them.

### Notifications
Each transition is a natural Vendor Activity event (per `docs/notification-system-redesign.md`'s categories), not a new category: invited → claimed is exactly the kind of milestone that category exists for. Performance Recorded's prompt is Planning Progress (it's about the venue's own follow-through after an event), not Vendor Activity (it's not something the vendor did).

### Onboarding
This lifecycle is the reason the four acquisition paths (`docs/vendor-onboarding-and-assets-design.md`) needed to be designed with different entry points in the first place — Import/Manual/Paste-Website entering at Active, Marketplace search entering at Invited. Documenting both here closes the loop between that design and this one rather than leaving the connection implicit.

### Reporting
A single, non-overlapping status field makes basic, honest funnel reporting possible for the first time: invited→active conversion rate, average time-to-claim, active→preferred rate, ratings distribution. None of this is reliably computable today, because the three "preferred" signals and two "inactive" signals can disagree with each other.

### UI
The vendor detail page should show this lifecycle as a short, chronological, audience-agnostic history strip — reusing the same "chronological entries" visual pattern already established for the Day-of Timeline and the Planning Playbook Builder (Charter: reuse before creating), not a new timeline component. Invited on [date] → Claimed on [date] → Preferred since [date] is a more honest and more useful summary of a vendor relationship than a single static badge.

---

No code has been written. This is the lifecycle design requested, ready to inform the vendor onboarding, notification, and domain-model work already approved for review but not yet implemented.
