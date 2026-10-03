/**
 * Date Hold multi-space + time-window occupancy (A–K product cases).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { evaluateEventOccupancy, windowsOverlap } from "@/lib/availability/event-occupancy";
import {
  conflictingForeignHolds,
  defaultHoldSpaceIdsFromPreferences,
  holdConflictsWithCandidate,
  holdOperationalWindow,
  holdResourcesCollide,
  holdSpaceIds,
  holdsConflictWithEachOther,
  inquiryDateBlockedByHolds,
  isWholeVenueHold,
} from "@/lib/availability/hold-occupancy";

const MIG = readFileSync(
  resolve("supabase/migrations/20261411000000_date_hold_multi_space_time_aware.sql"),
  "utf8",
);
const SECTION = readFileSync(
  resolve("components/availability/date-holds-section.tsx"),
  "utf8",
);
const PRECHECK = readFileSync(resolve("lib/availability/precheck.ts"), "utf8");
const REPO = readFileSync(resolve("lib/availability/repository.ts"), "utf8");

describe("hold occupancy — resources + date + window", () => {
  it("A. single space + time window", () => {
    const hold = {
      holdDate: "2026-09-04",
      startTime: "10:00",
      endTime: "14:00",
      spaceIds: ["barn"],
    };
    assert.equal(
      holdConflictsWithCandidate(
        hold,
        { date: "2026-09-04", spaceIds: ["barn"], startTime: "11:00", endTime: "13:00" },
        2,
      ),
      true,
    );
    assert.equal(
      holdConflictsWithCandidate(
        hold,
        { date: "2026-09-04", spaceIds: ["bridge"], startTime: "11:00", endTime: "13:00" },
        2,
      ),
      false,
    );
  });

  it("B. multi-space hold protects both spaces", () => {
    const hold = {
      holdDate: "2026-09-04",
      startTime: "10:00",
      endTime: "18:00",
      spaceIds: ["bridge", "barn"],
    };
    assert.equal(
      holdConflictsWithCandidate(
        hold,
        { date: "2026-09-04", spaceIds: ["bridge"], startTime: "12:00", endTime: "14:00" },
        2,
      ),
      true,
    );
    assert.equal(
      holdConflictsWithCandidate(
        hold,
        { date: "2026-09-04", spaceIds: ["barn"], startTime: "12:00", endTime: "14:00" },
        2,
      ),
      true,
    );
    assert.equal(
      holdConflictsWithCandidate(
        hold,
        { date: "2026-09-04", spaceIds: ["garden"], startTime: "12:00", endTime: "14:00" },
        2,
      ),
      false,
    );
  });

  it("C. non-overlapping same-space windows allowed", () => {
    const morning = {
      holdDate: "2026-09-04",
      startTime: "10:00",
      endTime: "14:00",
      spaceIds: ["barn"],
    };
    const evening = {
      holdDate: "2026-09-04",
      startTime: "17:00",
      endTime: "23:00",
      spaceIds: ["barn"],
    };
    assert.equal(holdsConflictWithEachOther(morning, evening, 2), false);
  });

  it("D. overlapping same-space windows conflict", () => {
    const a = {
      holdDate: "2026-09-04",
      startTime: "10:00",
      endTime: "15:00",
      spaceIds: ["barn"],
    };
    const b = {
      holdDate: "2026-09-04",
      startTime: "14:00",
      endTime: "18:00",
      spaceIds: ["barn"],
    };
    assert.equal(holdsConflictWithEachOther(a, b, 2), true);
  });

  it("E. exact boundary does not overlap (same as event windowsOverlap)", () => {
    assert.equal(
      windowsOverlap({ start: "10:00", end: "14:00" }, { start: "14:00", end: "18:00" }),
      false,
    );
    const a = {
      holdDate: "2026-09-04",
      startTime: "10:00",
      endTime: "14:00",
      spaceIds: ["barn"],
    };
    const b = {
      holdDate: "2026-09-04",
      startTime: "14:00",
      endTime: "18:00",
      spaceIds: ["barn"],
    };
    assert.equal(holdsConflictWithEachOther(a, b, 2), false);
  });

  it("F. different spaces same window allowed when max ≥ 2", () => {
    const barn = {
      holdDate: "2026-09-04",
      startTime: "10:00",
      endTime: "18:00",
      spaceIds: ["barn"],
    };
    const bridge = {
      holdDate: "2026-09-04",
      startTime: "10:00",
      endTime: "18:00",
      spaceIds: ["bridge"],
    };
    assert.equal(holdsConflictWithEachOther(barn, bridge, 2), false);
    assert.equal(holdsConflictWithEachOther(barn, bridge, 1), true);
  });

  it("G. whole venue hold blocks every space", () => {
    assert.equal(isWholeVenueHold([]), true);
    assert.equal(
      holdResourcesCollide({
        holdSpaceIds: [],
        candidateSpaceIds: ["barn"],
        effectiveMax: 2,
      }),
      true,
    );
    const hold = {
      holdDate: "2026-09-04",
      startTime: null,
      endTime: null,
      spaceIds: [] as string[],
    };
    assert.equal(
      holdConflictsWithCandidate(
        hold,
        { date: "2026-09-04", spaceIds: ["bridge"], startTime: "10:00", endTime: "12:00" },
        2,
      ),
      true,
    );
  });

  it("H. multi-space vs whole-venue interaction", () => {
    const multi = {
      holdDate: "2026-09-04",
      startTime: "10:00",
      endTime: "14:00",
      spaceIds: ["barn", "bridge"],
    };
    const whole = {
      holdDate: "2026-09-04",
      startTime: "12:00",
      endTime: "16:00",
      spaceIds: [] as string[],
    };
    assert.equal(holdsConflictWithEachOther(multi, whole, 2), true);
  });

  it("I. null times = all day", () => {
    const win = holdOperationalWindow({ startTime: null, endTime: null });
    assert.deepEqual(win, { start: "00:00", end: "23:59" });
  });

  it("J. lead prefs default both ceremony + reception spaces", () => {
    const ids = defaultHoldSpaceIdsFromPreferences([
      { preferenceKind: "venue_space", spaceId: "bridge" },
      { preferenceKind: "venue_space", spaceId: "barn" },
      { preferenceKind: "external", spaceId: null },
    ]);
    assert.deepEqual(ids, ["bridge", "barn"]);
  });

  it("J2. undecided and not_applicable contribute no default hold spaces", () => {
    const ids = defaultHoldSpaceIdsFromPreferences([
      { preferenceKind: "undecided", spaceId: null },
      { preferenceKind: "not_applicable", spaceId: null },
      { preferenceKind: "venue_space", spaceId: "barn" },
    ]);
    assert.deepEqual(ids, ["barn"]);
  });

  it("K. foreign hold exclusion still respects same owner", () => {
    const holds = [
      {
        leadId: "lead-a",
        holdDate: "2026-09-04",
        startTime: "10:00",
        endTime: "14:00",
        spaceIds: ["barn"],
      },
      {
        leadId: "lead-b",
        holdDate: "2026-09-04",
        startTime: "10:00",
        endTime: "14:00",
        spaceIds: ["barn"],
      },
    ];
    assert.equal(
      conflictingForeignHolds(
        holds,
        { date: "2026-09-04", spaceIds: ["barn"], startTime: "11:00", endTime: "12:00" },
        2,
        "lead-a",
      ).length,
      1,
    );
  });

  it("inquiry: space-specific hold does not close whole date when max ≥ 2", () => {
    const holds = [
      {
        leadId: "lead-x",
        holdDate: "2026-09-04",
        startTime: "10:00",
        endTime: "14:00",
        spaceIds: ["barn"],
      },
    ];
    assert.equal(
      inquiryDateBlockedByHolds(holds, "2026-09-04", 2, ["barn", "bridge"]),
      false,
    );
    assert.equal(
      inquiryDateBlockedByHolds(holds, "2026-09-04", 2, ["barn"]),
      true,
    );
    assert.equal(
      inquiryDateBlockedByHolds(holds, "2026-09-04", 1, ["barn", "bridge"]),
      true,
    );
  });

  it("legacy spaceId folds into spaceIds", () => {
    assert.deepEqual(holdSpaceIds({ spaceId: "barn" }), ["barn"]);
    assert.deepEqual(holdSpaceIds({ spaceIds: ["a", "b"], spaceId: "c" }), ["a", "b"]);
    assert.deepEqual(holdSpaceIds({}), []);
  });

  it("booked event occupancy intersects assignment spaces", () => {
    const venue = {
      effectiveMax: 2,
      activeSpaceIds: ["barn", "bridge"],
      allSpaceIds: ["barn", "bridge"],
    };
    const existing = [{
      id: "e1",
      status: "confirmed",
      eventDate: "2026-09-04",
      eventEndDate: null,
      spaceId: "barn",
      spaceIds: ["barn", "bridge"],
      setupTime: null,
      startTime: "10:00",
      endTime: "18:00",
      teardownTime: null,
    }];
    const againstBridge = evaluateEventOccupancy(
      { eventDate: "2026-09-04", spaceId: "bridge", startTime: "12:00", endTime: "14:00" },
      venue,
      existing,
    );
    assert.equal(againstBridge.ok, false);
    if (!againstBridge.ok) assert.equal(againstBridge.code, "space_overlap");

    const againstGarden = evaluateEventOccupancy(
      { eventDate: "2026-09-04", spaceId: "garden", startTime: "12:00", endTime: "14:00" },
      { ...venue, allSpaceIds: ["barn", "bridge", "garden"], activeSpaceIds: ["barn", "bridge", "garden"] },
      existing,
    );
    assert.equal(againstGarden.ok, true);
  });
});

describe("hold occupancy seams", () => {
  it("migration adds date_hold_spaces and time-aware hold collision", () => {
    assert.match(MIG, /create table if not exists public\.date_hold_spaces/);
    assert.match(MIG, /hold_resources_collide/);
    assert.match(MIG, /hold_occupied_space_ids/);
    assert.match(MIG, /event_occupied_space_ids/);
    assert.match(MIG, /event_space_assignments/);
  });

  it("UI collects multi-space + occupancy window", () => {
    assert.match(SECTION, /Spaces to hold/);
    assert.match(SECTION, /date-hold-whole-venue/);
    assert.match(SECTION, /date-hold-start-time/);
    assert.match(SECTION, /defaultHoldSpaceIdsFromPreferences/);
    assert.match(SECTION, /spaceIds/);
  });

  it("precheck and repository use hold space/time rows", () => {
    assert.match(PRECHECK, /conflictingForeignHolds/);
    assert.match(PRECHECK, /inquiryDateBlockedByHolds/);
    assert.match(REPO, /date_hold_spaces/);
    assert.match(REPO, /holdOccupancyRows/);
  });
});
