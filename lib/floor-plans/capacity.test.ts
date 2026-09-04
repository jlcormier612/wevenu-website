import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatFloorPlanCapacitySentence,
  floorPlanCapacityNeedsAttention,
  summarizeFloorPlanCapacity,
} from "@/lib/floor-plans/capacity";

describe("summarizeFloorPlanCapacity", () => {
  it("sums table capacities and ignores non-table objects", () => {
    const s = summarizeFloorPlanCapacity({
      objects: [
        { objectType: "table_round", capacity: 8 },
        { objectType: "table_rect", capacity: 10 },
        { objectType: "dance_floor", capacity: null },
        { objectType: "stage", capacity: null },
      ],
      guestCount: 16,
    });
    assert.equal(s.tableCount, 2);
    assert.equal(s.seatingCapacity, 18);
    assert.equal(s.level, "ok");
    assert.equal(s.seatingSurplus, 2);
    assert.equal(floorPlanCapacityNeedsAttention(s), false);
  });

  it("flags seating shortfall against the event guest count without blocking", () => {
    const s = summarizeFloorPlanCapacity({
      objects: [
        { objectType: "table_round", capacity: 8 },
        { objectType: "table_round", capacity: 8 },
      ],
      guestCount: 20,
    });
    assert.equal(s.level, "seating_short");
    assert.equal(s.seatingShortfall, 4);
    assert.equal(floorPlanCapacityNeedsAttention(s), true);
    assert.match(formatFloorPlanCapacitySentence(s), /short 4 seats/);
  });

  it("flags Space capacity when guest count exceeds the Space", () => {
    const s = summarizeFloorPlanCapacity({
      objects: [{ objectType: "table_round", capacity: 200 }],
      guestCount: 160,
      spaceCapacity: 150,
    });
    assert.equal(s.level, "space_short");
    assert.equal(s.spaceGuestShortfall, 10);
    assert.match(formatFloorPlanCapacitySentence(s), /over this Space's capacity/);
  });

  it("combines seating and Space shortfalls", () => {
    const s = summarizeFloorPlanCapacity({
      objects: [{ objectType: "table_round", capacity: 50 }],
      guestCount: 160,
      spaceCapacity: 150,
    });
    assert.equal(s.level, "both_short");
    assert.equal(s.seatingShortfall, 110);
    assert.equal(s.spaceGuestShortfall, 10);
  });

  it("treats tables without seat counts as incomplete when guests are known", () => {
    const s = summarizeFloorPlanCapacity({
      objects: [
        { objectType: "table_round", capacity: null },
        { objectType: "table_rect", capacity: null },
      ],
      guestCount: 80,
    });
    // No measurable seats + guest count → seating short (plan cannot seat them yet)
    assert.equal(s.level, "seating_short");
    assert.equal(s.seatingShortfall, 80);
  });

  it("flags incomplete when some tables lack capacity but seats still cover guests", () => {
    const s = summarizeFloorPlanCapacity({
      objects: [
        { objectType: "table_round", capacity: 100 },
        { objectType: "table_rect", capacity: null },
      ],
      guestCount: 80,
    });
    assert.equal(s.level, "incomplete");
    assert.equal(s.tablesMissingCapacity, 1);
    assert.match(formatFloorPlanCapacitySentence(s), /missing a seat count/);
  });

  it("stays ok with no guest count even when tables miss capacity", () => {
    const s = summarizeFloorPlanCapacity({
      objects: [{ objectType: "table_round", capacity: null }],
    });
    assert.equal(s.level, "incomplete");
    assert.equal(s.guestCount, null);
  });
});
