/**
 * Event Inventory → Event Order handoff (pure).
 * Inventory is operational. Event Order is the commercial/operational agreement.
 * Floor-plan allocation is never consulted here.
 * Venue-only rows (clientVisible === false) stay operational and never cross
 * into the Event Order, so they can never reach an invoice.
 */
export type InventoryHandoffItem = {
  id: string;
  isIncluded: boolean;
  unitPrice: number | null;
  quantity: number;
  addedToEventOrderAt: string | null;
  clientVisible?: boolean;
};

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
