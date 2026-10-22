import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve("supabase/migrations/20261422300000_floor_plan_portal_furniture_catalog_limits.sql"),
  "utf8",
);
const addRoute = readFileSync(resolve("app/api/portal/floor-plans/add-table/route.ts"), "utf8");
const catalogRoute = readFileSync(
  resolve("app/api/portal/floor-plans/furniture-catalog/route.ts"),
  "utf8",
);
const removeRoute = readFileSync(
  resolve("app/api/portal/floor-plans/remove-object/route.ts"),
  "utf8",
);
const portalSection = readFileSync(resolve("components/portal/floor-plan-section.tsx"), "utf8");
const portalView = readFileSync(resolve("components/portal/floor-plan-view.tsx"), "utf8");
const collabTest = readFileSync(resolve("lib/floor-plans/floor-plan-collab-complete.test.ts"), "utf8");

describe("Floor plan portal furniture catalog + quantity limits", () => {
  it("catalog RPC exposes inventory remaining and plan-type safety cap", () => {
    assert.match(migration, /get_portal_floor_plan_furniture_catalog/);
    assert.match(migration, /quantity_not_configured/);
    assert.match(migration, /quantity_exceeded/);
    assert.match(migration, /_portal_floor_plan_type_safety_cap/);
    assert.match(migration, /inventoryItems/);
    assert.match(migration, /planTableTypes/);
    assert.match(migration, /coordinateModel/);
    assert.match(catalogRoute, /get_portal_floor_plan_furniture_catalog/);
  });

  it("add_portal_floor_plan_table enforces inventory qty and drops unlimited 5-arg body", () => {
    assert.match(migration, /drop function if exists public\.add_portal_floor_plan_table\(text, uuid, text, numeric, numeric\)/);
    assert.match(migration, /p_inventory_item_id uuid/);
    assert.match(migration, /for update/);
    assert.match(migration, /quantity_not_configured/);
    assert.match(migration, /quantity_exceeded/);
    assert.match(migration, /outside_room/);
    assert.match(addRoute, /inventoryItemId/);
    assert.match(addRoute, /p_inventory_item_id/);
  });

  it("move rejects outside_room when room dims are configured", () => {
    assert.match(migration, /outside_room/);
    assert.match(migration, /room_width_ft/);
    assert.match(migration, /room_depth_ft/);
  });

  it("remove blocks assigned guests unless confirm_unassign", () => {
    assert.match(migration, /remove_portal_floor_plan_object/);
    assert.match(migration, /has_assignments/);
    assert.match(migration, /p_confirm_unassign/);
    assert.match(removeRoute, /remove_portal_floor_plan_object/);
    assert.match(removeRoute, /confirmUnassign/);
  });

  it("portal UI is catalog-driven with capacity, room scale, and remove flow", () => {
    assert.match(portalSection, /floor-plan-furniture-catalog/);
    assert.match(portalSection, /floor-plan-catalog-item/);
    assert.match(portalSection, /Add furniture/);
    assert.match(portalSection, /seats/);
    assert.match(portalSection, /floor-plan-room-boundary/);
    assert.match(portalSection, /floor-plan-room-scale/);
    assert.match(portalSection, /floor-plan-remove-table/);
    assert.match(portalSection, /Quantity not set by venue/);
    assert.match(portalView, /seats/);
    assert.doesNotMatch(portalSection, /objectType: "table_round"/);
  });

  it("prior collab regression suite still covers Ready/lock/add surface", () => {
    assert.match(collabTest, /add_portal_floor_plan_table/);
    assert.match(collabTest, /floor-plan-add-table/);
  });
});
