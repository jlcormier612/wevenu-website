import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  dayOffsetForScheduledDate,
  planScheduleTimelineSync,
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
      ],
    });
    assert.equal(plan.upserts.length, 2);
    assert.deepEqual(plan.deleteIds, ["gen-gone"]);
    assert.ok(!plan.deleteIds.includes("manual-1"));
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

  it("wires sync after schedule replace and on timeline load", () => {
    const assignments = readFileSync(resolve("lib/events/space-assignments.ts"), "utf8");
    assert.match(assignments, /syncTimelineFromEventSpaceAssignments/);
    const service = readFileSync(resolve("lib/timeline/service.ts"), "utf8");
    assert.match(service, /syncTimelineFromEventSpaceAssignments/);
    const mig = readFileSync(
      resolve("supabase/migrations/20261418200000_timeline_schedule_source_use_key.sql"),
      "utf8",
    );
    assert.match(mig, /source_space_use_key/);
  });
});
