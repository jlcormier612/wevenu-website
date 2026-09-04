/**
 * Floor plan / template authorization helpers — unit tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  canDeleteFloorPlanRows,
  canEditFloorPlans,
} from "@/lib/floor-plans/authorize";

describe("floor plan authorize helpers", () => {
  it("Staff cannot edit or delete plan/template rows", () => {
    assert.equal(canEditFloorPlans("staff"), false);
    assert.equal(canDeleteFloorPlanRows("staff"), false);
  });

  it("Coordinator can edit but cannot delete plan/template rows", () => {
    assert.equal(canEditFloorPlans("coordinator"), true);
    assert.equal(canDeleteFloorPlanRows("coordinator"), false);
  });

  it("Manager and Owner can edit and delete", () => {
    for (const role of ["manager", "owner"] as const) {
      assert.equal(canEditFloorPlans(role), true, role);
      assert.equal(canDeleteFloorPlanRows(role), true, role);
    }
  });

  it("null/unknown roles are denied", () => {
    assert.equal(canEditFloorPlans(null), false);
    assert.equal(canDeleteFloorPlanRows(undefined), false);
    assert.equal(canEditFloorPlans("guest"), false);
  });
});

describe("floor plan permission enforcement seams", () => {
  const root = process.cwd();

  it("floor-plans service gates edits and plan-row deletes", () => {
    const src = readFileSync(join(root, "lib/floor-plans/service.ts"), "utf8");
    assert.match(src, /canEditFloorPlans/);
    assert.match(src, /canDeleteFloorPlanRows/);
    assert.match(src, /withVenueEditor/);
    assert.match(src, /withVenuePlanDeleter/);
    assert.match(src, /FLOOR_PLAN_EDIT_DENIED/);
    assert.match(src, /FLOOR_PLAN_DELETE_DENIED/);
  });

  it("floor-plan-templates service gates edits and template-row deletes", () => {
    const src = readFileSync(join(root, "lib/floor-plan-templates/service.ts"), "utf8");
    assert.match(src, /canEditFloorPlans/);
    assert.match(src, /canDeleteFloorPlanRows/);
    assert.match(src, /withVenueEditor/);
    assert.match(src, /withVenueTemplateDeleter/);
    assert.match(src, /FLOOR_PLAN_TEMPLATE_DELETE_DENIED/);
  });

  it("floor-plan-offers service requires edit permission", () => {
    const src = readFileSync(join(root, "lib/floor-plan-offers/service.ts"), "utf8");
    assert.match(src, /canEditFloorPlans/);
    assert.match(src, /FLOOR_PLAN_EDIT_DENIED/);
  });

  it("venue StaffRole includes coordinator", () => {
    const src = readFileSync(join(root, "lib/venue/types.ts"), "utf8");
    assert.match(src, /StaffRole\s*=\s*"owner"\s*\|\s*"manager"\s*\|\s*"coordinator"\s*\|\s*"staff"/);
  });

  it("RLS migration denies Staff INSERT/UPDATE and allows Coordinator object DELETE", () => {
    const src = readFileSync(
      join(root, "supabase/migrations/20261329000000_floor_plan_staff_write_gates.sql"),
      "utf8",
    );
    assert.match(src, /floor_plans_staff_insert_gate/);
    assert.match(src, /floor_plans_staff_update_gate/);
    assert.match(src, /floor_plan_objects_staff_insert_gate/);
    assert.match(src, /floor_plan_templates_staff_insert_gate/);
    assert.match(src, /floor_plan_template_objects_staff_insert_gate/);
    assert.match(src, /event_floor_plan_offers_staff_insert_gate/);
    assert.match(src, /current_user_role\(\) is distinct from 'staff'/);
    assert.match(src, /floor_plan_objects_delete_gate/);
    assert.match(src, /array\['owner', 'manager', 'coordinator'\]/);
    assert.match(src, /floor_plan_template_objects_delete_gate/);
    // Plan/template row DELETE gates from earlier migrations remain Owner/Manager —
    // this migration must not recreate them as Staff-open.
    assert.doesNotMatch(src, /floor_plans_delete_gate/);
    assert.doesNotMatch(src, /floor_plan_templates_delete_gate/);
  });

  it("existing Owner/Manager DELETE gates remain in prior migrations", () => {
    const g6 = readFileSync(
      join(root, "supabase/migrations/20261002000000_tr_g6_core_object_delete_role_gate.sql"),
      "utf8",
    );
    const templates = readFileSync(
      join(root, "supabase/migrations/20261260000000_template_delete_permission_normalization.sql"),
      "utf8",
    );
    assert.match(g6, /floor_plans_delete_gate[\s\S]*owner[\s\S]*manager/);
    assert.match(templates, /floor_plan_templates_delete_gate[\s\S]*owner[\s\S]*manager/);
  });
});
