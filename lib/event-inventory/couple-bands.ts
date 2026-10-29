/**
 * Which couple-facing band an inventory row belongs to. Mirrors the rules the
 * couple portal (`components/portal/inventory-view.tsx`) and
 * `setInventoryItemClientSelectable` already apply:
 *  - Included rows are informational; a selectable flag on an included row is
 *    never offered to the couple, so Included wins.
 *  - Additional rows marked Select get a quantity control capped at
 *    `maxQuantity ?? quantity`.
 *  - Additional rows not marked Select are set by the venue.
 *
 * Library template rows have no selectable flag, so they classify as Included
 * or Additional — venue sets, the same as a freshly applied event copy.
 */

export type InventoryCoupleBand = "couple_can_choose" | "included" | "additional_venue_sets";

export const INVENTORY_COUPLE_BAND_ORDER: readonly InventoryCoupleBand[] = [
  "couple_can_choose",
  "included",
  "additional_venue_sets",
];

export const INVENTORY_COUPLE_BAND_LABEL: Record<InventoryCoupleBand, string> = {
  couple_can_choose: "Couple can choose",
  included: "Included",
  additional_venue_sets: "Additional — venue sets",
};

export const INVENTORY_COUPLE_BAND_HINT: Record<InventoryCoupleBand, string> = {
  couple_can_choose: "Additional items the couple can pick a quantity for when you share.",
  included: "Shown to the couple as included — no extra charge. Cannot be offered for selection.",
  additional_venue_sets: "Additional items at the quantity you set. The couple sees them but cannot change them.",
};

export const INVENTORY_VISIBILITY_DISCLOSURE =
  "All inventory rows are currently visible to the couple when you share. Venue-only items are not supported yet.";

export type InventoryBandInput = {
  isIncluded: boolean | null | undefined;
  clientSelectable?: boolean | null;
  quantity: number;
  maxQuantity?: number | null;
};

export function inventoryCoupleBand(row: InventoryBandInput): InventoryCoupleBand {
  if (row.isIncluded) return "included";
  if (row.clientSelectable) return "couple_can_choose";
  return "additional_venue_sets";
}

/** Couple's quantity cap for a selectable row — same expression as the portal. Null when the couple cannot choose. */
export function inventoryCoupleMaxQuantity(row: InventoryBandInput): number | null {
  if (inventoryCoupleBand(row) !== "couple_can_choose") return null;
  return row.maxQuantity ?? row.quantity;
}

export type InventoryBandGroup<T> = {
  band: InventoryCoupleBand;
  label: string;
  rows: T[];
};

/** Every row in exactly one band, input order kept within a band. Empty bands omitted. */
export function groupInventoryByCoupleBand<T extends InventoryBandInput>(
  rows: readonly T[],
): InventoryBandGroup<T>[] {
  const byBand = new Map<InventoryCoupleBand, T[]>();
  for (const row of rows) {
    const band = inventoryCoupleBand(row);
    const list = byBand.get(band) ?? [];
    list.push(row);
    byBand.set(band, list);
  }
  return INVENTORY_COUPLE_BAND_ORDER
    .filter((band) => (byBand.get(band)?.length ?? 0) > 0)
    .map((band) => ({ band, label: INVENTORY_COUPLE_BAND_LABEL[band], rows: byBand.get(band)! }));
}
