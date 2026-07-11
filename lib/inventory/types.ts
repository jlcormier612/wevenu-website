/**
 * Inventory Foundation — a venue's reusable physical inventory, fully
 * decoupled from any booking (Requirement 7). See lib/inventory/repository.ts.
 */

// The venue's reusable display-shape vocabulary (Floor Plan Completion —
// Phase 2). An item's shape is copied onto a placed object at insert time
// (lib/floor-plans/types.ts's FloorPlanObject.displayShape) — the canvas
// renderer (components/floor-plan/floor-plan-shapes.tsx) looks the shape up
// in one small reusable library rather than hardcoding per object type.
export type InventoryShape =
  | "round" | "square" | "rectangular" | "oval" | "cocktail"
  | "dance_floor" | "stage" | "dj_booth" | "bar" | "buffet"
  | "arbor" | "arch" | "aisle"
  | "sofa" | "lounge"
  | "custom";

export type InventoryCategory = {
  id: string;
  venueId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type InventoryItem = {
  id: string;
  venueId: string;
  categoryId: string | null;
  name: string;
  quantityAvailable: number;
  width: number | null;
  length: number | null;
  height: number | null;
  shape: InventoryShape | null;
  color: string | null;
  imageUrl: string | null;
  printableName: string | null;
  isArchived: boolean;
  availableForFloorPlans: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryItemWithCategory = InventoryItem & {
  categoryName: string | null;
};

export type InventoryItemInput = {
  name: string;
  categoryId: string | null;
  quantityAvailable: number;
  width: number | null;
  length: number | null;
  height: number | null;
  shape: InventoryShape | null;
  color: string | null;
  printableName: string | null;
  availableForFloorPlans: boolean;
};

/** One inventory item's usage across every floor plan on a single booking — reporting only, see Requirement 6. */
export type InventoryUsage = {
  itemId: string;
  name: string;
  quantityAvailable: number;
  quantityUsed: number;
};

export type InventoryActionResult = { ok: true } | { ok: false; message?: string };
export type CreateInventoryItemResult = { ok: true; itemId: string } | { ok: false; message?: string };
export type CreateInventoryCategoryResult = { ok: true; categoryId: string } | { ok: false; message?: string };
