/**
 * Explicit financial adjustments on an agreed commercial total.
 *
 * Distinguishes reductions (discount/credit) from charges/fees and from
 * payment allocations (deposits). Multiple named adjustments are first-class;
 * legacy single discount_* columns remain a rollup of all reductions.
 */

import { roundMoney } from "@/lib/commercial-selections/constants";
import {
  normalizeNonNegativeMoney,
  normalizePercent,
  type DiscountMode,
} from "@/lib/invoices/financial-terms";

export type FinancialAdjustmentKind =
  | "discount"
  | "credit"
  | "charge"
  | "fee";

/**
 * How the adjustment interacts with exclusive tax.
 * - reduces_taxable_base: reduction applied before tax (default for discount/credit)
 * - taxable: charge/fee included in taxable base
 * - none: reduction or charge outside the taxable base (rare; still changes total)
 */
export type FinancialAdjustmentTaxTreatment =
  | "reduces_taxable_base"
  | "taxable"
  | "none";

export type FinancialAdjustment = {
  id: string;
  kind: FinancialAdjustmentKind;
  description: string;
  mode: DiscountMode;
  /** Percent 0–100 or fixed dollars depending on mode. */
  value: number;
  /** Frozen dollar impact (positive). Sign comes from kind. */
  amount: number;
  taxTreatment: FinancialAdjustmentTaxTreatment;
};

export type FinancialAdjustmentInput = {
  id?: string;
  kind: FinancialAdjustmentKind;
  description: string;
  mode: DiscountMode;
  value: number;
  taxTreatment?: FinancialAdjustmentTaxTreatment;
};

function defaultTaxTreatment(kind: FinancialAdjustmentKind): FinancialAdjustmentTaxTreatment {
  if (kind === "discount" || kind === "credit") return "reduces_taxable_base";
  return "taxable";
}

export function isReductionKind(kind: FinancialAdjustmentKind): boolean {
  return kind === "discount" || kind === "credit";
}

export function freezeAdjustment(
  packagePrice: number,
  input: FinancialAdjustmentInput,
): FinancialAdjustment | null {
  const description = input.description.trim();
  if (!description) return null;
  const kind = input.kind;
  let amount = 0;
  let value = 0;
  if (input.mode === "percent") {
    const pct = normalizePercent(input.value);
    if (pct == null || pct <= 0) return null;
    value = pct;
    amount = roundMoney((packagePrice * pct) / 100);
  } else {
    const fixed = normalizeNonNegativeMoney(input.value);
    if (fixed == null || fixed <= 0) return null;
    value = fixed;
    amount = roundMoney(fixed);
  }
  if (amount <= 0) return null;
  return {
    id: input.id?.trim() || cryptoRandomId(),
    kind,
    description,
    mode: input.mode,
    value,
    amount,
    taxTreatment: input.taxTreatment ?? defaultTaxTreatment(kind),
  };
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `adj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export type MultiAdjustmentTermsInput = {
  packagePrice: number;
  adjustments?: FinancialAdjustmentInput[] | null;
  /**
   * Legacy single discount — converted to one adjustment when adjustments empty.
   * Kept for backward-compatible callers.
   */
  discountMode?: DiscountMode | null;
  discountValue?: number | null;
  discountDescription?: string | null;
  applyTax?: boolean;
  taxRatePercent?: number | null;
};

export type MultiAdjustmentTerms = {
  packagePrice: number;
  adjustments: FinancialAdjustment[];
  /** Sum of reduction amounts (discount + credit). */
  discountAmount: number;
  /** Sum of charge/fee amounts. */
  chargeAmount: number;
  /** package − taxable reductions + taxable charges. */
  taxableBase: number;
  taxApplied: boolean;
  taxRatePercent: number | null;
  taxAmount: number;
  /** package − all reductions + all charges + tax. */
  finalTotal: number;
  /** Legacy rollup: first reduction's mode, or null. */
  discountMode: DiscountMode | null;
  discountValue: number | null;
};

/**
 * Compute agreed terms with zero or more named adjustments.
 *
 * Example: $25,000 − $500 referral − $2,500 promo = $22,000 before tax.
 */
export function computeAgreedFinancialTermsMulti(
  input: MultiAdjustmentTermsInput,
): MultiAdjustmentTerms {
  const packagePrice = roundMoney(Math.max(0, Number(input.packagePrice) || 0));
  const rawInputs: FinancialAdjustmentInput[] = [...(input.adjustments ?? [])];
  if (
    rawInputs.length === 0
    && input.discountMode
    && input.discountValue != null
  ) {
    rawInputs.push({
      kind: "discount",
      description: (input.discountDescription ?? "Discount").trim() || "Discount",
      mode: input.discountMode,
      value: input.discountValue,
      taxTreatment: "reduces_taxable_base",
    });
  }

  const adjustments: FinancialAdjustment[] = [];
  for (const raw of rawInputs) {
    const frozen = freezeAdjustment(packagePrice, raw);
    if (frozen) adjustments.push(frozen);
  }

  // Cap cumulative reductions at package + charges so total cannot go negative
  // before tax via reductions alone.
  let reductionBudget = packagePrice;
  let discountAmount = 0;
  let chargeAmount = 0;
  let taxableReductions = 0;
  let taxableCharges = 0;
  let nontaxableNet = 0; // charges − reductions with taxTreatment none

  const normalized: FinancialAdjustment[] = [];
  for (const adj of adjustments) {
    if (isReductionKind(adj.kind)) {
      const applied = roundMoney(Math.min(adj.amount, reductionBudget));
      reductionBudget = roundMoney(Math.max(0, reductionBudget - applied));
      const next = { ...adj, amount: applied };
      normalized.push(next);
      discountAmount = roundMoney(discountAmount + applied);
      if (adj.taxTreatment === "reduces_taxable_base") {
        taxableReductions = roundMoney(taxableReductions + applied);
      } else {
        nontaxableNet = roundMoney(nontaxableNet - applied);
      }
    } else {
      normalized.push(adj);
      chargeAmount = roundMoney(chargeAmount + adj.amount);
      if (adj.taxTreatment === "taxable") {
        taxableCharges = roundMoney(taxableCharges + adj.amount);
      } else {
        nontaxableNet = roundMoney(nontaxableNet + adj.amount);
      }
    }
  }

  const taxableBase = roundMoney(
    Math.max(0, packagePrice - taxableReductions + taxableCharges),
  );
  const taxApplied = Boolean(input.applyTax);
  const taxRatePercent = taxApplied ? normalizePercent(input.taxRatePercent) : null;
  const taxAmount =
    taxApplied && taxRatePercent != null && taxRatePercent > 0
      ? roundMoney((taxableBase * taxRatePercent) / 100)
      : 0;

  const preTax = roundMoney(
    Math.max(0, packagePrice - discountAmount + chargeAmount),
  );
  // nontaxableNet already folded into discountAmount/chargeAmount above.
  void nontaxableNet;

  const firstReduction = normalized.find((a) => isReductionKind(a.kind)) ?? null;

  return {
    packagePrice,
    adjustments: normalized,
    discountAmount,
    chargeAmount,
    taxableBase,
    taxApplied: taxApplied && taxRatePercent != null,
    taxRatePercent: taxApplied ? taxRatePercent : null,
    taxAmount,
    finalTotal: roundMoney(preTax + taxAmount),
    discountMode: firstReduction?.mode ?? null,
    discountValue: firstReduction?.value ?? null,
  };
}

/** Proportionally redistribute remaining balance across unpaid installment amounts. */
export function redistributeUnpaidInstallments(input: {
  unpaidAmounts: number[];
  remainingBalance: number;
}): number[] {
  const remaining = roundMoney(Math.max(0, input.remainingBalance));
  const unpaid = input.unpaidAmounts.map((n) => roundMoney(Math.max(0, Number(n) || 0)));
  if (unpaid.length === 0) return [];
  const prevSum = roundMoney(unpaid.reduce((s, n) => s + n, 0));
  if (prevSum <= 0) {
    const equal = roundMoney(remaining / unpaid.length);
    const out = unpaid.map(() => equal);
    const drift = roundMoney(remaining - roundMoney(out.reduce((s, n) => s + n, 0)));
    out[out.length - 1] = roundMoney(out[out.length - 1]! + drift);
    return out;
  }
  const out = unpaid.map((amt) => roundMoney((amt / prevSum) * remaining));
  const drift = roundMoney(remaining - roundMoney(out.reduce((s, n) => s + n, 0)));
  out[out.length - 1] = roundMoney(Math.max(0, out[out.length - 1]! + drift));
  return out;
}

export function parseFinancialAdjustments(raw: unknown): FinancialAdjustment[] {
  if (!Array.isArray(raw)) return [];
  const out: FinancialAdjustment[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const kind = String(r.kind ?? "");
    if (!["discount", "credit", "charge", "fee"].includes(kind)) continue;
    const mode = r.mode === "percent" ? "percent" : r.mode === "fixed" ? "fixed" : null;
    if (!mode) continue;
    const description = String(r.description ?? "").trim();
    if (!description) continue;
    const value = Number(r.value);
    const amount = Number(r.amount);
    if (!Number.isFinite(value) || !Number.isFinite(amount) || amount < 0) continue;
    const taxTreatment = (
      ["reduces_taxable_base", "taxable", "none"].includes(String(r.taxTreatment))
        ? String(r.taxTreatment)
        : defaultTaxTreatment(kind as FinancialAdjustmentKind)
    ) as FinancialAdjustmentTaxTreatment;
    out.push({
      id: String(r.id ?? cryptoRandomId()),
      kind: kind as FinancialAdjustmentKind,
      description,
      mode,
      value,
      amount: roundMoney(amount),
      taxTreatment,
    });
  }
  return out;
}
