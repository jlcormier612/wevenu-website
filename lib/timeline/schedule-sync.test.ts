import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  applyScheduleLinkedContentProtection,
  dayOffsetForScheduledDate,
  expectedScheduleLinkedContent,
  planScheduleTimelineSync,
  SCHEDULE_LINKED_UNLOCK_BLOCKED_MESSAGE,
  SCHEDULE_SAVED_TIMELINE_MANUAL_MESSAGE,
  scheduleLinkedContentDiverged,
  scheduleLinkedMilestoneMatchesSchedule,
  scheduleSyncWriteForExistingRow,
  spaceDescription,
} from "@/lib/timeline/schedule-sync";

describe("schedule → timeline sync", () => {
  const multiDay = {
    eventDate: "2028-03-29",
    eventEndDate: "2028-03-30",
    assignments: [
      {
        useKey: "rehearsal_dinner",
        useLabel: "Rehearsal Dinner",
        spaceName: "Meadowbrook Barn",
        startTime: "18:00",
        endTime: "21:00",
        scheduledDate: "2028-03-29",
        sortOrder: 0,
      },
      {
        useKey: "getting_ready",
        useLabel: "Getting Ready",
        spaceName: "Meadowbrook Villa",
        startTime: "14:00",
        endTime: "16:00",
        scheduledDate: "2028-03-30",
        sortOrder: 1,
      },
      {
        useKey: "ceremony",
        useLabel: "Ceremony",
        spaceName: "Brook Bridge",
        startTime: "18:00",
        endTime: "22:00",
        scheduledDate: "2028-03-30",
        sortOrder: 2,
      },
      {
        useKey: "reception",
        useLabel: "Reception",
        spaceName: "Meadowbrook Barn",
        startTime: "16:00",
        endTime: "17:00",
        scheduledDate: "2028-03-30",
        sortOrder: 3,
      },
      {
        useKey: "cocktail_hour",
        useLabel: "Cocktail Hour",
        spaceName: "Meadow Lawn",
        startTime: "17:00",
        endTime: "18:00",
        scheduledDate: "2028-03-30",
        sortOrder: 4,
      },
    ],
    existing: [] as Array<{ id: string; sourceSpaceUseKey: string | null; lockState: string }>,
  };

  it("maps each configured component to the correct day, times, and space description", () => {
    assert.equal(dayOffsetForScheduledDate("2028-03-29", "2028-03-29"), 0);
    assert.equal(dayOffsetForScheduledDate("2028-03-29", "2028-03-30"), 1);
    assert.equal(dayOffsetForScheduledDate("2028-03-29", null), null);
    assert.equal(spaceDescription("Meadowbrook Barn"), "Space: Meadowbrook Barn");

    const plan = planScheduleTimelineSync(multiDay);
    assert.equal(plan.upserts.length, 5);
    assert.equal(plan.deleteIds.length, 0);

    const byKey = Object.fromEntries(plan.upserts.map((u) => [u.useKey, u]));
    assert.equal(byKey.rehearsal_dinner!.dayOffset, 0);
    assert.equal(byKey.rehearsal_dinner!.entryTime, "18:00");
    assert.equal(byKey.rehearsal_dinner!.endTime, "21:00");
    assert.equal(byKey.rehearsal_dinner!.description, "Space: Meadowbrook Barn");

    assert.equal(byKey.ceremony!.dayOffset, 1);
    assert.equal(byKey.ceremony!.entryTime, "18:00");
    assert.equal(byKey.ceremony!.endTime, "22:00");
    assert.equal(byKey.reception!.entryTime, "16:00");
    assert.equal(byKey.reception!.endTime, "17:00");
    assert.equal(byKey.cocktail_hour!.entryTime, "17:00");
  });

  it("does not invent the overall event date when scheduled_date or start is missing", () => {
    const plan = planScheduleTimelineSync({
      ...multiDay,
      assignments: [
        {
          useKey: "ceremony",
          useLabel: "Ceremony",
          spaceName: "Brook Bridge",
          startTime: "18:00",
          endTime: "19:00",
          scheduledDate: null,
          sortOrder: 0,
        },
        {
          useKey: "reception",
          useLabel: "Reception",
          spaceName: "Barn",
          startTime: null,
          endTime: "22:00",
          scheduledDate: "2028-03-30",
          sortOrder: 1,
        },
      ],
    });
    assert.equal(plan.upserts.length, 0);
  });

  it("is idempotent — existing generated rows update in place, not duplicate", () => {
    const first = planScheduleTimelineSync(multiDay);
    const existing = first.upserts.map((u, i) => ({
      id: `id-${i}`,
      sourceSpaceUseKey: u.useKey,
      lockState: "editable",
    }));
    const second = planScheduleTimelineSync({ ...multiDay, existing });
    assert.equal(second.upserts.length, 5);
    assert.ok(second.upserts.every((u) => u.existingId));
    assert.equal(second.deleteIds.length, 0);
  });

  it("updates schedule-derived rows and removes obsolete generated keys without touching manuals", () => {
    const plan = planScheduleTimelineSync({
      ...multiDay,
      assignments: multiDay.assignments.slice(0, 2),
      existing: [
        { id: "gen-1", sourceSpaceUseKey: "rehearsal_dinner", lockState: "editable" },
        { id: "gen-2", sourceSpaceUseKey: "getting_ready", lockState: "editable" },
        { id: "gen-gone", sourceSpaceUseKey: "ceremony", lockState: "editable" },
        { id: "manual-1", sourceSpaceUseKey: null, lockState: "editable" },
        { id: "couple-shaped", sourceSpaceUseKey: null, lockState: "editable" },
      ],
    });
    assert.equal(plan.upserts.length, 2);
    assert.deepEqual(plan.deleteIds, ["gen-gone"]);
    assert.deepEqual(plan.detachIds, []);
    assert.ok(!plan.deleteIds.includes("manual-1"));
  });

  it("retains a locked generated row by detaching it when its component is removed", () => {
    const plan = planScheduleTimelineSync({
      ...multiDay,
      assignments: multiDay.assignments.slice(0, 1),
      existing: [
        { id: "keep", sourceSpaceUseKey: "rehearsal_dinner", lockState: "editable" },
        { id: "locked-gone", sourceSpaceUseKey: "ceremony", lockState: "locked" },
      ],
    });
    assert.deepEqual(plan.deleteIds, []);
    assert.deepEqual(plan.detachIds, ["locked-gone"]);
    assert.equal(plan.upserts.find((u) => u.useKey === "ceremony"), undefined);
  });

  it("skips overwriting locked schedule-derived entries", () => {
    const plan = planScheduleTimelineSync({
      ...multiDay,
      assignments: [multiDay.assignments[0]!],
      existing: [
        { id: "locked-1", sourceSpaceUseKey: "rehearsal_dinner", lockState: "locked" },
      ],
    });
    assert.equal(plan.upserts[0]!.skipContent, true);
    assert.equal(plan.upserts[0]!.existingId, "locked-1");
  });

  it("preserves fixed, wedding-end, and unknown timing when the schedule day changes", () => {
    const fixed = scheduleSyncWriteForExistingRow(
      { dayIntent: "fixed", dayAnchor: null, clockIntent: "explicit", dayOffset: 0, entryTime: "18:00" },
      { dayOffset: 2, entryTime: null },
    );
    assert.equal(fixed.dayOffset, 0);
    assert.equal(fixed.entryTime, null);
    assert.equal(fixed.timingColumns.timing_clock_intent, "untimed");
    assert.equal("timing_day_intent" in fixed.timingColumns, false);

    const endAnchored = scheduleSyncWriteForExistingRow(
      { dayIntent: "relative", dayAnchor: "event_end", clockIntent: "untimed", dayOffset: 1, entryTime: null },
      { dayOffset: 3, entryTime: "12:00" },
    );
    assert.equal(endAnchored.dayOffset, 1);
    assert.equal(endAnchored.timingColumns.timing_clock_intent, "explicit");
    assert.equal("timing_relative_day_offset" in endAnchored.timingColumns, false);

    const unknown = scheduleSyncWriteForExistingRow(
      { dayIntent: "unknown", dayAnchor: null, clockIntent: "unknown", dayOffset: 0, entryTime: "18:00" },
      { dayOffset: 1, entryTime: "19:00" },
    );
    assert.equal(unknown.dayOffset, 1);
    assert.deepEqual(unknown.timingColumns, {});

    const sync = readFileSync(resolve("lib/timeline/schedule-sync.ts"), "utf8");
    assert.match(sync, /scheduleSyncWriteForExistingRow/);
    assert.doesNotMatch(sync, /projectTimingAfterEventDateChange/);
  });

  it("wires sync on schedule save only, atomically, and not on timeline read", () => {
    const assignments = readFileSync(resolve("lib/events/space-assignments.ts"), "utf8");
    assert.match(assignments, /syncTimelineFromEventSpaceAssignments/);
    const service = readFileSync(resolve("lib/timeline/service.ts"), "utf8");
    const getter = service.slice(
      service.indexOf("export async function getTimelineEntries"),
      service.indexOf("export async function addEntry"),
    );
    assert.doesNotMatch(getter, /syncTimelineFromEventSpaceAssignments/);
    assert.match(getter, /Opening Timeline must not write/);
    const sync = readFileSync(resolve("lib/timeline/schedule-sync.ts"), "utf8");
    assert.match(sync, /reconcile_timeline_from_schedule/);
    assert.doesNotMatch(sync, /\.from\("timeline_entries"\)\s*\n\s*\.update/);
    assert.doesNotMatch(sync, /\.from\("timeline_entries"\)\s*\n\s*\.insert/);
    assert.doesNotMatch(sync, /\.from\("timeline_entries"\)\s*\n\s*\.delete/);
    assert.doesNotMatch(sync, /\.from\("event_space_assignments"\)/);
    const syncFn = sync.slice(sync.indexOf("export async function syncTimelineFromEventSpaceAssignments"));
    assert.match(syncFn, /p_venue_id:\s*venueId/);
    assert.match(syncFn, /p_event_id:\s*eventId/);
    assert.doesNotMatch(syncFn, /p_updates/);
    assert.doesNotMatch(syncFn, /p_inserts/);
    assert.doesNotMatch(syncFn, /planScheduleTimelineSync/);
    assert.doesNotMatch(syncFn, /applyScheduleLinkedContentProtection/);
    const mig = readFileSync(
      resolve("supabase/migrations/20261424500000_timeline_schedule_reconcile.sql"),
      "utf8",
    );
    assert.match(mig, /for update/);
    assert.match(mig, /from public\.event_space_assignments/);
    assert.match(mig, /source_space_use_key is not null/);
    assert.match(mig, /lock_state = 'locked'/);
    assert.match(mig, /owner = 'venue'/);
    assert.match(mig, /source_space_use_key = null/);
    assert.match(mig, /timeline_clamp_day_offset/);
    assert.match(mig, /drop function if exists public\.reconcile_timeline_from_schedule\(uuid, uuid, jsonb, jsonb, uuid\[\], uuid\[\]\)/);
    assert.match(mig, /create or replace function public\.reconcile_timeline_from_schedule\(\s*p_venue_id uuid,\s*p_event_id uuid\s*\)/s);
    assert.doesNotMatch(mig, /p_updates/);
    assert.match(mig, /v_day_intent = 'fixed'/);
    assert.match(mig, /v_day_anchor = 'event_end'/);
    const repo = readFileSync(resolve("lib/timeline/repository.ts"), "utf8");
    assert.match(repo, /scheduleLinkedContentDiverged/);
    assert.match(repo, /applyScheduleLinkedContentProtection/);
    assert.match(repo, /SCHEDULE_LINKED_UNLOCK_BLOCKED_MESSAGE/);
    assert.match(repo, /scheduleLinkedMilestoneMatchesSchedule/);
    assert.doesNotMatch(repo, /source_space_use_key = null/);
  });

  it("detaches only when venue content changes, not on lock-only saves", () => {
    const current = {
      title: "Ceremony",
      description: "Space: Barn",
      notes: null,
      entryTime: "16:00:00",
      dayOffset: 0,
    };
    assert.equal(
      scheduleLinkedContentDiverged(current, {
        title: "Ceremony",
        description: "Space: Barn",
        entryTime: "16:00",
        dayOffset: 0,
      }),
      false,
    );
    assert.equal(
      scheduleLinkedContentDiverged(current, {
        title: "Ceremony seating note",
        description: "Space: Barn",
        entryTime: "16:00",
        dayOffset: 0,
      }),
      true,
    );
    assert.equal(
      scheduleLinkedContentDiverged(current, {
        title: "Ceremony",
        description: "Space: Barn",
        notes: "bring chairs",
        notesProvided: true,
        entryTime: "16:00",
        dayOffset: 0,
      }),
      true,
    );
  });

  it("keeps the schedule link and locks on an intentional content edit", () => {
    const patch: Record<string, unknown> = {
      title: "Ceremony seating note",
      lock_state: "editable",
      source_space_use_key: null,
    };
    applyScheduleLinkedContentProtection(patch);
    assert.equal(patch.lock_state, "locked");
    assert.equal("source_space_use_key" in patch, false);
    assert.equal(patch.title, "Ceremony seating note");
  });

  it("does not insert a duplicate or overwrite a locked linked milestone", () => {
    const ceremony = {
      useKey: "ceremony",
      useLabel: "Ceremony",
      spaceName: "Barn",
      startTime: "16:00",
      endTime: "17:00",
      scheduledDate: "2028-03-29",
      sortOrder: 0,
    };
    const kept = planScheduleTimelineSync({
      eventDate: "2028-03-29",
      eventEndDate: "2028-03-29",
      assignments: [ceremony],
      existing: [{ id: "edited-1", sourceSpaceUseKey: "ceremony", lockState: "locked" }],
    });
    assert.equal(kept.upserts.length, 1);
    assert.equal(kept.upserts[0]?.existingId, "edited-1");
    assert.equal(kept.upserts[0]?.skipContent, true);
    assert.deepEqual(kept.deleteIds, []);
    assert.deepEqual(kept.detachIds, []);

    const moved = planScheduleTimelineSync({
      eventDate: "2028-03-29",
      eventEndDate: "2028-03-29",
      assignments: [{ ...ceremony, startTime: "18:00", useLabel: "Ceremony moved" }],
      existing: [{ id: "edited-1", sourceSpaceUseKey: "ceremony", lockState: "locked" }],
    });
    assert.equal(moved.upserts[0]?.skipContent, true);
    assert.equal(moved.upserts[0]?.existingId, "edited-1");
    assert.equal(moved.upserts.filter((u) => u.existingId == null).length, 0);
  });

  it("retains and detaches a locked milestone when its component is removed", () => {
    const plan = planScheduleTimelineSync({
      eventDate: "2028-03-29",
      eventEndDate: "2028-03-29",
      assignments: [],
      existing: [{ id: "edited-1", sourceSpaceUseKey: "ceremony", lockState: "locked" }],
    });
    assert.deepEqual(plan.deleteIds, []);
    assert.deepEqual(plan.detachIds, ["edited-1"]);
    assert.deepEqual(plan.upserts, []);
  });

  it("may create a new milestone after removal without merging the detached row", () => {
    const plan = planScheduleTimelineSync({
      eventDate: "2028-03-29",
      eventEndDate: "2028-03-29",
      assignments: [{
        useKey: "ceremony",
        useLabel: "Ceremony",
        spaceName: "Barn",
        startTime: "16:00",
        endTime: null,
        scheduledDate: "2028-03-29",
        sortOrder: 0,
      }],
      existing: [{ id: "retained-1", sourceSpaceUseKey: null, lockState: "locked" }],
    });
    assert.equal(plan.upserts.length, 1);
    assert.equal(plan.upserts[0]?.existingId, null);
    assert.equal(plan.upserts[0]?.skipContent, false);
    assert.deepEqual(plan.deleteIds, []);
    assert.deepEqual(plan.detachIds, []);
  });

  it("leaves manual rows with no schedule key out of reconcile identity", () => {
    const plan = planScheduleTimelineSync({
      eventDate: "2028-03-29",
      eventEndDate: "2028-03-29",
      assignments: [{
        useKey: "ceremony",
        useLabel: "Ceremony",
        spaceName: "Barn",
        startTime: "16:00",
        endTime: null,
        scheduledDate: "2028-03-29",
        sortOrder: 0,
      }],
      existing: [{ id: "manual-1", sourceSpaceUseKey: null, lockState: "editable" }],
    });
    assert.equal(plan.upserts[0]?.existingId, null);
    assert.deepEqual(plan.deleteIds, []);
    assert.deepEqual(plan.detachIds, []);
  });

  it("surfaces the manual Timeline message only when the schedule saved and sync failed", () => {
    assert.equal(
      SCHEDULE_SAVED_TIMELINE_MANUAL_MESSAGE,
      "Your schedule was saved, but the Timeline could not be updated. Please update the corresponding Timeline entries manually to reflect your schedule changes.",
    );
    const assignments = readFileSync(resolve("lib/events/space-assignments.ts"), "utf8");
    const catchBlock = assignments.slice(assignments.indexOf("} catch (err)"));
    assert.match(catchBlock, /timeline schedule sync failed/);
    assert.match(catchBlock, /eventId/);
    assert.match(catchBlock, /venueId: venue\.id/);
    assert.match(catchBlock, /timelineWarning: SCHEDULE_SAVED_TIMELINE_MANUAL_MESSAGE/);
    assert.doesNotMatch(catchBlock, /timelineWarning:.*detail/);
    assert.doesNotMatch(catchBlock, /ok: false/);
    assert.match(assignments, /if \(error\) \{\s*const fail = occupancyFailureFromUnknown\(error\);\s*return \{ ok: false, message: fail\?\.message \?\? error\.message \};/s);

    const dialog = readFileSync(resolve("components/events/edit-booking-schedule-dialog.tsx"), "utf8");
    const save = dialog.slice(dialog.indexOf("async function save"), dialog.indexOf("return ("));
    assert.match(save, /if \(!result\.ok\)/);
    assert.match(save, /toast\.error\(result\.message \?\? "Could not save the schedule\."\)/);
    const warningAt = save.indexOf("if (result.timelineWarning)");
    const successAt = save.indexOf('toast.success("Schedule updated.")');
    assert.ok(warningAt > 0 && successAt > warningAt);
    assert.match(save.slice(warningAt, successAt), /toast\.warning\(result\.timelineWarning\)/);
    assert.match(save.slice(warningAt, successAt), /return;/);

    const edit = readFileSync(resolve("components/events/event-edit-form.tsx"), "utf8");
    assert.match(edit, /if \(result\.timelineWarning\) toast\.warning\(result\.timelineWarning\)/);
    assert.match(edit, /if \(!result\.timelineWarning\) toast\.success\("Event updated\."\)/);
    const create = readFileSync(resolve("components/events/event-form.tsx"), "utf8");
    assert.match(create, /result\.timelineWarning\) toast\.warning\(result\.timelineWarning\)/);
    assert.match(create, /else if \(result\.timelineWarning\)/);
  });

  it("unlock guard distinguishes edited linked content from ordinary manual locks", () => {
    const assignment = {
      useKey: "ceremony",
      useLabel: "Ceremony",
      spaceName: "Barn",
      startTime: "16:00",
      endTime: "17:00",
      scheduledDate: "2028-03-29",
      sortOrder: 0,
    };
    const expected = expectedScheduleLinkedContent({
      eventDate: "2028-03-29",
      eventEndDate: "2028-03-29",
      assignment,
    });
    assert.ok(expected);
    // Matching venue-editable fields unlocks even when stored end_time would differ —
    // end time is schedule-owned and omitted from unlock comparison.
    assert.equal(
      scheduleLinkedMilestoneMatchesSchedule({
        title: "Ceremony",
        description: "Space: Barn",
        notes: null,
        entryTime: "16:00",
        dayOffset: 0,
      }, expected!),
      true,
    );
    assert.equal(
      scheduleLinkedMilestoneMatchesSchedule({
        title: "Ceremony seating",
        description: "Space: Barn",
        notes: null,
        entryTime: "16:00",
        dayOffset: 0,
      }, expected!),
      false,
    );
    assert.equal(
      scheduleLinkedMilestoneMatchesSchedule({
        title: "Ceremony",
        description: "Space: Barn",
        notes: "bring chairs",
        entryTime: "16:00",
        dayOffset: 0,
      }, expected!),
      false,
    );
    assert.equal(
      expectedScheduleLinkedContent({
        eventDate: "2028-03-29",
        eventEndDate: "2028-03-29",
        assignment: { ...assignment, startTime: null },
      }),
      null,
    );

    assert.match(
      SCHEDULE_LINKED_UNLOCK_BLOCKED_MESSAGE,
      /stays locked because its content differs from the booked schedule/,
    );
    const sync = readFileSync(resolve("lib/timeline/schedule-sync.ts"), "utf8");
    const matchFn = sync.slice(
      sync.indexOf("export function scheduleLinkedMilestoneMatchesSchedule"),
      sync.indexOf("export function scheduleLinkedContentDiverged"),
    );
    assert.match(matchFn, /scheduleLinkedContentDiverged/);
    assert.doesNotMatch(matchFn, /endTime|end_time/);
    const repo = readFileSync(resolve("lib/timeline/repository.ts"), "utf8");
    const update = repo.slice(repo.indexOf("export async function updateEntry"), repo.indexOf("export async function shareVenueTimelineWithCouple"));
    assert.match(update, /unlockRequested/);
    assert.match(update, /SCHEDULE_LINKED_UNLOCK_BLOCKED_MESSAGE/);
    assert.match(update, /scheduleLinkedMilestoneMatchesSchedule/);
    assert.match(update, /if \(!contentEdited\) throw new Error\(SCHEDULE_LINKED_UNLOCK_BLOCKED_MESSAGE\)/);
    assert.match(update, /source_space_use_key/);
    // Detached rows (null key) skip the linked unlock guard entirely.
    assert.match(update, /if \(current\.source_space_use_key\)/);
    assert.doesNotMatch(update, /endTime: current\.end_time/);
    const service = readFileSync(resolve("lib/timeline/service.ts"), "utf8");
    assert.match(service, /stays locked because its content differs/);
    // After unlock, reconcile restores schedule end_time on unlocked linked rows.
    const mig = readFileSync(
      resolve("supabase/migrations/20261424500000_timeline_schedule_reconcile.sql"),
      "utf8",
    );
    assert.match(mig, /end_time = v_end_time/);
    assert.match(mig, /lock_state is distinct from 'locked'/);
  });

  it("does not treat lock-only or detached/manual rows as schedule-edit protection", () => {
    assert.equal(
      scheduleLinkedContentDiverged(
        { title: "Ceremony", description: "Space: Barn", notes: null, entryTime: "16:00", dayOffset: 0 },
        { title: "Ceremony", description: "Space: Barn", entryTime: "16:00", dayOffset: 0 },
      ),
      false,
    );
    const detached = planScheduleTimelineSync({
      eventDate: "2028-03-29",
      eventEndDate: "2028-03-29",
      assignments: [{
        useKey: "ceremony",
        useLabel: "Ceremony",
        spaceName: "Barn",
        startTime: "16:00",
        endTime: "17:00",
        scheduledDate: "2028-03-29",
        sortOrder: 0,
      }],
      existing: [{ id: "detached-1", sourceSpaceUseKey: null, lockState: "locked" }],
    });
    assert.equal(detached.upserts[0]?.existingId, null);
    assert.deepEqual(detached.deleteIds, []);
    assert.deepEqual(detached.detachIds, []);

    const sync = readFileSync(resolve("lib/timeline/schedule-sync.ts"), "utf8");
    const syncFn = sync.slice(sync.indexOf("export async function syncTimelineFromEventSpaceAssignments"));
    assert.doesNotMatch(syncFn, /applyScheduleLinkedContentProtection/);
    assert.doesNotMatch(syncFn, /SCHEDULE_LINKED_UNLOCK_BLOCKED_MESSAGE/);
  });

  it("empty active assignments delete unlocked generated rows; RPC never trusts a client plan", () => {
    const empty = planScheduleTimelineSync({
      eventDate: "2028-03-29",
      eventEndDate: "2028-03-29",
      assignments: [],
      existing: [
        { id: "gen-1", sourceSpaceUseKey: "ceremony", lockState: "editable" },
        { id: "locked-1", sourceSpaceUseKey: "reception", lockState: "locked" },
        { id: "manual-1", sourceSpaceUseKey: null, lockState: "editable" },
      ],
    });
    assert.deepEqual(empty.deleteIds, ["gen-1"]);
    assert.deepEqual(empty.detachIds, ["locked-1"]);
    assert.deepEqual(empty.upserts, []);

    const mig = readFileSync(
      resolve("supabase/migrations/20261424500000_timeline_schedule_reconcile.sql"),
      "utf8",
    );
    assert.match(mig, /from public\.event_space_assignments a/);
    assert.match(mig, /select e\.id, e\.event_date, e\.event_end_date/);
    assert.match(mig, /for update/);
    // Authoritative read happens after the event lock, before writes.
    const lockAt = mig.indexOf("for update");
    const assignAt = mig.indexOf("from public.event_space_assignments");
    assert.ok(lockAt > 0 && assignAt > lockAt);
  });
});
