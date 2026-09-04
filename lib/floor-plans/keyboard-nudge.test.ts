import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  floorPlanKeyboardTargetIsTextEntry,
  floorPlanNudgeStep,
  isFloorPlanNudgeKey,
  nudgeFloorPlanPosition,
} from "@/lib/floor-plans/keyboard-nudge";

describe("floorPlanNudgeStep", () => {
  it("uses one grid unit without Shift and five grid units with Shift", () => {
    assert.equal(floorPlanNudgeStep(60, false), 60);
    assert.equal(floorPlanNudgeStep(60, true), 300);
    assert.equal(floorPlanNudgeStep(12, false), 12);
    assert.equal(floorPlanNudgeStep(12, true), 60);
  });
});

describe("nudgeFloorPlanPosition", () => {
  it("nudges by the given step on each arrow and clamps to the canvas", () => {
    assert.deepEqual(
      nudgeFloorPlanPosition({ x: 100, y: 100, key: "ArrowLeft", step: 12, canvasWidth: 800, canvasHeight: 600 }),
      { x: 88, y: 100 },
    );
    assert.deepEqual(
      nudgeFloorPlanPosition({ x: 100, y: 100, key: "ArrowRight", step: 12, canvasWidth: 800, canvasHeight: 600 }),
      { x: 112, y: 100 },
    );
    assert.deepEqual(
      nudgeFloorPlanPosition({ x: 100, y: 100, key: "ArrowUp", step: 12, canvasWidth: 800, canvasHeight: 600 }),
      { x: 100, y: 88 },
    );
    assert.deepEqual(
      nudgeFloorPlanPosition({ x: 100, y: 100, key: "ArrowDown", step: 12, canvasWidth: 800, canvasHeight: 600 }),
      { x: 100, y: 112 },
    );
    assert.deepEqual(
      nudgeFloorPlanPosition({ x: 5, y: 5, key: "ArrowLeft", step: 60, canvasWidth: 800, canvasHeight: 600 }),
      { x: 0, y: 5 },
    );
    assert.deepEqual(
      nudgeFloorPlanPosition({ x: 790, y: 590, key: "ArrowDown", step: 60, canvasWidth: 800, canvasHeight: 600 }),
      { x: 790, y: 600 },
    );
  });

  it("Shift-sized steps move farther than a single grid unit", () => {
    const grid = 60;
    const fine = nudgeFloorPlanPosition({
      x: 300, y: 300, key: "ArrowRight", step: floorPlanNudgeStep(grid, false),
      canvasWidth: 800, canvasHeight: 600,
    });
    const coarse = nudgeFloorPlanPosition({
      x: 300, y: 300, key: "ArrowRight", step: floorPlanNudgeStep(grid, true),
      canvasWidth: 800, canvasHeight: 600,
    });
    assert.equal(fine.x, 360);
    assert.equal(coarse.x, 600);
  });
});

describe("isFloorPlanNudgeKey / floorPlanKeyboardTargetIsTextEntry", () => {
  it("recognizes only arrow keys as nudge keys", () => {
    assert.equal(isFloorPlanNudgeKey("ArrowLeft"), true);
    assert.equal(isFloorPlanNudgeKey("Delete"), false);
    assert.equal(isFloorPlanNudgeKey("Escape"), false);
  });

  it("ignores nudge while focus is in text-entry controls", () => {
    assert.equal(floorPlanKeyboardTargetIsTextEntry("INPUT"), true);
    assert.equal(floorPlanKeyboardTargetIsTextEntry("textarea"), true);
    assert.equal(floorPlanKeyboardTargetIsTextEntry("Select"), true);
    assert.equal(floorPlanKeyboardTargetIsTextEntry("BUTTON"), false);
    assert.equal(floorPlanKeyboardTargetIsTextEntry("DIV"), false);
  });
});
