import type { CommercialSelectionItem } from "@/lib/commercial-selections/types";
import { formatCurrency } from "@/lib/invoices/constants";

/** Round money to cents (half-up). */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Default deposit: venue override if provided, else 25% of total, rounded to cents.
 * Clamped to [0, total].
 * When collectInitialPayment / initialPaymentRequired is false, returns 0.
 */
export function suggestDepositAmount(
  totalAmount: number,
  venueDefaultDeposit?: number | null,
  opts?: { initialPaymentRequired?: boolean; collectInitialPayment?: boolean },
): number {
  const collect =
    opts?.collectInitialPayment
    ?? opts?.initialPaymentRequired
    ?? true;
  if (collect === false) return 0;
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
  opts?: { depositAmount?: number; currency?: string },
): string {
  const currency = opts?.currency ?? "USD";
  const money = (n: number) => formatCurrency(n, currency);
  const lines = [`Selected package / services:`, `• ${name}`];
  if (items.length > 0) {
    lines.push("");
    lines.push("Included:");
    for (const item of items) {
      const qty = item.quantity ? ` × ${item.quantity}` : "";
      const unit = item.unit ? ` ${item.unit}` : "";
      const price =
        item.lineTotal != null
          ? ` — ${money(Number(item.lineTotal))}`
          : item.unitPrice != null
            ? ` — ${money(Number(item.unitPrice))}`
            : "";
      lines.push(`• ${item.description}${qty}${unit}${price}`);
    }
  }
  lines.push("");
  lines.push(`Package total: ${money(totalAmount)}`);
  const deposit = opts?.depositAmount ?? 0;
  if (deposit > 0) {
    lines.push(`Deposit: ${money(deposit)}`);
    lines.push(`Remaining: ${money(remainingAmount(totalAmount, deposit))}`);
  }
  return lines.join("\n");
}

export const SELECTION_STATUS_LABEL: Record<string, string> = {
  draft: "Not sent",
  offered: "Share link created",
  accepted: "Accepted",
  superseded: "Replaced",
};
