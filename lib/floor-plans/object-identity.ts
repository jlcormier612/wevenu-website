/**
 * Floor-plan object identity — item type vs placement label vs inventory link.
 * Discovery/display only; never invent inventory links by name.
 */
import { OBJECT_TYPES } from "@/lib/floor-plans/constants";
import type { DisplayShape, ObjectType } from "@/lib/floor-plans/types";

/** Mirrors DISPLAY_SHAPE_LABELS — kept here so identity helpers stay lib-pure. */
const SHAPE_ITEM_LABELS: Partial<Record<DisplayShape, string>> = {
  round: "Round Table",
  cocktail: "Cocktail Table",
  oval: "Oval Table",
  square: "Square Table",
  rectangular: "Rectangular Table",
  dance_floor: "Dance Floor",
  stage: "Stage",
  bar: "Bar",
  buffet: "Buffet",
  arbor: "Arbor",
};

export type ObjectIdentityInput = {
  objectType: ObjectType;
  label: string | null;
  displayShape: DisplayShape | null;
  inventoryItemId: string | null;
  width: number;
  height: number;
  capacity: number | null;
};

/** True when the label looks like a placement ID (C1, T12) rather than an item name. */
export function looksLikePlacementId(label: string | null | undefined): boolean {
  if (!label?.trim()) return false;
  return /^[A-Za-z]{1,3}\d{1,3}$/.test(label.trim());
}

export function placementLabelPrefix(
  displayShape: DisplayShape | null | undefined,
  objectType: ObjectType,
): string {
  if (displayShape === "cocktail") return "C";
  if (displayShape === "round") return "T";
  if (displayShape === "oval") return "O";
  if (objectType === "table_round") return "T";
  if (objectType === "table_rect" || objectType === "table_oval") return "T";
  if (objectType === "cake_table") return "Cake";
  if (objectType === "gift_table") return "Gifts";
  if (objectType === "bar") return "Bar";
  if (objectType === "stage") return "Stage";
  if (objectType === "dance_floor") return "Dance Floor";
  const base = OBJECT_TYPES[objectType].defaultLabel.replace(/\d+$/, "").trim();
  return base || "Obj";
}

/**
 * Next placement ID for this shape/type among existing canvas objects.
 * Counts labels that share the same prefix (C1…Cn, T1…Tn).
 */
export function nextPlacementLabel(
  existing: Array<{ label: string | null }>,
  displayShape: DisplayShape | null | undefined,
  objectType: ObjectType,
): string {
  const prefix = placementLabelPrefix(displayShape, objectType);
  // Non-numeric prefixes (e.g. "Dance Floor") — keep as-is without numbering when unique enough
  if (!/^[A-Za-z]{1,3}$/.test(prefix)) {
    const used = new Set(existing.map((o) => (o.label ?? "").trim().toLowerCase()).filter(Boolean));
    if (!used.has(prefix.toLowerCase())) return prefix;
    let n = 2;
    while (used.has(`${prefix} ${n}`.toLowerCase())) n += 1;
    return `${prefix} ${n}`;
  }
  const re = new RegExp(`^${prefix}(\\d+)$`, "i");
  const nums = existing
    .map((o) => o.label?.trim() ?? "")
    .map((label) => {
      const m = label.match(re);
      return m ? parseInt(m[1]!, 10) : NaN;
    })
    .filter((n) => !Number.isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${next}`;
}

/** Suggested seats when placing from inventory/shape — not a fire-code claim. */
export function suggestedCapacityForPlacement(
  displayShape: DisplayShape | null | undefined,
  objectType: ObjectType,
  widthIn: number | null | undefined,
): number | null {
  if (displayShape === "cocktail") return 4;
  if (objectType === "cake_table" || objectType === "gift_table") return null;
  if (objectType === "stage" || objectType === "dance_floor" || objectType === "bar" || objectType === "text_label") {
    return null;
  }
  if (displayShape === "round" || objectType === "table_round") {
    const w = widthIn ?? 72;
    if (w <= 36) return 4;
    if (w <= 48) return 6;
    if (w <= 60) return 8;
    if (w <= 72) return 10;
    return 12;
  }
  if (objectType === "table_oval") return 10;
  if (objectType === "table_rect") return 8;
  return OBJECT_TYPES[objectType].defaultCapacity;
}

/**
 * Human item-type label for UI. Prefer linked inventory name; else shape;
 * else coarse object type. Never treats placement IDs (C1) as the item type.
 */
export function resolveItemTypeLabel(
  obj: Pick<ObjectIdentityInput, "objectType" | "label" | "displayShape" | "inventoryItemId">,
  inventoryName: string | null | undefined,
): { label: string; source: "inventory" | "shape" | "object-type" } {
  if (obj.inventoryItemId && inventoryName?.trim()) {
    return { label: inventoryName.trim(), source: "inventory" };
  }
  if (obj.displayShape && SHAPE_ITEM_LABELS[obj.displayShape]) {
    return { label: SHAPE_ITEM_LABELS[obj.displayShape]!, source: "shape" };
  }
  return { label: OBJECT_TYPES[obj.objectType].label, source: "object-type" };
}

export function inventoryLinkStatus(
  inventoryItemId: string | null,
  inventoryName: string | null | undefined,
): { kind: "linked" | "unlinked"; summary: string } {
  if (inventoryItemId) {
    return {
      kind: "linked",
      summary: inventoryName?.trim()
        ? `Linked inventory: ${inventoryName.trim()}`
        : "Linked to an inventory item (name unavailable)",
    };
  }
  return {
    kind: "unlinked",
    summary: "Not linked to inventory — layout-only. Placement counts do not change stock.",
  };
}
