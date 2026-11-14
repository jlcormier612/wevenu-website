/**
 * Resolve the SVG display shape for a floor-plan object.
 *
 * Prefer an explicit `display_shape`. When null (legacy / incomplete
 * placements), infer from object_type and aspect ratio so thin ceremony
 * rows never collapse into giant circles via the round fallback.
 */
import type { DisplayShape, ObjectType } from "@/lib/floor-plans/types";

const SHAPES = new Set<string>([
  "round", "square", "rectangular", "oval", "cocktail",
  "dance_floor", "stage", "dj_booth", "bar", "buffet",
  "arbor", "arch", "aisle", "sofa", "lounge", "custom",
]);

export function resolveDisplayShape(input: {
  displayShape?: string | null;
  objectType?: string | null;
  width?: number | null;
  height?: number | null;
  label?: string | null;
}): DisplayShape {
  const raw = (input.displayShape ?? "").trim();
  if (raw && SHAPES.has(raw)) return raw as DisplayShape;

  const type = (input.objectType ?? "") as ObjectType | "";
  const w = Number(input.width) || 0;
  const h = Number(input.height) || 0;
  const aspect = w > 0 && h > 0 ? Math.min(w, h) / Math.max(w, h) : 1;
  const label = (input.label ?? "").toLowerCase();

  if (type === "dance_floor") return "dance_floor";
  if (type === "bar") return "bar";
  if (type === "gift_table" || type === "cake_table") return "rectangular";
  if (type === "stage") return "stage";
  if (type === "table_oval") return "oval";
  if (type === "table_round") {
    if (label.includes("cocktail") || aspect >= 0.9) {
      // Small round cocktail tables often store shape=cocktail; default round.
      return raw === "cocktail" ? "cocktail" : "round";
    }
    return "round";
  }
  if (type === "table_rect") {
    // Thin rows (ceremony benches) and long tables must stay rectangular.
    if (aspect < 0.55) return "rectangular";
    return "rectangular";
  }
  if (type === "other") {
    if (label.includes("arbor") || label.includes("arch")) return "arbor";
    if (label.includes("aisle")) return "aisle";
    if (label.includes("dj") || label.includes("band")) return "dj_booth";
    return "custom";
  }
  if (type === "text_label") return "custom";

  // Last resort: strongly non-square geometry must not become a circle.
  if (aspect < 0.7) return "rectangular";
  return "round";
}

/** Compact canvas label — ceremony rows become "Row N". */
export function compactFloorPlanLabel(label: string | null | undefined): string {
  const raw = (label ?? "").trim();
  if (!raw) return "Table";
  const ceremony = raw.match(/^ceremony\s+row\s+(\d+)/i);
  if (ceremony) return `Row ${ceremony[1]}`;
  if (/^sweetheart/i.test(raw)) return "Sweetheart Table";
  if (/^dance\s*floor/i.test(raw)) return "Dance Floor";
  return raw;
}

export function isSeatingDestinationType(objectType: string | null | undefined): boolean {
  return objectType === "table_round"
    || objectType === "table_rect"
    || objectType === "table_oval";
}
