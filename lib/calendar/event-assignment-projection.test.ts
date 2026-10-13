import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { projectAssignmentWindowsOntoCalendarDates } from "@/lib/calendar/event-assignment-projection";

/** Nicole Bethune May 8–9 fixture — mirrors Sandbox persisted assignments. */
const NICOLE_WINDOWS = [
  {
    spaceId: "barn",
    useLabel: "Rehearsal Dinner",
    startTime: "18:00",
    endTime: "21:00",
    scheduledDate: "2027-05-08",
  },
  {
    spaceId: "villa",
    useLabel: "Getting Ready",
    startTime: "14:00",
    endTime: "16:00",
    scheduledDate: "2027-05-09",
  },
  {
    spaceId: "bridge",
    useLabel: "Ceremony",
    startTime: "16:00",
    endTime: "17:00",
    scheduledDate: "2027-05-09",
  },
  {
    spaceId: "lawn",
    useLabel: "Cocktail Hour",
    startTime: "17:00",
    endTime: "18:00",
    scheduledDate: "2027-05-09",
  },
  {
    spaceId: "barn",
    useLabel: "Reception",
    startTime: "18:00",
    endTime: "22:00",
    scheduledDate: "2027-05-09",
  },
] as const;

describe("projectAssignmentWindowsOntoCalendarDates", () => {
  it("places Nicole components on their scheduled_date only (not every protected day)", () => {
    const projected = projectAssignmentWindowsOntoCalendarDates({
      protectedDates: ["2027-05-08", "2027-05-09"],
      windows: [...NICOLE_WINDOWS],
    });
    assert.notEqual(projected, "untimed");
    if (projected === "untimed") return;
    assert.equal(projected.length, 5);
    const sat = projected.filter((p) => p.date === "2027-05-08");
    const sun = projected.filter((p) => p.date === "2027-05-09");
    assert.deepEqual(sat.map((p) => p.useLabel), ["Rehearsal Dinner"]);
    assert.deepEqual(
      sun.map((p) => p.useLabel).sort(),
      ["Ceremony", "Cocktail Hour", "Getting Ready", "Reception"],
    );
    // Regression: Rehearsal Dinner must not appear on Sunday.
    assert.equal(sun.some((p) => p.useLabel === "Rehearsal Dinner"), false);
    // Persisted 6–9 PM (21:00), not fabricated 10 PM.
    assert.equal(sat[0]?.endTime, "21:00");
  });

  it("Barn filter still sees Saturday rehearsal and Sunday reception only", () => {
    const projected = projectAssignmentWindowsOntoCalendarDates({
      protectedDates: ["2027-05-08", "2027-05-09"],
      windows: [...NICOLE_WINDOWS],
    });
    assert.notEqual(projected, "untimed");
    if (projected === "untimed") return;
    const barn = projected.filter((p) => p.spaceId === "barn");
    assert.deepEqual(
      barn.map((p) => `${p.date}:${p.useLabel}`),
      ["2027-05-08:Rehearsal Dinner", "2027-05-09:Reception"],
    );
  });

  it("legacy timed rows without scheduled_date still expand across protected days", () => {
    const projected = projectAssignmentWindowsOntoCalendarDates({
      protectedDates: ["2027-05-08", "2027-05-09"],
      windows: [{
        spaceId: "barn",
        useLabel: "Reception",
        startTime: "18:00",
        endTime: "22:00",
        scheduledDate: null,
      }],
    });
    assert.notEqual(projected, "untimed");
    if (projected === "untimed") return;
    assert.equal(projected.length, 2);
    assert.deepEqual(projected.map((p) => p.date), ["2027-05-08", "2027-05-09"]);
  });

  it("returns untimed when no start/end windows exist", () => {
    assert.equal(
      projectAssignmentWindowsOntoCalendarDates({
        protectedDates: ["2027-05-08"],
        windows: [{ spaceId: "barn", useLabel: null, startTime: null, endTime: null, scheduledDate: "2027-05-08" }],
      }),
      "untimed",
    );
  });
});

describe("getCalendarData wires scheduled_date into projection", () => {
  const serviceSrc = readFileSync(resolve("lib/calendar/service.ts"), "utf8");

  it("selects scheduled_date and uses the projection helper", () => {
    const aggregation = serviceSrc.slice(serviceSrc.indexOf("export async function getCalendarData"));
    assert.match(aggregation, /scheduled_date/);
    assert.match(aggregation, /projectAssignmentWindowsOntoCalendarDates/);
  });
});
