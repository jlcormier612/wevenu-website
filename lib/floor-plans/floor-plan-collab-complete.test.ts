import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve("supabase/migrations/20261422200000_floor_plan_collab_auto_seating_couple_move.sql"),
  "utf8",
);
const priorSelect = readFileSync(
  resolve("supabase/migrations/20261422100000_floor_plan_select_shares_layout_view.sql"),
  "utf8",
);
const portalSection = readFileSync(resolve("components/portal/floor-plan-section.tsx"), "utf8");
const portalView = readFileSync(resolve("components/portal/floor-plan-view.tsx"), "utf8");
const workspace = readFileSync(resolve("components/events/floor-plan-workspace.tsx"), "utf8");
const ensure = readFileSync(resolve("lib/floor-plans/ensure-working-layout.ts"), "utf8");
const moveRoute = readFileSync(resolve("app/api/portal/floor-plans/move-object/route.ts"), "utf8");
const ensureRoute = readFileSync(resolve("app/api/portal/floor-plans/ensure-assignment/route.ts"), "utf8");
const addRoute = readFileSync(resolve("app/api/portal/floor-plans/add-table/route.ts"), "utf8");

describe("Floor plan collaboration complete (auto-assign, seating, couple move)", () => {
  it("select RPC shares layout AND enables seating (client_access=view)", () => {
    assert.match(migration, /create or replace function public\.select_portal_floor_plan_offer/);
    assert.match(migration, /shared_with_couple,\s*client_access\s*\)\s*values\s*\([\s\S]*?true,\s*'view'/);
    assert.match(
      migration,
      /update public\.floor_plans\s+set\s+shared_with_couple = true,\s*client_access = 'view'/,
    );
    assert.doesNotMatch(migration, /client_access\s*=\s*'edit'/);
  });

  it("ensure_portal_floor_plan_assignment covers zero / sole / multi / already_selected", () => {
    assert.match(migration, /ensure_portal_floor_plan_assignment/);
    assert.match(migration, /reason', 'no_offers'/);
    assert.match(migration, /reason', 'needs_selection'/);
    assert.match(migration, /reason', 'sole_offer'/);
    assert.match(migration, /reason', 'already_selected'/);
    assert.match(migration, /select_portal_floor_plan_offer\(p_token, v_offer_id\)/);
    assert.match(ensureRoute, /ensure_portal_floor_plan_assignment/);
  });

  it("move_portal_floor_plan_object rejects locked and Ready plans", () => {
    assert.match(migration, /move_portal_floor_plan_object/);
    assert.match(migration, /object_locked/);
    assert.match(migration, /plan_ready/);
    assert.match(migration, /finalized_at is not null/);
    assert.match(migration, /coalesce\(v_obj\.locked, false\)/);
    assert.match(moveRoute, /move_portal_floor_plan_object/);
  });

  it("add_portal_floor_plan_table respects couple_may_add_tables", () => {
    assert.match(migration, /couple_may_add_tables/);
    assert.match(migration, /add_portal_floor_plan_table/);
    assert.match(migration, /add_not_permitted/);
    assert.match(migration, /type_not_permitted/);
    assert.match(addRoute, /add_portal_floor_plan_table/);
  });

  it("portal detail exposes locked + coupleMayAddTables", () => {
    assert.match(migration, /'coupleMayAddTables'/);
    assert.match(migration, /'locked', coalesce\(o\.locked/);
  });

  it("sole-offer venue ensure shares layout, seating, and couple_selected", () => {
    assert.match(ensure, /couple_selected_floor_plan_id/);
    assert.match(ensure, /shared_with_couple: true/);
    assert.match(ensure, /client_access: "view"/);
    assert.match(ensure, /soleOffer/);
  });

  it("portal UX: waiting state, skip chooser for sole, working edit + seating hint", () => {
    assert.match(portalSection, /floor-plan-waiting-no-offer/);
    assert.match(portalSection, /Waiting on a layout from your venue/);
    assert.match(portalSection, /ensure-assignment/);
    assert.match(portalSection, /needsChooser = offers\.length > 1 && !coupleSelectedId/);
    assert.match(portalSection, /Your Floor Plan/);
    assert.match(portalSection, /floor-plan-working-canvas/);
    assert.match(portalSection, /move-object/);
    assert.match(portalSection, /floor-plan-add-table/);
    assert.match(portalSection, /floor-plan-submit-to-venue/);
    assert.match(portalSection, /floor-plan-guidance/);
    assert.match(portalSection, /Seating is available now/);
    assert.match(portalSection, /floor-plan-ready-badge/);
    assert.doesNotMatch(portalSection, /furniture is venue-owned/);
    assert.match(portalView, /Waiting on a layout from your venue/);
    assert.match(portalView, /Seating is available now/);
  });

  it("venue workspace no longer requires Share for Seating as the ordinary next step", () => {
    assert.match(workspace, /floor-plan-next-mark-ready/);
    assert.match(workspace, /floor-plan-ready-confirmed/);
    assert.match(workspace, /Seating open|Seating paused/);
    assert.match(workspace, /sole offered layout is assigned/i);
    assert.doesNotMatch(
      workspace,
      /then\s+<span[^>]*>Share for Seating<\/span>\s+so the couple can assign/,
    );
  });

  it("prior select-shares migration remains historically correct (superseded by 222)", () => {
    assert.match(priorSelect, /true,\s*'hidden'/);
  });
});
