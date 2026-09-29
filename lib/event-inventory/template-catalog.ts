/**
 * Catalog-backed Inventory Template lines.
 * Available Inventory is the source; template stores provenance + snapshot fields.
 * Never invent inventory_item_id by matching names.
 */
import type { InventoryItem, InventoryItemWithCategory } from "@/lib/inventory/types";
import type { InventoryItemInput, InventoryTemplateItem } from "@/lib/event-inventory/types";

export function isCatalogBackedTemplateItem(
  item: Pick<InventoryTemplateItem, "inventoryItemId">,
): boolean {
  return Boolean(item.inventoryItemId);
}

export function catalogItemDisplayName(item: Pick<InventoryItem, "name" | "printableName">): string {
  return (item.printableName?.trim() || item.name).trim();
}

/** Prefill template input from an Available Inventory row. Does not invent links. */
export function templateItemInputFromCatalog(
  catalogItem: InventoryItemWithCategory | InventoryItem,
  overrides?: Partial<Pick<InventoryItemInput, "quantity" | "unitPrice" | "isIncluded" | "notes">>,
): InventoryItemInput {
  const withCategory = catalogItem as InventoryItemWithCategory;
  return {
    inventoryItemId: catalogItem.id,
    name: catalogItemDisplayName(catalogItem),
    category: withCategory.categoryName ?? "",
    quantity: overrides?.quantity ?? "1",
    unitPrice: overrides?.unitPrice ?? "",
    isIncluded: overrides?.isIncluded ?? true,
    notes: overrides?.notes ?? "",
  };
}

export function customTemplateItemInput(
  fields: Omit<InventoryItemInput, "inventoryItemId">,
): InventoryItemInput {
  return {
    ...fields,
    inventoryItemId: null,
  };
}
