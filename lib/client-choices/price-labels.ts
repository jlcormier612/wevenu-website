import { clientCommercialLabel } from "@/lib/event-order-templates/commercial-state";

/** Couple-facing price line for a selectable option. */
export function choiceOptionPriceLabel(
  opt: {
    isIncluded: boolean;
    unitPrice: number | null;
    description?: string | null;
    pricingModel?: string | null;
  },
  allowQuantity: boolean,
  surface: "preview" | "client" = "client",
): string {
  return clientCommercialLabel(opt, allowQuantity, surface);
}
