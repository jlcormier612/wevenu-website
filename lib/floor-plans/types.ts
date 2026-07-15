/**
 * Floor Plan domain types (Sprint 18 — Floor Plan Studio Lite).
 *
 * The canvas uses a fixed 800×600 logical coordinate space.
 * Object positions (x, y) are the center of the object in that space.
 */

import type { InventoryShape } from "@/lib/inventory/types";

export type ObjectType =
  | "table_round"
  | "table_rect"
  | "table_oval"
  | "stage"
  | "dance_floor"
  | "bar"
  | "gift_table"
  | "cake_table"
  | "text_label"
  | "other";

// Reserved for Client Collaboration (not built yet) — which floor plans a
// client may see/edit on their booking. No UI or logic reads this today.
export type FloorPlanClientAccess = "edit" | "view" | "hidden";

// Display-only — canvas units are always inches internally (an Inventory
// item's width/length are already plain-number inches, e.g. a "60" Round"
// table has width = 60). This only controls how room dimensions and grid
// labels are formatted for the coordinator (Floor Plan Editor Completion).
export type MeasurementUnit = "feet_inches" | "decimal_feet";

// Reuses the exact vocabulary an Inventory item's own `shape` already uses —
// a placed object's display shape is a frozen-at-placement-time copy of
// that value, never a live reference, same as color/notes (Floor Plan
// Completion — Phase 2).
export type DisplayShape = InventoryShape;

export type FloorPlan = {
  id: string;
  venueId: string;
  eventId: string;
  name: string;
  spaceId: string | null;
  clientAccess: FloorPlanClientAccess;
  backgroundImageUrl: string | null;
  backgroundImageOpacity: number;
  backgroundLocked: boolean;
  notes: string | null;
  // The room this plan's canvas represents, in feet — canvas units are
  // room_width_ft * 12 wide (inches). Configurable per plan.
  roomWidthFt: number;
  roomDepthFt: number;
  measurementUnit: MeasurementUnit;
  // Phase 4 — the print-ready checkpoint reconciliation is anchored to.
  // Mirrors event_orders.finalized_at's shape exactly. Never gates editing
  // — placement stays open before, during, and after Final.
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// Phase 4 — Floor Plan reconciliation against Event Order. Fact-based only:
// an item only appears here when this Floor Plan and its linked Section
// both reference the same Inventory item and disagree on count. Lines with
// no inventoryItemId (package/custom provenance) never appear — there is
// nothing on the Floor Plan side to count them against, and this never
// guesses a match from descriptions/labels. See
// docs/booking-financial-architecture-phase4-floor-plan-design.md §4.
export type FloorPlanReconciliationItem = {
  inventoryItemId: string;
  itemName: string;
  committed: number;
  placed: number;
};

export type FloorPlanSectionReconciliation = {
  sectionId: string;
  sectionName: string;
  items: FloorPlanReconciliationItem[];
};

export type FloorPlanObject = {
  id: string;
  venueId: string;
  floorPlanId: string;
  objectType: ObjectType;
  label: string | null;
  capacity: number | null;
  x: number;       // center x, canvas units (inches)
  y: number;       // center y, canvas units (inches)
  width: number;   // canvas units (inches)
  height: number;  // canvas units (inches) — "Length" in the properties panel
  rotation: number;
  sortOrder: number;
  // Which Inventory item this was placed from, if any (Inventory Foundation
  // task) — additive/nullable, read only for usage reporting. Floor Plans
  // are otherwise unaware of Inventory.
  inventoryItemId: string | null;
  // Per-placement overrides (Floor Plan Editor Completion) — never written
  // back to the Inventory item itself.
  color: string | null;
  notes: string | null;
  locked: boolean;
  // The shape actually rendered on canvas (Floor Plan Completion — Phase 2).
  // Copied from the Inventory item's own `shape` at placement time; a
  // coordinator may override it per-placement without touching the item.
  // Null on objects placed before this existed — the renderer falls back
  // to its object_type-based legacy rendering in that case.
  displayShape: DisplayShape | null;
  createdAt: string;
  updatedAt: string;
};

export type FloorPlanWithObjects = FloorPlan & {
  objects: FloorPlanObject[];
};

export type AddObjectInput = {
  objectType: ObjectType;
  x: number;
  y: number;
  label?: string;
  capacity?: number;
  // Optional overrides so an Inventory item's own dimensions can be used
  // in place of the object type's built-in defaults (Inventory Foundation
  // task) — omit to fall back to today's behavior exactly.
  width?: number;
  height?: number;
  inventoryItemId?: string;
  // Optional — rotation defaults to 0 (unchanged); color/notes are per-
  // placement overrides, used by Duplicate to carry the source object's
  // values forward (Floor Plan Editor Completion).
  rotation?: number;
  color?: string;
  notes?: string;
  displayShape?: DisplayShape | null;
};

export type UpdateObjectInput = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  label?: string | null;
  capacity?: number | null;
  color?: string | null;
  notes?: string | null;
  locked?: boolean;
  displayShape?: DisplayShape | null;
};

export type ReorderDirection = "forward" | "backward";

export type UpdateRoomSettingsInput = {
  roomWidthFt: number;
  roomDepthFt: number;
  measurementUnit: MeasurementUnit;
};

export type FloorPlanActionResult =
  | { ok: true }
  | { ok: false; message?: string };

export type CreateFloorPlanResult =
  | { ok: true; floorPlanId: string }
  | { ok: false; message?: string };

// Minimal shape the Floor Plan editor actually renders and edits — both a
// booking's FloorPlan/FloorPlanObject and a reusable FloorPlanTemplate/
// FloorPlanTemplateObject (Floor Plan Template Library task) satisfy this,
// so the same editor works against either without knowing which one it's
// pointed at. See components/floor-plan/floor-plan-editor.tsx.
export type FloorPlanCanvasObject = {
  id: string;
  objectType: ObjectType;
  label: string | null;
  capacity: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  sortOrder: number;
  inventoryItemId: string | null;
  color: string | null;
  notes: string | null;
  locked: boolean;
  displayShape: DisplayShape | null;
};

export type FloorPlanCanvasPlan = {
  id: string;
  name: string;
  backgroundImageUrl: string | null;
  backgroundImageOpacity: number;
  backgroundLocked: boolean;
  roomWidthFt: number;
  roomDepthFt: number;
  measurementUnit: MeasurementUnit;
  objects: FloorPlanCanvasObject[];
  // Booking floor plans only — Templates have no notes field, so this is
  // optional rather than duplicating FloorPlanCanvasPlan for the two modes.
  notes?: string | null;
};

// The editor calls these instead of importing a fixed set of server actions
// directly, so it can be pointed at either a booking's floor plan or a
// Floor Plan Template without duplicating the editor itself.
export type FloorPlanEditorActions = {
  // Only .ok is ever read by the editor (a fresh reload follows success) —
  // loosened from CreateFloorPlanResult so booking and template creation
  // results (different id field names) both satisfy this without adapting.
  create: () => Promise<FloorPlanActionResult>;
  addObject: (planId: string, input: AddObjectInput) => Promise<{ ok: true; object: FloorPlanCanvasObject } | FloorPlanActionResult>;
  updateObject: (objId: string, input: UpdateObjectInput) => Promise<FloorPlanActionResult>;
  deleteObject: (objId: string) => Promise<FloorPlanActionResult>;
  reorderObject: (planId: string, objId: string, direction: ReorderDirection) => Promise<FloorPlanActionResult>;
  updateBackground: (planId: string, url: string | null, opacity: number) => Promise<FloorPlanActionResult>;
  setBackgroundLocked: (planId: string, locked: boolean) => Promise<FloorPlanActionResult>;
  updateRoomSettings: (planId: string, input: UpdateRoomSettingsInput) => Promise<FloorPlanActionResult>;
  clear: (planId: string) => Promise<FloorPlanActionResult>;
  // Booking mode only — Templates have no notes field to update.
  updateNotes?: (planId: string, notes: string) => Promise<FloorPlanActionResult>;
};
