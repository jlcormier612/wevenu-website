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

const phase2Migration = readFileSync(
  resolve("supabase/migrations/20261424600000_floor_plans_phase2_preference_decouple.sql"),
  "utf8",
);

describe("Floor plan collaboration complete (auto-assign, seating, couple move)", () => {
  it("historical 222 select shared layout AND seating; Phase 2 migration decouples preference", () => {
    assert.match(migration, /create or replace function public\.select_portal_floor_plan_offer/);
    assert.match(migration, /shared_with_couple,\s*client_access\s*\)\s*values\s*\([\s\S]*?true,\s*'view'/);
    assert.match(
      migration,
      /update public\.floor_plans\s+set\s+shared_with_couple = true,\s*client_access = 'view'/,
    );
    assert.doesNotMatch(migration, /client_access\s*=\s*'edit'/);
    assert.match(phase2Migration, /couple_preference_status = 'pending'/);
    assert.match(phase2Migration, /Does not set operational_floor_plan_id, shared_with_couple, or client_access/);
  });

  it("Phase 2 ensure_portal reports state without auto-select; route still wired", () => {
    assert.match(phase2Migration, /ensure_portal_floor_plan_assignment/);
    assert.match(phase2Migration, /reason', 'no_offers'/);
    assert.match(phase2Migration, /reason', 'needs_selection'/);
    assert.match(phase2Migration, /reason', 'already_selected'/);
    assert.match(phase2Migration, /sole_offer_shared|sole_offer_awaiting_share/);
    assert.doesNotMatch(
      phase2Migration.split("create or replace function public.ensure_portal_floor_plan_assignment")[1]!
        .split("create or replace function public.get_portal_floor_plans")[0]!,
      /select_portal_floor_plan_offer\(/,
    );
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

  it("sole-offer venue ensure may seed working + layout share without preference or seating", () => {
    assert.match(ensure, /shared_with_couple: true/);
    assert.doesNotMatch(ensure, /client_access: "view"/);
    assert.doesNotMatch(ensure, /couple_selected_floor_plan_id:\s*floorPlanId/);
    assert.match(ensure, /sole_offer|ambiguous_offers/);
  });

  it("portal UX: waiting state, multi-offer preference chooser, working edit + seating hint", () => {
    assert.match(portalSection, /floor-plan-waiting-no-offer/);
    assert.match(portalSection, /Waiting on a layout from your venue/);
    assert.match(portalSection, /ensure-assignment/);
    assert.match(portalSection, /needsChooser = offers\.length > 1/);
    assert.match(portalSection, /Save as preference|preferred layout/);
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

  it("venue workspace keeps seating toggles and sole-offer simple-path guidance", () => {
    assert.match(workspace, /floor-plan-next-mark-ready|floor-plan-preference-awaiting-share/);
    assert.match(workspace, /floor-plan-ready-confirmed/);
    assert.match(workspace, /Seating open|Seating paused/);
    assert.match(workspace, /Sole offered layout/i);
    assert.doesNotMatch(
      workspace,
      /then\s+<span[^>]*>Share for Seating<\/span>\s+so the couple can assign/,
    );
  });

  it("prior select-shares migration remains historically correct (superseded by 222)", () => {
    assert.match(priorSelect, /true,\s*'hidden'/);
  });
});
