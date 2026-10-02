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
  stripePaymentIntentId?: string | null;
};

function byDue(a: ManualInstallmentCandidate, b: ManualInstallmentCandidate): number {
  const ad = a.dueDate ?? "9999-12-31";
  const bd = b.dueDate ?? "9999-12-31";
  return ad.localeCompare(bd);
}

/** Overdue installment first, otherwise the next unpaid pending line. */
export function selectCurrentUnpaidInstallment(
  lines: readonly ManualInstallmentCandidate[],
): ManualInstallmentCandidate | null {
  const open = lines.filter(
    (l) =>
      (l.status === "overdue" || l.status === "pending")
      && !l.stripePaymentIntentId,
  );
  const overdue = open.filter((l) => l.status === "overdue").sort(byDue);
  if (overdue[0]) return overdue[0];
  const pending = open.filter((l) => l.status === "pending").sort(byDue);
  return pending[0] ?? null;
}
