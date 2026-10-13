/**
 * Venue-controlled adjustment of remaining (unpaid) payment-plan installments.
 * Collected receipts are immutable historical facts — only unresolved lines
 * and explicit partial-shortfall closeouts may change.
 */

import { redistributeUnpaidInstallments } from "@/lib/invoices/financial-adjustments";
import { computeTotalPaid } from "@/lib/payments/constants";
import type { PaymentLineItem, PaymentObligationKind } from "@/lib/payments/types";

const MONEY_EPS = 0.009;

export type AdjustableDraftLine = {
  /** Existing pending/overdue id when updating in place conceptually; omitted for new lines. */
  id?: string | null;
  label: string;
  amount: number;
  dueDate: string | null;
  obligationKind: PaymentObligationKind | null;
};

export type AdjustRemainingPlanPreview = {
  invoiceTotal: number;
  paidToDate: number;
  balanceDue: number;
  /** Shortfalls closed on partially_paid lines (amount reduced to paidAmount). */
  closedPartialShortfall: number;
  preservedCollected: Array<{
    id: string;
    label: string;
    amount: number;
    paidAmount: number;
    status: string;
    dueDate: string | null;
  }>;
  proposedRemaining: AdjustableDraftLine[];
  proposedRemainingTotal: number;
  discrepancy: number;
  ok: boolean;
  message?: string;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Format a stored amount for the adjust dialog amount field (no currency symbol). */
export function formatAdjustAmountInput(amount: number): string {
  if (!Number.isFinite(amount)) return "";
  return String(roundMoney(amount));
}

/**
 * Parse venue-typed installment amounts. Incomplete values (e.g. "4302.") must not
 * coerce to a different number or to 0 — that desyncs the controlled input and
 * falsely trips "greater than zero" validation mid-edit.
 */
export function parseAdjustAmountInput(
  raw: string,
):
  | { kind: "empty" }
  | { kind: "incomplete" }
  | { kind: "invalid" }
  | { kind: "ok"; value: number } {
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  if (cleaned === "") return { kind: "empty" };
  // Allow typing through intermediate forms without committing.
  if (cleaned === "." || cleaned === "-" || cleaned === "-." || /\.$/.test(cleaned)) {
    return { kind: "incomplete" };
  }
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return { kind: "invalid" };
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return { kind: "invalid" };
  return { kind: "ok", value: roundMoney(value) };
}

export function isUnresolvedInstallmentStatus(status: string): boolean {
  return status === "pending" || status === "overdue";
}

export function isPreservedCollectedStatus(status: string): boolean {
  return (
    status === "paid"
    || status === "partially_paid"
    || status === "partially_refunded"
    || status === "refunded"
    || status === "cancelled"
    || status === "processing"
  );
}

/**
 * Preview a remaining-plan adjustment. Does not mutate.
 * proposedRemaining must sum to balanceDue (after closing partial shortfalls into the pool).
 */
export function previewAdjustRemainingPlan(input: {
  invoiceTotal: number;
  balanceDue: number;
  lines: PaymentLineItem[];
  proposedRemaining: AdjustableDraftLine[];
}): AdjustRemainingPlanPreview {
  const paidToDate = roundMoney(computeTotalPaid(input.lines));
  const preservedCollected = input.lines
    .filter((l) => isPreservedCollectedStatus(l.status) && l.status !== "cancelled")
    .map((l) => ({
      id: l.id,
      label: l.label,
      amount: l.amount,
      paidAmount: Number(l.paidAmount ?? (l.status === "paid" ? l.amount : 0)),
      status: l.status,
      dueDate: l.dueDate,
    }));

  let closedPartialShortfall = 0;
  for (const l of input.lines) {
    if (l.status !== "partially_paid") continue;
    const paid = Number(l.paidAmount ?? 0);
    const shortfall = roundMoney(Math.max(0, l.amount - paid));
    closedPartialShortfall = roundMoney(closedPartialShortfall + shortfall);
  }

  const proposedRemaining = input.proposedRemaining.map((l) => ({
    ...l,
    label: l.label.trim(),
    amount: roundMoney(Math.max(0, Number(l.amount) || 0)),
    dueDate: l.dueDate?.trim() || null,
  }));
  const proposedRemainingTotal = roundMoney(
    proposedRemaining.reduce((s, l) => s + l.amount, 0),
  );
  const balanceDue = roundMoney(Math.max(0, input.balanceDue));
  const discrepancy = roundMoney(proposedRemainingTotal - balanceDue);

  if (proposedRemaining.some((l) => !l.label)) {
    return {
      invoiceTotal: input.invoiceTotal,
      paidToDate,
      balanceDue,
      closedPartialShortfall,
      preservedCollected,
      proposedRemaining,
      proposedRemainingTotal,
      discrepancy,
      ok: false,
      message: "Every remaining installment needs a label.",
    };
  }
  if (proposedRemaining.some((l) => l.amount <= 0)) {
    return {
      invoiceTotal: input.invoiceTotal,
      paidToDate,
      balanceDue,
      closedPartialShortfall,
      preservedCollected,
      proposedRemaining,
      proposedRemainingTotal,
      discrepancy,
      ok: false,
      message: "Remaining installment amounts must be greater than zero.",
    };
  }
  if (Math.abs(discrepancy) > MONEY_EPS) {
    return {
      invoiceTotal: input.invoiceTotal,
      paidToDate,
      balanceDue,
      closedPartialShortfall,
      preservedCollected,
      proposedRemaining,
      proposedRemainingTotal,
      discrepancy,
      ok: false,
      message:
        discrepancy > 0
          ? `Remaining installments exceed the outstanding balance by $${Math.abs(discrepancy).toFixed(2)}.`
          : `Remaining installments fall short of the outstanding balance by $${Math.abs(discrepancy).toFixed(2)}.`,
    };
  }

  return {
    invoiceTotal: input.invoiceTotal,
    paidToDate,
    balanceDue,
    closedPartialShortfall,
    preservedCollected,
    proposedRemaining,
    proposedRemainingTotal,
    discrepancy: 0,
    ok: true,
  };
}

/** Build equal or proportional remaining lines from current unresolved amounts. */
export function buildRedistributedRemaining(input: {
  balanceDue: number;
  template: AdjustableDraftLine[];
  mode: "equal" | "proportional";
}): AdjustableDraftLine[] {
  const balanceDue = roundMoney(Math.max(0, input.balanceDue));
  const template = input.template.length > 0
    ? input.template
    : [{ label: "Remaining balance", amount: balanceDue, dueDate: null, obligationKind: "installment" as const }];
  // Proportional weights of 0 stay 0 and fail validation while siblings look fine.
  // Fall back to equal split when every weight is unusable.
  const weights = template.map((t) => roundMoney(Math.max(0, Number(t.amount) || 0)));
  const useEqual = input.mode === "equal" || weights.every((w) => w <= 0);
  const amounts = useEqual
    ? redistributeUnpaidInstallments({
        unpaidAmounts: template.map(() => 1),
        remainingBalance: balanceDue,
      })
    : redistributeUnpaidInstallments({
        unpaidAmounts: weights,
        remainingBalance: balanceDue,
      });
  return template.map((t, i) => ({
    ...t,
    amount: amounts[i] ?? 0,
  }));
}

export function draftLinesFromUnresolved(lines: PaymentLineItem[]): AdjustableDraftLine[] {
  return lines
    .filter((l) => isUnresolvedInstallmentStatus(l.status))
    .map((l) => ({
      id: l.id,
      label: l.label,
      amount: l.amount,
      dueDate: l.dueDate,
      obligationKind: l.obligationKind ?? null,
    }));
}
