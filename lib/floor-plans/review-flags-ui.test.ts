/**
 * Run: npx tsx --test lib/floor-plans/review-flags-ui.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FLOOR_PLAN_REVIEW_FLAGS_CHANGED_EVENT,
  floorPlanSpaceFingerprint,
} from "@/lib/floor-plans/review-flags-ui";

describe("floorPlanSpaceFingerprint", () => {
  it("changes when a layout room changes so the review panel can refetch", () => {
    const before = floorPlanSpaceFingerprint([
      { id: "a", spaceId: "room-1" },
      { id: "b", spaceId: null },
    ]);
    const after = floorPlanSpaceFingerprint([
      { id: "a", spaceId: "room-2" },
      { id: "b", spaceId: null },
    ]);
    assert.notEqual(before, after);
  });

  it("is order-independent", () => {
    const left = floorPlanSpaceFingerprint([
      { id: "b", spaceId: "x" },
      { id: "a", spaceId: "y" },
    ]);
    const right = floorPlanSpaceFingerprint([
      { id: "a", spaceId: "y" },
      { id: "b", spaceId: "x" },
    ]);
    assert.equal(left, right);
  });

  it("exports a stable browser event name for card→panel refresh", () => {
    assert.match(FLOOR_PLAN_REVIEW_FLAGS_CHANGED_EVENT, /floor-plan-review-flags-changed/);
  });
});
