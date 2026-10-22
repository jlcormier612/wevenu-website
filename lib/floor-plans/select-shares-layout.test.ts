import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve("supabase/migrations/20261422100000_floor_plan_select_shares_layout_view.sql"),
  "utf8",
);
const portalSection = readFileSync(resolve("components/portal/floor-plan-section.tsx"), "utf8");
const portalView = readFileSync(resolve("components/portal/floor-plan-view.tsx"), "utf8");
const workspace = readFileSync(resolve("components/events/floor-plan-workspace.tsx"), "utf8");

describe("Floor plan select shares layout view (collaboration closure)", () => {
  it("select RPC inserts and updates shared_with_couple=true without opening seating", () => {
    assert.match(migration, /create or replace function public\.select_portal_floor_plan_offer/);
    assert.match(migration, /shared_with_couple,\s*client_access\s*\)\s*values\s*\([\s\S]*?true,\s*'hidden'/);
    assert.match(
      migration,
      /update public\.floor_plans\s+set shared_with_couple = true\s+where id = v_plan_id/,
    );
    assert.doesNotMatch(
      migration,
      /client_access\s*=\s*'view'/,
    );
  });

  it("portal list surfaces Ready and couple-selected status fields", () => {
    assert.match(migration, /'isCoupleSelected'/);
    assert.match(migration, /'isReady'/);
    assert.match(migration, /'coupleSelectedFloorPlanId'/);
    assert.match(migration, /fp\.finalized_at is not null/);
  });

  it("portal UX shows working layout after selection and does not claim furniture editing", () => {
    assert.match(portalSection, /Your working layout/);
    assert.match(portalSection, /furniture is venue-owned|furniture is placed by your venue|view only/i);
    assert.match(portalSection, /floor-plan-seating-next-hint/);
    assert.match(portalSection, /floor-plan-ready-badge/);
    assert.doesNotMatch(portalSection, /doesn.?t share it automatically/);
    assert.match(portalView, /Your working layout/);
    assert.doesNotMatch(portalView, /doesn.?t share it automatically/);
  });

  it("venue workspace surfaces Share for Seating / Mark Ready next actions after selection", () => {
    assert.match(workspace, /floor-plan-next-share-seating/);
    assert.match(workspace, /floor-plan-next-mark-ready/);
    assert.match(workspace, /floor-plan-ready-confirmed/);
    assert.match(workspace, /Share for Seating/);
    assert.match(workspace, /Mark as Ready/);
  });

  it("does not invent a couple furniture write path", () => {
    assert.doesNotMatch(portalSection, /saveFloorPlan|updateObject|moveTable|drag.*furniture/i);
    assert.doesNotMatch(migration, /client_access\s*=\s*'edit'/);
  });
});
