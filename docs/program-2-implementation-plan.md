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

## North Star (sits above all working principles below, adopted 2026-07-21)

**Every completed Program 2 phase should reduce cognitive load for the venue owner.** The architecture is allowed to become more sophisticated with every phase; the product experience must become simpler with every phase. Wevenu's customers are barn owners, farm owners, winery owners, family businesses, independent venues — not technical users. They think "I got a lead," "I'm trying to book them," "I'm planning their event," "I'm running event day" — never "Relationship," "Opportunity," "Conversation," "Asset." Internal correctness is necessary but never sufficient; if a phase is architecturally right but makes the day-to-day experience busier or more confusing, it isn't done yet.

## Working principles for all four phases

1. **Replace, don't layer.** When a new canonical model is established, the old implementation is actively retired, not left to accumulate alongside it.
2. **One migration at a time**, per subsystem: establish the canonical model → migrate existing functionality → remove the legacy implementation → update documentation. Then move to the next subsystem.
3. **Every phase leaves the repository simpler than it found it.** Measured by fewer duplicate concepts, fewer sources of truth, fewer integration points, clearer ownership, simpler mental models — not lines of code or features shipped.
4. **An Architecture Delta accompanies every completed phase**, and now answers one question above all others: **how did this phase make the product simpler for a venue owner?** Not just what became canonical, what duplicate concepts disappeared, what Trust Risks closed, and what future optionality it enables — those describe internal health. The venue-owner-simplicity question is the real measure of Program 2 success and is answered first, not appended as an afterthought.
5. **The venue should experience customers, not architecture.** Relationship, Opportunity, Conversation, and Asset are the correct internal model — but the target is a single **Relationship Workspace** a coordinator naturally opens for "Emma & James," not a set of screens being replaced one at a time. Every remaining phase is checked against whether it strengthens that one workspace, not just whether it's internally correct. The term "Relationship Workspace" is an internal design target — venues are never expected to see or use that word; their vocabulary stays "Emma & James," "this booking," "this event." See `docs/product-completion-roadmap.md` principle 5 and `docs/conversation-experience-cutover.md`.
6. **Progressive disclosure.** Show a venue only what it needs right now; reveal additional complexity only when asked for. The platform underneath keeps getting more sophisticated — the experience should get calmer and more obvious with every phase, never busier. See `docs/product-completion-roadmap.md` principle 6.

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

**Target architecture superseded twice** — first by `docs/conversation-lifecycle-design.md` (lifecycle-first modeling, replacing this section's original transport-first sketch), then by `docs/lead-identity-architectural-exploration.md` (the anchor moved one level higher again, from Lead to a new enduring Relationship concept). Corrections binding here, in order:

- **`conversations` anchors to `relationship_id`** (references a new `venue_customer_relationships` table), or `vendor_relationship_id` for vendor conversations — not `client_id`, not `lead_id`. Lead now represents one Opportunity; a customer relationship can have more than one Opportunity over time (a wedding, then an anniversary party; a corporate account rebooking annually), so anchoring any lower than the Relationship itself would fork or require reattaching the conversation each time a returning customer opened a new Opportunity.
- **No `status` column on `conversations`.** A relationship doesn't "close" the way a support ticket does — dormancy/activity is computed at read time from `last_message_at` and the linked Relationship/Lead's own status, the same projection discipline Calendar Entry established in Phase 1. A Conversation is provisioned automatically alongside its Relationship (or vendor relationship), never explicitly created or "reopened."
- **Minimal scope for the Relationship concept itself, per explicit agreement:** `venue_customer_relationships` is built now only as the enduring anchor Conversation (and future Activity History) needs — matched by email, same heuristic `find_lead_by_email` already uses. Broader account modeling (multiple contacts per relationship as first-class, Contact's scope moving from Client to Relationship, when a Relationship's repeat contact should open a fresh Opportunity vs. reuse an existing Lead) is explicitly deferred until there's a concrete need. A longer-term question — whether this eventually becomes a global Relationship identity with venue-scoped relationships beneath it, mirroring `vendors`/`venue_vendor_relationships` — is deliberately not being built now; the minimal design doesn't foreclose it (any future global parent is a purely additive column/table addition, provided FKs reference `venue_customer_relationships.id` rather than a natural key, which is already the plan) but is a separate, more sensitive decision than it was for Vendor, since customers haven't opted into cross-venue identity correlation the way vendors do by claiming a discoverable profile.

Full reasoning, the Participants/multi-person model, the Messages-vs-relationship-milestones distinction (composed at the view layer via a Relationship Timeline, never merged into Conversation's own schema), and the corrected schema are in `docs/conversation-lifecycle-design.md`. Everything below this line still holds as written except where superseded above.

**Split into two sub-phases, per explicit agreement, so a backend migration and a user-facing cutover are never approved as one decision:**

- **Phase 2A — Backend.** Schema (done — see `docs/architecture-delta-phase-2-relationship-foundation.md`), historical backfill, forward-sync compatibility between the legacy tables and the new ones, the new Conversation RPCs, and full verification. No UI changes. The old coordinator/couple-facing messaging surfaces keep working exactly as they do today, reading the old tables, for the entire duration of 2A.
- **Phase 2B — UI cutover.** Only begins once 2A's backend is fully canonical and verified. A separate go/no-go decision from 2A, not an automatic continuation. **Further split by explicit request once the coordinator inbox slice shipped:** the coordinator-facing UI (the higher-risk surface, since that's where coordinators spend their whole day) is validated and made to feel natural *before* the couple portal cutover even begins — not run in parallel. The couple portal keeps working exactly as it does today until that validation is done. Retiring the legacy tables waits for both.

### Target architecture (superseded fields marked)
- ~~`conversations` — one row per venue-to-person relationship, `client_id` or `vendor_relationship_id`, `status`~~, ~~`lead_id` XOR `vendor_relationship_id`~~ — see corrections above. `venue_id`, `relationship_id` XOR `vendor_relationship_id`, `last_message_at`, unread counts, `created_at`. No `status`.
- **`venue_customer_relationships`** (new, minimal) — one row per distinct customer relationship (individual, couple, family, company, nonprofit), matched by email today. `leads.relationship_id` links each Opportunity back to it.
- **`conversation_participants`** — one row per person who can see/send into a conversation (a venue Team Member, the Lead/Client, a Contact, a Vendor), so "who's in this conversation" is explicit rather than inferred. Multiple participants never fork the conversation — attribution lives on the message, not a separate thread.
- **`conversation_messages`** — one row per message, any channel. `conversation_id`, `sender_type` (`venue_staff`/`lead_or_client`/`contact`/`vendor`/`system`), `sender_id`, `channel` (`email`/`sms`/`portal`/`internal_note`/`phone_log`/`voicemail`/`push`, extensible), `body`, `body_html` (email only), `channel_metadata` (jsonb — provider IDs, phone numbers, whatever is channel-specific, so adding a channel doesn't mean a schema migration), `sent_at`, per-party read timestamps.
- **`conversation_message_events`** — replaces `message_events`; delivery/bounce/open/click tracking, one row per event, referencing `conversation_messages`.
- No separate `channels` table — channel is a property of a message, not an object with its own lifecycle. This matches the Domain Model's framing exactly: "channels are transports," not entities.
- **No attachments this phase** — by explicit agreement, attachments are retrofitted in Phase 4 once the Asset model exists in Phase 3.

### Migration strategy

**Phase 2A — Backend:**
1. ~~Create `venue_customer_relationships`, add `leads.relationship_id`, create the conversation tables, RLS from day one~~ — **done**, see `docs/architecture-delta-phase-2-relationship-foundation.md`.
2. ~~Provision a `conversations` row for every existing Relationship~~ — **done**, via the auto-provisioning trigger; carries forward automatically for every future Relationship too.
3. Write a one-time historical backfill: for every Relationship, gather every Lead under it, then every row in `message_threads`/`messages` or `couple_threads`/`couple_messages` (joined via each Lead's linked Client, since those legacy tables key off `client_id`), migrate `messages` rows in as `channel='email'`, `couple_messages` rows in as `channel='portal'`; merge by `created_at` across every Lead the Relationship has ever had, so the resulting conversation is genuinely chronological across both origins and across every past Opportunity, not just the most recent one.
4. Add a **temporary, named-and-bounded forward-sync**: since the legacy UI stays live and writable throughout 2A, new rows written to `messages`/`couple_messages` during this window must keep mirroring into `conversation_messages`, or the new tables go stale the moment the one-time backfill finishes. This is a deliberate, temporary bridge — removed in 2B once the legacy tables are retired, not a permanent dual-write architecture. "Replace, don't layer" describes the end state; a time-boxed bridge during the migration itself is the standard way to get there without a data-loss window.
5. Build `lib/conversations/repository.ts`/`service.ts` (real repository/service layering — TR-C2's couple-chat side skipped this; don't repeat that either) and the new Conversation RPCs the couple portal will need (token-authenticated, mirroring `get_portal_context`/`_resolve_portal_ids`) — built and tested in 2A, not yet called by any UI.
6. Full verification: backfill correctness, forward-sync correctness, new-RPC correctness, RLS/access-level parity — see Expected risks below. 2A isn't done until this is real, not just "the migration ran."

**Phase 2B — UI cutover (separate go/no-go, only after 2A is verified):**
7. ~~Cut the UI over: the coordinator's Client-detail "Messages" tab and the main-nav "Messaging" inbox become one Conversation view; the couple portal's message view becomes the couple-facing window into the same data~~ — **sequencing corrected below**, per explicit request: coordinator and couple portal cutover are not simultaneous. Consider a composed Relationship Timeline view (Conversation + Lead/Contract/Payment activity, read-only) as a stretch within this phase or an immediate fast-follow.
   - **7a. Coordinator inbox first** (done — see `docs/architecture-delta-phase-2b-coordinator-inbox.md`), flag-gated (`venues.conversation_experience_enabled`), legacy inbox untouched underneath.
   - **7b. Validate the coordinator experience feels natural** before touching the couple portal at all — this is the higher-risk surface (coordinators live there all day) and the one the "venue should experience customers, not architecture" principle is judged against first. Includes: the Lead/Client detail page's Conversation tab, a real click-through (not just `tsc`/build — see the open verification gap in the coordinator-inbox delta), and pointing the digest engine at the new data.
   - **7c. Couple portal cutover** — only after 7b is validated, not in parallel with it.
8. Retire `message_threads`/`messages`/`couple_threads`/`couple_messages`, and remove the 2A forward-sync bridge, once verified — replace, don't layer. A short safety window (one release cycle, tables renamed/archived, not left live) is acceptable; an indefinite parallel system is not.

### Order of implementation
Schema + RLS (done) → historical backfill → forward-sync bridge → repository/service layer → couple-portal RPCs → full verification **[2A boundary]** → coordinator inbox cutover → **validate coordinator experience feels natural** → Lead/Client detail Conversation tab → digest engine source-swap → couple portal cutover → retire old tables and the bridge **[2B]**.

### Expected risks
- **Backfill correctness** is the main risk — two independently-timestamped tables need to interleave into one true chronology, joined via each Lead's linked Client (since the legacy tables key off `client_id`, and Conversation now anchors to `relationship_id`). Test with the same rolled-back-transaction discipline used throughout Program 1, on real (copied) data, before running against production.
- **Forward-sync drift** — the temporary bridge is a second place a message briefly exists in two forms; if the trigger logic and the backfill logic ever disagree on mapping rules (channel, sender_type, which conversation a message belongs to), the two systems silently diverge during the exact window they're supposed to be kept in lockstep. Share the same resolution logic between the backfill and the trigger rather than writing it twice.
- **RLS/access-level parity** — the couple-portal side must check `client_portal_sessions.access_level`/`client_contacts.portal_role` from day one; TR-G4 was exactly this check being added late to four RPCs. Build it in from the start here instead of retrofitting.
- **UI consolidation effort (2B)** — coordinators are used to two separate surfaces; merging them is a real workflow change, not just a backend refactor. Worth a short internal dogfooding pass before wide release.
- **Vendor messaging scope creep** — the schema supports it, but building the vendor-facing UI is explicitly out of scope for this pass unless the venue owner wants to pull it in.
- **Resisting the urge to add a `status` column** once real usage patterns show up (e.g., wanting to mark something "needs follow-up") — that's a computed label per `docs/conversation-lifecycle-design.md`, not a stored state. Worth flagging in code review specifically, since it's an easy regression to reintroduce under time pressure.

### Opportunities to simplify
- Retires two full systems (tables, RLS, RPCs, UI) down to one, once 2B completes.
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
