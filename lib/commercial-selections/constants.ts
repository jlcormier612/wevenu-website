import type { CommercialSelectionItem } from "@/lib/commercial-selections/types";

/** Round money to cents (half-up). */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Default deposit: venue override if provided, else 25% of total, rounded to cents.
 * Clamped to [0, total].
 */
export function suggestDepositAmount(
  totalAmount: number,
  venueDefaultDeposit?: number | null,
): number {
  if (!(totalAmount >= 0) || Number.isNaN(totalAmount)) return 0;
  if (venueDefaultDeposit != null && venueDefaultDeposit >= 0 && !Number.isNaN(venueDefaultDeposit)) {
    return roundMoney(Math.min(venueDefaultDeposit, totalAmount));
  }
  return roundMoney(totalAmount * 0.25);
}

export function remainingAmount(totalAmount: number, depositAmount: number): number {
  return roundMoney(Math.max(0, totalAmount - depositAmount));
}

export function formatPackageSection(
  name: string,
  totalAmount: number,
  items: CommercialSelectionItem[],
): string {
  const lines = [`Selected package / services:`, `• ${name}`];
  if (items.length > 0) {
    lines.push("");
    lines.push("Included:");
    for (const item of items) {
      const qty = item.quantity ? ` × ${item.quantity}` : "";
      const unit = item.unit ? ` ${item.unit}` : "";
      lines.push(`• ${item.description}${qty}${unit}`);
    }
  }
  lines.push("");
  lines.push(`Package total: $${totalAmount.toFixed(2)}`);
  return lines.join("\n");
}

export const SELECTION_STATUS_LABEL: Record<string, string> = {
  draft: "Not sent",
  offered: "Offer sent",
  accepted: "Accepted",
  superseded: "Replaced",
};
