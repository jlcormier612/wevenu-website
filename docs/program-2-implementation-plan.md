# Program 2 Implementation Plan — Coherence, Not Features

**Status:** Proposal — not yet implemented. For review; no code should be written against this plan until it's agreed.
**Date:** 2026-07-08
**Objective (stated by the venue owner):** Program 1 was about trust. Program 2 is about coherence — aligning the implementation with `docs/domain-model.md` and reducing the codebase to fewer, stronger concepts rather than adding new ones. Every decision below is checked against the four questions: does this align with the Domain Model, does it reinforce the Product Promise, does it follow the Engineering Standards, and does it reduce fragmentation or increase it.
**Reads on:** `docs/domain-model.md` (the target concepts), `docs/architecture-audit.md` (where today's implementation diverges from them), `docs/trust-risk-register.md`, `docs/engineering-standards.md`, `docs/contract-lifecycle-design.md`.

---

## Recommended order across all four projects

The priority ranking given (Conversation, Assets, Calendar, Lead Lifecycle) is the right *importance* ranking. The recommended *build* order differs slightly, for one dependency reason worth surfacing before agreeing to anything:

**1. Lead Lifecycle → 2. Calendar → 3. Conversation (v1, text-only) → 4. Assets → 5. Conversation attachments (retrofit onto Assets)**

Reasoning: Lead Lifecycle and Calendar are both small, contained, and share a root cause (the `tour_appointments` vs. `leads.tour_date` split feeds both TR-B4 and Lead scoring) — doing them first is a quick, low-risk way to open Program 2 with wins before the two large projects. Conversation and Assets are the two big ones; building them in strict priority order would mean building Conversation's message-attachment storage once now and migrating it to the Asset model later, which is exactly the kind of self-inflicted fragmentation Program 2 exists to avoid. Recommendation: build Conversation's core (Conversation, Message, Channel — no attachments) first, matching its stated priority, explicitly deferring attachments as a fast-follow once Assets exists to attach onto. If attachment volume in the current systems is high enough that this deferral is impractical, say so and Assets moves ahead of Conversation instead — flagging this as the one open sequencing question in this plan.

---

## 1. Conversation

### Target architecture
- **`conversations`** — one row per venue-to-person relationship. `venue_id`, and exactly one of `client_id` or `vendor_relationship_id` (check constraint), `status`, `last_message_at`, `created_at`. Vendor conversations are modeled from day one (nullable column, unused until Vendor messaging is built) so a second migration isn't needed later — this is the same "don't build a second door" lesson as Engineering Standard #5, applied to schema design instead of a security gate.
- **`conversation_messages`** — one row per message, any channel. `conversation_id`, `sender_type` (`venue_staff`/`client`/`contact`/`vendor`), `sender_id`, `channel` (`email`/`sms`/`portal`/`internal_note`/`phone_log`/`voicemail`/`push`, extensible), `body`, `body_html` (email only), `channel_metadata` (jsonb — provider IDs, phone numbers, whatever is channel-specific, so adding a channel doesn't mean a schema migration), `sent_at`, per-party read timestamps.
- **`conversation_message_events`** — replaces `message_events`; delivery/bounce/open/click tracking, one row per event, referencing `conversation_messages`.
- No separate `channels` table — channel is a property of a message, not an object with its own lifecycle. This matches the Domain Model's framing exactly: "channels are transports," not entities.

### Migration strategy
1. Create the new tables, RLS from day one using `current_user_venue_id()` (never repeat TR-C2's `owner_user_id`-only mistake).
2. Write a one-time backfill: for every `client_id` with rows in either `message_threads`/`messages` or `couple_threads`/`couple_messages`, create one `conversations` row; migrate `messages` rows in as `channel='email'`, `couple_messages` rows in as `channel='portal'`; merge by `created_at` so the resulting conversation is genuinely chronological across both origins.
3. Build `lib/conversations/repository.ts`/`service.ts` (real repository/service layering — TR-C2's couple-chat side skipped this; don't repeat that either) and the RPCs the couple portal needs (token-authenticated, mirroring `get_portal_context`).
4. Cut the UI over: the coordinator's Client-detail "Messages" tab and the main-nav "Messaging" inbox become one Conversation view; the couple portal's message view becomes the couple-facing window into the same data.
5. Keep the old tables, renamed (`_deprecated` suffix or moved to an archive schema), for one full release cycle before dropping — a safety window, not a permanent second system.
6. Decommission `message_threads`/`messages`/`couple_threads`/`couple_messages` once verified.

### Order of implementation
Schema + RLS → repository/service layer → backfill script (tested against a copy of real data first) → couple-portal RPCs → coordinator UI cutover → couple portal UI cutover → deprecate old tables → (later, once Assets exists) attachments.

### Expected risks
- **Backfill correctness** is the main risk — two independently-timestamped tables need to interleave into one true chronology. Test with the same rolled-back-transaction discipline used throughout Program 1, on real (copied) data, before running against production.
- **RLS/access-level parity** — the couple-portal side must check `client_portal_sessions.access_level`/`client_contacts.portal_role` from day one; TR-G4 was exactly this check being added late to four RPCs. Build it in from the start here instead of retrofitting.
- **UI consolidation effort** — coordinators are used to two separate surfaces; merging them is a real workflow change, not just a backend refactor. Worth a short internal dogfooding pass before wide release.
- **Vendor messaging scope creep** — the schema supports it, but building the vendor-facing UI is explicitly out of scope for this pass unless the venue owner wants to pull it in.

### Opportunities to simplify
- Retires two full systems (tables, RLS, RPCs, UI) down to one.
- `channel_metadata` jsonb means adding SMS later is a code change, not a schema migration.
- Attachments, once Assets exists, are just Assets linked to a message — no bespoke attachment table to maintain.

### Trust Risks closed
- **TR-C1** (fragmentation) — this project is the fix, by definition.
- Re-verifies TR-C2's venue-resolution and webhook-reliability fixes carry over correctly into the new schema (regression check, not a new risk).
- New RLS/access-level checks should be verified with the same "real per-role session, not superuser" test technique as TR-G1/TR-G4, before this is considered closed.

---

## 2. Assets

### Target architecture
- **`assets`** — the generic registry: `id`, `venue_id`, `type` (`floor_plan`/`insurance`/`permit`/`pdf`/`image`/`questionnaire_response`/`other` — extensible enum), `visibility` (an array or a join table of `venue`/`couple`/`vendor`/`planner`/`family` — see risk note below), `linked_to_type` + `linked_to_id` (`event`/`client`/`venue`/`vendor`), `storage_url`, `version_number`, `parent_asset_id`, `is_current`, `created_by`, timestamps.
- **Contract and Invoice stay their own dedicated tables**, per `docs/domain-model.md`'s explicit framing — their legal/financial guarantees (immutability, balance recomputation) are too specific to generalize into a flat asset row without weakening them. They become part of the Asset *family* conceptually, joined into unified views, not literally rows in `assets`.
- **A single sanctioned "all assets for X" view** (`get_client_assets`, `get_venue_assets`) that unions `assets` + `contracts` + `invoices` — replacing `get_couple_documents`'s hand-written UNION with a real, visibility-aware one. This view is the *only* place "all assets" is assembled; nothing else is allowed to reassemble it independently (this is the specific discipline that prevents Assets from becoming a second instance of the exact fragmentation it's meant to fix).
- **Floor Plans keep their structured detail tables** (`floor_plans`/`floor_plan_objects` — a canvas isn't a flat file), but gain one `assets` registry row (`type='floor_plan'`) so they appear in unified listings and exports without forcing their editable canvas data into a shape it doesn't fit.

### Migration strategy
1. Create `assets` + the visibility model + RLS (dual-enforced: service-layer check and RLS policy, per Engineering Standard #3).
2. Backfill from `documents` (venue-side) and `couple_documents` (couple-side), mapping the old boolean `share_with_venue` onto the richer visibility set.
3. Create one Asset registry row per existing Floor Plan.
4. Build the unified `get_client_assets`/`get_venue_assets` views/RPCs.
5. Cut the couple portal's Documents tab and the venue-side Documents UI over to the new views.
6. Extend `get_venue_export` (TR-G2) to include `assets` — closing the gap the audit found (a venue's actual uploaded files are currently absent from "your data").
7. Retire `documents`/`couple_documents` after a safety window.

### Order of implementation
Schema + RLS → backfill → Floor Plan registry rows → unified views → UI cutover (couple side, then venue side) → extend TR-G2 export → deprecate old tables. Do this *after* Conversation's core ships (see top-level sequencing), so Conversation's later attachment work lands directly on the finished Asset model instead of a half-built one.

### Expected risks
- **Visibility model complexity** — five visibility values (venue/couple/vendor/planner/family) is a real step up from today's single boolean; get the RLS shape right before backfilling data into it, since fixing a wrong visibility model after data exists is much more disruptive than before.
- **Storage-path migration** — moving records between tables must not break existing Supabase Storage URLs already referenced elsewhere (emails sent, printed PDFs, etc.).
- **Contract/Invoice drift risk** — the union view must be the only path; if a future feature reassembles "all documents" by querying `contracts`+`invoices`+`assets` independently instead of through the sanctioned view, Assets has silently reproduced the exact fragmentation pattern it was built to close (Engineering Standard #9). Worth a code-review checklist item once this ships.

### Opportunities to simplify
- Three-to-four document-shaped systems (`documents`, `couple_documents`, the hand-written couple-portal UNION, Floor Plans' isolation) become one registry with one real visibility model.
- Closes the `documents.category='contract'` misleading-affordance the audit found (a venue-uploaded "contract" document that silently never reaches the couple) — visibility becomes an explicit, honest choice instead of an accident of which table something landed in.

### Trust Risks closed
- The `documents.category='contract'` Transparency gap (found in the audit, not yet a numbered Trust Risk — recommend registering and closing it as part of this work, e.g. as a new item under Governance or Legal depending on final categorization).
- Extends TR-G2 (Data Export) to genuinely include a venue's uploaded files — arguably closes a residual piece of that promise rather than opening a new risk.
- Recommend folding in the audit's Floor Plan finding (no role restriction on `clearFloorPlan`/`deleteObject_` — any staff role can wipe an entire floor plan, same shape as TR-M5 before its fix) as a small, related fix in this same pass: gate those actions to Owner/Manager, matching the established permissions model.

---

## 3. Calendar

### Target architecture
Calendar owns nothing — it's confirmed as a pure projection in the Domain Model, and the fix here is structural, not additive. Instead of `lib/calendar/service.ts`'s `getCalendarData` reaching directly into seven source tables (several of which it doesn't otherwise own or understand), each owning domain exposes its *own* calendar-projection function — e.g. `lib/tours/service.ts` gains `getTourCalendarEntries(venueId, range)`, `lib/payments/service.ts` gains `getPaymentDueCalendarEntries(...)`, and so on. The Calendar service becomes pure composition: call each domain's projection, merge, sort, return. This is the direct structural fix for what TR-B4 actually was — the calendar reached into `leads.tour_date` instead of asking the tours domain "what's happening," which is exactly why it silently fell out of sync when `tour_appointments` became the real source.

### Migration strategy
1. Fix TR-B4 concretely first, in place: change the "tour" source to read `tour_appointments`. This alone closes the registered Trust Risk and can ship independently of the larger refactor.
2. Fix the audit's `date_holds.expires_at` finding alongside it: filter `expires_at is null or expires_at > now()` at query time (a one-line fix that closes the visible symptom immediately, ahead of any future real hold-expiry processing job).
3. Refactor the other five sources (events, follow-ups, payments due, key dates, calendar blocks) from inline queries into each owning domain's own projection function — this is a pure refactor of already-correct logic, low risk, done to establish the pattern before new sources are added.
4. Add new sources per the adopted vision (vendor arrivals, staff schedules, walkthroughs, planning milestones) as their owning domains are built out — not blocking, can trail behind.

### Order of implementation
TR-B4 fix → `date_holds` expiry fix → refactor existing 5 sources into the projection pattern → new sources added opportunistically as their owning Program 2 work lands (e.g., a vendor-arrival projection falls naturally out of Vendor work, if that's ever prioritized).

### Expected risks
- **Refactor churn on a high-visibility feature** — Calendar is used constantly; the projection refactor touches working code. Mitigate with the same before/after rolled-back-transaction tests used for TR-B1/TR-B4.
- **Query performance** — composing N domain-owned queries instead of 7 inline ones must not turn into N+1 queries; each domain's projection function should still be one efficient query, batched the same way the current implementation is.

### Opportunities to simplify
- Calendar's own service code shrinks to composition + sort; it stops needing to understand every other domain's schema.
- Adding a new calendar source in the future is "implement this one function in the owning domain," not "edit calendar/service.ts and hope nothing else needs to change."

### Trust Risks closed
- **TR-B4** (Identified → Resolved).
- Recommend registering the `date_holds.expires_at` non-enforcement as its own small Trust Risk (Booking category, likely TR-B5) and closing it in the same pass — it's a real "the system appears to expire holds but doesn't" gap, the same shape as everything else in this register, just not yet given an ID.

---

## 4. Lead Lifecycle

### Target architecture
One canonical Lead per real person, regardless of entry point. The mechanism is a shared `findOrCreateLead(venueId, {email, phone, name})` used by *every* creation path — public inquiry, tour booking, manual entry, CSV import, and any future source (Facebook, The Knot, WeddingWire). It matches an existing Lead by email first (the reliable signal), attaches the new interaction as an Activity on the existing record, and only creates a new Lead when no match exists.

### Migration strategy
1. Build `findOrCreateLead` in `lib/leads/service.ts`, and its SQL equivalent (`find_or_create_lead()`) for the two public, unauthenticated entry points that run as `SECURITY DEFINER` RPCs (`create_public_lead`, `book_tour`), since those can't call back into the TS service layer.
2. Wire it into the two automatic/public entry points first — this is where the actual gap was found, and it's the highest-value fix.
3. Wire it into manual-create and CSV import, with an explicit "this looks like an existing lead — use it or create new?" prompt in the UI for these more deliberate paths, rather than silently merging (a human is already in the loop here, unlike the automatic paths).
4. Fix Lead commitment scoring to read `tour_appointments` instead of `leads.tour_date` — the same TR-B4-shaped bug, found independently in `lib/leads/scores.ts` during the audit.
5. One-time backfill: identify existing same-venue, same-email duplicate Leads and merge them (combining notes/tasks/activities, choosing the older record as primary) — run against a copied dataset first, reversibly, before touching production data.

### Order of implementation
`findOrCreateLead` core logic → wire into inquiry form + tour booking (the two automatic paths, highest value) → lead-scoring `tour_appointments` fix (small, independent, can land any time after step 1) → wire into manual-create/CSV import with the UI prompt → backfill/merge script for existing duplicates, last, once the forward-going logic is proven.

### Expected risks
- **False-positive matching** — a shared family email address could incorrectly merge two different couples. Mitigate: match on email within the same venue only, and never silently merge on the manual/CSV paths — only the automatic public paths merge without a human prompt, since those are exactly the case the gap was found in.
- **Backfill risk** — merging historical records is inherently higher-stakes than preventing new duplicates. Full backup, dry run, reversible, before running for real.
- **SQL-side logic in `SECURITY DEFINER` RPCs is harder to test than TypeScript** — needs the same rolled-back-transaction discipline as every other RLS/RPC change this session.

### Opportunities to simplify
- Once "one Lead per person" is a real invariant, every future feature that touches Lead identity (activation scoring, playbook triggers, and the new Conversation model once Leads get their own pre-Client conversation) can assume it rather than working around possible duplicates.

### Trust Risks closed
- None directly — this remains, by the venue owner's own earlier decision, a Program 2 architecture objective rather than a Trust Risk. The `tour_appointments` lead-scoring fix is the same bug shape as TR-B4 but wasn't separately registered; worth a one-line mention in the register when this ships, for completeness, even though it doesn't need its own dramatic writeup.

---

## 5. Cohesion Before Features — how this gets enforced, not just stated

This isn't a build item; it's a standing review discipline for the rest of Program 2. Concretely:

- Before any new table, service, or workflow is introduced during Program 2, check it against `docs/domain-model.md` first — does this map to an existing entity, or does it look like a new one? If it maps to an existing entity, extend that entity's existing implementation rather than starting a parallel one (this is the literal mechanism that produced TR-C1/TR-G3/the Documents fragmentation — a reasonable-seeming new table built next to an existing concept instead of extending it).
- Every Program 2 pull request/change should be able to answer, in its own description: which Domain Model entity does this touch, does it reduce or add to the number of places that entity's canonical fact lives, and which Engineering Standard (particularly #7 and #9) is most relevant to keep in mind.
- Where a genuinely new capability is proposed that doesn't map to any of the 15 entities in the Domain Model, that's the trigger to update the Domain Model itself first, deliberately, rather than let a 16th unmodeled concept accumulate quietly.

---

## Summary table

| Priority | Size | Depends on | Trust Risks closed |
|---|---|---|---|
| Lead Lifecycle | Small | None | (none directly — Program 2 objective, per earlier decision) |
| Calendar | Small–Medium | None | TR-B4; new TR-B5 (`date_holds` expiry) recommended |
| Conversation (core) | Large | None | TR-C1 |
| Assets | Large | Conversation core (for attachment sequencing only) | New Documents-category item recommended; extends TR-G2; Floor Plan role-gate fix |
| Conversation (attachments) | Small | Assets | — |

One open question for you: **should Assets move ahead of Conversation** given the attachment dependency, or is deferring Conversation's attachments to a fast-follow (as recommended above) the right trade against shipping the higher-priority Conversation core sooner? Everything else in this plan can proceed regardless of how that's resolved.
