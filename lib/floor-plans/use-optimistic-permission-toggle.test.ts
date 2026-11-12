/**
 * Optimistic permission toggle — generation / rollback / out-of-order invariants.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  adoptServerValue,
  beginOptimisticToggle,
  createOptimisticPermissionState,
  settleOptimisticToggle,
  simulateOptimisticToggleSequence,
} from "@/lib/floor-plans/optimistic-permission-controller";

const hook = readFileSync(resolve("lib/floor-plans/use-optimistic-permission-toggle.ts"), "utf8");
const workspace = readFileSync(resolve("components/events/floor-plan-workspace.tsx"), "utf8");
const controller = readFileSync(
  resolve("lib/floor-plans/optimistic-permission-controller.ts"),
  "utf8",
);

describe("useOptimisticPermissionToggle contract", () => {
  it("delegates to the pure controller for begin/settle/adopt", () => {
    assert.match(hook, /beginOptimisticToggle/);
    assert.match(hook, /settleOptimisticToggle/);
    assert.match(hook, /adoptServerValue/);
    assert.match(controller, /gen !== state\.gen/);
  });
});

describe("Floor plan Working Layout toggles use optimistic permission hook", () => {
  it("wires Couple see / seat / add tables / Vendors see through the hook", () => {
    assert.match(workspace, /useOptimisticPermissionToggle/);
    assert.match(workspace, /ShareFloorPlanToggle/);
    assert.match(workspace, /ShareForSeatingToggle/);
    assert.match(workspace, /CoupleMayAddTablesToggle/);
    assert.match(workspace, /ShareWithVendorsToggle/);
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

describe("optimistic permission race controller", () => {
  it("flips immediately and rolls back on failure with an error", () => {
    let state = createOptimisticPermissionState(false);
    const { state: begun, gen, previous } = beginOptimisticToggle(state, true);
    assert.equal(begun.value, true);
    assert.equal(begun.pending, true);
    assert.equal(begun.desired, true);
    const settled = settleOptimisticToggle(
      begun,
      gen,
      { ok: false, message: "permission denied" },
      previous,
    );
    assert.equal(settled.stale, false);
    assert.equal(settled.state.value, false);
    assert.equal(settled.state.pending, false);
    assert.equal(settled.state.error, "permission denied");
    assert.equal(settled.state.desired, null);
  });

  it("ignores a slower earlier save after a newer click (out-of-order)", async () => {
    // Click A at t=0 (save 200ms, would set true), click B at t=40 (save 50ms, sets false).
    // Final value must follow B (false) even though A resolves last.
    const final = await simulateOptimisticToggleSequence(false, [
      { atMs: 0, saveMs: 200, ok: true },
      { atMs: 40, saveMs: 50, ok: true },
    ]);
    assert.equal(final.value, false);
    assert.equal(final.pending, false);
    assert.equal(final.error, null);
  });

  it("rapid on/off/on ends on the last click intent", async () => {
    const final = await simulateOptimisticToggleSequence(false, [
      { atMs: 0, saveMs: 80, ok: true },
      { atMs: 15, saveMs: 80, ok: true },
      { atMs: 30, saveMs: 80, ok: true },
    ]);
    // three flips from false → true → false → true
    assert.equal(final.value, true);
    assert.equal(final.pending, false);
  });

  it("does not let a stale failure overwrite a newer successful selection", async () => {
    const final = await simulateOptimisticToggleSequence(false, [
      { atMs: 0, saveMs: 150, ok: false, message: "late fail" },
      { atMs: 20, saveMs: 40, ok: true },
    ]);
    assert.equal(final.value, false); // second click toggled true→false from first optimistic true… 
    // Sequence: start false
    // click0 → true (pending), fails late
    // click1 at 20 → false (pending), succeeds
    // late fail for gen0 must be ignored
    assert.equal(final.error, null);
    assert.equal(final.pending, false);
  });

  it("holds optimistic value until server props match after success", () => {
    let state = createOptimisticPermissionState(false);
    const { state: begun, gen, previous } = beginOptimisticToggle(state, true);
    const settled = settleOptimisticToggle(begun, gen, { ok: true }, previous);
    state = settled.state;
    assert.equal(state.value, true);
    assert.equal(state.pending, false);
    assert.equal(state.desired, true);
    // Stale server prop (still false) must not clobber
    state = adoptServerValue(state, false);
    assert.equal(state.value, true);
    assert.equal(state.desired, true);
    // Matching server prop clears desired
    state = adoptServerValue(state, true);
    assert.equal(state.value, true);
    assert.equal(state.desired, null);
  });

  it("does not adopt server props while a save is pending", () => {
    let state = createOptimisticPermissionState(false);
    const { state: begun } = beginOptimisticToggle(state, true);
    const adopted = adoptServerValue(begun, false);
    assert.equal(adopted.value, true);
    assert.equal(adopted.pending, true);
  });
});
