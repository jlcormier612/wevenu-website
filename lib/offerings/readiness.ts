/**
 * Catalog readiness flags for Offerings. Rentals are identified by category
 * name (the catalog has no product-type field); flags never auto-link anything.
 */

export function isRentalCategoryName(categoryName: string | null | undefined): boolean {
  return /rental/i.test(categoryName ?? "");
}

export function needsInventoryLink(o: {
  categoryName: string | null;
  inventoryItemId: string | null;
  isArchived?: boolean;
}): boolean {
  if (o.isArchived) return false;
  return isRentalCategoryName(o.categoryName) && !o.inventoryItemId;
}

export function isUnpriced(o: { defaultUnitPrice: number | null; isArchived?: boolean }): boolean {
  if (o.isArchived) return false;
  return o.defaultUnitPrice == null;
}
