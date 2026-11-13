/**
 * Event Inventory → Event Order handoff (pure).
 * Inventory is operational. Event Order is the commercial/operational agreement.
 * Floor-plan allocation is never consulted here.
 * Venue-only rows (clientVisible === false) stay operational and never cross
 * into the Event Order, so they can never reach an invoice.
 *
 * Name matches against existing Event Order lines are advisory only — never
 * proof of identity. Previously transferred items are detected via
 * addedToEventOrderAt (stable per-item provenance), not by name.
 */
export type InventoryHandoffItem = {
  id: string;
  name?: string;
  isIncluded: boolean;
  unitPrice: number | null;
  quantity: number;
  addedToEventOrderAt: string | null;
  clientVisible?: boolean;
};

export type EventOrderLineNameRef = {
  id: string;
  description: string;
  isIncluded?: boolean;
  unitPrice?: number | null;
};

export type HandoffPreviewRow = {
  itemId: string;
  name: string;
  quantity: number;
  isIncluded: boolean;
  unitPrice: number | null;
  /** Advisory only — matching description on the Event Order, not identity. */
  possibleMatch: { lineId: string; description: string } | null;
  defaultAction: "add" | "skip";
};

export function normalizeHandoffName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findAdvisoryNameMatch(
  itemName: string,
  existingLines: ReadonlyArray<EventOrderLineNameRef>,
): EventOrderLineNameRef | null {
  const key = normalizeHandoffName(itemName);
  if (!key) return null;
  return existingLines.find((line) => normalizeHandoffName(line.description) === key) ?? null;
}

export function buildHandoffPreviewRows(
  pending: ReadonlyArray<InventoryHandoffItem & { name: string }>,
  existingLines: ReadonlyArray<EventOrderLineNameRef>,
): HandoffPreviewRow[] {
  return pending.map((item) => {
    const match = findAdvisoryNameMatch(item.name, existingLines);
    return {
      itemId: item.id,
      name: item.name,
      quantity: item.quantity,
      isIncluded: item.isIncluded,
      unitPrice: item.unitPrice,
      possibleMatch: match
        ? { lineId: match.id, description: match.description }
        : null,
      // Caution default: skip when an advisory name match already exists on the EO.
      defaultAction: match ? "skip" : "add",
    };
  });
}

export function isVenueOnlyInventoryItem(item: Pick<InventoryHandoffItem, "clientVisible">): boolean {
  return item.clientVisible === false;
}

export function eventInventoryItemsPendingForEventOrder<T extends InventoryHandoffItem>(
  items: T[],
): T[] {
  return items.filter((item) => !item.addedToEventOrderAt && !isVenueOnlyInventoryItem(item));
}

export function isInventoryItemBillableForInvoice(
  item: Pick<InventoryHandoffItem, "isIncluded" | "unitPrice" | "clientVisible">,
): boolean {
  if (isVenueOnlyInventoryItem(item)) return false;
  if (item.isIncluded) return false;
  return item.unitPrice != null && item.unitPrice > 0;
}

export function inventoryHandoffBillableTotal<T extends InventoryHandoffItem>(
  pending: T[],
): number {
  return Number(
    pending
      .filter(isInventoryItemBillableForInvoice)
      .reduce((sum, item) => sum + item.quantity * (item.unitPrice ?? 0), 0)
      .toFixed(2),
  );
}
