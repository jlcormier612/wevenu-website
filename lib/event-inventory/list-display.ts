/**
 * Event Inventory list price column — configured unit price is independent of
 * package inclusion. Inclusion controls billing / “no extra charge”, not whether
 * a saved price is visible.
 */

export function formatEventInventoryUnitPrice(unitPrice: number | null): string | null {
  if (unitPrice == null || Number.isNaN(unitPrice)) return null;
  return unitPrice.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** List cell content for the price column (null → em dash). */
export function eventInventoryListPriceLabel(item: {
  unitPrice: number | null;
  isIncluded: boolean;
}): { price: string | null; inclusionHint: string | null } {
  const price = formatEventInventoryUnitPrice(item.unitPrice);
  return {
    price,
    inclusionHint: price != null && item.isIncluded ? "no extra charge" : null,
  };
}
