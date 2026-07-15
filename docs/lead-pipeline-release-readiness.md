# Lead Pipeline — Release Readiness Audit

**Status:** Audit complete. Implementation follows in this same document's Release Completion section.
**Read first:** `docs/lead-identity-architectural-exploration.md` (the Relationship/Opportunity split — approved and live), `docs/booking-journey-design.md` (a richer canonical-stage pipeline redesign — **design only, explicitly not implemented**, see below), `docs/conversation-experience-cutover.md` and `docs/communication-platform-release-readiness.md` (the Messages/Conversation fork this audit does not re-litigate, only cross-references).
**Method:** direct code and live-schema verification — every claim below traced to a specific file, line, or live query, matching this program's methodology for Planning, Timeline, Wedding Day, Floor Plans, Seating, Templates, Communication, and Calendar. Two claims from prior documents were found stale during this audit and corrected in place, not repeated uncritically (named explicitly below).
**Scope discipline, stated once:** this is a release-readiness audit of the pipeline as it exists, not a redesign. `docs/booking-journey-design.md` proposes a materially richer model (canonical `inquiry→tour→proposal→decision→booked` stages, a "Decision Pending" stage, payment-schedule templates, a one-screen Booked→Client confirmation) — real, well-considered, and **not built**: `lib/leads/constants.ts`'s live `LeadStatus` enum is still the original seven-value set (`new/contacted/qualified/proposal_sent/won/lost/cancelled`), confirmed directly. This audit evaluates the pipeline against what it actually promises today, not against that unbuilt proposal — implementing it is out of scope, per the explicit instruction governing this pass.

---

## Two prior claims found stale during this audit — corrected, not repeated

Both discovered while tracing live code, in keeping with this program's standing discipline of verifying rather than trusting an earlier document's own words:

1. **`docs/booking-journey-design.md`'s "Grounding" section states "there is no existing pipeline/kanban view."** No longer true — a real, working drag-and-drop Pipeline Board exists (`app/(app)/leads/pipeline/page.tsx`, `components/leads/pipeline-board.tsx`), built on top of Pipeline Templates via a documented "Phase 2 compatibility layer" (`lib/leads/pipeline-stage-mapping.ts`).
2. **`docs/template-platform-release-readiness.md` classified Pipeline Templates as "Not connected to Leads yet — this is just the editor."** Also no longer true — the same compatibility layer above genuinely wires `pipeline_stages` to `leads.status`, bidirectionally, in both the List view and the Board view. This is a real, working integration this audit found and verified directly; the earlier claim is stale, not wrong at the time it was written (the Pipeline Board post-dates that audit).

Both corrections matter for what follows: the Lead Pipeline is materially more built than either prior document credits it for.

---

## Phase 1 — Release Readiness Audit

Walked cold: New inquiry → Lead record → Relationship card → Messages → Notes → Tasks → Activity → Documents → Luv → Scheduling tours → Follow-ups → Stage progression → Conversion to booking → Handoff into the Client Workspace.

### New inquiry
Two real entry points, both converging on the same `createLead`/`insertLead` path: the coordinator-facing `NewInquiryForm` (`/leads/new`, "Record a new lead from a call, email, or walk-in") and the public inquiry widget (`create_public_lead` RPC). Both resolve identity through `find_or_create_relationship` — the same function, no parallel path. A third real entry point, confirmed working this session: Calendar's "Convert to Booking" (`/leads/new?fromBlockId=`), pre-filling from a manually-placed booking placeholder.

### Lead record
`LeadWithDetails` — notes, tasks, activities, and (Program 2) `relationshipId`/`linkedClientId` — is a clean, single, well-typed aggregate (`lib/leads/repository.ts`'s `getLead`). Tour data is correctly canonicalized through `tour_appointments`, not duplicated on `leads` (confirmed: the old `leads.tour_date`/etc. columns were dropped in a named migration; every reader goes through `getCurrentTourForLead`/`getCurrentToursForLeads`).

### Relationship card
Real, well-built (`components/leads/relationship-card.tsx`) — next action (preset list + free text), follow-up date, last-contacted, and a tour sub-section with real conflict detection (`ConflictWarning`, reusing Calendar's own availability check rather than a second one). Clean empty state ("+ Add details").

### Messages
Correctly deferred to, not re-litigated by, this audit — the exact same legacy/new Conversation fork `docs/communication-platform-release-readiness.md` already audits in full. One Lead-specific addition confirmed here: the new Conversation compose UI (`components/conversations/conversation-thread.tsx`) supports picking a Message Template and scheduling a send; the legacy compose (`components/messaging/message-compose.tsx`, what most venues see today since `conversation_experience_enabled` defaults false) does not. Not a new finding — the same fork, one more data point on the side of "the new system is more capable."

### Notes, Tasks, Activity
Notes and Activity are plain, correct, unremarkable. **Tasks is not** — a real navigation/mental-model finding: the tab literally labeled **"Tasks"** (`lead-detail.tsx`'s `TabsTrigger`) renders a **Date Holds** card *above* the Tasks card, with no hint in the tab's own label that holds live there too. Each card is correctly headed once you're inside the tab, so nothing is actually mislabeled at the content level — but a coordinator clicking a tab that says "Tasks" and landing on "Date Holds" first is exactly the "navigation that breaks the user's mental model" this audit was asked to find. Named as a UX Improvement (not a blocker — nothing is lost or broken, just unexpected).

### Documents
Real (`DocumentsSection`, `entityType="lead"`) — contracts, inspiration photos, questionnaires. Correctly the same component every other entity type in the platform already uses, not a Lead-specific reimplementation.

### Luv
Real, and — per `docs/luv-platform-intelligence-architecture.md` §1's own assessment, reconfirmed here — the most mature Luv integration on the platform: `commitmentScore`/`responsivenessScore`/`interestScore` are persisted, refreshed on every dashboard load, read directly by `lib/luv/observations.ts`, and drive momentum indicators in both the List and Board views. `LuvDraftPanel` generates a reviewable, editable follow-up draft — never sends automatically, matching the platform-wide Luv Product Philosophy.

### Scheduling tours
Real, canonical, single source of truth (`tour_appointments`), reachable from both the Relationship card (manual) and the public booking widget — confirmed both write the identical table via `upsertLeadTour`'s "this is the only write path for manually-scheduled tours" comment.

### Follow-ups
Real (`followUpDate`, `nextActionDue`) — appears on Calendar (confirmed, `leads.follow_up_date` already wired per `docs/calendar-platform-integration.md`). No automatic reminder/escalation exists on a missed follow-up — a real, bounded gap, named as a Future Enhancement (Automation could plausibly own this, per the Automation Philosophy already established platform-wide) — not attempted here.

### Stage progression
Two parallel, correctly-reconciled controls: a plain status dropdown (seven-value `LeadStatus`) and, when a Pipeline Template is active, a Pipeline Stage dropdown/drag-drop board that maps onto the same status underneath (`CANONICAL_STAGE_TO_LEAD_STATUS`). One real, already-self-documented approximation: the canonical `"decision"` stage has no matching `LeadStatus` value (the seven-value enum predates `docs/booking-journey-design.md`'s proposal) and is mapped to `proposal_sent` as the closest fit — the mapping file's own comment names this as an approximation, not a real answer. Correctly not fixed here (fixing it means adding a "Decision Pending" status, which is exactly the pipeline-redesign this audit was told not to do).

**One real gap found, not previously documented:** once a Lead is converted (`linkedClientId` is set), its status/stage dropdown remains fully live — a coordinator can still change a converted Lead's status (e.g., to "lost") with no warning, producing a Lead record that visually contradicts the real, active Client/Event it already produced. Nothing breaks (the Client/Event is independent and unaffected), but it's a real, confusing display inconsistency. UX Improvement, not a blocker.

### Conversion to booking
`convertLeadToClient` (`lib/clients/service.ts`) is careful and correct: hard-blocks conversion against a calendar-blocked event date (server-side, not just advisory), creates the Client, auto-creates the Event when a date exists, sends the portal invitation, exits any active Sequence enrollment ("stop on booking"), and correctly does **not** silently apply a Planning Playbook, generate a contract, or create a payment schedule — all three remain manual follow-up steps today, exactly as `docs/booking-journey-design.md` found and exactly as this audit reconfirms, unchanged.

**One real gap found:** `clients.lead_id` has a foreign key but **no unique constraint** — confirmed directly against the live schema. A double-click or a second browser tab on "Convert to Client" can create two separate Client records for the same Lead, with no server-side guard against it. Release Blocker (below).

### Handoff into the Client Workspace
Clean — `router.push(/clients/{id}/booked...)`, no dead end, no re-entry of anything already captured.

---

## Migration Readiness

Evaluated explicitly against "a venue returning from another CRM with hundreds of active prospects," per the brief.

- **Bulk import: real, and genuinely good** — `/settings/import?type=leads`, a real CSV wizard with field mapping, confirmed in the Template Platform audit and reconfirmed here.
- **Duplicate handling: the one real gap in this entire audit.** `find_or_create_relationship` dedupes the *Relationship* by exact, case-insensitive email match — real and working. It does **not** dedupe the *Lead* itself: `importLeadsAction` calls `createLead` once per CSV row, unconditionally, so a venue that re-runs an import, or whose CSV export contains a row already present as an existing Lead, gets a second `leads` row every time, silently, with zero warning anywhere in the import wizard. The Relationship-level enrollment guard (`hasActiveEnrollment`, keyed to `relationshipId`) does prevent a duplicate "welcome" message from firing in the common same-email case — so this is a data-quality/reporting defect (inflated, duplicated pipeline cards), not a customer-facing double-contact one — but for exactly the scenario this audit was asked to weight most heavily (a large, one-time historical import), it's a real one. Release Blocker (below).
- **Manual lead entry:** fast, low-friction, only two required fields (first/last name) — matches "on paper," "phone reservation" style entry the Calendar audit's own placeholder design already anticipated.
- **Getting started feel:** genuinely good once past the duplicate-import gap — clean empty states on both List and Board, a two-click path from zero to a real Lead, Pipeline Templates discoverable from both list surfaces without leaving the page.

---

## Release Blockers

1. **Bulk/CSV import has no duplicate detection at the Lead level.** Confirmed: `importLeadsAction` inserts a new `leads` row per row, unconditionally — including rows that exactly match an existing, still-open Lead in the same venue. For the single highest-stakes workflow this audit was asked to weight ("returning from another CRM with hundreds of active prospects"), a re-run import or a CSV containing pre-existing contacts silently doubles the pipeline with no warning.
2. **No unique constraint on `clients.lead_id`.** A double-click or a race between two tabs on "Convert to Client" can create two Client records for one Lead, confirmed via direct schema inspection (FK only, no uniqueness).

## UX Improvements

Real, verified, deliberately not blocking release:

1. The "Tasks" tab silently also contains Date Holds, with no hint in the tab's own label.
2. A converted Lead's status/stage control stays fully editable, with no indication that changing it no longer reflects the real, independent Client/Event it already produced.
3. No List/Board bulk operations exist anywhere (multi-select stage-change, multi-select delete, multi-select export) — confirmed absent, matching the exact platform-wide pattern the Template Platform audit already found and named as a deliberate, low-priority gap given current usage scale. Worth naming again here specifically because "hundreds of active prospects" is exactly the scale where it would start to matter — not urgent enough to block this pass.
4. No automatic reminder/escalation on a missed `followUpDate`/`nextActionDue`.
5. The `"decision"` canonical Pipeline Stage has no real backing status — already self-documented as an approximation in the code, surfaced here for completeness, not newly discovered.

## Future Enhancements

- `docs/booking-journey-design.md`'s full richer pipeline (canonical stages including Decision Pending, payment-schedule templates, the one-screen Booked→Client confirmation) — real, approved-for-design, not approved-for-build; stays exactly where the prior document left it.
- Automation-driven follow-up reminders/escalation on stale leads.
- Bulk operations on the List/Board views.
- A "possible duplicate" *suggestion* UI beyond the import-time skip this pass adds (e.g., surfacing a merge affordance when a coordinator manually creates a Lead that closely matches an existing one) — a genuinely new capability, not a bug fix, correctly out of scope here.

---

## Phase 2 — Platform Integration Audit

| Integration | Classification | Evidence |
|---|---|---|
| **Calendar** | Fully integrated | `leads.follow_up_date` on Calendar (confirmed, `docs/calendar-platform-integration.md`); tours canonically sourced from `tour_appointments`; Calendar's own "Convert to Booking" placeholder creates a real Lead through the identical `createLead` path — no parallel logic, confirmed this session. |
| **Tours** | Fully integrated | `tour_appointments` is the single canonical source, read/written identically from the public widget and the Relationship card; `tour_converted` signal fires correctly on win. |
| **Communication** | Partially integrated | Real on both the legacy and new systems, but split exactly along the fork `docs/communication-platform-release-readiness.md` already audits in full — not re-litigated here. Message Template picking exists only on the new system's compose UI. |
| **Message Templates** | Partially integrated | See Communication above — real, but unreachable from the default (flag-off) compose experience most venues still have today. |
| **Automations (Sequences)** | Fully integrated | `triggerSequencesForRelationship` fires correctly on `lead_created` and `lead_stage_changed`, guarded against double-enrollment by `hasActiveEnrollment` keyed to `relationshipId`; exits correctly on booking and on reply (confirmed cross-referenced against `docs/communication-platform-release-readiness.md`'s own inbound-webhook findings). |
| **Platform Events** | Missing (correctly, for now) | `lib/platform-events` is real but only Requests is wrapped (`wire-requests.ts`) — Lead creation/stage-change are not yet emitted as Platform Events, consistent with `docs/platform-event-adoption-plan.md`'s own adoption order, which schedules new triggers (Leads would be one) *after* the existing four mechanisms are wrapped. Not a regression, not attempted here. |
| **Notifications** | Fully integrated | `notify_new_lead` trigger confirmed live on `leads` (`AFTER INSERT`), writing to `venue_notifications` through the same shared mechanism every other trigger uses. |
| **Luv** | Fully integrated | The platform's most mature Luv integration, confirmed directly and by `docs/luv-platform-intelligence-architecture.md`'s own independent assessment — three persisted, dashboard-driving scores, read directly, never re-derived. |
| **Requests** | Correctly omitted | `Request.clientId` is non-nullable — a Request cannot exist without a Client Workspace, which a Lead by definition doesn't have yet. Confirmed, not a gap. |
| **Documents** | Fully integrated | `DocumentsSection`, `entityType="lead"` — the same shared component every other entity uses. |
| **Contracts** | Correctly omitted | Contracts operate on Clients/Events, which don't exist pre-conversion; no premature or parallel Lead-level contract mechanism found. |
| **Payments** | Correctly omitted | Same reasoning as Contracts — confirmed no Lead-level payment mechanism exists anywhere. |
| **Event Readiness** | Correctly omitted (N/A) | Event Readiness is explicitly, permanently a per-Event computation (`docs/luv-platform-reconciliation.md` §6) — a Lead precedes any Event by definition. |
| **Client Workspace handoff** | Fully integrated | `convertLeadToClient` — careful, correct, calendar-block-checked, Sequence-exiting, no dead end — with one real gap (no unique constraint on `clients.lead_id`, Release Blocker #2 above). |
| **Pipeline Templates** | Fully integrated | The stale "not connected" claim corrected above — a real, working, bidirectional compatibility layer (`lib/leads/pipeline-stage-mapping.ts`) backs both the List and Board views. |

**No duplicate or isolated implementations found** anywhere in this integration sweep — every capability either reads a fact another feature already owns (Calendar reading `follow_up_date`, Luv reading the three scores) or correctly has no integration because the underlying entity (Client, Event) doesn't exist yet.

---

## Overall Recommendation (pre-implementation)

# Almost Ready

**Justification.** The Lead Pipeline is materially more complete than the two prior documents credited it for — a real Pipeline Board, a real bidirectional Pipeline Templates integration, the platform's most mature Luv integration, a careful and correct conversion path. No dead ends, no duplicated workflows, no stale architecture, no backend/UI mismatch found anywhere in the full lifecycle walk.

**Why not "Ready."** Two bounded, genuine defects — both are exactly the "architecture and consistency" class of fix this pass is scoped to, not new capability: bulk import can silently duplicate a venue's entire historical pipeline on the one workflow this audit was asked to weight most heavily, and a race condition can duplicate a Client record on conversion.

**What "Ready" requires, precisely:** close the two Release Blockers above. Neither requires new architecture, a redesign, or a decision this audit isn't positioned to make.

---

## Release Completion

### Phase 3 — Release Blockers (fixed, DB-verified)

1. **Bulk/CSV import now checks for an already-active duplicate before creating a Lead.** `lib/leads/repository.ts`'s new `findActiveDuplicate` (email match, case-insensitive, exact; falling back to an exact first+last name match only when no email is given) is called once per row in `importLeadsAction` before `createLead` — a match is skipped and reported the same way a missing-required-field row already is ("Skipped — matches an already-active lead"), reusing the import wizard's existing `kind: "skipped"` mechanism rather than inventing a second one. **Deliberately scoped to still-active leads only** (`status not in ('won','lost','cancelled')`) — a won/lost/cancelled Lead is never treated as a duplicate, so a genuine years-later repeat inquiry still correctly opens a new Opportunity, preserving the exact boundary `docs/lead-identity-architectural-exploration.md` §8 already drew on purpose (that document's own "when does repeat contact open a new Opportunity" question stays exactly as open and deferred as it was — this fix does not quietly decide it). The import wizard's summary line, which hardcoded "missing required fields" as the only skip reason, was corrected to reflect both real reasons now that there are two. DB-verified directly: a still-active lead with a matching email is correctly flagged; a `won` lead with a different (but real, matching-scenario) status is correctly *not* flagged; the no-email name-fallback path is correctly triggered.
2. **`clients.lead_id` is now uniquely constrained**, closing the double-click/two-tab race on "Convert to Client." A new partial unique index (`clients_lead_id_unique`, `where lead_id is not null` — many Clients legitimately have no originating Lead at all) is the real guarantee, confirmed by direct reproduction: a second insert with the same `lead_id` throws Postgres `23505 unique_violation`. Two layers above that DB guarantee, matching this program's own established "friendly message, not a raw crash" discipline: `convertLeadToClient` now pre-checks for an already-existing Client for this Lead (the common, non-racing case — returns the existing client gracefully, no error shown) and wraps the actual insert in a catch for the true race (near-simultaneous double-click), falling back to the same graceful "return the client that already exists" behavior rather than surfacing an unhandled exception. DB-verified: the unique constraint correctly blocks a second Client for the same Lead; no pre-existing duplicate rows were found in the live database before the index was added (confirmed before creating it, not assumed).

### Phase 4 — Verification

Full-repo `tsc --noEmit`: clean, the same two pre-existing, unrelated stale `.next/types/validator.ts` errors present before and after this pass. Full-repo `eslint`: 150 errors / 107 warnings — matching the established baseline exactly, zero new issues in any file this pass touched. Both fixes DB-verified directly against the real local database in one self-cleaning transactional test (a real venue, real active/won leads, a real client-conversion race reproduced and caught) — confirmed via recount that zero test rows were left behind.

### Updated Recommendation

# Ready

**Justification.** Both genuine Release Blockers — the one real gap in an otherwise thorough, evidence-dense audit of the full lead lifecycle, migration readiness, and platform integration — are fixed and DB-verified. Everything else found (the Tasks/Date-Holds tab label, a converted Lead's still-editable status, the absence of bulk operations at current usage scale, the already-self-documented "decision" stage approximation) is real, honestly named, and correctly left as UX Improvement or Future Enhancement rather than forced into this pass. `docs/booking-journey-design.md`'s richer pipeline redesign remains exactly where it was — approved for design, not for build, and this pass did not move that line.

**What keeps this honest, not just optimistic.** The Lead Pipeline's own architecture is sound and, per this audit's two stale-claim corrections, more complete than prior documents credited — a real Pipeline Board, a real bidirectional Pipeline Templates integration, the platform's most mature Luv integration, and a conversion path that was already careful before this pass and is now provably race-safe. A venue migrating hundreds of active prospects from another CRM can now import, get an honest account of what was skipped and why, work the pipeline on either the List or Board view, and convert into the Client Workspace without a double-click silently forking their data.
