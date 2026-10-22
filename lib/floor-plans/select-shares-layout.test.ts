/**
 * Alias kept for STATUS docs that reference this path.
 * Canonical coverage lives in floor-plan-collab-complete.test.ts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve("supabase/migrations/20261422200000_floor_plan_collab_auto_seating_couple_move.sql"),
  "utf8",
);
const portalSection = readFileSync(resolve("components/portal/floor-plan-section.tsx"), "utf8");
const workspace = readFileSync(resolve("components/events/floor-plan-workspace.tsx"), "utf8");

describe("Floor plan select shares layout + seating (collaboration complete)", () => {
  it("select RPC shares layout and opens seating", () => {
    assert.match(migration, /shared_with_couple,\s*client_access\s*\)\s*values\s*\([\s\S]*?true,\s*'view'/);
    assert.match(migration, /client_access = 'view'/);
  });

  it("portal surfaces working plan editing and Ready", () => {
    assert.match(portalSection, /Your Floor Plan/);
    assert.match(portalSection, /floor-plan-ready-badge/);
    assert.match(portalSection, /move-object/);
  });

  it("venue workspace surfaces Mark Ready after selection", () => {
    assert.match(workspace, /floor-plan-next-mark-ready/);
    assert.match(workspace, /Mark as Ready/);
  });

  it("does not revive client_access=edit", () => {
    assert.doesNotMatch(migration, /client_access\s*=\s*'edit'/);
  });
});
