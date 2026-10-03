/**
 * Current installment for a manual/offline "money received" action.
 * Does not create a second payment record — callers persist via markLineItemPaid.
 * Skips Stripe-in-flight lines so an online debit is not rewritten as cash.
 */

export type ManualInstallmentCandidate = {
  id: string;
  status: string;
  dueDate: string | null;
  amount: number;
  paidAmount?: number | null;
  label?: string | null;
  stripePaymentIntentId?: string | null;
};

function byDue(a: ManualInstallmentCandidate, b: ManualInstallmentCandidate): number {
  const ad = a.dueDate ?? "9999-12-31";
  const bd = b.dueDate ?? "9999-12-31";
  return ad.localeCompare(bd);
}

/** Open installments that can still accept offline money. */
export function isOpenOfflineInstallment(status: string): boolean {
  return status === "overdue" || status === "pending" || status === "partially_paid";
}

/** Remaining dollars still owed on an installment. */
export function installmentRemainingAmount(line: {
  amount: number;
  status: string;
  paidAmount?: number | null;
}): number {
  const due = Number(line.amount);
  if (line.status === "paid") return 0;
  if (line.status === "partially_paid") {
    return Math.max(0, Math.round((due - Number(line.paidAmount ?? 0)) * 100) / 100);
  }
  return due;
}

/**
 * Overdue installment first, otherwise the next open pending/partial line.
 * Used only as the default selection for a deliberate recording flow —
 * never as a silent one-click target that can advance across installments.
 */
export function selectCurrentUnpaidInstallment(
  lines: readonly ManualInstallmentCandidate[],
): ManualInstallmentCandidate | null {
  const open = lines.filter(
    (l) => isOpenOfflineInstallment(l.status) && !l.stripePaymentIntentId,
  );
  const overdue = open.filter((l) => l.status === "overdue").sort(byDue);
  if (overdue[0]) return overdue[0];
  const partial = open.filter((l) => l.status === "partially_paid").sort(byDue);
  if (partial[0]) return partial[0];
  const pending = open.filter((l) => l.status === "pending").sort(byDue);
  return pending[0] ?? null;
}
