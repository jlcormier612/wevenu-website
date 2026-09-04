import type { DisplayShape, MeasurementUnit, ObjectType } from "@/lib/floor-plans/types";

export type FloorPlanTemplate = {
  id: string;
  venueId: string;
  name: string;
  eventType: string | null;
  spaceId: string | null;
  isDefault: boolean;
  isArchived: boolean;
  /** Hello to Cheers master key (FP-01 / FP-02) when provisioned from a starter. */
  sourceMasterKey: string | null;
  /** Source-of-record Document for the uploaded floor-plan file (Phase 2). Null on legacy URL-only templates. */
  backgroundDocumentId: string | null;
  backgroundImageUrl: string | null;
  backgroundImageOpacity: number;
  backgroundLocked: boolean;
  roomWidthFt: number;
  roomDepthFt: number;
  measurementUnit: MeasurementUnit;
  createdAt: string;
  updatedAt: string;
};

// The library card grid needs the space name and object count alongside the
// base row — computed alongside the list, never stored.
export type FloorPlanTemplatePreviewObject = {
  id: string;
  objectType: ObjectType;
  label: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string | null;
  displayShape: DisplayShape | null;
};

export type FloorPlanTemplateWithStats = FloorPlanTemplate & {
  spaceName: string | null;
  objectCount: number;
  /** Objects for Library preview SVG (presentation only — real shape renderer). */
  previewObjects: FloorPlanTemplatePreviewObject[];
};

export type FloorPlanTemplateObject = {
  id: string;
  venueId: string;
  templateId: string;
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
  createdAt: string;
  updatedAt: string;
};

export type FloorPlanTemplateActionResult =
  | { ok: true }
  | { ok: false; message?: string };

export type CreateFloorPlanTemplateResult =
  | { ok: true; templateId: string }
  | { ok: false; message?: string };

export type ImportFloorPlanTemplateResult =
  | { ok: true; templateId: string; objectCount: number }
  | { ok: false; message: string };
