import type { PortalFloorPlanCatalogItem } from "@/lib/portal/types";

export function isLimitReason(reason: string | null | undefined): boolean {
  return reason === "order_limit_reached" || reason === "quantity_exceeded" || reason === "quantity_not_configured";
}

/** Couple-facing limit line: Event Order quantity first, else venue stock. */
export function catalogLimitLabel(item: PortalFloorPlanCatalogItem): string {
  if (item.limitSource === "event_order" && (item.orderQuantity ?? 0) > 0) {
    return item.remaining > 0
      ? `Your order includes ${item.orderQuantity} — ${item.remaining} left to place`
      : `Your order includes ${item.orderQuantity} — all placed`;
  }
  if (item.quantityConfigured) {
    return item.remaining > 0 ? `${item.remaining} more available` : "None left to add";
  }
  return "Not on your order";
}
