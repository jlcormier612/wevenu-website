# Vendor Lifecycle & Status Truth Audit

**Type:** Research and product recommendation only. No code, database, migrations, UI, or navigation were modified to produce this document.
**Method:** Direct database schema inspection (`\d`, `\sf`), full reads of `lib/vendors/*`, `lib/vendor-invites/service.ts`, `components/vendors/vendor-list.tsx` and `vendor-detail.tsx`, the `create_vendor_atomic` and `claim_vendor_profile` RPCs read via `\sf`, and a live database query confirming the venue owner's and a manager's auth user IDs are genuinely distinct (not merely theoretical). One live browser reproduction (a Manager-role login attempting to edit a vendor) was attempted and did not complete due to environment login flakiness after repeated Playwright sessions this engagement — that specific finding is labeled **VERIFIED FROM SOURCE**, not live, per this task's own instruction to label rather than force it.

---

## Executive Finding

**A venue owner cannot reliably distinguish "invited but not yet claimed" from "claimed and active" using the Vendor list, because the underlying lifecycle field that's supposed to carry that distinction is never actually set to anything but "active" in current practice — and the list's own "Status" column doesn't display lifecycle or claim state at all, only Preference level, under a misleading header.** The Vendor detail page, separately, gets this right using a different, correct signal (`is_claimed`). Independently, this pass found a real, confirmed permissions gap: vendor relationship management is restricted at the database level to literally the venue's owner account, not any Manager or Staff team member, with no compensating check or messaging anywhere in the application layer.

---

## Current Vendor Truth Model

| Concept | Field | Current reality |
|---|---|---|
| Relationship lifecycle | `venue_vendor_relationships.status` (`invited`/`active`/`inactive`) | The type/constraint still defines all three, but **`invited` is never written anywhere in the current codebase** — confirmed by exhaustive grep, and confirmed structurally: `create_vendor_atomic` never sets `status` at insert time, so every new relationship starts at the column's own default, `'active'`, immediately, before any invitation is ever sent |
| Claim state | `vendors.is_claimed` | The real, working, correctly-maintained signal — kept in sync by a database trigger (`vendor_users_sync_claimed_status`) off real `vendor_users` rows |
| Invitation sent | `vendor_invitations` table (separate from the relationship) | Real, working — a row is upserted with `status: 'pending'` and a 7-day expiry each time **Send Invite** is clicked |
| Invitation accepted | `vendor_invitations.status = 'accepted'` + `vendors.is_claimed = true` | Both set together, atomically, inside `claim_vendor_profile` |
| Preference | `venue_vendor_relationships.preference_level` (`featured`/`preferred`/`recommended`) | A venue's own categorization of a vendor, entirely independent of lifecycle or claim state |

---

## Lifecycle

**The real, current journey, traced end to end:**

1. **Vendor created** (`create_vendor_atomic`) — the relationship is inserted with no explicit status, landing on `'active'` by column default. **Confirmed: a vendor is "active" from the moment a venue adds them, whether or not anyone has ever invited them or they've ever heard of Hello to Cheers.**
2. **Send Invite** (only offered in the UI while `!vendor.isClaimed`) — creates/updates a `vendor_invitations` row and sends a real email with a link to `/vendor/accept?token={claim_token}`.
3. **Vendor opens the link** — a real, pre-auth, security-definer RPC (`get_vendor_by_claim_token`) resolves the invite; the vendor authenticates (existing or new Hello to Cheers login).
4. **Vendor claims** (`claim_vendor_profile`) — inserts/updates their `vendor_users` row, clears `vendors.claim_token`, marks the matching `vendor_invitations` row `'accepted'`, and — per the function's own comment — is written specifically to *"advance every invited relationship for this vendor to active now that they've claimed."* **This line of logic is, in current practice, a no-op** — because nothing upstream ever leaves a relationship in `'invited'` for it to advance from.
5. **Resend Invite** — same `sendVendorInvite` path, confirmed reusable; blocked with a clear message if the vendor has since claimed (`"This vendor has already claimed their profile."`).
6. **Inactive / Reactivate** — a real, working pair (`Mark Inactive` / `Reactivate` on the detail page), confirmed distinct from claim state — an inactive vendor can be claimed or unclaimed independently.
7. **Vendor already claimed elsewhere / multiple venue relationships** — supported by the data model (`vendor_users` is scoped to one `vendor_id`, but a `vendors` row can have relationships with multiple venues via separate `venue_vendor_relationships` rows) — **VERIFIED FROM SOURCE**, not reproduced live in this pass.

---

## Preferred

**Confirmed: Preferred is not lifecycle, and the current product mostly gets this right — with one real exception.**

- Stored on the relationship (`venue_vendor_relationships.preference_level`), not on the vendor itself — correctly venue-specific, since two different venues could reasonably rank the same vendor differently.
- A simple three-value enum (`featured`/`preferred`/`recommended`), defaulting to `recommended`.
- **Can coexist with any claim state** — confirmed nothing in the schema or code ties preference to `is_claimed`; a venue can mark an unclaimed vendor "Preferred" immediately.
- **Can coexist with inactive** — confirmed no constraint or trigger clears preference on deactivation.
- **Does it affect other behavior?** Confirmed real, functional consequences beyond display: the partial index `vvr_venue_active_pref` and sort logic in the vendor list (`lvl()` helper ranking featured > preferred > recommended) both key off it — it drives real ordering, not just a badge.
- **The one real collision:** the Vendor **list's own column is literally labeled "Status"** and renders **only** `preferenceLevel` — confirmed directly in `vendor-list.tsx`. A venue reading that column believes they're seeing lifecycle status; they are actually seeing a ranking. This is a genuine semantic collision, not a hypothetical one.

---

## Vendor List

Confirmed directly from `components/vendors/vendor-list.tsx` and cross-checked against this engagement's own live capture of the real list earlier this session:

- Columns: Vendor, Category, Contact, Phone, **Status**, and a "View →" link.
- The **Status** column renders a **"★ Featured"** or **"✓ Preferred"** badge when applicable, and **nothing** — a blank cell — for `recommended`-tier vendors, regardless of whether they've claimed their profile or not.
- **The previously-observed behavior is confirmed still true, and now precisely explained rather than merely observed:** "Baker's Dozen" (unclaimed, confirmed live via its own "Send Invite" button) showed a blank Status cell — not because it was unclaimed, but because it happens to be `recommended`-tier, which would render blank regardless of claim state. The blank cell carries no claim-state information at all, in either direction.
- No filter or sort by lifecycle/claim state was found — sorting is by preference tier and name only.

---

## Vendor Detail

Confirmed directly from `components/vendors/vendor-detail.tsx`:

- Header: business name, a correctly-labeled **"★ Preferred"** badge (only for genuinely preferred/featured vendors — this page does not have the list's mislabeling problem), category badge.
- **Send Invite** button, shown only while `!vendor.isClaimed`, with an honest, clarifying tooltip: *"Gives this vendor their own login to the Vendor Portal — separate from assigning them to a specific event."* Button label becomes **"Invite Sent"** immediately after a successful send.
- Once claimed, the Send Invite button simply **disappears** — there is no positive "✓ Claimed" label anywhere to confirm this; the fact is communicated only by the button's absence.
- Inactive vendors show a clear banner: *"This vendor is marked inactive — hidden from your directory and clients' portals."* with a **Reactivate** button.
- **Edit** and **Mark Inactive** (soft-delete, confirmed — the underlying action is a status change, not a row deletion) are always available while active.
- Reviews are real and functional — see correction below.

**Verdict: the detail page is more truthful than the list, using the correct `is_claimed` signal — but only ever tells the venue "not yet claimed" (via a visible button) or "claimed" (via that same button's absence), never in a single explicit sentence.**

---

## Event Vendor Context

Confirmed structurally distinct, and confirmed the UI already explains the distinction reasonably well:

- `venue_vendor_relationships` (the global Vendor Network relationship) and `event_vendor_assignments` (a real, separate table — `arrival_time`, `checked_in_at`, `setup_complete_at`, `agreed_fee`, `payment_status`, guest-info-sharing flags) are confirmed to model genuinely different facts — one relationship-wide, one event-specific and operational.
- The Send Invite tooltip on the Detail page already draws this line explicitly for the venue, unprompted: *"separate from assigning them to a specific event."*
- No evidence found of the two being confused in either direction in the current UI.

**Verdict: not a problem.**

---

## Vendor Portal

Traced from `app/vendor/accept/page.tsx` and `claim_vendor_profile`:

- **Before claim:** a vendor with a valid token sees a real, pre-auth invitation screen (*"You've been invited"*, business name, category) — resolved via a security-definer RPC that works without a session.
- **After claim:** the vendor gains a real `vendor_users` row and full Vendor Portal access; their invitation record moves to `'accepted'`.
- **Does the venue's own Vendor list reflect this transition?** Confirmed: **only via the Detail page's Send Invite button disappearing** — the List's own Status column, per the finding above, shows nothing that changes across this transition at all (`is_claimed` is not read by the list component).

---

## Invitation / Claim Security

**No genuine new security defect found.** `claim_token` is generated with `gen_random_bytes(24)` (48 hex characters) — strong, unguessable entropy, consistent with every other token-based flow already verified elsewhere in this engagement (Contract signing tokens, etc.). Claiming ties the vendor to whichever account is authenticated at the moment of claim (`auth.uid()`), the same trust model this codebase already uses consistently for every comparable invitation flow — not a Vendor-specific weakness.

**One real, confirmed, separate finding that belongs in this section rather than the Status theme: relationship management is restricted to the venue owner only, at the database level.**

- `venue_vendor_relationships`'s only venue-side RLS policy, `venues_manage_relationships`, checks `v.owner_user_id = auth.uid()` — not the standard `venue_id = current_user_venue_id()` pattern used almost everywhere else in this codebase for venue-wide staff access.
- `vendor_users`'s `venues_see_vendor_team` policy uses the identical, narrower `owner_user_id` check.
- **Confirmed by direct query, not assumed:** the seeded Manager account's own `auth.users.id` is a completely different UUID from the venue's `owner_user_id`.
- `lib/vendors/service.ts` has **no application-layer role check anywhere** that would compensate for or explain this restriction to a Manager or Staff user attempting the same action.
- **A live reproduction (Manager account attempting to edit a vendor) was attempted and did not complete in this pass due to login flakiness — labeled VERIFIED FROM SOURCE, not VERIFIED LIVE**, per this task's own instruction. The database evidence (the policy text plus the confirmed-distinct UIDs) is direct and conclusive on its own even without the live click-through.

**Classification: P0, security/permissions — not the same finding as the Status/Preferred confusion, but real and belongs in this audit.**

---

## Truth Matrix

Using actual, currently-reachable states only (not the unreachable `invited` value):

| Relationship | Invited (real) | Claimed | Active | Inactive | Preferred | What the List's "Status" column shows |
|---|---|---|---|---|---|---|
| A — newly added, unranked, unclaimed (e.g. Baker's Dozen) | No (status is already `active`) | No | Yes | No | No (recommended) | **Blank** |
| B — invited, still unclaimed, but marked Preferred | No | No | Yes | No | **Yes** | **"✓ Preferred"** |
| C — claimed and Preferred (e.g. Golden Hour Photography) | No | **Yes** | Yes | No | **Yes** | **"✓ Preferred"** |
| D — deactivated | No | Either | No | Yes | Either | Not evaluated — inactive vendors are excluded from the venue's directory per the detail page's own copy |

**Row B and Row C are visually identical in the list** despite one being an unclaimed vendor a venue is still waiting on and the other being a fully onboarded partner — the exact, now-precisely-demonstrated collision.

---

## Findings

| # | Finding | Classification | Severity |
|---|---|---|---|
| 1 | List "Status" column shows Preference, not lifecycle or claim state, under a misleading header | UX/terminology | **P1** |
| 2 | `status = 'invited'` is architecturally present but never reachable in practice | Dead code / stale design intent, not a venue-facing problem on its own (the Detail page's `is_claimed` signal already correctly serves the practical need) | **P2** |
| 3 | Claimed state on Detail is only ever shown by a button's absence, never a positive label | Polish | **P2** |
| 4 | Vendor relationship management (and team visibility) restricted to `owner_user_id` only, no Manager/Staff access, no app-layer compensation | Security/permissions | **P0** |
| 5 | `vendor_reviews` — prior context said unused; **confirmed now real and wired** (`components/vendors/vendor-reviews.tsx`, live read/write) | Context correction, not a problem | **NOT A PROBLEM** |
| 6 | Vendor vs. event-vendor distinction | Already well-communicated (Send Invite tooltip) | **NOT A PROBLEM** |
| 7 | Invitation token strength/security model | Consistent with established patterns elsewhere | **NOT A PROBLEM** |

---

## Minimum Safe UX Fix

For Finding 1 (the real Status/Preferred collision), several reasonable, small fixes exist — **this document lists them rather than choosing, per instruction, since more than one is defensible:**

- **Option 1:** Rename the list column from "Status" to "Preference" — the smallest possible change, immediately truthful, since that's already all it shows.
- **Option 2:** Keep "Status" as the header, but change what it renders — surface `is_claimed` (e.g., a small "Claimed"/"Invited" indicator) instead of or alongside preference, moving Preference to its own, separately-labeled column.
- **Option 3:** Do both — rename the existing column to "Preference" and add one small, new claim-state indicator next to it.

**This document does not choose between these — it is a genuine product decision** (how much new information belongs in an already-scannable list vs. how much should stay on the Detail page) that the evidence alone doesn't resolve. Recommend Jennifer pick one.

For Finding 4 (the RLS permissions gap), the smallest safe fix is narrower and less of a judgment call: broaden `venues_manage_relationships` and `venues_see_vendor_team` from `v.owner_user_id = auth.uid()` to the standard `venue_id = current_user_venue_id()` pattern already used everywhere else in this codebase — the existing, proven pattern, not a new one.

---

## Explicitly Deferred

Per instruction, none of the following were reopened or redesigned: the Vendor domain model, the relationship status enum, the dedup architecture, Vendor Network architecture, Client/Event architecture, Pipeline, Automations, Library IA, left navigation, Help & Guides, Event Orders, branding, Contracts, Payments, or Luv.

---

## Acceptance Criteria

Readiness would be proven when: (1) the list's Status/Preference column and its label agree with each other, in whichever direction is chosen; (2) a Manager-role account can successfully send a vendor invite and edit a vendor relationship without a permissions error, verified live; (3) no venue-facing surface implies a vendor is in an "Invited" state that the data model cannot actually represent today.

---

## 16. Final Decision

# B. Small bounded remediation required.

Exact changes: (1) resolve the List "Status"-vs-"Preference" mislabeling — one of the three options above, Jennifer's call; (2) broaden the two `owner_user_id`-restricted RLS policies to the standard venue-wide staff pattern already used throughout this codebase. Both are small, targeted, evidence-based fixes to an otherwise sound and mostly-truthful Vendor lifecycle model — not a deeper Vendor product rework.

This document ends here. No code, database, migrations, UI, or navigation were changed in producing it.
