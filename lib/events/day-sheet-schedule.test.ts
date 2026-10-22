import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildDaySheetSchedule,
  normalizeDaySheetEntryTime,
} from "@/lib/events/day-sheet-schedule";
import type { TimelineEntry } from "@/lib/timeline/types";

function entry(
  partial: Partial<TimelineEntry> & Pick<TimelineEntry, "id" | "title" | "entryTime" | "sortOrder">,
): TimelineEntry {
  return {
    venueId: "v",
    eventId: "e",
    description: null,
    notes: null,
    dayOffset: 0,
    audiences: ["venue"],
    sectionId: null,
    owner: "venue",
    lockState: "editable",
    status: "not_started",
    assignedToStaffId: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("buildDaySheetSchedule", () => {
  it("orders timed entries chronologically and separates untimed", () => {
    const schedule = buildDaySheetSchedule(
      [
        entry({ id: "u1", title: "Untimed A", entryTime: null, sortOrder: 0 }),
        entry({ id: "t2", title: "Later", entryTime: "18:00", sortOrder: 0 }),
        entry({ id: "t1", title: "Earlier", entryTime: "14:00", sortOrder: 5 }),
        entry({ id: "u2", title: "Untimed B", entryTime: null, sortOrder: 1 }),
      ],
      "2028-06-10",
    );
    assert.equal(schedule.timedGroups.length, 1);
    assert.deepEqual(
      schedule.timedGroups[0]!.entries.map((e) => e.title),
      ["Earlier", "Later"],
    );
    assert.deepEqual(
      schedule.unscheduled.map((e) => e.title),
      ["Untimed A", "Untimed B"],
    );
    assert.equal(schedule.timedGroups[0]!.dayLabel, null);
  });

  it("groups multi-day timed entries with day labels", () => {
    const schedule = buildDaySheetSchedule(
      [
        entry({ id: "d1", title: "Dinner", entryTime: "18:00", dayOffset: 0, sortOrder: 0 }),
        entry({ id: "d2", title: "Ceremony", entryTime: "16:00", dayOffset: 1, sortOrder: 0 }),
      ],
      "2028-06-10",
      "2028-06-11",
    );
    assert.equal(schedule.timedGroups.length, 2);
    assert.ok(schedule.timedGroups[0]!.dayLabel);
    assert.ok(schedule.timedGroups[1]!.dayLabel);
    assert.equal(schedule.timedGroups[0]!.entries[0]!.title, "Dinner");
    assert.equal(schedule.timedGroups[1]!.entries[0]!.title, "Ceremony");
  });

  it("does not invent times for unscheduled items", () => {
    const schedule = buildDaySheetSchedule(
      [entry({ id: "u", title: "Vendor Load-In", entryTime: null, sortOrder: 0 })],
      "2028-06-10",
    );
    assert.equal(schedule.timedGroups.length, 0);
    assert.equal(schedule.unscheduled.length, 1);
    assert.equal(schedule.unscheduled[0]!.entryTime, null);
  });

  it("normalizes Postgres HH:MM:SS times into the timed schedule", () => {
    assert.equal(normalizeDaySheetEntryTime("14:00:00"), "14:00");
    assert.equal(normalizeDaySheetEntryTime("6:30:00"), "06:30");
    const schedule = buildDaySheetSchedule(
      [entry({ id: "t", title: "Venue Access", entryTime: "14:00:00", sortOrder: 0 })],
      "2028-06-10",
    );
    assert.equal(schedule.timedGroups[0]!.entries[0]!.entryTime, "14:00");
    assert.equal(schedule.unscheduled.length, 0);
  });

  it("assigning a time moves an entry from unscheduled to timed", () => {
    const before = buildDaySheetSchedule(
      [entry({ id: "a", title: "Reception", entryTime: null, sortOrder: 0 })],
      "2028-06-10",
    );
    assert.equal(before.unscheduled.length, 1);
    assert.equal(before.timedGroups.length, 0);
    const after = buildDaySheetSchedule(
      [entry({ id: "a", title: "Reception", entryTime: "18:00", sortOrder: 0 })],
      "2028-06-10",
    );
    assert.equal(after.timedGroups[0]!.entries[0]!.entryTime, "18:00");
    assert.equal(after.unscheduled.length, 0);
  });

  it("day-sheet document uses schedule helper and timeline actions revalidate day-sheet", () => {
    const doc = readFileSync(
      join(process.cwd(), "components/events/day-sheet/day-sheet-document.tsx"),
      "utf8",
    );
    const actions = readFileSync(
      join(process.cwd(), "app/(app)/events/[id]/timeline-actions.ts"),
      "utf8",
    );
    assert.match(doc, /buildDaySheetSchedule/);
    assert.match(doc, /day-sheet-unscheduled/);
    assert.match(actions, /\/events\/\$\{eventId\}\/day-sheet/);
    assert.match(actions, /\/events\/\$\{eventId\}\/timeline-print/);
  });
});
