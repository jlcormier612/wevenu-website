import { clientCommercialLabel } from "@/lib/event-order-templates/commercial-state";
import {
  formatTemplateOfferingPrice,
  normalizeTemplatePricingModel,
} from "@/lib/event-order-templates/offerings";

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

/**
 * Couple-facing label for a fixed offering line (portal + Preview).
 * Included lines never append a dollar amount — stored unitPrice stays
 * venue reference data and must not read as an amount owed.
 */
export function choicesFixedLineMoneyLabel(line: {
  includedByDefault: boolean;
  unitPrice: number | null;
  unit?: string | null;
  pricingModel?: string | null;
}): string {
  if (line.includedByDefault) return "Included";

  return formatTemplateOfferingPrice({
    unitPrice: line.unitPrice,
    pricingModel: normalizeTemplatePricingModel(line.pricingModel),
    unit: line.unit ?? null,
  });
}

/** Compact portal summary under a fixed included/offering line. */
export function choicesPortalFixedLineSummary(line: {
  includedByDefault: boolean;
  unitPrice: number | null;
  unit?: string | null;
}): string {
  if (line.includedByDefault) return "Included";

  let label = "Part of your offering";
  if (line.unitPrice != null) {
    label += ` · $${Number(line.unitPrice).toFixed(2)}`;
  }
  if (line.unit) {
    label += ` / ${line.unit}`;
  }
  return label;
}
