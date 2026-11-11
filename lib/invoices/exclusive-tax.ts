/**
 * Exclusive percent tax on invoice rollups: (charges − discounts) × rate.
 * Deposits never enter the base. Existing tax lines are ignored when computing
 * a new/refreshed tax amount so tax cannot compound on itself.
 */

import { roundMoney } from "@/lib/commercial-selections/constants";
import { computeInvoiceTotals } from "@/lib/invoices/constants";
import { normalizePercent, taxableBaseFromRollups } from "@/lib/invoices/financial-terms";
import type { InvoiceLineItemType } from "@/lib/invoices/types";

export type TaxRollupLine = { type: InvoiceLineItemType; amount: number };

/** Lines that contribute to the exclusive-tax base (excludes tax + deposits). */
export function rollupLinesForExclusiveTax(lines: TaxRollupLine[]): TaxRollupLine[] {
  return lines.filter((l) => l.type !== "tax" && l.type !== "deposit");
}

/**
 * Freeze a percent-tax dollar amount from the authoritative rollup.
 * Returns 0 when the rate is missing/invalid or the taxable base is 0.
 */
export function exclusiveTaxAmountFromRollup(
  lines: TaxRollupLine[],
  taxRatePercent: number | string | null | undefined,
): { taxableBase: number; taxRatePercent: number | null; taxAmount: number } {
  const pct = normalizePercent(taxRatePercent);
  const { subtotal, discountAmount } = computeInvoiceTotals(rollupLinesForExclusiveTax(lines));
  const taxableBase = taxableBaseFromRollups(subtotal, discountAmount);
  if (pct == null || pct <= 0) {
    return { taxableBase, taxRatePercent: pct, taxAmount: 0 };
  }
  return {
    taxableBase,
    taxRatePercent: pct,
    taxAmount: roundMoney((taxableBase * pct) / 100),
  };
}

/** Percentage discount frozen against charge subtotal only (same rollup as tax base charges). */
export function percentDiscountAmountFromRollup(
  lines: TaxRollupLine[],
  discountPercent: number | string | null | undefined,
): number {
  const pct = normalizePercent(discountPercent);
  if (pct == null || pct <= 0) return 0;
  const { subtotal } = computeInvoiceTotals(rollupLinesForExclusiveTax(lines));
  return roundMoney((subtotal * pct) / 100);
}
