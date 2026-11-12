/**
 * Optimistic permission toggle — generation / rollback invariants.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const hook = readFileSync(resolve("lib/floor-plans/use-optimistic-permission-toggle.ts"), "utf8");
const workspace = readFileSync(resolve("components/events/floor-plan-workspace.tsx"), "utf8");

describe("useOptimisticPermissionToggle contract", () => {
  it("flips local state before awaiting save and guards stale generations", () => {
    assert.match(hook, /setValue\(next\)/);
    assert.match(hook, /genRef/);
    assert.match(hook, /gen !== genRef\.current/);
    assert.match(hook, /setValue\(previous\)/);
    assert.match(hook, /setPending\(true\)/);
    assert.match(hook, /desiredRef/);
  });

  it("holds optimistic value until server props match after success", () => {
    assert.match(hook, /serverValue === desiredRef\.current/);
    assert.match(hook, /keep optimistic value until props match/i);
  });
});

describe("Floor plan Working Layout toggles use optimistic permission hook", () => {
  it("wires Couple see / seat / add tables / Vendors see through the hook", () => {
    assert.match(workspace, /useOptimisticPermissionToggle/);
    assert.match(workspace, /ShareFloorPlanToggle/);
    assert.match(workspace, /ShareForSeatingToggle/);
    assert.match(workspace, /CoupleMayAddTablesToggle/);
    assert.match(workspace, /ShareWithVendorsToggle/);
    // Must not wait for server before flipping visible state.
    assert.doesNotMatch(
      workspace.slice(
        workspace.indexOf("function ShareFloorPlanToggle"),
        workspace.indexOf("function SetOperationalToggle"),
      ),
      /if \(result\.ok\) \{\s*setShared\(next\)/,
    );
  });

  it("does not disable the switch solely while a save is in flight", () => {
    const row = workspace.slice(
      workspace.indexOf("function PlanSwitchRow"),
      workspace.indexOf("function ShareForSeatingToggle"),
    );
    assert.match(row, /aria-busy=\{pending\}/);
    assert.doesNotMatch(row, /disabled=\{pending\}/);
  });
});
