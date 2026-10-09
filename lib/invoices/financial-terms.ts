/**
 * Canonical commercial financial terms — shared by Selected Package (pre-invoice),
 * contracts, and invoice line totals. Tax is exclusive; discounts reduce the
 * taxable base; deposits are payment allocations and never enter these formulas.
 *
 * Currency: half-up to cents via roundMoney (same as commercial-selections).
 */

import { roundMoney } from "@/lib/commercial-selections/constants";
import type { InvoiceLineItemType } from "@/lib/invoices/types";

export const TAXABLE_CHARGE_TYPES: readonly InvoiceLineItemType[] = [
  "package",
  "item",
  "addon",
  "fee",
  "inventory",
] as const;

export type DiscountMode = "fixed" | "percent";

export type AgreedFinancialTermsInput = {
  /** Original package / charge price before discount and tax. */
  packagePrice: number;
  /** When set with discountValue, applies a discount (frozen $ for percent). */
  discountMode?: DiscountMode | null;
  /** Percent (0–100) or fixed dollars depending on discountMode. */
  discountValue?: number | null;
  /**
   * When true, apply taxRatePercent to (packagePrice − discount).
   * Venue default alone must not imply this — caller opts in explicitly.
   */
  applyTax?: boolean;
  /** Exclusive tax rate percent (0–100). Ignored unless applyTax. */
  taxRatePercent?: number | null;
};

export type AgreedFinancialTerms = {
  packagePrice: number;
  discountMode: DiscountMode | null;
  discountValue: number | null;
  discountAmount: number;
  taxableBase: number;
  taxApplied: boolean;
  taxRatePercent: number | null;
  taxAmount: number;
  /** Final agreed commitment: package − discount + tax. */
  finalTotal: number;
};

/** Validate a tax/discount percent: finite, 0–100 inclusive. */
export function normalizePercent(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/%/g, ""));
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 100) return null;
  return roundMoney(n * 10000) / 10000; // 4 dp
}

export function normalizeNonNegativeMoney(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[$,]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return roundMoney(n);
}

/**
 * Compute agreed commercial terms from package + optional discount + optional exclusive tax.
 * Percentage discounts are calculated once here; callers persist the resulting discountAmount
 * and must not recalc from a later package edit without an explicit new apply.
 */
export function computeAgreedFinancialTerms(input: AgreedFinancialTermsInput): AgreedFinancialTerms {
  const packagePrice = roundMoney(Math.max(0, Number(input.packagePrice) || 0));
  let discountMode: DiscountMode | null = null;
  let discountValue: number | null = null;
  let discountAmount = 0;

  if (input.discountMode === "percent" && input.discountValue != null) {
    const pct = normalizePercent(input.discountValue);
    if (pct != null && pct > 0) {
      discountMode = "percent";
      discountValue = pct;
      discountAmount = roundMoney((packagePrice * pct) / 100);
    }
  } else if (input.discountMode === "fixed" && input.discountValue != null) {
    const fixed = normalizeNonNegativeMoney(input.discountValue);
    if (fixed != null && fixed > 0) {
      discountMode = "fixed";
      discountValue = fixed;
      discountAmount = roundMoney(Math.min(fixed, packagePrice));
    }
  }

  const taxableBase = roundMoney(Math.max(0, packagePrice - discountAmount));
  const taxApplied = Boolean(input.applyTax);
  const taxRatePercent = taxApplied ? normalizePercent(input.taxRatePercent) : null;
  const taxAmount =
    taxApplied && taxRatePercent != null && taxRatePercent > 0
      ? roundMoney((taxableBase * taxRatePercent) / 100)
      : 0;

  return {
    packagePrice,
    discountMode,
    discountValue,
    discountAmount,
    taxableBase,
    taxApplied: taxApplied && taxAmount >= 0 && taxRatePercent != null,
    taxRatePercent: taxApplied ? taxRatePercent : null,
    taxAmount,
    finalTotal: roundMoney(taxableBase + taxAmount),
  };
}

/** Taxable base from invoice rollups: charge subtotal minus true discounts only. */
export function taxableBaseFromRollups(subtotal: number, discountAmount: number): number {
  return roundMoney(Math.max(0, subtotal - discountAmount));
}
