/**
 * Floor Plan domain types (Sprint 18 — Floor Plan Studio Lite).
 *
 * The canvas uses a fixed 800×600 logical coordinate space.
 * Object positions (x, y) are the center of the object in that space.
 */

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

export type FloorPlan = {
  id: string;
  venueId: string;
  eventId: string;
  name: string;
  backgroundImageUrl: string | null;
  backgroundImageOpacity: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FloorPlanObject = {
  id: string;
  venueId: string;
  floorPlanId: string;
  objectType: ObjectType;
  label: string | null;
  capacity: number | null;
  x: number;       // center x in 800×600 canvas
  y: number;       // center y in 800×600 canvas
  width: number;   // canvas units
  height: number;  // canvas units
  rotation: number;
  sortOrder: number;
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
};

export type UpdateObjectInput = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  label?: string | null;
  capacity?: number | null;
};

export type FloorPlanActionResult =
  | { ok: true }
  | { ok: false; message?: string };

export type CreateFloorPlanResult =
  | { ok: true; floorPlanId: string }
  | { ok: false; message?: string };
