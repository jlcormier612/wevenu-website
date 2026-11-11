/**
 * Hello to Cheers — Starter Floor Plan Templates.
 *
 * Distinct wedding-setup starters (ceremony / cocktail / reception), plus an
 * optional same-room flip and a blank canvas. Illustrative layouts only —
 * room dimensions are neutral placeholders. No capacity/fire-code/ADA claims.
 * No inventory links. No phase/timeline engine — each starter is one static plan.
 *
 * Legacy FP-01 ("Standard Wedding — Ceremony + Reception" combined canvas) is
 * intentionally NOT in this list. Existing venue copies with source_master_key
 * FP-01 remain readable and editable; new venues no longer receive that default.
 */

import type { DisplayShape, MeasurementUnit, ObjectType } from "@/lib/floor-plans/types";

export type FloorPlanStarterMasterKey =
  | "FP-02"
  | "FP-03"
  | "FP-04"
  | "FP-05"
  | "FP-SR";

/** Legacy combined master — no longer provisioned; kept for docs/tests/compat. */
export const LEGACY_COMBINED_FLOOR_PLAN_STARTER_KEY = "FP-01" as const;

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
  obj("text_label", label, x, y, 160, 28);

/**
 * FP-03 — Wedding Ceremony only.
 * Illustrative canvas: 50 ft × 40 ft (600 × 480 inches).
 */
function buildCeremonyObjects(): FloorPlanStarterObject[] {
  return [
    zone("Ceremony", 300, 28),

    obj("other", "Arbor", 300, 90, 100, 56, { displayShape: "arbor" }),
    obj("other", "Aisle", 300, 280, 48, 240, { displayShape: "aisle" }),

    obj("table_rect", "Ceremony Row 1", 160, 180, 110, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 1", 440, 180, 110, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 2", 160, 240, 110, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 2", 440, 240, 110, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 3", 160, 300, 110, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 3", 440, 300, 110, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 4", 160, 360, 110, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 4", 440, 360, 110, 28, { capacity: 8 }),
    obj("table_rect", "Reserved", 160, 420, 110, 28, { capacity: 6 }),
    obj("table_rect", "Reserved", 440, 420, 110, 28, { capacity: 6 }),
  ];
}

/**
 * FP-04 — Cocktail Hour only.
 * Illustrative canvas: 40 ft × 30 ft (480 × 360 inches).
 */
function buildCocktailObjects(): FloorPlanStarterObject[] {
  return [
    zone("Cocktail Hour", 240, 24),

    obj("table_round", "C1", 120, 120, 42, 42, { capacity: 4, displayShape: "cocktail" }),
    obj("table_round", "C2", 220, 120, 42, 42, { capacity: 4, displayShape: "cocktail" }),
    obj("table_round", "C3", 320, 120, 42, 42, { capacity: 4, displayShape: "cocktail" }),
    obj("table_round", "C4", 120, 220, 42, 42, { capacity: 4, displayShape: "cocktail" }),
    obj("table_round", "C5", 220, 220, 42, 42, { capacity: 4, displayShape: "cocktail" }),
    obj("table_round", "C6", 320, 220, 42, 42, { capacity: 4, displayShape: "cocktail" }),
    obj("bar", "Cocktail Bar", 240, 300, 140, 44, { displayShape: "bar" }),
  ];
}

/**
 * FP-02 — Wedding Reception only (not a ceremony layout with ceremony hidden).
 * Illustrative canvas: 60 ft × 40 ft (720 × 480 inches).
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

/**
 * FP-SR — Same-room ceremony + reception flip (specialized).
 * One static canvas with two labeled reference arrangements side by side.
 * Does NOT switch by event phase — Hello to Cheers stores one arrangement
 * per floor plan; venues edit or duplicate plans for the flip.
 * Illustrative canvas: 80 ft × 50 ft (960 × 600 inches).
 */
function buildSameRoomFlipObjects(): FloorPlanStarterObject[] {
  return [
    zone("Ceremony setup (reference)", 160, 28),
    zone("Reception setup (reference)", 700, 28),
    obj(
      "text_label",
      "Same room — static reference only (not a timed flip)",
      480,
      70,
      280,
      28,
    ),

    // Ceremony (left)
    obj("other", "Arbor", 160, 120, 90, 50, { displayShape: "arbor" }),
    obj("other", "Aisle", 160, 280, 48, 220, { displayShape: "aisle" }),
    obj("table_rect", "Ceremony Row 1", 80, 200, 100, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 1", 240, 200, 100, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 2", 80, 260, 100, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 2", 240, 260, 100, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 3", 80, 320, 100, 28, { capacity: 8 }),
    obj("table_rect", "Ceremony Row 3", 240, 320, 100, 28, { capacity: 8 }),
    obj("table_rect", "Reserved", 80, 380, 100, 28, { capacity: 6 }),
    obj("table_rect", "Reserved", 240, 380, 100, 28, { capacity: 6 }),

    // Reception (right) — dining focus for after the flip
    obj("table_rect", "Sweetheart", 700, 140, 110, 44, { capacity: 2 }),
    obj("table_round", "T1", 560, 200, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T2", 680, 200, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T3", 800, 200, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T4", 560, 320, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T5", 800, 320, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("table_round", "T6", 680, 400, 72, 72, { capacity: 8, displayShape: "round" }),
    obj("dance_floor", "Dance Floor", 700, 500, 160, 100, { displayShape: "dance_floor" }),
    obj("bar", "Bar", 880, 320, 100, 44, { displayShape: "bar" }),
    obj("other", "DJ / Band", 880, 420, 90, 50, { displayShape: "dj_booth" }),
  ];
}

export const FLOOR_PLAN_STARTER_MASTERS: readonly FloorPlanStarterMaster[] = [
  {
    key: "FP-03",
    name: "Wedding Ceremony",
    description:
      "Ceremony seating and a focal point (arbor/altar). Does not include cocktail hour or reception dining — start from those starters when you need them as separate plans.",
    eventType: "wedding",
    roomWidthFt: 50,
    roomDepthFt: 40,
    measurementUnit: "feet_inches",
    objects: buildCeremonyObjects(),
  },
  {
    key: "FP-04",
    name: "Cocktail Hour",
    description:
      "Mingling space with high-tops and a bar. Does not include ceremony seating or a full reception dining layout.",
    eventType: "wedding",
    roomWidthFt: 40,
    roomDepthFt: 30,
    measurementUnit: "feet_inches",
    objects: buildCocktailObjects(),
  },
  {
    key: "FP-02",
    name: "Wedding Reception",
    description:
      "Dining tables, dance floor, and common reception service areas. Does not include a ceremony or cocktail-hour setup.",
    eventType: "wedding",
    roomWidthFt: 60,
    roomDepthFt: 40,
    measurementUnit: "feet_inches",
    objects: buildReceptionOnlyObjects(),
  },
  {
    key: "FP-SR",
    name: "Same-Room Ceremony + Reception Flip",
    description:
      "Specialized starter for venues that use one room for ceremony then reception. Shows both arrangements as a static reference on one canvas — Hello to Cheers does not switch layouts by event phase. Duplicate or edit plans when you need separate before/after working copies.",
    eventType: "wedding",
    roomWidthFt: 80,
    roomDepthFt: 50,
    measurementUnit: "feet_inches",
    objects: buildSameRoomFlipObjects(),
  },
  {
    key: "FP-05",
    name: "Blank Floor Plan",
    description:
      "An empty canvas so you can build your own layout. No ceremony, cocktail, or reception objects are prepopulated.",
    eventType: "wedding",
    roomWidthFt: 60,
    roomDepthFt: 40,
    measurementUnit: "feet_inches",
    objects: [],
  },
] as const;

export function getFloorPlanStarterMaster(key: string): FloorPlanStarterMaster | undefined {
  return FLOOR_PLAN_STARTER_MASTERS.find((m) => m.key === key);
}

export function listFloorPlanStarterMasters(): FloorPlanStarterMaster[] {
  return [...FLOOR_PLAN_STARTER_MASTERS];
}

/** Labels that appear only on the specialized same-room flip starter. */
export function isSameRoomFlipStarter(master: FloorPlanStarterMaster): boolean {
  return master.key === "FP-SR";
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

/**
 * True when a venue template still looks like the legacy combined FP-01
 * (ceremony + cocktail + reception zones). Used only for documentation /
 * preservation checks — never auto-rewritten.
 */
export function looksLikeLegacyCombinedFloorPlan(labels: readonly (string | null)[]): boolean {
  const lower = labels.map((l) => (l ?? "").toLowerCase());
  const hasCeremony = lower.some((l) => l === "ceremony" || l.includes("ceremony row"));
  const hasCocktail = lower.some((l) => l === "cocktail" || l.includes("cocktail"));
  const hasReception = lower.some((l) => l === "reception" || l.startsWith("t"));
  return hasCeremony && hasCocktail && hasReception;
}
