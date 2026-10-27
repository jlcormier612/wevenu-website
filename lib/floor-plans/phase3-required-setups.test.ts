/**
 * Floor Plans Phase 3 — required setups, scoped alternatives, package view seams.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  alternativeMemberIds,
  eventUsesSetupPackage,
  layoutsBelongOnlyToSetup,
  portalShouldShowPackageView,
} from "@/lib/floor-plans/setups";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20261425000000_floor_plans_phase3_required_setups.sql"),
  "utf8",
);
const portal = readFileSync(join(root, "components/portal/floor-plan-section.tsx"), "utf8");
const packagePanel = readFileSync(
  join(root, "components/events/floor-plan-setup-package.tsx"),
  "utf8",
);
const setupService = readFileSync(join(root, "lib/floor-plans/setup-service.ts"), "utf8");
const phase1 = readFileSync(join(root, "lib/floor-plans/phase1-contract-invariants.test.ts"), "utf8");
const phase2 = readFileSync(join(root, "lib/floor-plans/phase2-preference-decouple.test.ts"), "utf8");

describe("Phase 3 helpers — package vs simple path", () => {
  it("zero setups keeps simple path; any setup enables package mode", () => {
    assert.equal(eventUsesSetupPackage(0), false);
    assert.equal(eventUsesSetupPackage(1), true);
    assert.equal(portalShouldShowPackageView(false), false);
    assert.equal(portalShouldShowPackageView(true), true);
  });

  it("alternatives exclude the working layout for a setup", () => {
    const members = [
      { floorPlanId: "ceremony" },
      { floorPlanId: "reception-a" },
      { floorPlanId: "reception-b" },
    ];
    assert.deepEqual(alternativeMemberIds(members, "reception-a"), ["ceremony", "reception-b"]);
  });

  it("layouts for one setup never include another setup's members", () => {
    const memberships = [
      { setupId: "s-ceremony", floorPlanId: "fp-garden" },
      { setupId: "s-reception", floorPlanId: "fp-a" },
      { setupId: "s-reception", floorPlanId: "fp-b" },
    ];
    assert.equal(
      layoutsBelongOnlyToSetup("s-reception", memberships, ["fp-a", "fp-b"]),
      true,
    );
    assert.equal(
      layoutsBelongOnlyToSetup("s-reception", memberships, ["fp-a", "fp-garden"]),
      false,
    );
  });
});

describe("Phase 3 migration — explicit setups, no name inference, detach-safe", () => {
  it("creates setup and member tables with unique floor_plan membership", () => {
    assert.match(migration, /create table if not exists public\.event_floor_plan_setups/);
    assert.match(migration, /create table if not exists public\.event_floor_plan_setup_members/);
    assert.match(migration, /unique \(floor_plan_id\)/);
    assert.match(migration, /never inferred/i);
  });

  it("portal preference RPC is setup-scoped and preference-only", () => {
    assert.match(migration, /select_portal_setup_floor_plan_preference/);
    assert.match(migration, /Does not set operational, share, or seating/);
    assert.match(migration, /Does not mutate other setups/);
    assert.match(migration, /get_portal_floor_plan_setups/);
  });

  it("does not destructively backfill or reinterpret legacy events", () => {
    assert.match(migration, /No destructive backfill/);
    assert.doesNotMatch(migration, /update public\.events[\s\S]{0,80}setup/i);
  });
});

describe("Phase 3 UI seams", () => {
  it("portal package view uses Your wedding setups and nests options under setups", () => {
    assert.match(portal, /Your wedding setups/);
    assert.match(portal, /floor-plan-wedding-setups/);
    assert.match(portal, /showPackageView/);
    assert.match(portal, /ChooseLayoutSection/);
  });

  it("venue organizer is progressive and detach preserves layouts", () => {
    assert.match(packagePanel, /Organize wedding setups/);
    assert.match(packagePanel, /optional/i);
    assert.match(packagePanel, /Detach/);
    assert.match(packagePanel, /Layouts stay on the event/);
    assert.match(setupService, /deleteSetupMember/);
    assert.match(setupService, /preserves layout/i);
  });
});

describe("Phase 3 does not reopen Phase 1/2 invariants", () => {
  it("Phase 1 coexistence and Phase 2 preference suites remain present", () => {
    assert.match(phase1, /multi-layout coexistence without package claims/);
    assert.match(phase2, /select_portal_floor_plan_offer/);
    assert.match(phase2, /does not set operational\/share\/seating/i);
  });
});
