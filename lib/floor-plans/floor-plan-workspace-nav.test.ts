import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workspace = readFileSync(resolve("components/events/floor-plan-workspace.tsx"), "utf8");
const editorPage = readFileSync(resolve("app/(app)/events/[id]/floor-plans/[planId]/page.tsx"), "utf8");
const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");

describe("Floor Plans workspace navigation", () => {
  it("does not auto-redirect into the designer when a working plan exists", () => {
    assert.doesNotMatch(
      workspace,
      /operationalFloorPlanId\)\s*\{\s*router\.replace\(`\/events\/\$\{eventId\}\/floor-plans/,
    );
    assert.doesNotMatch(
      workspace,
      /router\.replace\(`\/events\/\$\{eventId\}\/floor-plans\/\$\{operationalFloorPlanId\}`\)/,
    );
    assert.doesNotMatch(
      workspace,
      /router\.replace\(`\/events\/\$\{eventId\}\/floor-plans\/\$\{result\.floorPlanId\}`\)/,
    );
  });

  it("still ensures a working layout when offers exist and none is operational", () => {
    assert.match(workspace, /ensureWorkingFloorPlanAction/);
    assert.match(workspace, /if \(operationalFloorPlanId\) return;/);
    assert.match(workspace, /router\.refresh\(\)/);
  });

  it("distinguishes working layout from client selection in the status strip", () => {
    assert.match(workspace, /floor-plan-selection-status/);
    assert.match(workspace, /floor-plan-client-selected/);
    assert.match(workspace, /floor-plan-client-pending/);
    assert.match(workspace, /coupleSelectedFloorPlanId/);
    assert.match(workspace, /workingPlan/);
  });

  it("booked Floor Plans tab mounts the workspace without leaving the booking", () => {
    assert.match(detail, /value="floorplan"/);
    assert.match(detail, /FloorPlanWorkspace/);
    assert.match(detail, /operationalFloorPlanId=\{event\.operationalFloorPlanId\}/);
    assert.match(detail, /coupleSelectedFloorPlanId=\{event\.coupleSelectedFloorPlanId\}/);
  });

  it("designer back link returns to the booking Floor Plans tab", () => {
    assert.match(editorPage, /backHref=\{event\.clientId \? `\/clients\/\$\{event\.clientId\}#floorplan`/);
    assert.match(editorPage, /backLabel="Back to Floor Plans"/);
  });
});
