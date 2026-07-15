# Planning Execution (Planning + Timeline) — Release Readiness Audit

**Status:** Audit complete, all three original Release Blockers closed ("Release Completion"), and a subsequent experience-polish pass complete with zero new Release Blockers found ("Experience Completion," at the very end of this document). The audit body below (everything through "Release Recommendation") is preserved exactly as originally written, for an accurate record of what was found before either round of fixes existed.
**Scope framing:** Planning and Timeline are audited here as one operational feature — "Planning Execution" — per the explicit instruction governing this pass. Both have already been through their own individual release-completion passes (`docs/planning-release-readiness.md`, `docs/timeline-release-readiness.md`, `docs/wedding-day-release-readiness.md`) — every blocker those three documents found is treated as fixed and verified here, not re-litigated. This audit's job is different and narrower: does the *seam* between Planning and Timeline, and the *workflow* a coordinator actually walks through booking-to-completion, hold together as one coherent feature — the question neither prior audit was asked.
**Method:** Direct code and live-schema verification, continuing this program's own methodology — no new agents spawned (an earlier pass this session lost two research agents to an account-wide session-limit reset; this audit stayed entirely within direct `Read`/`Grep`/`npx supabase db query --local` verification to avoid repeating that). Every finding below is traceable to a specific file, line, or live query result. Where a scenario could not be observed against real data (because the real dev dataset has never exercised that code path), this is stated explicitly, not glossed over as "confirmed."

---

## The Coordinator Journey, Walked End to End

Booking confirmed → apply playbook → venue tasks created → staff assignments → client planning → timeline building → requests → scheduled activities → wedding week → wedding day → completion. At each step: does it work, is it discoverable, is it in the right workspace, does ownership make sense, does it duplicate work, does it respect the venue/client boundary, is there a dead end?

1. **Booking confirmed → Apply playbook.** Works, discoverable, correctly scoped. `BookingSetupCard` surfaces the moment a booking has no Planning yet, self-gates once anything is applied, shows real milestone/task counts per template (fixed in the Planning pass) so the choice isn't blind. No dead end.
2. **Venue tasks created.** Real, immediate, correctly split from Client Planning (the two-workflow model holds). No duplicate work — one apply action, one set of tasks, snapshotted from the template, never re-derived.
3. **Staff assignments.** The write path is real (built in the Planning pass) — a coordinator can assign any venue task to a specific `venue_staff` row, and it persists correctly. **What happens after assigning is the first genuine dead end in the journey:** the assignee is never told (§7, §3), and no view anywhere lets anyone — the assignee, a manager, the owner — see "my/our assigned work" as a distinct list (§3). Assignment is real; being *operationally useful* to the person or team it's assigned to is not yet true.
4. **Client planning.** Real, correctly separate from Venue Planning, correctly snapshotted, Apply→Draft→Release all work. Progress is genuinely observable from the venue side without portal access (§2) — this step does not dead-end.
5. **Timeline building.** Real, venue-owned, fully editable (per the Timeline pass). The one friction found here specific to *Planning Execution* as a combined feature: nothing about finishing a Client/Venue Planning checklist nudges a coordinator toward building the Timeline next, or vice versa — they're two adjacent, unprompted entry points on the same event page, not a guided sequence. Minor, not a dead end (both are independently discoverable), but worth naming since the brief frames this as one journey.
6. **Requests.** Real bridge exists (`event_tasks.request_id`), correctly independent lifecycle. No new finding beyond what the Planning pass already confirmed.
7. **Scheduled activities.** Real feature, confirmed working when used — and confirmed, via a direct query against the live dev database, **never used**: zero rows anywhere have `scheduled_date` set. §4 traces why: there is no template-level path to it at all, only a per-task, per-event, manual toggle a coordinator has to already know exists. This is the second genuine dead end — not because the feature is broken, but because nothing in the normal apply-a-template workflow ever leads a coordinator to it.
8. **Wedding week.** No distinct "wedding week" concept exists in Planning or Timeline themselves — the closest real surface is Event Readiness's own proximity framing and Luv's "wedding approaching without a day-of timeline" observation (both already confirmed real and correctly wired in the prior passes). Not a dead end, but also not something Planning Execution itself owns or surfaces — worth naming as a boundary, not a gap.
9. **Wedding day.** The transition itself is the third genuine dead end, and the most important one this audit found: work does not *visibly* evolve into Wedding Day — it silently *qualifies* for Wedding Day, with zero indication anywhere in the day-to-day Planning UI of which tasks will appear there until the day itself (§6).
10. **Completion.** Task completion, dependency unblocking, and readiness scoring all work correctly (verified and fixed in the Planning pass). No new finding.

---

## 1. Venue Planning Workspace (coordinator-only, no portal impersonation)

Audited `app/(app)/tasks/page.tsx` + `components/tasks/task-center.tsx` (the one cross-booking venue-wide Planning surface) and `components/playbooks/event-task-list.tsx` (the per-booking surface).

| Capability the brief asks for | Works today? | Evidence |
|---|---|---|
| Understand what needs attention | **Yes** | Task Center: overdue / due today / due this week / blocked / upcoming, computed fresh across every active event, correctly excluding cancelled/complete events. |
| Work from assigned tasks | **No** | Task Center's own query never selects `assigned_to_staff_id` — confirmed directly in `app/(app)/tasks/page.tsx`. There is no "assigned to me" filter, view, or count anywhere in this page. See §3. |
| See venue responsibilities | **Yes, but undifferentiated from client responsibilities** | Both surfaces list every task regardless of `owner_type`, distinguished only by a small inline label when `owner_type !== "coordinator"`. |
| Understand client progress | **Yes** — see §2 | |
| Understand blocked work | **Yes** | `status: "blocked"` renders with a plain-language "Waiting on: [task title]" line (`dependsOnTitle`), both in Task Center and the per-event list. |
| Understand dependencies | **Yes**, for direct one-hop dependencies | Same `dependsOnTitle` mechanism. Multi-hop chains are not visualized (a task blocked by a task blocked by a task shows only its own immediate blocker) — real but minor, not investigated further as out of proportion to this pass. |
| Understand overdue work | **Yes** | Both surfaces compute overdue correctly, including a defensive app-layer recompute in Task Center ("DB status may lag between cron runs" — a deliberate, documented safeguard, not a bug). |
| Understand today's work | **Yes in Task Center** (`dueToday`), **no equivalent grouping in the per-event list** — a task due today is simply wherever it falls in that page's five status buckets, not called out. Minor. |

**"View Client Portal" dependency — investigated directly, not assumed either way.** The button still exists (`event-task-list.tsx`, reachable once a Client Planning checklist is released) — but tracing every "understand client progress" capability in §2 confirms **no coordinator workflow actually requires clicking it.** Milestone progress, task-level status (blocked/overdue/complete), and the readiness percentage are all real, already rendered, on the venue side. The button's only genuine use case left is a QA/support one — seeing the checklist exactly as the couple sees it, e.g. to sanity-check what was released — not a blocked operational task. **Not flagged as a Release Blocker on the "workflow depends on it" test, because it doesn't.** Its continued existence is a separate, already-documented finding (`docs/wedding-workspace-architecture.md` §5, §15): it's the one standing, unaudited path into a couple's workspace that Client Identity Foundation's consented-access model was built to replace. Real, worth closing eventually, but a privacy/architecture-boundary question, not a Planning Execution workflow gap — named here precisely rather than mechanically flagged.

---

## 2. Client Progress

Audited `PlaybookApplyRow`'s released-state view and `MilestoneStepper` (`components/playbooks/event-task-list.tsx`).

- **Progress visibility:** real — a percentage bar plus "X of Y complete," computed from the same `EventReadiness` object Event Readiness owns (no duplicate computation).
- **Milestone completion:** real — `MilestoneStepper` renders every milestone name in order, marks completed ones, highlights the current one. Confirmed it reads only `clientTasks` (couple-owned), not venue tasks — correctly scoped.
- **Blocked / overdue / completed client tasks:** all visible — because the per-event task list merges venue and client tasks into one set of status groups (Overdue / Waiting / Upcoming / Complete / Waived), a client task in any of those states appears exactly where a venue task would, with the same `dependsOnTitle` messaging and the same owner-type label.

**The one real gap:** client progress is *observable* but not *distinct*. A coordinator cannot see "just the couple's list" without mentally filtering the merged view (the `clientTasks` array exists in the component and feeds the milestone stepper, but nothing renders it as its own grouped section). Named as a UX Improvement, not a blocker — the underlying data is never hidden, only unsorted.

---

## 3. Staff Workspaces

**Determined directly: the current Planning experience does not support layered operational views. It is one list, shown identically to everyone, regardless of role.**

- `venue_staff.role` (`owner`/`manager`/`coordinator`/`staff`) exists and is real (Team's own roster). Nothing in Task Center or the per-event list reads it.
- `assigned_to_staff_id` exists, is populated (the Planning pass built the write path), and is even already read by Calendar's own staff filter (Month view) — but Task Center, the one page whose own header text says *"Your live event workspace... across all events,"* never selects it.
- There is no `?assignee=me` equivalent anywhere, no "My Tasks" tab, no manager-scoped "my team's tasks" view, no owner-scoped "everything" distinguished from anyone else's "everything" (today, everyone's view already *is* "everything" — the owner's default is accidentally correct, coordinators' and managers' are not).

This is the single most significant finding of this audit, precisely because the brief names it as the test and the prerequisite data already exists — a coordinator, a manager, and a venue owner logging into Wevenu today see the exact same Task Center, the exact same per-event list, with no lens between them and the full, venue-wide task load.

---

## 4. Timeline Integration

Audited `lib/playbooks/constants.ts` (`isScheduledActivity`, `TaskScheduleSection`), the `playbook_tasks`/`event_tasks` schema, and live data.

- **Structural duplication for pre-wedding activities: not possible, by construction.** Timeline entries have no date of their own (confirmed in the Timeline pass — `entry_time` is time-only, always implicitly "the wedding day"). A Planning scheduled activity dated three weeks before the wedding (a Final Walkthrough, a tasting) cannot be represented in Timeline at all — the two systems occupy genuinely disjoint date domains for this case. No duplicate scheduling risk here.
- **Structural duplication for wedding-day-of activities: real and unguarded, though unobserved in real data.** A task tagged `milestone_kind = 'event_day'` *can* also carry its own `scheduledDate`/`scheduledStartTime` (the same feature, just dated on the wedding day itself) — and nothing connects that timing to a same-subject Timeline entry, or vice versa. Timeline's own delay-recovery feature (`shiftEntriesAfter`, built in the Timeline pass) shifts Timeline entries only; a Planning task's independent `scheduledStartTime` is untouched by it. **Confirmed via direct query this has never actually happened** — zero `event_tasks` rows anywhere have `scheduled_date` set — so this is a latent, structural risk, not an observed bug. Named precisely as such.
- **Duplicate milestones:** not found. Planning's `playbook_milestones`/`milestone_kind` and Timeline's `timeline_sections` are unrelated concepts (task groupings vs. run-of-show chapters) with no naming collision found in real templates.
- **Duplicate ownership:** not found — every task has exactly one `assigned_to_staff_id`; every Timeline entry has its own, independently. No case where the same real assignment is tracked twice with room to disagree, because nothing links the two at the assignment level at all (they're simply two separate, never-reconciled facts).
- **Duplicate completion tracking:** not found — `event_tasks.status` and `timeline_entries.status` are separate state machines with no shared row, and (per the Timeline pass) the two systems' only real connection, `event_task_context_links.timeline_entry_id`, is a *reference* link ("see also"), never a status mirror.
- **The feature's own discoverability is the real problem, not duplication.** `playbook_tasks` has zero scheduling-related columns — a scheduled activity can never be part of a template, only added by hand, per task, per real event, after noticing a checkbox inside a task's detail panel. This fully explains why zero rows in the dev database have ever used it.

---

## 5. Calendar Integration

Audited `lib/calendar/service.ts` (Month view) and `lib/calendar/booking-schedule.ts` (per-booking view).

| Item type | Appears on Calendar? | Carries staff assignment (`assignedToStaffId`/`Name`)? | Links correctly? |
|---|---|---|---|
| `planning_activity` (Month view, scheduled activities) | Yes | **Yes** — `assigned_to_staff_id` selected and joined to `venue_staff.full_name` | Yes, to `#playbook` |
| `planning_task` (Booking Schedule, due-date tasks) | Yes | **No** — not selected in `booking-schedule.ts`'s construction of this item | Yes |
| `timeline_entry` (Booking Schedule) | Yes | **No** — same gap, despite Timeline entries genuinely having a working `assigned_to_staff_id` of their own (confirmed in the Timeline pass) | Yes, to `#timeline` |

**A real, concrete inconsistency:** the same piece of metadata (staff assignment) is correctly threaded through one Calendar view and silently dropped in another, for item types that would benefit from it the most — a single booking's own day-of schedule is exactly where "who's doing this" matters. This isn't a broken filter (Booking Schedule has no staff filter of its own to break) — it's a passthrough gap that would need closing the moment §3's layered-views gap is addressed, since a future Calendar-side "my work" filter would silently fail for these two item types today.

**Waived tasks correctly excluded** (re-confirmed, unchanged since the Planning pass). **Changing one place updates everywhere:** confirmed — `updateEventTaskSchedule`'s server action dual-revalidates `/events/[id]` and `/calendar`, and Timeline entry edits revalidate the same way; no stale-cache dead end found.

---

## 6. Wedding Day

**Does work naturally evolve into Wedding Day, or does it feel like a different feature? Confirmed: the latter, and precisely why.**

`get_wedding_day_ops`'s tasks block filters to `milestone_kind = 'event_day'` — a real, correct, already-fixed (Planning pass) query. The data driving it (`milestoneKind`) is denormalized onto every `EventTask` at apply time and is already present on every task object the frontend receives. **And yet:** grepped the entire Builder (`playbook-builder.tsx`) and the entire live task list (`event-task-list.tsx`) for any rendering of `milestoneKind`/`milestone_kind`/`event_day` — zero matches. No badge marks a task as "this is a wedding-day task." No section groups them. No preview anywhere in Planning shows a coordinator, in the weeks before the wedding, which of their tasks will surface on Wedding Day Ops.

The mechanism is correct and already verified working (Planning pass, Wedding Day pass). The *experience* of building toward it is not — a coordinator assembles a checklist for months with no visual thread connecting any of it to the day it's building toward, then opens a structurally separate page and discovers, after the fact, which tasks were "wedding day" tasks all along.

---

## 7. Operational Recovery

Each scenario traced through real code, not assumed:

- **Walkthrough moved** (a scheduled activity's date/time changes): the write path (`updateEventTaskSchedule`) is a pure field update — no downstream recomputation is needed or missing, because `reminder_before_days` is keyed to `due_date` only, never `scheduled_date` (a deliberate, already-documented separation — "a due date represents completion, a scheduled activity represents presence," per Calendar Integration Phase 2a). Recovers cleanly; nothing to break.
- **Vendor cancelled:** out of Planning Execution's own scope — no formal cancellation state exists for `event_vendor_assignments` at all (confirmed in the Wedding Day pass); not re-litigated here.
- **Weather delay:** Timeline's `shiftEntriesAfter` genuinely recovers the Timeline side of the day (verified in the Timeline pass). Does **not** cascade to any Planning wedding-day task with its own independent `scheduledStartTime` — the real-world consequence of §4's structural gap, though again, currently latent rather than observed (no real data exercises this).
- **Client finishes tasks late:** recovers correctly. `completeEventTask` has always called `unblockedependents()` (confirmed unchanged from the Planning pass, which only had to fix the *waive* path, not completion) — a late completion correctly unblocks whatever was waiting on it, no manual intervention needed.
- **Coordinator reassigns work:** **does not recover — it goes silent.** `notify_on_assign` is a real, Builder-configurable, per-task field (`notifyOnAssign`), stored and round-tripped correctly through every read/write path — and never read by any notification code anywhere in the codebase (confirmed via exhaustive grep: every hit is either the type definition or a mapper assigning the stored value, none is a conditional that acts on it). Reassigning a task to a colleague today produces zero signal to that colleague. They find out by opening the task list themselves.
- **Timeline shifts:** covered above (Weather delay) — recovers for Timeline itself, doesn't reach Planning.

**One more dead field found while tracing this section, not originally asked for but directly adjacent:** `notify_on_complete` is equally configurable, equally stored, equally never read. A real, unconditional DB trigger (`notify_task_completed`) does fire a coordinator-facing notification when a *couple or vendor* completes a task — but it fires unconditionally, ignoring the per-task `notify_on_complete` setting entirely, and it never fires for a *coordinator's own* completion regardless of the setting. A coordinator toggling this option in the Builder is configuring something that has no effect in either direction.

---

## 8. Platform Integration — ownership, not existence

Per the brief's own framing: not "does an integration exist," but "is Planning Execution the authoritative owner of this fact, and is anything else duplicating or ignoring it."

| Capability | Who owns the fact | Verified |
|---|---|---|
| **Calendar** | Planning Execution owns due dates/scheduled activities/Timeline entries; Calendar only ever reads and displays them (`event_tasks`, `timeline_entries` selected directly, nothing recomputed). Correct ownership. Gap found: §5's staff-metadata passthrough inconsistency — not an ownership violation, a completeness gap. |
| **Requests** | Requests owns its own lifecycle (`requests.status`); Planning links to it (`event_tasks.request_id`) without duplicating status. `ON DELETE SET NULL` confirmed (Planning pass) — a deleted Request never corrupts the task's own state. Correct. |
| **Notifications** | Planning owns escalation/reminder configuration; the shared notification engine owns delivery. Escalation and reminders are both now real (Planning pass fixed both). `notify_on_assign`/`notify_on_complete` are the exception: Planning stores the configuration, and **nothing owns acting on it** — not Planning, not Notifications. A genuinely orphaned fact, flagged in §7. |
| **Automation** | The one real automation action (`applyPlaybookToEvent` via "Booking Confirmed") correctly calls the same function a coordinator's own click uses — no parallel path. Correct. |
| **Luv** | Luv reads `EventReadinessSummary`, never recomputes Planning's own status — confirmed unchanged from the Planning pass. Correct, one-directional. |
| **Readiness** | `computeEventReadinessFromPlaybook`/`readinessFromTasks` are Planning's own functions; Event Readiness calls them, doesn't reimplement them. Correct — this is the platform's own reference example of the right pattern, not a gap. |
| **Wedding Day** | `get_wedding_day_ops` reads `event_tasks`/`timeline_entries` directly, filtered by `milestone_kind`/`audiences` — no separate wedding-day task list exists anywhere to drift out of sync. Correct ownership, undermined only by §6's visibility gap (the fact is owned correctly; nobody can *see* it coming). |
| **Documents** | Correct, one-directional: Planning *consumes* document facts (`document_uploaded`/`document_uploaded_insurance` auto-complete triggers, both confirmed wired in the Planning pass) — it does not track document state itself. |
| **Vendors** | Correct, one-directional: `vendor_selected` auto-complete trigger confirmed wired (`app/api/portal/vendors/route.ts`) — Planning reacts to Vendor Management's own fact, never re-derives "was a vendor selected" independently. |
| **Team** | Correct: `getTeamMembers(venueId)` (Team's own function) is the source for every staff picker in Planning — no shadow roster, no duplicated staff list. |

**No case found of Planning duplicating another feature's fact, or another feature duplicating Planning's.** The one real integration failure in this section is orphanhood, not duplication: `notify_on_assign`/`notify_on_complete` are facts Planning owns that literally nobody consumes.

---

## Release Blockers

1. **No layered staff views exist anywhere in Planning Execution** (§3). "My Tasks"/"Venue Tasks"/"Everything" — the brief's own explicit test — all resolve to the identical, undifferentiated view today, despite the underlying assignment data being real and correctly populated. This is the single most consequential finding of this audit: the data model supports exactly the experience the brief asks for; nothing built on top of it does.
2. **`notify_on_assign` is completely dead.** A coordinator reassigning work — one of the seven Operational Recovery scenarios the brief explicitly names as important — produces no signal to the newly-assigned person, despite a real, Builder-configurable field existing specifically for this and being stored correctly on every write.
3. **Wedding-day designation is invisible throughout the entire Planning-building experience** (§6). The mechanism is correct and already verified working; a coordinator has no way to see, while building or reviewing a checklist, which tasks are the ones that will matter on the day itself.

## UX Improvements

1. **`notify_on_complete` is equally dead**, and doubly misleading — an unrelated, unconditional trigger already covers a similar-sounding case (couple/vendor completion), making the per-task setting look redundant-but-harmless rather than simply inert.
2. **Client progress is observable but undifferentiated** (§2) — the data (`clientTasks`) already exists as its own set; nothing renders it as its own section.
3. **Calendar's Booking Schedule view silently drops staff-assignment metadata** for `planning_task` and `timeline_entry` items, while Month view's `planning_activity` correctly carries it (§5) — an inconsistency that will resurface the moment any Calendar-side "my work" filter is built on top of Booking Schedule.
4. **Scheduled Activities have no template-level path and, consistent with that, zero real-world usage** (§4) — a real, working feature that a coordinator can only discover by already knowing to look inside a task's own detail panel.
5. **The per-event task list has no "due today" grouping**, unlike the venue-wide Task Center, which does (§1) — a small inconsistency between the two surfaces that answer overlapping questions.

## Future Enhancements

Kept intentionally small, per this program's own standing discipline:

- Designing and building the actual "My Tasks / Venue Tasks / Everything" three-tier view (Release Blocker #1 names the gap; the view itself, its defaults, and its interaction with Calendar's own staff filter is real product design work, not a bug fix).
- A real Reference-Point/duration/sync model connecting Planning's scheduled activities and Timeline entries for wedding-day items — already named as Future Enhancement in the Timeline pass, reconfirmed relevant here as the long-term answer to §4's structural (if currently latent) duplication risk.
- A "coming up on wedding day" preview surfaced inside the everyday Planning tab, closing §6's visibility gap without redesigning Wedding Day Ops itself.
- Extending `assigned_to_staff_id` passthrough to Calendar's Booking Schedule item types (§5) — small, additive, deferred alongside the layered-views work it would actually serve.

---

## Release Recommendation

# Almost Ready

**Justification.** Every individual capability this audit walked — apply a playbook, assign staff, track client progress, build a Timeline, complete and unblock tasks, reach Wedding Day Ops with correct data — works, and works correctly, thanks to the two prior release-completion passes. No architecture is broken. No feature duplicates another's data. No workflow that must be possible today is actually blocked — including the one the brief was most concerned about, "View Client Portal": investigated directly and confirmed not to be a dependency, because client progress is genuinely visible from the venue side already.

**Why not "Ready."** Three Release Blockers, and they share one shape: real, correctly-built data with no operational surface on top of it. Staff assignment works as a *write*; it does nothing as a *read* a team can organize around. `notify_on_assign` is configured and stored; it notifies no one. Wedding-day tasks are correctly tagged; the tag is invisible until the day arrives. None of these are broken pipes — they're pipes that dead-end exactly at the point a coordinator, a manager, or a venue owner would need them to keep going. This is a different flavor of "almost ready" than either prior pass found (both of those were dominated by genuine bugs — schema drift, security gaps, silent failures); this one is dominated by real capability that was built and then never surfaced.

**What "Ready" requires, precisely:** close the three Release Blockers above. None require new data, a new table, or new architecture — every one is a view or a notification call sitting on top of a fact that already exists, correctly, in the database today.

---

## Release Completion

Executed against this audit as source of truth. No redesign — every fix below is exactly what the audit itself described as sufficient: a view or a notification call sitting on top of a fact that already existed. Planning's and Timeline's own underlying engines (per `docs/planning-release-readiness.md`, `docs/timeline-release-readiness.md`, `docs/wedding-day-release-readiness.md`) were not touched.

### 1. Staff-Centered Planning Views — built

**Task Center** (`app/(app)/tasks/page.tsx`, `components/tasks/task-center.tsx`) now offers **My Tasks / Team Tasks / All Tasks** as three lenses over the exact same query — one additional join (`assigned_to_staff_id`, `assignee:assigned_to_staff_id(full_name)`, `milestone_kind`), zero new queries, zero duplicated data:

- **My Tasks** filters every urgency bucket (Overdue/Blocked/Due Today/This Week/Upcoming) to `assigned_to_staff_id === currentStaffId` — a pure client-side filter over data already fetched.
- **Team Tasks** keeps every bucket and every row, but regroups within each bucket by assignee instead of by event (`StaffGroup`, parallel to the existing `EventGroup`) — the same rows, the same `TaskItem`, a different `Map` key.
- **All Tasks** is the page's original, unmodified behavior.

**The one genuine prerequisite the audit named — a staff-identity resolver — did not exist, and now does.** `getCurrentStaffMember(venueId)` (`lib/team/service.ts`) resolves the logged-in session's own `venue_staff` row via `user_id = auth.getUser().id`, the identical relationship `current_user_role()` already uses at the SQL layer for the exact same purpose. Identity resolution, not a new ownership or permission concept — confirmed directly against real data that owners have a real `venue_staff` row too (`role='owner'`, `user_id = venues.owner_user_id`), so one query correctly resolves every role.

**Default, not restriction, per the audit's own instruction ("do not invent new permissions"):** owners and managers default to All Tasks; coordinators and staff default to My Tasks (`currentRole` resolved via the existing `getCurrentUserRole()`). Every perspective stays switchable by everyone — nothing gates access, only which view opens first.

**Wedding Day designation is now visible everywhere the audit named**, not just Task Center — see §3 below.

### 2. Assignment Notifications — repaired

**`notify_on_assign`** (`lib/playbooks/repository.ts`'s `updateEventTaskAssignment`) now fires a real notification through the exact mechanism escalation already uses — `create_venue_notification`, the same venue-wide coordinator inbox every other operational event in this platform reports through. Gated on the task's own stored setting (not made unconditional) — "repair the intended behavior" was read literally: some tasks are meant to announce their assignment, others aren't, and that coordinator decision, stored since the Planning pass, now actually takes effect for the first time rather than being silently replaced with different logic. Only fires on a real assignment (never on unassign — nothing to announce there); `create_venue_notification` never throws, so a notification failure can never block the assignment itself.

**`notify_on_complete` audited, found to have exactly one real remaining gap, and wired.** The existing DB trigger (`_trigger_task_completed_notification`) already covers `completed_by IN ('couple','vendor')` unconditionally, ignoring this field entirely — confirmed by reading its live definition, not assumed. The one case it structurally cannot cover is a coordinator's own completion (`completed_by = 'coordinator'` is explicitly excluded in the trigger's own `WHERE`). `completeEventTask` now fires the identical `create_venue_notification` call, gated on `completedBy === 'coordinator' && notify_on_complete === true` — mutually exclusive with the DB trigger's own condition by construction, so the two can never double-fire for the same completion.

**Both verified end-to-end against real data**, not just read for correctness: a real task's `notify_on_assign`/`notify_on_complete` temporarily enabled, a real assignment and a real coordinator-completion performed, a real `venue_notifications` row confirmed created with the correct body text in both cases, then reverted — zero lingering test data.

### 3. Wedding-Day Visibility — exposed, and its own missing write path found and closed

**The audit's own finding undersold the gap by one layer.** `milestone_kind` wasn't just unrendered — `playbook_milestones.kind` could only ever be set by seed/migration code; the Builder had **no UI at all** to mark a milestone as Wedding Day when building a custom template. A coordinator writing their own checklist from scratch could never create a Wedding Day chapter through the product, only ever inherit one from the two standard starting templates. Found while implementing "expose `milestone_kind` throughout the Builder," not assumed going in — exactly the kind of thing this pass was instructed to fix if discovered.

**Closed with `setMilestoneKind`** (repository → service → `setMilestoneKindAction`), a small toggle in each milestone's own header in the Builder ("💍 Wedding Day"). Respects the schema's own constraint — at most one Wedding Day milestone per template (`playbook_milestones_one_event_day`, a partial unique index) — by clearing any other milestone in the same template that already holds it before setting the new one, so toggling it on *moves* the designation rather than failing on a constraint violation. Verified against real live templates: setting it on a template with none yet, and moving it from one milestone to another on a template that already had one — both confirmed correct via direct query, both reverted.

**Now rendered everywhere a coordinator actually looks while planning**, not only after the fact on Wedding Day Ops itself: a small "💍 Wedding Day" badge on any task whose `milestoneKind === 'event_day'`, in both the venue-wide Task Center and the per-booking task list (`event-task-list.tsx`). The same fact `get_wedding_day_ops` already reads correctly (verified in the Wedding Day pass) — nothing about that RPC changed; this only makes the fact visible earlier in the coordinator's own journey, which was the entire point.

**Timeline reviewed, deliberately left unchanged.** Every Timeline entry already belongs, by construction, to the wedding day itself — entries have no date of their own (confirmed in the Timeline pass). There is no "before vs. during" distinction for Timeline to draw the way there is for Planning tasks; adding a badge here would be decoration with nothing to distinguish. Named explicitly rather than silently skipped.

### Navigation Review

**"View Client Portal" removed.** The audit's own investigation (§1) already confirmed no coordinator workflow depends on it — milestone progress, task status, and the readiness percentage were all already rendered venue-side. Removed from both places it rendered: the Planning tab's own applied-checklist view (`PlaybookApplyRow` in `event-task-list.tsx`) and the Overview tab's early "Set up this booking" card (`BookingSetupCard`, which reuses the same component) — one removal closed both. The `portalToken` prop threaded through both component chains was removed alongside it, not left as dead plumbing.

**One related mechanism found and deliberately left alone, named honestly rather than silently expanded into:** `EventReadinessCard` has its own, separate `window.open('/p/{token}#{section}')` call, used across multiple Event Readiness sections — not just Planning's. This is out of Planning Execution's own scope: several of those sections (Guests, Budget, Seating) are genuinely client-owned with no venue-side equivalent page to link to instead, and determining which of them could safely lose this link would require auditing each section individually, not something this pass's brief covers. If the venue-boundary principle is meant to apply platform-wide, that's a dedicated follow-up, not a Planning Execution fix.

**No other portal or off-workspace navigation found** in Timeline's own components (confirmed via direct grep) — Timeline's own navigation was already fully contained inside the venue workspace.

### Verification

The full journey — Booking → Apply Planning Template → Assign staff → Coordinator receives notification → Work appears in My Tasks → Manager sees Team Tasks → Wedding Day tasks are clearly identified → Timeline → Wedding Day — was walked end to end, each link confirmed against real data or real code, not assumed correct because a prior link worked:

- Apply Planning Template: unchanged, already verified in the Planning pass.
- Assign staff: `updateEventTaskAssignment` re-confirmed correct (Planning pass) and now additionally fires the assignment notification, verified together in one test.
- Coordinator receives notification: a real `venue_notifications` row, correct type/title/body/link, confirmed created and then removed.
- Work appears in My Tasks: the PostgREST embedded-relationship query (`assignee:assigned_to_staff_id(full_name)`) confirmed correct — the identical pattern Calendar's own `planning_activity` item already uses successfully — and `venue_staff` confirmed grant-readable by the `authenticated` role the page actually runs as (a `service_role` grant gap was found incidentally while checking this, confirmed unrelated and unreachable — nothing in this codebase queries `venue_staff` via `service_role` today — noted, not fixed, as out of scope).
- Manager sees Team Tasks: `StaffGroup`'s grouping logic traced directly — same rows, regrouped by assignee, verified by code reading since no real task in the dev database currently has more than one distinct assignee to observe the grouping live against.
- Wedding Day tasks clearly identified: the Builder's toggle and both badge locations verified against real milestones and real tasks.
- Timeline: confirmed correctly unaffected — no date distinction exists for it to draw.
- Wedding Day: `get_wedding_day_ops` untouched, already verified correct in the Wedding Day pass; this pass only made the same fact visible earlier in the journey.

Full-repo `tsc --noEmit`: clean, zero errors (the same two pre-existing, unrelated stale `.next/types/validator.ts` errors noted in every prior pass this program, present before and after this one too). Full-repo `eslint`: 150 errors / 108 warnings — identical to the established baseline, zero new issues introduced.

### Updated Recommendation

# Ready

**Justification.** All three Release Blockers this audit identified are now closed, verified against real data, and match the audit's own precise description of what "Ready" would require — no new architecture, no new tables, every fix a view or a notification call over a fact that already existed correctly. The Navigation Review closed the one standing exception to "the venue should never need to enter another workspace" that this pass's own scope covered. A coordinator can now genuinely run Planning Execution end to end: apply a checklist, assign work to a specific person, have that person actually find out, see their own workload distinctly from the venue's whole workload or their team's, watch which tasks are building toward Wedding Day while they're still weeks away from it, and arrive at the day itself with a command center that was never a surprise about which tasks belonged there.

**What keeps this honest, not just optimistic:** everything named as a Future Enhancement in the original audit — a Reference-Point/duration/sync model between Planning's scheduled activities and Timeline entries for wedding-day items, a Request Framework bridge for Timeline, Timeline-derived notifications, the Calendar Booking-Schedule staff-metadata passthrough gap — remains real, remains unbuilt, and remains correctly out of this pass's scope. None of it blocks a venue from running a real wedding through Planning Execution today; all of it is genuine future investment, named honestly rather than folded into "Ready" by omission.

---

## Experience Completion

A second, deliberately different pass: not "does it work" (already closed above) but "does it feel intentional." Method: no new capability considered — only polish, discoverability, workflow continuity, and operational clarity, walked the way a brand-new coordinator would actually experience it, without reading a single line of documentation first. Every finding below is anchored to a specific file and line, read directly, not inferred.

### The onboarding-coordinator test

Landing on Task Center (`app/(app)/tasks/page.tsx`, `components/tasks/task-center.tsx`) cold: the exception band ("N items need attention today"), the Overdue/Blocked/Due Today/Due This Week/Upcoming ordering, the My Tasks/Team Tasks/All Tasks switcher, and the 👤/💍/blocked-reason inline markers on every row together answer every question the brief asks before a single task has to be read closely — where they start, what's important, what's theirs, what's blocked, what's overdue, what's due today. This page was already the strongest single screen in the product before this pass; confirmed, not rebuilt.

The Planning Templates library (`app/(app)/library/playbooks/page.tsx`, `components/settings/playbooks-section.tsx`) has an equally well-built first-run state for a brand-new venue with zero templates: a Sparkles icon, a plain-language heading ("No planning templates yet"), one clarifying sentence about the two-checklist model, and a direct starter picker — no dead end, no jargon.

**One real first-run gap found, not previously named:** the Builder (`playbook-builder.tsx`, lines ~818–838) renders *nothing* — no heading, no guidance sentence — when a coordinator starts a custom template completely from scratch (zero milestones yet). It falls straight to an audience-filter row and a bare "Add Milestone" button. Every other empty state audited across Planning already has a heading and a sentence of orientation (Task Center's "✅ Nothing needs attention," the Library's "No planning templates yet"); this is the one place that doesn't, and it's exactly the moment — building a checklist with nothing on the page yet — where a first-timer would most benefit from one line telling them what a Milestone even is before they're asked to name one.

### Terminology

Walked every term the brief names against real, rendered UI copy (not just code identifiers): **Planning** (nav, event tab, Task Center header, Library header) is the single, consistent umbrella term everywhere a coordinator actually reads it. **Playbooks** never appears in coordinator-facing copy except one place (below). **Templates** is used consistently for library items ("Planning Templates," template pickers). **Milestones** was already standardized venue-wide in the earlier Planning pass (Builder copy, task counts) — reconfirmed still true, no drift found. **Tasks**, **Timeline**, and **Wedding Day** are each used consistently and don't collide with one another anywhere audited.

**One real leak found:** `components/dashboard/getting-started.tsx` line 30 — the one-time onboarding milestone toast a brand-new coordinator sees the moment they build their first checklist reads **"Planning Playbook created!"** — the single coordinator-facing surface anywhere in the product still using "Playbook" where every other screen says "Planning." Small, seen once, but it's a new venue's very first encounter with this feature. Named as a UX Improvement, not fixed in this pass (a copy-only change, but this pass's own brief draws the line at Release Blockers only; see below for the one finding that did cross that line).

**One word shared by two different things, worth naming honestly rather than silently passing:** "Activity" means an audit-trail feed elsewhere in the product (Activity Timeline on Payments, Contracts, Leads, the portal's "Recent Activity") and means something different inside Planning — a "Scheduled Activity" is a task with a date/time a coordinator shows up to. The two-word compound keeps them from actually colliding on screen (no page shows both senses at once), so this doesn't rise to a real confusion risk today — named per the brief's own instruction to flag it, not because it needs a rename.

### Navigation and visibility — the one Release Blocker this pass found

Walking Planning → Timeline → Calendar → Wedding Day → Requests → Floor Plans → Seating exactly as a coordinator would: every one of these is at most one click from a real booking except **Requests**, and the reason isn't structural — it's that the entry point itself was still branded as a developer tool.

`RequestSummaryCard` (rendered on every booking's own Overview tab) links to `/requests` via "Open Request Dashboard →." Before this pass, that link landed on a page whose own `<h1>` read **"Requests (Internal)"** and whose subtitle read **"Framework verification page — create, assign, and move requests through their lifecycle."** The sidebar's own nav label read **"Requests (Internal)"** on every screen, permanently. This was not a stale comment nobody sees — `components/requests/request-manager.tsx`'s own header comment confirms the underlying feature was already finished ("Started as an internal verification-only page... this completes it into the real venue-side Request experience: filters, assignment, due-date ordering, and Origin") — the *component* was completed; only the *entry points* — the page title, the `<h1>`, the subtitle, and the sidebar label — never caught up to that fact. A real coordinator, following the exact path the brief names ("moving between Planning, Timeline, Calendar, Wedding Day, Requests... without feeling like they left one workflow"), would land on a page that told them, in its own words, that they'd wandered into a developer's leftover QA scaffold. That's not a matter of taste — it's shipped, customer-visible copy that misrepresents a real, working feature as unfinished, on the one workflow this pass's own brief called out by name. Classified as a **Release Blocker** and fixed (below), not carried forward as polish.

Everything else in this section held up: Planning ↔ Timeline are two adjacent, independently-discoverable entry points on the same event page (a known, already-documented minor friction from the original audit, unchanged); Calendar is one click away via "Booking Schedule" in the event header; Floor Plans and Seating are a tab and a direct link respectively, both reachable without leaving the booking; "View Client Portal" is already gone (prior pass). No other off-workspace or unexplained navigation jump was found.

### Wedding Day — progressively important, or switched on all at once?

The brief asks specifically whether Wedding Day work *feels* progressively more important as the date approaches. Traced the actual code path (`components/events/event-detail.tsx` lines 353–376): the "✦ Today's Dashboard" button and the gradient Wedding Day banner both render exclusively on `daysUntil(event.eventDate) === 0` — the literal day, and only that day. There is no visual signal in the days or weeks before — no countdown, no gradually-warming treatment — beyond the 💍 Wedding Day badges the Release Completion pass already added to individual tasks (which do correctly build anticipation task-by-task, just not at the event level). The mechanism is binary, not progressive: invisible, then suddenly fully present. Real, and it's precisely the kind of "flip a switch vs. build gradually" distinction the brief's own framing draws — but it's an additive, bounded enhancement (an event-level countdown treatment), not something broken today. Named as a UX Improvement, not implemented here.

### Recoverability

Re-walked the "coordinator returns after several days away" scenario against the now-completed Task Center: overdue/blocked items surface in their own top-priority sections with an exception count banner, not buried in a single long list — this already is the "help them recover" experience the brief asks for, not merely a task dump. No new gap found here; the Release Completion pass's own staff-perspective and notification work already closes what used to be missing.

### Delight

Confirmed already present and working: Task Center's "✅ Nothing assigned to you needs attention right now" empty state, the warm/restrained completion toasts (`celebrateCompletion` in `event-task-list.tsx` — a quiet confirmation for venue tasks, a "🎉 Nicely done" for client-facing ones), and the Library's guided zero-template state. The one place this pattern doesn't yet reach is the Builder's blank-milestone-list state, named above.

### What was implemented (the one Release Blocker)

**Requests' entry-point copy corrected to match the real, already-completed feature behind it** — no functional change, no schema change, exactly matching this pass's own "polish, not capability" scope:
- `lib/navigation.ts` — sidebar label: "Requests (Internal)" → "Requests."
- `app/(app)/requests/page.tsx` — page `<title>`, `<h1>`, and subtitle rewritten in venue language ("Requests" / "Everything you've asked a couple or vendor to do, across every booking — assign it, track it, and see where it stands"), replacing the leftover "(Internal)" / "Framework verification page" copy.
- `app/(app)/requests/[id]/page.tsx` — page `<title>` corrected to match ("Request — Wevenu").

No change to `RequestManager`, `RequestDetail`, filters, assignment, or any data path — all of that was already real and correct; only the words a coordinator sees on arrival changed.

### Reclassified findings

**Release Blockers — none remain.** The one finding that met this pass's own bar ("genuinely prevents release," not merely suboptimal) is fixed above.

**UX Improvements (real, verified, deliberately not implemented this pass):**
1. Builder's from-scratch empty state (zero milestones) has no heading or guidance, unlike every other empty state audited in Planning.
2. "Planning Playbook created!" — the one onboarding-milestone toast still using "Playbook" instead of "Planning."
3. Wedding Day awareness is binary at the event level (invisible until `daysUntil === 0`, no lead-up countdown), even though it's now correctly progressive at the individual-task level (💍 badges).
4. Requests' nav placement (under "Operations," alongside Settings/Analytics) sits further from Task Center than its actual daily-use frequency warrants — a grouping question, not a labeling one; the labeling itself is fixed above.
5. Everything already carried forward, unchanged, from the original audit's own UX Improvements list (client-progress differentiation, per-event "due today" grouping, Calendar's staff-metadata passthrough gap, `notify_on_complete`'s now-closed-but-still-worth-noting redundancy) — none revisited here, none newly at risk.

**Future Enhancements:** unchanged from the original audit and the Release Completion pass — nothing new added, nothing dropped.

### Verification

Full-repo `tsc --noEmit`: clean, the same two pre-existing, unrelated stale `.next/types/validator.ts` errors present before and after this pass. Full-repo `eslint`: 150 errors / 108 warnings — identical to the established baseline (a transient 151st error, an unescaped apostrophe in the new Requests subtitle copy, was caught and fixed before this count was taken). Confirmed via direct grep that no other user-visible "(Internal)" or similarly leftover-sounding copy exists anywhere else in `app/`, `components/`, or `lib/`.

### Updated Recommendation

# Ready

**Justification.** This pass changed nothing about whether Planning Execution works — that question was already closed. It asked a different, narrower question: does it feel finished? Walking it cold, as a brand-new coordinator, the answer is yes almost everywhere already, on the strength of work done in the two prior passes — Task Center in particular is now the product's strongest single screen. The one place the experience actively undercut its own credibility — a real, working feature whose front door still called itself a developer's internal test page — is now fixed. Everything else found is genuine, named honestly, and correctly small: an empty state missing a sentence, one onboarding toast using an old word, a countdown that could exist but doesn't yet. None of it is a reason to hold the release; all of it is a reasonable next-pass list, not a defect in what ships today.
