/**
 * Floor plan / template venue-staff authorization.
 *
 * Owner/Manager: full management including deleting plan/template rows.
 * Coordinator: create/edit plans, templates, objects, offers — cannot delete
 *   the floor_plan or floor_plan_templates row.
 * Staff: view only.
 *
 * Couple/vendor paths do not use these helpers (portal/vendor RPCs).
 */

export type FloorPlanVenueRole = "owner" | "manager" | "coordinator" | "staff";

export const FLOOR_PLAN_EDIT_DENIED =
  "You don't have permission to edit floor plans.";

export const FLOOR_PLAN_DELETE_DENIED =
  "Only an Owner or Manager can delete a floor plan.";

export const FLOOR_PLAN_TEMPLATE_DELETE_DENIED =
  "Only an Owner or Manager can delete this template.";

export const FLOOR_PLAN_OBJECT_DELETE_DENIED =
  "You don't have permission to remove objects from this floor plan.";

export const FLOOR_PLAN_CLEAR_DENIED =
  "You don't have permission to clear this floor plan.";

/** Create/edit plans, templates, objects, offers, share/operational flags. */
export function canEditFloorPlans(role: string | null | undefined): boolean {
  return role === "owner" || role === "manager" || role === "coordinator";
}

/** Delete floor_plans / floor_plan_templates rows (not in-plan object edits). */
export function canDeleteFloorPlanRows(role: string | null | undefined): boolean {
  return role === "owner" || role === "manager";
}
