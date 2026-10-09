import type { CommercialSelection, CommercialSelectionItem } from "@/lib/commercial-selections/types";

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

export type PackageSectionFinancialOpts = {
  depositAmount?: number;
  packageAmount?: number;
  discountAmount?: number;
  discountType?: "fixed" | "percent" | null;
  discountValue?: number | null;
  taxApplied?: boolean;
  taxRatePercent?: number | null;
  taxAmount?: number;
  /** Final agreed total; defaults to totalAmount argument for backcompat. */
  finalTotal?: number;
};

/**
 * Contract merge package section — package price, optional discount/tax, final total,
 * and deposit as a payment allocation (not a price reduction).
 */
export function formatPackageSection(
  name: string,
  totalAmount: number,
  items: CommercialSelectionItem[],
  opts?: PackageSectionFinancialOpts,
): string {
  const packageAmount = roundMoney(opts?.packageAmount ?? totalAmount);
  const discountAmount = roundMoney(opts?.discountAmount ?? 0);
  const taxAmount = roundMoney(opts?.taxAmount ?? 0);
  const taxApplied = Boolean(opts?.taxApplied && (opts.taxRatePercent != null || taxAmount > 0));
  const finalTotal = roundMoney(opts?.finalTotal ?? totalAmount);
  const lines = [`Selected package / services:`, `• ${name}`];
  if (items.length > 0) {
    lines.push("");
    lines.push("Included:");
    for (const item of items) {
      const qty = item.quantity ? ` × ${item.quantity}` : "";
      const unit = item.unit ? ` ${item.unit}` : "";
      const price =
        item.lineTotal != null
          ? ` — $${Number(item.lineTotal).toFixed(2)}`
          : item.unitPrice != null
            ? ` — $${Number(item.unitPrice).toFixed(2)}`
            : "";
      lines.push(`• ${item.description}${qty}${unit}${price}`);
    }
  }
  lines.push("");
  lines.push(`Package price: $${packageAmount.toFixed(2)}`);
  if (discountAmount > 0) {
    const discLabel =
      opts?.discountType === "percent" && opts.discountValue != null
        ? `Discount (${opts.discountValue}%): −$${discountAmount.toFixed(2)}`
        : `Discount: −$${discountAmount.toFixed(2)}`;
    lines.push(discLabel);
  }
  if (taxApplied && opts?.taxRatePercent != null) {
    lines.push(`Tax (${opts.taxRatePercent}%): $${taxAmount.toFixed(2)}`);
  } else if (taxAmount > 0) {
    lines.push(`Tax: $${taxAmount.toFixed(2)}`);
  }
  lines.push(`Agreed total: $${finalTotal.toFixed(2)}`);
  const deposit = opts?.depositAmount ?? 0;
  if (deposit > 0) {
    lines.push(`Deposit (payment allocation): $${deposit.toFixed(2)}`);
    lines.push(`Remaining after deposit: $${remainingAmount(finalTotal, deposit).toFixed(2)}`);
  }
  return lines.join("\n");
}

/** Build formatPackageSection opts from a CommercialSelection. */
export function packageSectionOptsFromSelection(
  selection: Pick<
    CommercialSelection,
    | "packageAmount"
    | "discountAmount"
    | "discountType"
    | "discountValue"
    | "taxApplied"
    | "taxRatePercent"
    | "taxAmount"
    | "totalAmount"
    | "depositAmount"
  >,
): PackageSectionFinancialOpts {
  return {
    packageAmount: selection.packageAmount,
    discountAmount: selection.discountAmount,
    discountType: selection.discountType,
    discountValue: selection.discountValue,
    taxApplied: selection.taxApplied,
    taxRatePercent: selection.taxRatePercent,
    taxAmount: selection.taxAmount,
    finalTotal: selection.totalAmount,
    depositAmount: selection.depositAmount,
  };
}

export const SELECTION_STATUS_LABEL: Record<string, string> = {
  draft: "Not sent",
  offered: "Share link created",
  accepted: "Accepted",
  superseded: "Replaced",
};
