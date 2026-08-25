# Coordinator Seating and Planning Help Research

Research date: 2026-08-14  
Scope: research/specification only. No product code, schema, migrations, RLS, seeds, UI, copy, tests, packages, config, environment, commits, deployment, or product data were changed.

Evidence labels:

- **VERIFIED FROM SOURCE** — confirmed in current code or migrations.
- **VERIFIED FROM DATABASE** — confirmed with read-only queries against the running local Supabase Postgres database.
- **VERIFIED LIVE** — confirmed through an exercised browser workflow. No finding carries this label; authenticated UI workflows were not exercised.
- **UNVERIFIED** — product assumption, production/deployment state, or behavior needing end-to-end validation.

# 1. Coordinator-Side Seating — Research & Specification

## 1. Current state

- **VERIFIED FROM SOURCE** The premise that no coordinator-side seat-assignment tool exists is stale. `components/events/venue-seating-editor.tsx` assigns an unseated guest through a table selector, moves a guest by assigning a new table, removes an assignment, submits an operational snapshot, and hands management back to the couple.
- **VERIFIED FROM SOURCE** The editor is reachable at `app/(app)/events/[id]/seating/manage/page.tsx`. `components/events/wedding-day-seating.tsx` exposes “Manage Seating” when the selected plan is actively delegated.
- **VERIFIED FROM SOURCE** The read-only coordinator surface is reachable from `components/events/wedding-day-dashboard.tsx` at `/events/{eventId}/seating`. It supports guest/table search, rosters, unseated guests, meal counts, accessibility notes, children/vendor-meal lists, open-seat counts, and print.
- **VERIFIED FROM SOURCE** The coordinator editor is intentionally list/select based. The couple editor in `components/portal/seating-section.tsx` additionally provides a floor-plan canvas, drag/drop, search, multi-select, household/wedding-party/children/vendor-meal grouping, and auto-assignment. Both use the same data model.
- **VERIFIED FROM SOURCE** Tables are canonical `floor_plan_objects` rows whose `object_type` is `table_round`, `table_rect`, or `table_oval`. Label, capacity, geometry, shape, and position remain Floor Plan facts.
- **VERIFIED FROM SOURCE** Guests are canonical `couple_guests` rows. Seat placement is `guest_seat_assignments(guest_id, floor_plan_id, table_object_id, assigned_at)`, unique per `(guest_id, floor_plan_id)`.
- **VERIFIED FROM SOURCE** `couple_guests.table_number` is a legacy duplicate-shaped column with no TypeScript/TSX call sites found. It is not the seating source of truth.
- **VERIFIED FROM SOURCE** Deleting a table sets `guest_seat_assignments.table_object_id` to null. `_build_seating_json` reports affected guests under `needsReassignment`; their decision is not silently deleted.
- **VERIFIED FROM SOURCE** Seating is per floor plan. One guest can have independent Ceremony and Reception assignments.
- **VERIFIED FROM SOURCE** Couple-side reads use `get_seating_floor_plans(token)` and `get_seating_data(token, floor_plan_id)`. Writes use `assign_guest_to_table` / `remove_guest_assignment`; the couple may submit or delegate each plan.
- **VERIFIED FROM SOURCE** Financial and view-only portal access cannot assign, remove, submit, or delegate. During active delegation the couple still sees the plan, but both UI and RPC reject couple writes.
- **VERIFIED FROM SOURCE** “Final” has three separate meanings:
  1. Floor Plan “Ready” is `floor_plans.finalized_at`; it is reversible and does not lock editing.
  2. Seating “Submit” appends an immutable `seating_submissions` snapshot.
  3. Event Order “Finalized” is an independent lifecycle and source of record.
- **VERIFIED FROM SOURCE** The venue’s default operational read is the latest submission snapshot, not the couple’s private live draft. During active delegation the venue reads and writes the same live assignment rows the couple would use.
- **VERIFIED FROM SOURCE** `submit_seating_plan_as_venue` appends a snapshot with `submitted_by='venue'` and completes tasks configured with `auto_complete_trigger='seating_submitted'`.
- **VERIFIED FROM SOURCE** Event Order does not consume seat assignments or seating submissions. Its only seating-adjacent link is `event_order_sections.floor_plan_id`; reconciliation compares inventory quantities, not guest placement.
- **VERIFIED FROM DATABASE** The local database contains `floor_plans`, `floor_plan_objects`, `couple_guests`, `guest_seat_assignments`, `seating_submissions`, and `seating_delegations`.
- **VERIFIED FROM DATABASE** Local counts were 3 floor plans, 40 floor-plan objects, 5 couple guests, 2 seat assignments, 2 seating submissions, and 0 seating delegations. Persisted assignment/submission data exists, but no active delegation was available to exercise.
- **VERIFIED FROM DATABASE** One current signature exists for each couple/venue seating read, assign/remove, submit, grant-delegation, and revoke path inspected. All are `SECURITY DEFINER`.
- **VERIFIED FROM DATABASE** `guest_seat_assignments` has RLS enabled and zero policies. `seating_submissions` and `seating_delegations` have venue-scoped SELECT policies using `current_user_venue_id()`.
- **VERIFIED FROM DATABASE** Venue seating RPCs are executable by `authenticated`; couple token RPCs are executable by `anon` and `authenticated`.
- **VERIFIED FROM SOURCE** `current_user_venue_id()` accepts an owner or any accepted active `venue_staff` member. Venue seating RPCs do not additionally check `current_user_role()`.
- **UNVERIFIED** Production migration parity, full browser behavior, mobile/tablet usability, and error/loading states.

## 2. Gap

- **VERIFIED FROM SOURCE** The core delegated coordinator-assignment capability already exists. A new coordinator seating entity, canvas, or assignment API would duplicate current architecture.
- **VERIFIED FROM SOURCE** The remaining workflow gap is authorship acquisition: only a portal-token holder can grant delegation. A coordinator cannot initiate venue-managed seating for a disengaged couple, a full-service venue package, or a booking without a usable portal link.
- **VERIFIED FROM SOURCE** `getSeatingFloorPlansForVenue(eventId, clientId)` borrows a client portal token to call `get_seating_floor_plans`. A venue-owned plan list therefore depends on a client portal session.
- **VERIFIED FROM SOURCE** Before submission/delegation, the event-day page tells staff to ask the couple to delegate; it provides no coordinator action.
- **VERIFIED FROM SOURCE** Authorization is venue-scoped but not role-scoped. Owner, manager, coordinator, and generic accepted staff can reach delegated venue RPCs.
- **VERIFIED FROM SOURCE** Venue assignment APIs return HTTP 200 with `{ok:false}` when an RPC returns false, weakening error handling and telemetry.
- **VERIFIED FROM SOURCE** No automated tests reference the current venue seating RPCs/editor. Corrective migrations exist for prior runtime defects, but regression protection is absent.
- **VERIFIED FROM SOURCE** Multi-plan interactive lookup exists, while `app/(app)/events/[id]/seating-print/page.tsx` prints only `floorPlans[0]`.
- **UNVERIFIED** Whether Product wants couple-delegation only or venue-initiated management, and which staff roles should read/write seating.

## 3. Smallest coherent workflow

The smallest coherent workflow is the existing delegation model, hardened rather than replaced:

1. **VERIFIED FROM SOURCE** Coordinator opens Event → Event Day Seating and selects a venue-owned Floor Plan.
2. **VERIFIED FROM SOURCE** The page shows the latest submitted snapshot; the couple’s in-progress work remains private.
3. **VERIFIED FROM SOURCE** The couple selects “Let Your Venue Manage This” for that plan. Delegation is plan-specific and revocable.
4. **VERIFIED FROM SOURCE** “Manage Seating” appears, and the couple’s editor becomes read-only.
5. **VERIFIED FROM SOURCE** Coordinator assigns/moves/removes attending guests against existing Floor Plan table objects through venue-authenticated RPCs.
6. **VERIFIED FROM SOURCE** Assignments persist immediately; deleted tables create `needsReassignment`; capacity remains advisory.
7. **VERIFIED FROM SOURCE** “Update Operational Plan” appends an immutable venue-attributed snapshot. It does not mutate Event Order or Floor Plan readiness.
8. **VERIFIED FROM SOURCE** Either party revokes delegation; the latest submitted snapshot remains the operational checkpoint.

If Product approves venue-initiated management, the smallest extension is an explicit, auditable creation of the existing `seating_delegations` record. It is not removal of delegation checks.

## 4. Existing architecture to reuse — exact paths

- **VERIFIED FROM SOURCE** Couple UI: `components/portal/seating-section.tsx`, mounted by `components/portal/portal-shell.tsx`.
- **VERIFIED FROM SOURCE** Coordinator read/edit UI: `components/events/wedding-day-seating.tsx`, `components/events/venue-seating-editor.tsx`.
- **VERIFIED FROM SOURCE** Coordinator pages: `app/(app)/events/[id]/seating/page.tsx`, `manage/page.tsx`, `seating-print/page.tsx`.
- **VERIFIED FROM SOURCE** Venue APIs: `app/api/venue/seating/route.ts`, `assign/route.ts`, `submit/route.ts`, `delegate/route.ts`.
- **VERIFIED FROM SOURCE** Couple APIs: `app/api/portal/seating/route.ts`, `floor-plans/route.ts`, `assign/route.ts`, `submit/route.ts`, `delegate/route.ts`, `suggestions/route.ts`.
- **VERIFIED FROM SOURCE** Service/types: `lib/seating/service.ts`, seating types in `lib/portal/types.ts`.
- **VERIFIED FROM SOURCE** Canonical tables: `couple_guests`, `floor_plans`, `floor_plan_objects`, `guest_seat_assignments`, `seating_submissions`, `seating_delegations`.
- **VERIFIED FROM SOURCE** Shared payload builder: `_build_seating_json(client_id, venue_id, floor_plan_id)`.
- **VERIFIED FROM SOURCE** Couple RPCs: `get_seating_floor_plans`, `get_seating_data`, `assign_guest_to_table`, `remove_guest_assignment`, `submit_seating_plan`, `grant_seating_delegation`, `revoke_seating_delegation`.
- **VERIFIED FROM SOURCE** Venue RPCs: `get_operational_seating_plan`, `assign_guest_to_table_as_venue`, `remove_guest_assignment_as_venue`, `submit_seating_plan_as_venue`, `revoke_seating_delegation_as_venue`.
- **VERIFIED FROM SOURCE** Canonical migrations: `20260828000000_seating_phase1.sql`, `20260905000000_seating_release_completion.sql`, and `20261025000000` through `20261025050000` commitment-alignment seating migrations.
- **VERIFIED FROM SOURCE** Readiness/task integration: `lib/readiness/compute.ts`, `lib/playbooks/constants.ts`.
- **VERIFIED FROM SOURCE** Architecture: `docs/floor-plan-seating-architecture.md`, `docs/commitment-lifecycle-architecture.md`, `docs/client-workspace-product-architecture.md`.

## 5. Required changes — list only

### Database / permissions

- **VERIFIED FROM SOURCE** No new seat, table, guest, assignment, snapshot, or finalization table.
- **VERIFIED FROM SOURCE** No direct venue RLS policy on `guest_seat_assignments`.
- **UNVERIFIED** If approved, add one auditable venue-initiated operation on existing `seating_delegations`.
- **UNVERIFIED** Encode the Product-selected minimum role in every venue seating mutation RPC using `current_user_role()` in addition to venue isolation.

### Backend

- **VERIFIED FROM SOURCE** Replace the borrowed portal-token plan list with a venue-authenticated, event-scoped list over existing Floor Plans.
- **VERIFIED FROM SOURCE** Retain `_build_seating_json` and existing venue assignment RPCs.
- **VERIFIED FROM SOURCE** Return structured authorization/delegation errors and non-2xx responses for false RPC results.

### UI

- **VERIFIED FROM SOURCE** Reuse `VenueSeatingEditor`; do not fork the couple canvas.
- **VERIFIED FROM SOURCE** Keep table geometry/capacity in Floor Plans and guest placement in Seating.
- **VERIFIED FROM SOURCE** Make Not Submitted, Submitted, and Delegated states explicit/discoverable.
- **UNVERIFIED** If venue initiation is approved, add a confirmation explaining transfer of editing authority.
- **UNVERIFIED** Add multi-plan print selection only if required for launch.

### Tests

- **VERIFIED FROM SOURCE** Add RPC tests for same/cross venue, role rejection, active delegation, wrong-plan guest/table, deleted-table reassignment, and immutable resubmission.
- **VERIFIED FROM SOURCE** Add route tests for invalid input and false-RPC failure semantics.
- **VERIFIED FROM SOURCE** Add e2e coverage for delegate → manage → assign/move/remove → submit → revoke and couple read-only state.
- **VERIFIED FROM SOURCE** Add multi-plan isolation coverage.

## 6. Risks

- **UNVERIFIED** Production migration/function parity.
- **UNVERIFIED** Minimum read/write role and venue-initiated consent/audit policy.
- **VERIFIED FROM SOURCE** The plan picker’s portal-session dependency can hide venue-owned plans.
- **VERIFIED FROM SOURCE** Submission is a checkpoint, not a lock; live assignments remain editable.
- **VERIFIED FROM SOURCE** Later Floor Plan edits can diverge from an older immutable snapshot.
- **VERIFIED FROM SOURCE** Unconverted plus-ones are not distinct guest rows and cannot be independently seated.
- **VERIFIED FROM SOURCE** Capacity is advisory and over-capacity assignment is permitted.
- **VERIFIED FROM SOURCE** Event Order is not reconciled from seating.
- **VERIFIED FROM SOURCE** Multi-plan print currently selects only the first plan.

## 7. Out of scope

- **VERIFIED FROM SOURCE** No second canvas, table model, guest model, or Event Order seating model.
- **VERIFIED FROM SOURCE** No couple editing of Floor Plan geometry/capacity/inventory.
- **VERIFIED FROM SOURCE** No synchronization into Event Order, guest count, Inventory, or `couple_guests.table_number`.
- **VERIFIED FROM SOURCE** No mutation of historical submissions.
- **VERIFIED FROM SOURCE** No hard capacity or accessibility-placement enforcement.
- **VERIFIED FROM SOURCE** No per-chair numbered-seat model.
- **UNVERIFIED** No venue-initiated takeover until Product decides consent, roles, audit, notification, and revocation.
- **UNVERIFIED** No drag/drop parity, bulk assignment, mobile redesign, or real-time collaboration in the smallest release.

## 8. Implementation sequence

1. **VERIFIED FROM SOURCE** Reframe from “build coordinator seating” to “harden existing delegated coordinator seating.”
2. **UNVERIFIED** Obtain Product decisions on venue initiation and minimum read/write roles.
3. **VERIFIED FROM SOURCE** Add venue-authenticated plan listing; remove portal-session dependency.
4. **UNVERIFIED** Add authoritative role checks according to the decision.
5. **VERIFIED FROM SOURCE** Normalize API failure semantics.
6. **VERIFIED FROM SOURCE** Add RPC/route/e2e coverage for the delegated lifecycle and multi-plan isolation.
7. **UNVERIFIED** Browser-test owner, manager, coordinator, and staff accounts; same/cross venue; desktop/tablet; network failure.
8. **UNVERIFIED** Release the list editor first; assess richer assignment UX from observed usage.

# 2. Planning the Event — Help Audit

## Audit state

- **VERIFIED FROM SOURCE** `lib/help-guides/areas.ts` defines this area around Questionnaires, Timelines, and Playbooks; current event/navigation surfaces also make Key Dates, Tasks, Calendar, Requests, and delegated Seating genuine planning topics.
- **VERIFIED FROM DATABASE** The local database has zero `success_library_articles` rows in `goal_category='Planning the Event'`.
- **VERIFIED FROM DATABASE** Active local models include 26 questionnaire templates, 2 event questionnaires, 26 timeline templates, 16 timeline entries, 2 playbook templates, 4 playbook applications, and 31 event tasks.
- **VERIFIED FROM DATABASE** `client_key_dates` exists with zero local rows. Zero rows do not make its reachable UI dead.
- **UNVERIFIED** No Help or planning workflow was authenticated in browser.

## Recommended topics

### 1. Understand the three questionnaires

- **Capability:** Client Planning Questionnaire, Final Details, and Post-Event Feedback are distinct masters with separate purposes, templates, statuses, and event instances.
- **Evidence:** **VERIFIED FROM SOURCE** `lib/questionnaire-family/definitions.ts`, `components/events/questionnaire-family-panel.tsx`, `components/events/event-detail.tsx`. **VERIFIED FROM DATABASE** questionnaire tables and rows exist.
- **Scope:** Explain purpose, what is pre-known, what the couple supplies, and Draft → Sent → Submitted.
- **Confidence:** High.
- **Recommendation:** **RECOMMEND**

### 2. Create, preview, send, withdraw, and reopen a questionnaire

- **Capability:** Coordinators may apply a draft template, preview with client rendering, send/resend, withdraw Sent access to Draft, review answers/activity, and reopen Submitted.
- **Evidence:** **VERIFIED FROM SOURCE** `components/events/questionnaire-family-panel.tsx`, `app/(app)/events/[id]/questionnaire-actions.ts`, `app/questionnaire/[key]/page.tsx`, `components/portal/questionnaire-section.tsx`.
- **Scope:** Lifecycle/status article; distinguish Withdraw from Reopen. Do not claim email delivery was live-verified.
- **Confidence:** High source; medium end-to-end.
- **Recommendation:** **RECOMMEND AFTER FIX**

### 3. Customize Questionnaire & Feedback templates

- **Capability:** Library templates cover all three kinds; applying snapshots included/required/custom fields, wording, and order onto a draft.
- **Evidence:** **VERIFIED FROM SOURCE** `app/(app)/library/questionnaire-templates/`, `components/questionnaire-templates/questionnaire-template-list.tsx`, `lib/questionnaire-templates/service.ts`, `lib/questionnaire-family/resolve.ts`. **VERIFIED FROM DATABASE** 26 template rows.
- **Scope:** Master fields, customization, draft-only apply, copy-not-live-link behavior.
- **Confidence:** High.
- **Recommendation:** **RECOMMEND**

### 4. What questionnaire answers update

- **Capability:** Answers have explicit destinations: authoritative event facts, questionnaire columns, or `additional.family`; they do not create a second Timeline/vendor/Event Order model.
- **Evidence:** **VERIFIED FROM SOURCE** destination registry in `lib/questionnaire-family/definitions.ts` and answer rendering in `components/events/questionnaire-family-panel.tsx`.
- **Scope:** Trust article listing authoritative updates versus retained answers.
- **Confidence:** High.
- **Recommendation:** **RECOMMEND**

### 5. Build a booking Timeline from a template

- **Capability:** An empty booking can apply a venue Library template as an editable copy. The in-editor picker can append template/starter entries and warns when entries already exist.
- **Evidence:** **VERIFIED FROM SOURCE** `components/events/timeline-setup-card.tsx`, `components/events/timeline/template-picker.tsx`, `app/(app)/library/timeline-templates/`. **VERIFIED FROM DATABASE** template and entry rows exist.
- **Scope:** First apply versus append, copy-not-live-link, relative times, duplicate warning. Do not direct users to `/timeline`; it redirects to Events.
- **Confidence:** High.
- **Recommendation:** **RECOMMEND**

### 6. Timeline owner, lock, audience, and client submission

- **Capability:** Entries have venue/client owner, editable/locked state, and external audiences. Couples can edit their own allowed entries, manage their visibility, and submit immutable snapshots to the venue.
- **Evidence:** **VERIFIED FROM SOURCE** `lib/timeline/types.ts`, `components/events/timeline/timeline-entry-form.tsx`, `components/events/timeline/timeline-view.tsx`, `components/portal/timeline-section.tsx`, `app/api/portal/timeline/*`.
- **Scope:** Separate authorship, editability, visibility, and submission. “Locked” is not finalization.
- **Confidence:** High source; medium end-to-end.
- **Recommendation:** **RECOMMEND AFTER FIX**

### 7. Edit and operate the day-of Timeline

- **Capability:** Timeline supports sections, multi-day entries, notes, links/attachments/related records, staff assignment, ordering, audiences, day-of status, and shifting later timed entries when running late.
- **Evidence:** **VERIFIED FROM SOURCE** `components/events/timeline/timeline-view.tsx`, `components/events/wedding-day-dashboard.tsx`, `lib/timeline/service.ts`.
- **Scope:** Keep planning-time editing separate from event-day execution.
- **Confidence:** High source; medium live-operation.
- **Recommendation:** **RECOMMEND AFTER FIX**

### 8. Understand Client Planning vs Venue Planning

- **Capability:** Independent Playbook kinds. Venue Planning activates on apply; Client Planning is a private Draft until explicit Release.
- **Evidence:** **VERIFIED FROM SOURCE** `components/playbooks/event-task-list.tsx`, `lib/playbooks/repository.ts`, `lib/playbooks/types.ts`. **VERIFIED FROM DATABASE** applications/tasks exist.
- **Scope:** Audience and Not Applied/Draft/Released/Active states; why Release differs from Apply.
- **Confidence:** High.
- **Recommendation:** **RECOMMEND**

### 9. Create and apply a Planning Template

- **Capability:** Reusable Client/Venue templates contain milestones, tasks, relative due dates, owners/visibility, dependencies, reminders, attachments, action links, and event-day designation. Apply creates event-specific snapshots.
- **Evidence:** **VERIFIED FROM SOURCE** `app/(app)/library/playbooks/`, `components/playbooks/playbook-builder.tsx`, `components/playbooks/playbook-starter-picker.tsx`, `lib/playbooks/repository.ts`.
- **Scope:** Kind, milestones/tasks, date behavior, apply, copy isolation. Do not promise syncing later template edits.
- **Confidence:** High.
- **Recommendation:** **RECOMMEND**

### 10. Manage event tasks and Task Center

- **Capability:** Event tasks support pending/waiting/overdue/complete/waived, dependencies, staff assignment, relative/fixed due dates, context, Requests, scheduled-activity details, complete/waive/reopen. `/tasks` aggregates exceptions with My/Team/All perspectives.
- **Evidence:** **VERIFIED FROM SOURCE** `components/playbooks/event-task-list.tsx`, `app/(app)/tasks/page.tsx`, `components/tasks/task-center.tsx`. **VERIFIED FROM DATABASE** 31 task rows.
- **Scope:** Event detail versus global Task Center; My Tasks is a perspective, not a permission boundary. Tasks originate from applied templates; no ad-hoc event-task create/delete exists.
- **Confidence:** High.
- **Recommendation:** **RECOMMEND**

### 11. Task due dates, dependencies, reminders, and escalation

- **Capability:** Tasks default to event-relative dates, may be fixed-date, may block on another task, and may schedule reminder/escalation work. Client reminders begin at Release.
- **Evidence:** **VERIFIED FROM SOURCE** `components/playbooks/due-date-composer.tsx`, `components/playbooks/event-task-list.tsx`, `lib/playbooks/repository.ts`, `lib/notifications/engine.ts`.
- **Scope:** Relative/fixed dates, recalculation, Waiting, reminder timing, escalation, cancellation after completion/waiver.
- **Confidence:** Medium; background delivery was not re-executed in this audit.
- **Recommendation:** **RECOMMEND AFTER FIX**

### 12. Add and use Key Dates

- **Capability:** Coordinators add/delete client-scoped date-only milestones with label/note from Event Overview; Dashboard and Calendar consume them; the Couple Workspace reads them through `get_portal_key_dates`.
- **Evidence:** **VERIFIED FROM SOURCE** `components/clients/key-dates-section.tsx`, `components/events/event-detail.tsx`, `components/dashboard/key-dates-widget.tsx`, `app/api/portal/key-dates/route.ts`, `supabase/migrations/20261157000000_portal_key_dates.sql`. **VERIFIED FROM DATABASE** table exists with zero rows.
- **Scope:** Add/delete, display behavior, Dashboard/Calendar/client visibility. Explicitly state they are not Timeline entries, are not editable in place, and do not inherently send reminders.
- **Confidence:** Medium because no row/browser flow demonstrated all read surfaces.
- **Recommendation:** **RECOMMEND AFTER FIX**

### 13. Use Requests for client/vendor follow-up

- **Capability:** Requests tracks work explicitly asked of a couple/vendor across bookings. An event task can create a linked Request, but their statuses remain independent.
- **Evidence:** **VERIFIED FROM SOURCE** `app/(app)/requests/page.tsx`, `components/requests/request-manager.tsx`, `components/playbooks/event-task-list.tsx`.
- **Scope:** Distinguish Request from Task; do not promise status synchronization.
- **Confidence:** High source; medium delivery.
- **Recommendation:** **RECOMMEND AFTER FIX**

### 14. Use Calendar for planning work

- **Capability:** Month/Week/Day/Agenda views aggregate events and planning items; tasks can become scheduled activities with date/time/location.
- **Evidence:** **VERIFIED FROM SOURCE** `app/(app)/calendar/page.tsx`, `components/calendar/calendar-view.tsx`, `components/calendar/calendar-shared.tsx`, `TaskScheduleSection` in `components/playbooks/event-task-list.tsx`.
- **Scope:** Calendar is a view over source records, not a second source of truth.
- **Confidence:** High source.
- **Recommendation:** **RECOMMEND AFTER FIX**

### 15. Keep a personal wedding to-do list

- **Capability:** Couples can add, complete/reopen, and delete private to-dos with notes/category/due date, with time-bracket suggestions. These are separate from venue tasks.
- **Evidence:** **VERIFIED FROM SOURCE** `TodoSection` in `components/portal/portal-shell.tsx`, `app/api/portal/todos/route.ts`.
- **Scope:** Couple-facing article only; venue staff do not manage these.
- **Confidence:** High source; medium portal behavior.
- **Recommendation:** **RECOMMEND AFTER FIX**

### 16. Prepare Floor Plans and delegated Seating

- **Capability:** Venue owns room/table structure; couple owns guest placement; venue reviews submissions and edits only under per-plan delegation.
- **Evidence:** **VERIFIED FROM SOURCE** and **VERIFIED FROM DATABASE** as detailed in Section 1.
- **Scope:** Dedicated article after role/authorship decisions and browser verification.
- **Confidence:** High architecture; medium release state.
- **Recommendation:** **RECOMMEND AFTER FIX**

## Topics not safe to publish as working behavior

### Key Dates automatically remind clients
- **Capability:** No established capability.
- **Evidence:** **VERIFIED FROM SOURCE** reminder generation is tied to `event_tasks`; Key Dates are display records.
- **Scope:** None until a real notification workflow exists.
- **Confidence:** High.
- **Recommendation:** **DO NOT WRITE**

### Timeline automatically detects what is happening now
- **Capability:** No established capability; status is manually changed.
- **Evidence:** **VERIFIED FROM SOURCE** Wedding Day Timeline handlers.
- **Scope:** Do not promise wall-clock inference.
- **Confidence:** High.
- **Recommendation:** **DO NOT WRITE**

### Timeline reminders/automation and Timeline-created Requests
- **Capability:** No complete general user workflow established.
- **Evidence:** **VERIFIED FROM SOURCE** Timeline source and prior release audit show reserved/future integration, not operable contracts.
- **Scope:** Wait for concrete triggers/actions.
- **Confidence:** Medium-high.
- **Recommendation:** **DO NOT WRITE**

### Replace/unrelease an applied Planning checklist
- **Capability:** No coherent removal/replacement/unrelease workflow.
- **Evidence:** **VERIFIED FROM SOURCE** event UI exposes Apply and Release, not replacement/unrelease.
- **Scope:** Write only after lifecycle and safeguards exist.
- **Confidence:** High.
- **Recommendation:** **DO NOT WRITE**

### Ad-hoc event task creation
- **Capability:** No event-level create/delete path; tasks are generated by template application.
- **Evidence:** **VERIFIED FROM SOURCE** Playbook service and Event Task List.
- **Scope:** Future capability.
- **Confidence:** High.
- **Recommendation:** **DO NOT WRITE**

### Standalone Timeline workspace
- **Capability:** `/timeline` redirects to `/events`; Timeline is event-specific.
- **Evidence:** **VERIFIED FROM SOURCE** `app/(app)/timeline/page.tsx`.
- **Scope:** Never document `/timeline` as a workspace.
- **Confidence:** High.
- **Recommendation:** **DO NOT WRITE**

### Automatic Event Order reconciliation from seating
- **Capability:** None.
- **Evidence:** **VERIFIED FROM SOURCE** `lib/event-orders/` contains no seat-assignment/submission integration.
- **Scope:** Unbuilt and architecturally separate.
- **Confidence:** High.
- **Recommendation:** **DO NOT WRITE**

# 3. Findings Requiring Jennifer/Product Decision

1. **UNVERIFIED** Choose “couple delegation only” or “venue may initiate,” with exact consent, audit, notification, and revocation behavior.
2. **UNVERIFIED** Choose minimum roles for seating read, assignment/removal, submit, and revoke; current RPCs admit all accepted active venue staff.
3. **UNVERIFIED** Decide whether generic staff may see meal/accessibility details or read/write roles differ.
4. **VERIFIED FROM SOURCE** Decide whether multi-plan print selection is launch-required.
5. **UNVERIFIED** Decide whether the current list-based coordinator editor is sufficient before considering drag/drop/bulk parity.
6. **VERIFIED FROM SOURCE** Decide whether `couple_guests.table_number` is retained only for import compatibility or formally deprecated.
7. **VERIFIED FROM SOURCE** Use “Planning Templates” in customer help; keep “Playbook” internal unless Product chooses otherwise.
8. **VERIFIED FROM SOURCE** Decide whether Timeline help presents both template entry points or deliberately centers the venue-owned Library workflow.
9. **VERIFIED FROM SOURCE** Decide whether Key Date correction by delete/recreate is acceptable to document or article publication waits for edit.
10. **VERIFIED FROM SOURCE** Decide whether couple Personal To-Dos belong in this venue-help collection or a separate couple collection.
11. **UNVERIFIED** Decide whether background reminders/escalation may be documented before target-environment execution.

# 4. Findings That Should NOT Be Implemented

- **VERIFIED FROM SOURCE** Do not build a new coordinator seating model or duplicate the couple canvas.
- **VERIFIED FROM SOURCE** Do not grant direct venue RLS access to `guest_seat_assignments`.
- **VERIFIED FROM SOURCE** Do not use `couple_guests.table_number` for reconciliation.
- **VERIFIED FROM SOURCE** Do not synchronize seat assignments into Event Order, guest count, or Inventory.
- **VERIFIED FROM SOURCE** Do not merge Floor Plan Ready, Seating Submitted, and Event Order Finalized.
- **VERIFIED FROM SOURCE** Do not mutate historical seating submissions.
- **VERIFIED FROM SOURCE** Do not bypass delegation to expose the existing editor.
- **VERIFIED FROM SOURCE** Do not merge couple Personal To-Dos with venue-assigned Tasks.
- **VERIFIED FROM SOURCE** Do not synchronize linked Request and Task statuses implicitly.
- **VERIFIED FROM SOURCE** Do not document dead/reserved behaviors listed as **DO NOT WRITE**.

# 5. Recommended Next Actions

1. **UNVERIFIED** Jennifer/Product: decide seating authorship and exact minimum read/write roles.
2. **VERIFIED FROM SOURCE** Rename the ticket to “Harden existing delegated coordinator seating.”
3. **VERIFIED FROM SOURCE** Replace the borrowed portal-token plan list with venue-authenticated event-scoped Floor Plan listing.
4. **UNVERIFIED** Add role checks only after the role decision.
5. **VERIFIED FROM SOURCE** Normalize false-RPC API responses and add delegated-lifecycle/multi-plan regression coverage.
6. **UNVERIFIED** Browser-test owner/manager/coordinator/staff, same/cross venue, delegate/assign/move/remove/submit/revoke, couple read-only, tablet, and failed network.
7. **VERIFIED FROM SOURCE** Resolve the multi-plan print requirement.
8. **VERIFIED FROM DATABASE** Create the first Help batch from topics 1, 3, 4, 5, 8, 9, and 10; the local category currently has zero articles.
9. **UNVERIFIED** Browser-verify topics marked **RECOMMEND AFTER FIX** before publication; upgrade only exercised claims to **VERIFIED LIVE**.
10. **VERIFIED FROM SOURCE** Reject drafts claiming Key Dates send reminders, Timeline status changes automatically, a Planning checklist can be replaced/unreleased, or seating updates Event Order.

