/**
 * Pure keyboard-nudge helpers for the Floor Plan editor.
 * Canvas coordinates are inches; gridUnit is gridIntervalFt * 12.
 * Arrow = one grid unit; Shift+Arrow = five grid units (same grid, coarser step).
 */

export type FloorPlanNudgeKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

export function isFloorPlanNudgeKey(key: string): key is FloorPlanNudgeKey {
  return key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown";
}

/** Step in canvas inches — always a multiple of the editor's current grid unit. */
export function floorPlanNudgeStep(gridUnit: number, shiftKey: boolean): number {
  const unit = Number.isFinite(gridUnit) && gridUnit > 0 ? gridUnit : 12;
  return shiftKey ? unit * 5 : unit;
}

export function nudgeFloorPlanPosition(input: {
  x: number;
  y: number;
  key: FloorPlanNudgeKey;
  step: number;
  canvasWidth: number;
  canvasHeight: number;
}): { x: number; y: number } {
  const step = Number.isFinite(input.step) ? input.step : 0;
  let { x, y } = input;
  if (input.key === "ArrowLeft") x -= step;
  else if (input.key === "ArrowRight") x += step;
  else if (input.key === "ArrowUp") y -= step;
  else if (input.key === "ArrowDown") y += step;
  return {
    x: Math.max(0, Math.min(input.canvasWidth, x)),
    y: Math.max(0, Math.min(input.canvasHeight, y)),
  };
}

/** True when arrow keys should move the page/control instead of the canvas object. */
export function floorPlanKeyboardTargetIsTextEntry(tagName: string): boolean {
  const tag = tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}
