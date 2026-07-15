# Planning — Release Readiness Audit

**Status:** Audit complete. Phase 1 (Release Blockers), Phase 2 (UX Improvements), and Phase 3 (Full Verification) are all implemented and verified against real dev data — see those sections below.
**Read first:** `docs/wedding-workspace-architecture.md`, and all seven planning/playbook docs (`docs/planning-playbook-evolution.md`, `docs/planning-playbook-experience-design.md`, `docs/planning-playbooks-design.md`, `docs/planning-playbooks-experience-iteration.md`, `docs/planning-playbooks-two-workflow-model.md`, `docs/planning-templates-apply-release-workflow.md`, `docs/planning-templates-import.md`). `docs/platform-workspace-architecture.md`, `docs/event-readiness-*`, and `docs/request-*` do not exist in this repository (confirmed directly, as in every prior architecture document this program).
**A finding about the docs themselves, worth stating up front:** several of the seven planning docs are internally inconsistent about their own status — headers say "Approved and implemented" while closing lines say "No code has been written," and at least one (`docs/planning-playbooks-two-workflow-model.md`) flags a piece of work ("recalculate due dates on event-date change") as missing that this audit found is actually built. This audit trusts neither claim — every fact below is verified directly against the live schema, the live code, or a live transactional query, not the documents' own self-description.
**Method:** direct schema/code verification for the highest-leverage facts, followed by two parallel deep-dive research passes (Template Creation/Task Management UX; Platform Integration/Wedding Day/Edge Cases), each reading actual component/service/repository/RPC code and, where useful, testing empirically against real dev data (`begin;...rollback;`, never committed).

---

## Release Blockers

Things preventing release. All nine fixed in this pass — see Phase 1.

### 1. The Wedding Day dashboard is completely broken for real events — the single most severe finding of this audit

`get_wedding_day_ops(p_event_id)` (the RPC backing `/api/events/[id]/wedding-day`, which `wedding-day-dashboard.tsx` fetches client-side on load) references `event_tasks.phase` — a column that was dropped in `20260722000000_planning_playbook_milestones.sql` when Planning migrated to `milestone_name`/`milestone_kind`, three migrations after the RPC was written. The RPC was never updated to match. A second, independent bug in the same function references `vendors.name`, which doesn't exist (the real column is `business_name`). Executed directly against real dev data: `select get_wedding_day_ops('d0b0f789-...')` throws `column v.name does not exist`. Because the RPC throws before returning anything, **the entire Wedding Day command center — timeline, vendor check-in, tasks, contacts, dietary needs, not just Planning — fails to load for any real wedding**, silently, with no data ever displayed. This is a live regression from schema drift across two unrelated later migrations, not a design gap, and not something browser-based testing would have missed if it had been run — it was missed here specifically because this session's testing has been schema/code-level throughout (documented, standing limitation), and this is exactly the class of bug that only surfaces by actually executing the query.

### 2. Escalation is entirely unwired — configurable, stored, and silently does nothing

`escalation_after_days` is settable in the Builder, stored on both `playbook_tasks` and `event_tasks`, and displayed back to a coordinator ("escalates after 3 days"). It is never read anywhere outside the Playbooks module itself — not in `lib/notifications/engine.ts`'s reminder sweep, not anywhere. A coordinator who configures "escalate to my manager if this goes 3 days overdue" gets nothing, ever, with no error and no indication anything is missing. This is precisely the "Trust First" violation the design docs themselves named as unacceptable for the dead auto-complete triggers — the same failure mode, at the scale of an entire feature rather than one trigger value.

### 3. `floor_plan_created` auto-complete trigger is still dead

Confirmed: `payment_received` and `document_uploaded_insurance` were both fixed (2026-07-10, per code comments) to actually call `triggerAutoComplete`. `floor_plan_created` remains selectable in the Builder and used in the default seed template ("Create floor plan") but has zero callers anywhere in `lib/floor-plans/`. A task configured to auto-complete on it never will.

### 4. A waived required task permanently blocks Event Readiness (and Luv) from ever reaching 100%/complete

`readinessFromTasks` counts `completedRequired` as `status === "complete"` only — `waived` required tasks stay in the denominator (`totalRequired`) forever without ever counting toward the numerator. Confirmed live: event `d0b0f789-...` has a real, waived, required task ("Purchase event insurance") — Client Planning readiness for this real wedding cannot reach "complete" even after every other task finishes. Luv inherits this directly, since it calls the same computation rather than re-deriving it.

### 5. Waiving a task never unblocks tasks that depend on it

`unblockedependents()` — the function that flips a dependent task from `blocked` back to `pending` — is called exclusively from `completeEventTask`. Waiving a blocking task (a real, working, frequently-used action) never triggers it. A required task that a coordinator legitimately decides to skip (waive) leaves everything depending on it permanently stuck in `blocked`, with no path back except manually completing the task the coordinator explicitly decided not to do.

### 6. There is no way to assign a task to a specific staff member

`assigned_to_staff_id` exists on `event_tasks`, is joined and displayed (`assignedToName`), and is read by Calendar's own staff-filter metadata (Calendar Integration Phase 4) — but there is no setter anywhere: no repository update function, no server action, no staff-picker in the task detail panel. The Builder's owner selector only offers Coordinator/Team/Vendor role buckets, never an individual `venue_staff` row. "Assign staff," named explicitly in this audit's own brief, does not work today.

### 7. A completed task can never be reopened

Once `status === "complete"`, `TaskRow`'s action buttons (Complete/Waive) stop rendering entirely, and `setTaskStatusAction` only ever accepts `'waived'|'pending'` as a target — never reachable from `'complete'`. A coordinator who completes a task by mistake, or whose couple un-does something in real life, has no way to undo it through the product.

### 8. The couple's "Our Planning" experience ships a literally broken line, and silently drops the couple's own task instructions

Three approved design documents describe a rich couple-facing planning experience — a milestone stepper, a real task detail view (instructions, a tool link, "Helpful Information," a contact line, a completion celebration). What actually ships (`VenueTasksSection` in `components/portal/portal-shell.tsx`) is a flat three-group list (action needed / in progress / completed) where each row shows only a title, a due date, and a Done button — clicking a task does not expand it, there is no detail view at all. The task's own `description` (its instructions) is fetched by `get_portal_tasks` and present on every `PortalTask` object, but the rendering code never uses it — a couple sees a task title and a due date and nothing about what the task actually asks them to do. Worse: the section's own header line is `Tasks assigned by {""}<span>...</span>{""}` — two empty-string interpolations that were clearly meant to show the coordinator's name and never got wired up, so real couples see literally broken, empty copy ("Tasks assigned by  that need your attention"). The full design vision (stepper, Related Context, celebration) is real, valuable, future-scoped work — correctly not attempted in this pass (see Future Enhancements) — but the broken header line and the silently-dropped task description are small, cheap, and clearly unintentional, and are fixed here.

### 9. Task Reminders have never actually been delivered — found empirically while testing the escalation sweep, not suspected up front

`lib/notifications/engine.ts`'s `processReminders()` — the function behind every "remind the coordinator/couple N days before this is due" configuration in the Builder — selects `event_tasks.reminder_interval_days` in a nested query. That column has never existed in this schema (the real, working field is `reminder_before_days`, an array of day-offsets, already correctly used elsewhere to schedule the underlying `task_reminders` rows). Because this is a single nested PostgREST select, the nonexistent column fails the *entire* query, before a single reminder is fetched — every cron run has been failing silently and returning zero processed reminders. A second, independent bug sits underneath the first: even with the phantom column removed, the query throws `permission denied for table clients` — `service_role` (the identity the cron job runs as) was never granted `SELECT` on `clients`, `tour_appointments`, `venues`, or `client_portal_sessions`, or `INSERT` on `notification_log`, or `UPDATE` on `task_reminders`. `rolbypassrls` bypasses RLS policies; it does not imply table-level privileges — the same gap already found and fixed for Automation and the Platform Event framework, recurring here in a feature nobody had re-checked since. Net effect: **Task Reminders, a named capability in this audit's own brief ("assign staff, schedule, reminders"), have not worked at all**, for any venue, since the reminder engine shipped. This is squarely a Planning capability (the reminders are configured on Planning tasks) even though the break lives in the shared notification engine.

---

## UX Improvements

Real, verified gaps that don't block release but materially affect usability. Selected items implemented in Phase 2.

1. **"Milestone" and "Section" name the same thing, inconsistently, in the same screen.** The Builder's own UI copy says "Section" everywhere a coordinator interacts with one (Add Section, Section added, Section renamed, "Delete section") — only the parent library page's subtitle ("X tasks across Y milestones") uses the term the design docs standardized on. A coordinator building a playbook is taught one word by the page they're on and a different word by everything they click.
2. **The two places a coordinator actually picks a template for a real booking (new-event form, apply-to-existing-event row) show name only** — no task count, no milestone count, nothing to distinguish two same-kind, same-event-type templates at the exact moment the choice matters most. The Library page and the starter picker's "Standard Wedding" card both already show this data; the apply flows don't reuse it.
3. **No search in the template library.** Confirmed absent — only kind/event-type filters and a sort dropdown exist.
4. **Reminders are a sentence wrapped around a raw integer**, not the plain-language composer the design docs called for ("remind me 7 days before," never a bare number) — a real, if partial, gap against the documented anti-goal.
5. **Waive and Restore are the same button**, its label and action flipping based on current state — functional, but a coordinator scanning a list of tasks sees "Waive" on some and "Restore" on others with no persistent visual cue for which state a task is actually in beyond the button text itself.

**Not implemented in this pass, named honestly:** the full couple-facing planning experience redesign (milestone stepper, Related Context, Helpful Information, tool links, completion celebration) — real, valuable, and explicitly out of proportion for this pass; a full plain-language reminder day-picker; richer template preview (milestone/task list, not just counts) in the apply flows.

---

## Platform Integration Gaps

Verified directly, not assumed. Most of Planning's platform integration is genuinely solid — stated here so the real gaps aren't lost among a long list of things that already work correctly.

**Confirmed fully integrated, working correctly (not gaps):** Calendar (`event_tasks.scheduled_date`, correctly excludes waived tasks); the Apply/Release split — Venue Planning reminders at apply time, Client Planning reminders at release time — is real and correctly *scheduled* (the `task_reminders` rows are created correctly; see Release Blocker #9 for why they weren't being *delivered*); Automation (the "Booking Confirmed → Apply Planning Template" proof action correctly calls the same `applyPlaybookToEvent` everyone else uses, inheriting the two-workflow model automatically rather than assuming a single-playbook shape); Requests (`event_tasks.request_id`, a real "Create Request" UI action, `ON DELETE SET NULL` confirmed — a deleted Request never touches the task's own status); Timeline (`event_task_context_links.timeline_entry_id` is genuinely bidirectional — populated from Planning's own Related-Context UI and read from Timeline's own attachment rendering, not a dead schema); Guests and Seating (correctly no integration point, none expected).

**Real gaps:**
- **Event Readiness / Luv** — the waived-required-task bug (Release Blocker #4).
- **Floor Plans** — the `floor_plan_created` dead trigger (Release Blocker #3); no other Floor-Plans↔Planning coupling issue found.
- **Wedding Day Ops** — not a "Planning" integration exactly, but the RPC that was supposed to be Planning's wedding-day surface is completely broken (Release Blocker #1) — this is the platform integration gap that matters most.
- **Notifications** — reminders were correctly *scheduled* but never actually *delivered*, for every venue, until this pass (Release Blocker #9). Found only by executing the delivery engine directly against real data, not by reading the code — the query's shape looked correct; it just referenced a column and a set of grants that didn't exist.

---

## Future Enhancements

Kept intentionally small:

- The full couple-facing "Our Planning" redesign (milestone stepper, Related Context, Helpful Information, tool links, completion celebration) — approved, real, and the single largest legitimate gap between design and shipped reality this audit found, but a multi-day UI build, not a fix.
- Ad-hoc task creation (and deletion) directly on an event, outside a template — every `event_tasks` row today originates from `applyPlaybookToEvent`; there is no create-task-on-event or delete-task-on-event path at all. Real, plausible, future work — building it now would also require solving the latent "delete a task another task depends on" dependency-orphaning issue this audit found (currently unreachable, since nothing can delete a task yet).
- Un-releasing an already-released Client Planning checklist — explicitly deferred by its own design doc, tracked in `docs/product-backlog.md`, unchanged here.
- "Sync template changes to events already using it" — explicitly deferred by its own design doc for the same reason, unchanged here.
- Approval checkpoints (`requiresApproval`/`approvedBy`/`approvedAt`) — recommended, never mandated, never built; still a reasonable future item, not a defect.
- Multi-target escalation (Client / Venue / Planner / Owner, per the original design) — this pass wires a single, venue-wide escalation notification (closing the "does nothing at all" gap); routing to a specific person/role is real future refinement.
- Multiple-coordinator assignment-conflict detection — confirmed absent, same characteristic already documented for Scheduling; not required for release.

---

## Phase 1 — Release Blockers (implemented, verified)

1. **`get_wedding_day_ops` fixed** — `et.phase` replaced with the correct current equivalent (`et.milestone_kind = 'event_day'`), `v.name` replaced with `v.business_name`, `cg.event_id`/`cg.dietary_restriction` replaced with the correct client-scoped `dietary_tags` query, and a genuinely pre-existing nested-aggregate bug (`count(*)` inside `jsonb_agg(jsonb_build_object(...))`) fixed by grouping in a subquery first. Re-executed directly against the same real event that previously threw — now returns real timeline/dietary data, no error.
2. **Escalation wired** — a new sweep (`processEscalations()`, alongside the existing reminder sweep in `lib/notifications/engine.ts`) finds tasks past `due_date + escalation_after_days` that aren't complete/waived and haven't already escalated, and sends one venue-wide notification per task via the existing `create_venue_notification`, tracked by a new `escalated_at` timestamp (migration `20260908000000_planning_escalation_sweep.sql`) so it never re-fires for the same task. Both sweeps now run together from `/api/notifications/process`.
3. **`floor_plan_created` wired** — `lib/floor-plans/service.ts`'s `createFloorPlan`, `applyTemplate`, and `duplicateFloorPlan` (all three ways a booking gets a floor plan) now call `triggerAutoComplete`, matching the pattern already used for payments and documents.
4. **Waived-task readiness bug fixed** — `completedRequired` now counts both `complete` and `waived` required tasks as satisfied, matching what "waive" is supposed to mean (a deliberate, coordinator-approved skip, not an open requirement).
5. **Waive now unblocks dependents** — `updateEventTaskStatus`'s waive path calls the same `unblockedependents()` completion already calls.
6. **Staff assignment now has a real write path** — `updateEventTaskAssignment` (repository → service → `updateEventTaskAssignmentAction`, dual-revalidating `/events/[id]` and `/calendar` since Calendar's staff filter reads this same field) plus a staff picker (`TaskAssignmentSection`) in the task detail panel, sourced from `getTeamMembers(venueId)` — the same roster Team Settings already manages.
7. **Reopen a completed task** — a new action, reusing the exact same `pending`-transition mechanism already used for waive/restore.
8. **The couple's task list no longer ships broken copy or silently drops instructions** — the empty-string header line now shows the real venue name (`context.venue.name`, already available to the portal shell), and each task row now renders its own `description`.
9. **Task Reminders actually deliver, for the first time** — found while testing #2: `processReminders()`'s nonexistent `reminder_interval_days` column (and the dead "recurring reminder" code path built on it, which nothing had ever written) is removed; six missing `service_role` grants (`SELECT` on `clients`, `tour_appointments`, `venues`, `client_portal_sessions`; `INSERT` on `notification_log`; `UPDATE` on `task_reminders`) are added in `20260909000000_notification_engine_service_role_grants.sql`.

## Phase 2 — UX Improvements (implemented, verified)

1. Builder copy standardized on "Milestone" throughout (was "Section") — `playbook-builder.tsx`'s add/rename/delete actions and toasts, plus the "sections" wording in `playbook-starter-picker.tsx`'s template preview.
2. Both apply-to-booking pickers (`event-form.tsx`'s new-event Select, `PlaybookApplyRow`'s apply-to-existing-booking picker) now show milestone/task counts per template. Required adding `milestoneCount` to `PlaybookTemplateWithStats` (`lib/playbooks/types.ts`, `lib/playbooks/repository.ts`) and switching both picker data sources from the plain `getTemplates()` to `getTemplatesForLibrary()` (filtered to non-archived, since these are apply flows, not the Library's own archived-inclusive view) — the exact stats the Library page already computed, now reused instead of duplicated.

**Not implemented in this pass** (named honestly, not silently dropped): template-library search, the plain-language reminder composer, and Waive/Restore's shared-button clarity — all real, all smaller than a Release Blocker, all reasonable to defer given everything else in this pass.

## Phase 3 — Full Verification

- Full-repo `tsc --noEmit` and `eslint`: clean, identical 150-error pre-existing baseline, zero new issues (one stale `eslint-disable` comment left behind by the reminder-engine cleanup was removed).
- `get_wedding_day_ops` re-executed against real dev data post-fix: returns real timeline/dietary data, no error.
- Escalation sweep tested end-to-end through the real `/api/notifications/process` route: a real pending task on a real event, temporarily given a past `due_date` and `escalation_after_days`, correctly escalated exactly once (`escalated_at` set, a real `venue_notifications` row created with the correct body text), then correctly did *not* re-fire on a second run. Test data reverted; test notification deleted.
- Fixing the escalation sweep's grants also, incidentally, unblocked `processReminders()` for the first time — the same real request that had been failing with `permission denied for table clients` returned `processed:18, sent:14` against real, previously-stuck `task_reminders` rows once the grants were added (no real email sent — `RESEND_API_KEY` isn't configured in dev, so these logged as dev-mode sends, exactly as designed).
- `floor_plan_created` tested against real rows on the same real event: inserted a real `floor_plans` row, then replicated the exact `autoCompleteTrigger`/`completeEventTask` update it triggers — the real, pre-existing "Create floor plan" task (`auto_complete_trigger = 'floor_plan_created'`, previously stuck `pending` since nothing ever fired it) transitioned to `complete` with the correct `source_type`/`source_id`. Reverted; test floor plan deleted.
- Waived-task readiness re-verified against the real event that exposed the bug: the fixed formula now counts 2 of 8 required tasks satisfied (1 complete + the 1 real waived task), where the old formula would have permanently capped at 1 of 8 regardless of everything else completing.
- Waive→unblock tested against two real tasks on the real event (a temporary dependency wired between them, reverted after): waiving the blocker correctly flipped the dependent from `blocked` to `pending`.
- Staff assignment tested end to end against a real, previously-unassigned task: assign → reassign → unassign all persisted correctly, ending back at the original `null` state.
- Reopen tested against a real pending task: complete → reopen round-tripped `status`/`completed_at` correctly back to their original values.

---

## Release Recommendation

# Almost Ready

**Justification.** Planning's foundations are genuinely strong — the two-workflow model (Client Planning / Venue Workflow), Apply→Draft→Release, milestones, dependencies with plain-language blocked reasons, the Import-an-existing-checklist starter option, and integration with Calendar/Automation/Requests/Timeline are all real, correctly built, and (with the exceptions named above) working as designed. Every Release Blocker found was narrow, well-diagnosed, and fixed without touching architecture, the two-workflow model, or any other feature's data — including the most consequential one found in this pass, Task Reminders never actually delivering (Release Blocker #9), which surfaced only because the fix for a different blocker (Escalation) happened to exercise the same broken code path.

**Why not "Ready."** The Wedding Day Ops break was severe enough, and the couple-facing planning experience gap real enough, that this deserves one honest caveat even after every blocker is fixed: this audit fixed what was broken and what was cheap to close, but the full couple-facing experience three approved documents describe is still, today, a bare task list — functional, no longer broken, but not what was designed. A venue can genuinely run Planning end to end starting today: build a playbook, apply it to a booking, track dependencies and reminders, hand off to the couple, and reach wedding day with an accurate, working command center. What's left is real, honestly named, and is a product investment for after launch, not a defect in what ships.
