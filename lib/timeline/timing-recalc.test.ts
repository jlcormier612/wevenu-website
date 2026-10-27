import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { projectClockAfterDayOfStartChange } from "@/lib/timeline/timing-provenance";
import {
  buildTimingRecalcPreview,
  workingPatchForRecalcRow,
} from "@/lib/timeline/timing-recalc";
import type { TimelineEntry } from "@/lib/timeline/types";

function entry(partial: Partial<TimelineEntry> & { id: string; title: string }): TimelineEntry {
  return {
    venueId: "v",
    eventId: "e",
    description: null,
    notes: null,
    entryTime: null,
    dayOffset: 0,
    audiences: [],
    sectionId: null,
    sortOrder: 0,
    owner: "venue",
    lockState: "editable",
    status: "not_started",
    assignedToStaffId: null,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

const relative = {
  dayIntent: "relative" as const,
  dayAnchor: "event_start" as const,
  relativeDayOffset: 1,
  dayOffsetOverridden: false,
  templateDayOffset: 1,
  templateDayAnchor: "event_start" as const,
  fixedDate: null,
  clockIntent: "relative" as const,
  relativeMinutes: 60,
  clockOverridden: false,
  attention: null,
};

describe("P1c projectClockAfterDayOfStartChange", () => {
  it("rebakes eligible relative clocks", () => {
    const proj = projectClockAfterDayOfStartChange(
      relative,
      { entryTime: "12:00" },
      { nextStartTime: "14:00" },
    );
    assert.equal(proj.eligible, true);
    assert.equal(proj.entryTime, "15:00");
  });

  it("leaves explicit clocks alone", () => {
    const proj = projectClockAfterDayOfStartChange(
      { ...relative, clockIntent: "explicit", relativeMinutes: null, clockOverridden: true },
      { entryTime: "16:00" },
      { nextStartTime: "10:00" },
    );
    assert.equal(proj.eligible, false);
    assert.equal(proj.blockedReason, "not_relative_clock");
    assert.equal(proj.entryTime, "16:00");
  });

  it("keeps unknown clock intent unresolved", () => {
    const proj = projectClockAfterDayOfStartChange(
      { ...relative, clockIntent: null, relativeMinutes: null },
      { entryTime: "11:00" },
      { nextStartTime: "10:00" },
    );
    assert.equal(proj.eligible, false);
    assert.equal(proj.blockedReason, "unknown_intent");
  });
});

describe("P1c buildTimingRecalcPreview", () => {
  it("projects eligible relative days and keeps fixed dates fixed", () => {
    const rows = buildTimingRecalcPreview({
      eventId: "e",
      entries: [
        entry({
          id: "rel",
          title: "Rehearsal",
          dayOffset: 1,
          entryTime: "10:00",
          timing: { ...relative, clockIntent: "explicit", relativeMinutes: null },
        }),
        entry({
          id: "fix",
          title: "Hair",
          dayOffset: -2,
          entryTime: "09:00",
          timing: {
            ...relative,
            dayIntent: "fixed",
            dayAnchor: null,
            relativeDayOffset: null,
            fixedDate: "2028-10-03",
            clockIntent: "explicit",
            relativeMinutes: null,
          },
        }),
      ],
      activeReleaseEntryIds: new Set(["rel"]),
      hasActiveRelease: true,
      previousEventDate: "2028-10-05",
      previousEndDate: "2028-10-06",
      previousStartTime: "11:00",
      nextEventDate: "2028-11-05",
      nextEndDate: "2028-11-06",
      nextStartTime: "11:00",
    });
    assert.deepEqual(rows.kinds, ["date"]);
    // Relative day_offset 1 stays 1 when the wedding moves — omitted as a no-op.
    assert.equal(rows.rows.some((r) => r.entryId === "rel"), false);
    const fix = rows.rows.find((r) => r.entryId === "fix");
    assert.equal(fix?.eligible, true);
    assert.equal(fix?.proposedDayOffset, -33); // 2028-10-03 relative to 2028-11-05
    assert.equal(fix?.dayIntent, "fixed");
    assert.equal(fix?.inActiveRelease, false);
  });

  it("flags unknown intent for review and does not mark eligible", () => {
    const rows = buildTimingRecalcPreview({
      eventId: "e",
      entries: [
        entry({
          id: "unk",
          title: "Legacy",
          dayOffset: 0,
          entryTime: "12:00",
          timing: {
            dayIntent: null,
            dayAnchor: null,
            relativeDayOffset: null,
            dayOffsetOverridden: false,
            templateDayOffset: null,
            templateDayAnchor: null,
            fixedDate: null,
            clockIntent: null,
            relativeMinutes: null,
            clockOverridden: false,
            attention: "unknown_intent",
          },
        }),
      ],
      activeReleaseEntryIds: new Set(),
      hasActiveRelease: false,
      previousEventDate: "2028-10-05",
      previousEndDate: null,
      previousStartTime: "11:00",
      nextEventDate: "2028-12-01",
      nextEndDate: null,
      nextStartTime: "11:00",
    });
    assert.equal(rows.rows[0]?.eligible, false);
    assert.equal(rows.rows[0]?.blockedReason, "unknown_intent");
  });

  it("end-anchored relative day updates when the wedding span changes", () => {
    const rows = buildTimingRecalcPreview({
      eventId: "e",
      entries: [
        entry({
          id: "brunch",
          title: "Brunch",
          dayOffset: 1, // prior span 1 + offset 0
          entryTime: null,
          timing: {
            ...relative,
            dayAnchor: "event_end",
            relativeDayOffset: 0,
            clockIntent: "untimed",
            relativeMinutes: null,
          },
        }),
      ],
      activeReleaseEntryIds: new Set(["brunch"]),
      hasActiveRelease: true,
      previousEventDate: "2028-10-05",
      previousEndDate: "2028-10-06",
      previousStartTime: null,
      nextEventDate: "2028-11-05",
      nextEndDate: "2028-11-07", // span 2
      nextStartTime: null,
    });
    const row = rows.rows.find((r) => r.entryId === "brunch");
    assert.equal(row?.eligible, true);
    assert.equal(row?.proposedDayOffset, 2);
    assert.equal(row?.inActiveRelease, true);
  });

  it("does not fall back when end-anchored and end is missing", () => {
    const rows = buildTimingRecalcPreview({
      eventId: "e",
      entries: [
        entry({
          id: "end",
          title: "Brunch",
          dayOffset: 2,
          entryTime: null,
          timing: {
            ...relative,
            dayAnchor: "event_end",
            relativeDayOffset: 0,
            clockIntent: "untimed",
            relativeMinutes: null,
          },
        }),
      ],
      activeReleaseEntryIds: new Set(),
      hasActiveRelease: false,
      previousEventDate: "2028-10-05",
      previousEndDate: "2028-10-06",
      previousStartTime: null,
      nextEventDate: "2028-11-05",
      nextEndDate: null,
      nextStartTime: null,
    });
    assert.equal(rows.rows[0]?.eligible, false);
    assert.equal(rows.rows[0]?.blockedReason, "missing_event_end");
  });

  it("T7 lists eligible relative clocks and skips explicit", () => {
    const rows = buildTimingRecalcPreview({
      eventId: "e",
      entries: [
        entry({
          id: "rel-clock",
          title: "Doors",
          dayOffset: 0,
          entryTime: "12:00",
          timing: relative,
        }),
        entry({
          id: "fixed-clock",
          title: "Toast",
          dayOffset: 0,
          entryTime: "18:00",
          timing: {
            ...relative,
            clockIntent: "explicit",
            relativeMinutes: null,
            clockOverridden: true,
          },
        }),
      ],
      activeReleaseEntryIds: new Set(),
      hasActiveRelease: false,
      previousEventDate: "2028-10-05",
      previousEndDate: "2028-10-05",
      previousStartTime: "11:00",
      nextEventDate: "2028-10-05",
      nextEndDate: "2028-10-05",
      nextStartTime: "13:00",
    });
    assert.deepEqual(rows.kinds, ["day_of_start"]);
    assert.equal(rows.eligibleCount, 1);
    assert.equal(rows.rows.find((r) => r.entryId === "rel-clock")?.proposedEntryTime, "14:00");
    assert.equal(rows.rows.some((r) => r.entryId === "fixed-clock"), false);
  });

  it("fingerprint changes when a proposed value changes", () => {
    const base = {
      eventId: "e",
      entries: [
        entry({
          id: "rel",
          title: "Rehearsal",
          dayOffset: 1,
          entryTime: "10:00",
          timing: { ...relative, clockIntent: "explicit", relativeMinutes: null },
        }),
      ],
      activeReleaseEntryIds: new Set<string>(),
      hasActiveRelease: false,
      previousEventDate: "2028-10-05",
      previousEndDate: null as string | null,
      previousStartTime: "11:00" as string | null,
      nextEventDate: "2028-11-05",
      nextEndDate: null as string | null,
      nextStartTime: "11:00" as string | null,
    };
    const a = buildTimingRecalcPreview(base);
    const b = buildTimingRecalcPreview({ ...base, nextEventDate: "2028-12-05" });
    assert.notEqual(a.fingerprint, b.fingerprint);
  });

  it("workingPatchForRecalcRow only returns patches for eligible rows", () => {
    const patch = workingPatchForRecalcRow(
      {
        entryId: "x",
        title: "x",
        kind: "day_of_start",
        inActiveRelease: false,
        currentDayOffset: 0,
        currentEntryTime: "12:00",
        proposedDayOffset: 0,
        proposedEntryTime: "14:00",
        dayIntent: "relative",
        clockIntent: "relative",
        eligible: true,
        blockedReason: null,
        attention: null,
        summary: "",
      },
      relative,
    );
    assert.equal(patch?.entryTime, "14:00");
    assert.equal(
      workingPatchForRecalcRow(
        {
          entryId: "x",
          title: "x",
          kind: "date",
          inActiveRelease: false,
          currentDayOffset: 0,
          currentEntryTime: null,
          proposedDayOffset: 1,
          proposedEntryTime: null,
          dayIntent: null,
          clockIntent: null,
          eligible: false,
          blockedReason: "unknown_intent",
          attention: "unknown_intent",
          summary: "",
        },
        relative,
      ),
      null,
    );
  });
});

describe("P1c wiring source contract", () => {
  it("Edit Event opens timing recalc review; apply RPC is atomic and release-safe", () => {
    const edit = readFileSync("components/events/event-edit-form.tsx", "utf8");
    const service = readFileSync("lib/events/service.ts", "utf8");
    const mig = readFileSync("supabase/migrations/20261424000000_venue_timeline_timing_recalc_apply.sql", "utf8");
    const sync = readFileSync("lib/timeline/schedule-sync.ts", "utf8");
    assert.match(edit, /TimelineTimingRecalcDialog/);
    assert.match(edit, /timingRecalc/);
    assert.match(service, /timingRecalc/);
    assert.match(mig, /apply_venue_timeline_timing_recalc/);
    assert.match(mig, /for update/);
    assert.match(mig, /update public\.timeline_entries/);
    assert.doesNotMatch(mig, /update public\.venue_timeline_releases/);
    assert.doesNotMatch(mig, /update public\.events/);
    assert.doesNotMatch(sync, /apply_venue_timeline_timing_recalc/);
    assert.doesNotMatch(sync, /buildTimingRecalcPreview/);
  });
});
