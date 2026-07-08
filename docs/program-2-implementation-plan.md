# Program 2 Implementation Plan — Coherence, Not Features

**Status:** Agreed 2026-07-08 — approved with refinements, implementation underway. Phase order and working principles below are the final agreed structure, superseding the original "recommended order" draft.
**Date:** 2026-07-08 (proposed) / 2026-07-08 (agreed)
**Objective (stated by the venue owner):** Program 1 was about trust. Program 2 is about coherence — aligning the implementation with `docs/domain-model.md` and reducing the codebase to fewer, stronger concepts rather than adding new ones. Every decision is checked against four questions: does this align with the Domain Model, does it reinforce the Product Promise, does it follow the Engineering Standards, and does it reduce fragmentation or increase it.
**Reads on:** `docs/domain-model.md` (the target concepts), `docs/architecture-audit.md` (where today's implementation diverges from them), `docs/trust-risk-register.md`, `docs/engineering-standards.md`, `docs/contract-lifecycle-design.md`.

---

## Agreed phase structure

**Phase 1 — Canonical Lead Lifecycle + Calendar Backbone.** Contained, closes real Trust Risk Register items (TR-B4, and a newly-registered `date_holds.expires_at` gap), and establishes two principles many later systems depend on: every entry point resolves into one Lead lifecycle; Calendar is a projection of canonical data, never its own source of truth. `date_holds.expires_at` enforcement is included here — same temporal-scheduling architecture, same pass.

**Phase 2 — Conversation Foundation.** Conversation, Participants, Messages, Channels, Delivery status, Conversation timeline. **No attachments yet** — the goal is establishing Conversation as the canonical communication model before documents move through it.

**Phase 3 — Asset Foundation.** The unified home for contracts, invoices, questionnaires, floor plans, PDFs, images, COIs, permits, timelines, uploaded files, and future document types. The Floor Plan delete-guard Trust Risk gap closes in this same phase, since it's the same area of work, not unrelated.

**Phase 4 — Conversation + Assets Integration.** Retrofit attachments into Conversation using the Asset model, once both foundations exist. Conversation references Assets — it never owns them.

## Working principles for all four phases

1. **Replace, don't layer.** When a new canonical model is established, the old implementation is actively retired, not left to accumulate alongside it.
2. **One migration at a time**, per subsystem: establish the canonical model → migrate existing functionality → remove the legacy implementation → update documentation. Then move to the next subsystem.
3. **Every phase leaves the repository simpler than it found it.** Measured by fewer duplicate concepts, fewer sources of truth, fewer integration points, clearer ownership, simpler mental models — not lines of code or features shipped.
4. **An Architecture Delta accompanies every completed phase**: what became canonical, what legacy systems were removed, what sources of truth were eliminated, what Trust Risks closed, what complexity was reduced. Program 2 is measured by simplification, not just delivery.

---

## Phase 1a — Lead Lifecycle

### Target architecture
One canonical Lead per real person, regardless of entry point. The mechanism is a shared `findOrCreateLead(venueId, {email, phone, name})` used by *every* creation path — public inquiry, tour booking, manual entry, CSV import, and any future source (Facebook, The Knot, WeddingWire). It matches an existing Lead by email first (the reliable signal), attaches the new interaction as an Activity on the existing record, and only creates a new Lead when no match exists.

**Tour scheduling itself is unified as part of this phase, not deferred to Calendar's fix.** Today two mechanisms represent "this lead has a tour": `tour_appointments` (written by the public booking widget) and `leads.tour_date`/`tour_time`/`tour_completed` (written by a coordinator manually scheduling a tour by phone). Per "replace, don't layer," the fix isn't teaching Calendar and Lead scoring to check two places — it's making every tour-scheduling path, manual or automatic, write to `tour_appointments`, so it becomes the single real answer to "does this lead have a tour" regardless of how it was booked. `leads.tour_date`/`tour_time` become read-only denormalized display fields kept in sync automatically (or are retired outright once every reader has moved to `tour_appointments`).

### Migration strategy
1. Build `findOrCreateLead` in `lib/leads/service.ts`, and its SQL equivalent (`find_or_create_lead()`) for the two public, unauthenticated entry points that run as `SECURITY DEFINER` RPCs (`create_public_lead`, `book_tour`), since those can't call back into the TS service layer.
2. Wire it into the two automatic/public entry points first — this is where the actual gap was found, and it's the highest-value fix.
3. Wire it into manual-create and CSV import, with an explicit "this looks like an existing lead — use it or create new?" prompt in the UI for these more deliberate paths, rather than silently merging (a human is already in the loop here, unlike the automatic paths).
4. Unify tour scheduling: the manual "schedule a tour" coordinator action starts writing a real `tour_appointments` row instead of (or in addition to, transitionally) `leads.tour_date`.
5. Fix Lead commitment scoring to read `tour_appointments` instead of `leads.tour_date` — the same TR-B4-shaped bug, found independently in `lib/leads/scores.ts` during the audit.
6. Retire `leads.tour_date`/`tour_time`/`tour_completed` as writable fields once every reader and writer has moved to `tour_appointments` — replace, don't layer.
7. One-time backfill: identify existing same-venue, same-email duplicate Leads and merge them (combining notes/tasks/activities, choosing the older record as primary), and backfill a `tour_appointments` row for any lead whose only tour record today is the legacy `leads.tour_date` fields — run against a copied dataset first, reversibly, before touching production data.

### Order of implementation
`findOrCreateLead` core logic → wire into inquiry form + tour booking (the two automatic paths, highest value) → unify manual tour scheduling onto `tour_appointments` → lead-scoring fix → wire dedup into manual-create/CSV import with the UI prompt → backfill/merge script for existing duplicates and legacy tour records, last, once the forward-going logic is proven → retire the legacy `leads.tour_date` write paths.

### Expected risks
- **False-positive matching** — a shared family email address could incorrectly merge two different couples. Mitigate: match on email within the same venue only, and never silently merge on the manual/CSV paths — only the automatic public paths merge without a human prompt, since those are exactly the case the gap was found in.
- **Backfill risk** — merging historical records, and backfilling tour appointments from legacy fields, is inherently higher-stakes than preventing new duplicates. Full backup, dry run, reversible, before running for real.
- **SQL-side logic in `SECURITY DEFINER` RPCs is harder to test than TypeScript** — needs the same rolled-back-transaction discipline as every other RLS/RPC change this session.

### Opportunities to simplify
- Once "one Lead per person" is a real invariant, every future feature that touches Lead identity (activation scoring, playbook triggers, and the new Conversation model once Leads get their own pre-Client conversation) can assume it rather than working around possible duplicates.
- Retiring `leads.tour_date`/`tour_completed` as a parallel writable concept removes one whole category of "which one is true" question from the codebase — exactly the Engineering Standard #7/#9 pattern this phase exists to close.

### Trust Risks closed
- None directly by the dedup work itself — that remains, by the venue owner's own earlier decision, a Program 2 architecture objective rather than a Trust Risk. The `tour_appointments` lead-scoring fix is the same bug shape as TR-B4; worth a one-line mention in the register when this ships, for completeness, even though it doesn't need its own dramatic writeup.

---

## Phase 1b — Calendar Backbone

### Target architecture
Calendar owns nothing — it's confirmed as a pure projection in the Domain Model, and the fix here is structural, not additive. Instead of `lib/calendar/service.ts`'s `getCalendarData` reaching directly into seven source tables (several of which it doesn't otherwise own or understand), each owning domain exposes its *own* calendar-projection function — e.g. `lib/tours/service.ts` gains `getTourCalendarEntries(venueId, range)`, `lib/payments/service.ts` gains `getPaymentDueCalendarEntries(...)`, and so on. The Calendar service becomes pure composition: call each domain's projection, merge, sort, return. This is the direct structural fix for what TR-B4 actually was — the calendar reached into `leads.tour_date` instead of asking the tours domain "what's happening," which is exactly why it silently fell out of sync when `tour_appointments` became the real source.

`date_holds.expires_at` enforcement is included in this phase — same temporal-scheduling architecture, same pass, per the venue owner's instruction.

### Migration strategy
1. Fix TR-B4 concretely first, in place: change the "tour" source to read `tour_appointments` (now the single canonical source, per Phase 1a). This alone closes the registered Trust Risk and can ship independently of the larger refactor.
2. Fix `date_holds.expires_at`: filter `expires_at is null or expires_at > now()` at query time (a one-line fix that closes the visible symptom immediately, ahead of any future real hold-expiry processing job) — register this as a new Trust Risk (TR-B5) and close it in the same pass.
3. Refactor the other five sources (events, follow-ups, payments due, key dates, calendar blocks) from inline queries into each owning domain's own projection function — this is a pure refactor of already-correct logic, low risk, done to establish the pattern before new sources are added.
4. Add new sources per the adopted vision (vendor arrivals, staff schedules, walkthroughs, planning milestones) as their owning domains are built out — not blocking, can trail behind.

### Order of implementation
TR-B4 fix (depends on Phase 1a's tour unification) → `date_holds` expiry fix (TR-B5) → refactor existing 5 sources into the projection pattern → new sources added opportunistically as their owning Program 2 work lands.

### Expected risks
- **Refactor churn on a high-visibility feature** — Calendar is used constantly; the projection refactor touches working code. Mitigate with the same before/after rolled-back-transaction tests used for TR-B1/TR-B4.
- **Query performance** — composing N domain-owned queries instead of 7 inline ones must not turn into N+1 queries; each domain's projection function should still be one efficient query, batched the same way the current implementation is.

### Opportunities to simplify
- Calendar's own service code shrinks to composition + sort; it stops needing to understand every other domain's schema.
- Adding a new calendar source in the future is "implement this one function in the owning domain," not "edit calendar/service.ts and hope nothing else needs to change."

### Trust Risks closed
- **TR-B4** (Identified → Resolved).
- **TR-B5** (new — `date_holds.expires_at` non-enforcement, Booking category) — Identified and Resolved in the same pass.

---

## Phase 2 — Conversation Foundation

### Target architecture
- **`conversations`** — one row per venue-to-person relationship. `venue_id`, and exactly one of `client_id` or `vendor_relationship_id` (check constraint), `status`, `last_message_at`, `created_at`. Vendor conversations are modeled from day one (nullable column, unused until Vendor messaging is built) so a second migration isn't needed later — this is the same "don't build a second door" lesson as Engineering Standard #5, applied to schema design instead of a security gate.
- **`conversation_participants`** — one row per person who can see/send into a conversation (a venue Team Member, a Client, a Contact, a Vendor), so "who's in this conversation" is explicit rather than inferred.
- **`conversation_messages`** — one row per message, any channel. `conversation_id`, `sender_type` (`venue_staff`/`client`/`contact`/`vendor`), `sender_id`, `channel` (`email`/`sms`/`portal`/`internal_note`/`phone_log`/`voicemail`/`push`, extensible), `body`, `body_html` (email only), `channel_metadata` (jsonb — provider IDs, phone numbers, whatever is channel-specific, so adding a channel doesn't mean a schema migration), `sent_at`, per-party read timestamps.
- **`conversation_message_events`** — replaces `message_events`; delivery/bounce/open/click tracking, one row per event, referencing `conversation_messages`.
- No separate `channels` table — channel is a property of a message, not an object with its own lifecycle. This matches the Domain Model's framing exactly: "channels are transports," not entities.
- **No attachments this phase** — by explicit agreement, attachments are retrofitted in Phase 4 once the Asset model exists in Phase 3.

### Migration strategy
1. Create the new tables, RLS from day one using `current_user_venue_id()` (never repeat TR-C2's `owner_user_id`-only mistake).
2. Write a one-time backfill: for every `client_id` with rows in either `message_threads`/`messages` or `couple_threads`/`couple_messages`, create one `conversations` row; migrate `messages` rows in as `channel='email'`, `couple_messages` rows in as `channel='portal'`; merge by `created_at` so the resulting conversation is genuinely chronological across both origins.
3. Build `lib/conversations/repository.ts`/`service.ts` (real repository/service layering — TR-C2's couple-chat side skipped this; don't repeat that either) and the RPCs the couple portal needs (token-authenticated, mirroring `get_portal_context`).
4. Cut the UI over: the coordinator's Client-detail "Messages" tab and the main-nav "Messaging" inbox become one Conversation view; the couple portal's message view becomes the couple-facing window into the same data.
5. Retire `message_threads`/`messages`/`couple_threads`/`couple_messages` once verified — replace, don't layer. A short safety window (one release cycle, tables renamed/archived, not left live) is acceptable; an indefinite parallel system is not.

### Order of implementation
Schema + RLS → repository/service layer → backfill script (tested against a copy of real data first) → couple-portal RPCs → coordinator UI cutover → couple portal UI cutover → retire old tables.

### Expected risks
- **Backfill correctness** is the main risk — two independently-timestamped tables need to interleave into one true chronology. Test with the same rolled-back-transaction discipline used throughout Program 1, on real (copied) data, before running against production.
- **RLS/access-level parity** — the couple-portal side must check `client_portal_sessions.access_level`/`client_contacts.portal_role` from day one; TR-G4 was exactly this check being added late to four RPCs. Build it in from the start here instead of retrofitting.
- **UI consolidation effort** — coordinators are used to two separate surfaces; merging them is a real workflow change, not just a backend refactor. Worth a short internal dogfooding pass before wide release.
- **Vendor messaging scope creep** — the schema supports it, but building the vendor-facing UI is explicitly out of scope for this pass unless the venue owner wants to pull it in.

### Opportunities to simplify
- Retires two full systems (tables, RLS, RPCs, UI) down to one.
- `channel_metadata` jsonb means adding SMS later is a code change, not a schema migration.

### Trust Risks closed
- **TR-C1** (fragmentation) — this project is the fix, by definition.
- Re-verifies TR-C2's venue-resolution and webhook-reliability fixes carry over correctly into the new schema (regression check, not a new risk).
- New RLS/access-level checks should be verified with the same "real per-role session, not superuser" test technique as TR-G1/TR-G4, before this is considered closed.

---

## Phase 3 — Asset Foundation

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
7. Retire `documents`/`couple_documents` — replace, don't layer.
8. Close the Floor Plan delete-guard Trust Risk in this same phase: gate `clearFloorPlan`/`deleteObject_` to Owner/Manager, matching the established permissions model (same shape as TR-M5 before its fix).

### Order of implementation
Schema + RLS → backfill → Floor Plan registry rows → unified views → UI cutover (couple side, then venue side) → extend TR-G2 export → Floor Plan delete-guard fix → retire old tables. Begins after Phase 2 ships, so Conversation's later attachment work (Phase 4) lands directly on the finished Asset model instead of a half-built one.

### Expected risks
- **Visibility model complexity** — five visibility values (venue/couple/vendor/planner/family) is a real step up from today's single boolean; get the RLS shape right before backfilling data into it, since fixing a wrong visibility model after data exists is much more disruptive than before.
- **Storage-path migration** — moving records between tables must not break existing Supabase Storage URLs already referenced elsewhere (emails sent, printed PDFs, etc.).
- **Contract/Invoice drift risk** — the union view must be the only path; if a future feature reassembles "all documents" by querying `contracts`+`invoices`+`assets` independently instead of through the sanctioned view, Assets has silently reproduced the exact fragmentation pattern it was built to close (Engineering Standard #9). Worth a code-review checklist item once this ships.

### Opportunities to simplify
- Three-to-four document-shaped systems (`documents`, `couple_documents`, the hand-written couple-portal UNION, Floor Plans' isolation) become one registry with one real visibility model.
- Closes the `documents.category='contract'` misleading-affordance the audit found (a venue-uploaded "contract" document that silently never reaches the couple) — visibility becomes an explicit, honest choice instead of an accident of which table something landed in.

### Trust Risks closed
- The `documents.category='contract'` Transparency gap (found in the audit, not yet a numbered Trust Risk — register and close it as part of this work).
- Extends TR-G2 (Data Export) to genuinely include a venue's uploaded files.
- The Floor Plan delete-guard gap (no role restriction on `clearFloorPlan`/`deleteObject_`, same shape as TR-M5 before its fix) — register and close in this same pass.

---

## Phase 4 — Conversation + Assets Integration

Once Phases 2 and 3 both exist: retrofit attachments into Conversation by referencing Assets, never owning them. A `conversation_message_id` becomes a valid `linked_to_type`/`linked_to_id` target for an Asset row (or a lightweight join table `conversation_message_assets(message_id, asset_id)` if a message can carry more than one attachment). No new attachment storage system — this phase is pure integration, and should be small precisely because Phases 2 and 3 did their jobs correctly.

---

## Working Principle — Cohesion Before Features (applies throughout all phases)

This isn't a build item; it's a standing review discipline for the whole of Program 2. Concretely:

- Before any new table, service, or workflow is introduced, check it against `docs/domain-model.md` first — does this map to an existing entity, or does it look like a new one? If it maps to an existing entity, extend that entity's existing implementation rather than starting a parallel one (this is the literal mechanism that produced TR-C1/TR-G3/the Documents fragmentation — a reasonable-seeming new table built next to an existing concept instead of extending it).
- Every Program 2 change should be able to answer: which Domain Model entity does this touch, does it reduce or add to the number of places that entity's canonical fact lives, and which Engineering Standard (particularly #7 and #9) is most relevant to keep in mind.
- Where a genuinely new capability is proposed that doesn't map to any of the 15 entities in the Domain Model, that's the trigger to update the Domain Model itself first, deliberately, rather than let a 16th unmodeled concept accumulate quietly.

---

## Summary table

| Phase | Contains | Depends on | Trust Risks closed |
|---|---|---|---|
| 1a — Lead Lifecycle | ✅ Substantially complete 2026-07-08 — canonical Lead dedup across the two public entry points; tour-scheduling unified onto `tour_appointments`, legacy columns dropped. Manual-create/CSV dedup deferred (see `docs/architecture-delta-phase-1.md`) | None | (none directly — enables 1b's TR-B4 fix) |
| 1b — Calendar Backbone | ✅ Core complete 2026-07-08 — TR-B4/TR-B5 fixed, tours' own calendar projection established. Refactoring the other 5 sources into the same pattern is a lower-urgency fast-follow | Phase 1a (tour unification) | TR-B4; TR-B5 (new) |
| 2 — Conversation Foundation | Conversation, Participants, Messages, Channels, Delivery status, timeline — no attachments | None | TR-C1 |
| 3 — Asset Foundation | Unified Asset model (contracts/invoices stay first-class, join via a sanctioned view); Floor Plan registry rows | Phase 2 (sequencing only) | Documents `category='contract'` gap; extends TR-G2; Floor Plan delete-guard fix |
| 4 — Conversation + Assets Integration | Retrofit attachments onto Assets; Conversation references, never owns | Phases 2 and 3 | — |

Each phase closes with an Architecture Delta (what became canonical, what legacy systems were removed, what sources of truth were eliminated, what Trust Risks closed, what complexity was reduced) before the next phase begins. Phase 1's delta: `docs/architecture-delta-phase-1.md`.
