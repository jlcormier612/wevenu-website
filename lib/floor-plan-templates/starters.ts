/**
 * Hello to Cheers — Starter Floor Plan Templates (FP-01 / FP-02).
 *
 * Illustrative layouts only. Room dimensions are neutral placeholders —
 * venues resize to their real spaces. No capacity/fire-code/ADA/exit claims.
 * No inventory links (optional sourcing happens later on venue copies).
 */

import type { DisplayShape, MeasurementUnit, ObjectType } from "@/lib/floor-plans/types";

export type FloorPlanStarterMasterKey = "FP-01" | "FP-02";

export type FloorPlanStarterObject = {
  objectType: ObjectType;
  label: string | null;
  capacity: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  displayShape: DisplayShape | null;
};

export type FloorPlanStarterMaster = {
  key: FloorPlanStarterMasterKey;
  name: string;
  description: string;
  eventType: string | null;
  roomWidthFt: number;
  roomDepthFt: number;
  measurementUnit: MeasurementUnit;
  objects: FloorPlanStarterObject[];
};

const obj = (
  objectType: ObjectType,
  label: string | null,
  x: number,
  y: number,
  width: number,
  height: number,
  opts?: {
    capacity?: number | null;
    rotation?: number;
    displayShape?: DisplayShape | null;
  },
): FloorPlanStarterObject => ({
  objectType,
  label,
  capacity: opts?.capacity ?? null,
  x,
  y,
  width,
  height,
  rotation: opts?.rotation ?? 0,
  displayShape: opts?.displayShape ?? null,
});

/** Zone label helper — text_label has no capacity. */
const zone = (label: string, x: number, y: number) =>
  obj("text_label", label, x, y, 120, 28);

/**
 * FP-01 — Ceremony (left) → Cocktail (center) → Reception (right).
 * Illustrative canvas: 80 ft × 50 ft (960 × 600 inches). Not a real venue claim.
 */
function buildCeremonyAndReceptionObjects(): FloorPlanStarterObject[] {
  const objects: FloorPlanStarterObject[] = [
    zone("Ceremony", 140, 36),
    zone("Cocktail", 380, 36),
    zone("Reception", 700, 36),

    // Ceremony focal + aisle
    obj("other", "Arbor", 140, 100, 90, 50, { displayShape: "arbor" }),
    obj("other", "Aisle", 140, 260, 48, 220, { displayShape: "aisle" }),

    // Ceremony seating rows (left / right of aisle)
    obj("table_rect", "Ceremony Row 1", 70, 180, 100, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 1", 210, 180, 100, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 2", 70, 230, 100, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 2", 210, 230, 100, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 3", 70, 280, 100, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 3", 210, 280, 100, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 4", 70, 330, 100, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 4", 210, 330, 100, 28, { capacity: 8 }),
    obj("table_rect", "Reserved", 70, 380, 100, 28, { capacity: 6 }),
    obj("table_rect", "Reserved", 210, 380, 100, 28, { capacity: 6 }),

    // Cocktail hour
    obj("table_round", "C1", 340, 160, 42, 42, { capacity: 4, displayShape: "cocktail" }),
    obj("table_round", "C2", 420, 160, 42, 42, { capacity: 4, displayShape: "cocktail" }),
    obj("table_round", "C3", 340, 250, 42, 42, { capacity: 4, displayShape: "cocktail" }),
    obj("table_round", "C4", 420, 250, 42, 42, { capacity: 4, displayShape: "cocktail" }),
    obj("table_round", "C5", 380, 340, 42, 42, { capacity: 4, displayShape: "cocktail" }),
    obj("bar", "Cocktail Bar", 380, 430, 120, 44, { displayShape: "bar" }),

    // Reception guest tables
    obj("table_round", "T1", 560, 160, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T2", 680, 160, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T3", 800, 160, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T4", 560, 280, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T5", 800, 280, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T6", 560, 400, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T7", 680, 400, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T8", 800, 400, 72, 72, { capacity: 8, displayShape: "round" }),

    obj("table_rect", "Sweetheart", 680, 250, 110, 44, { capacity: 2 }),
    obj("dance_floor", "Dance Floor", 680, 520, 160, 120, { displayShape: "dance_floor" }),
    obj("other", "DJ / Band", 860, 520, 90, 50, { displayShape: "dj_booth" }),
    obj("bar", "Bar", 900, 320, 100, 44, { displayShape: "bar" }),
    obj("cake_table", "Cake", 900, 420, 60, 40),
    obj("gift_table", "Gifts", 900, 240, 80, 40),
  ];
  return objects;
}

/**
 * FP-02 — Reception-only layout (not a ceremony layout with ceremony hidden).
 * Illustrative canvas: 60 ft × 40 ft (720 × 480 inches). Not a real venue claim.
 */
function buildReceptionOnlyObjects(): FloorPlanStarterObject[] {
  return [
    zone("Reception", 360, 28),

    obj("table_rect", "Sweetheart", 360, 90, 120, 44, { capacity: 2 }),
    obj("dance_floor", "Dance Floor", 360, 220, 160, 140, { displayShape: "dance_floor" }),
    obj("other", "DJ / Band", 360, 340, 100, 48, { displayShape: "dj_booth" }),

    obj("table_round", "T1", 140, 120, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T2", 140, 240, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T3", 140, 360, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T4", 250, 170, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T5", 250, 300, 72, 72, { capacity: 8, displayShape: "round" }),

    obj("table_round", "T6", 580, 120, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T7", 580, 240, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T8", 580, 360, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T9", 470, 170, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T10", 470, 300, 72, 72, { capacity: 8, displayShape: "round" }),

    obj("bar", "Bar", 640, 90, 120, 44, { displayShape: "bar" }),
    obj("cake_table", "Cake / Dessert", 640, 420, 70, 40),
    obj("gift_table", "Gifts / Cards", 80, 90, 90, 40),
  ];
}

export const FLOOR_PLAN_STARTER_MASTERS: readonly FloorPlanStarterMaster[] = [
  {
    key: "FP-01",
    name: "Standard Wedding — Ceremony + Reception",
    description:
      "A flexible starting layout for a wedding with both a ceremony and reception. Customize the room, seating, and other elements to match your venue and the event.",
    eventType: "wedding",
    roomWidthFt: 80,
    roomDepthFt: 50,
    measurementUnit: "feet_inches",
    objects: buildCeremonyAndReceptionObjects(),
  },
  {
    key: "FP-02",
    name: "Standard Wedding — Reception Only",
    description:
      "A flexible starting layout for a wedding reception at your venue. Customize the room, seating, dance floor, service areas, and other elements to match your space and event.",
    eventType: "wedding",
    roomWidthFt: 60,
    roomDepthFt: 40,
    measurementUnit: "feet_inches",
    objects: buildReceptionOnlyObjects(),
  },
] as const;

export function getFloorPlanStarterMaster(key: string): FloorPlanStarterMaster | undefined {
  return FLOOR_PLAN_STARTER_MASTERS.find((m) => m.key === key);
}

/**
 * Pure skip rules used by provision (unit-tested). Never overwrite an existing
 * key or same-named customized template for the venue.
 */
export function shouldSkipFloorPlanStarterProvision(opts: {
  masterKey: string;
  masterName: string;
  existingByKey: Set<string>;
  existingNames: Set<string>;
}): "skip_key" | "skip_name" | "create" {
  if (opts.existingByKey.has(opts.masterKey)) return "skip_key";
  if (opts.existingNames.has(opts.masterName)) return "skip_name";
  return "create";
}
