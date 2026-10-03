/**
 * Invoice balance vs payment-plan cancellation.
 *
 * invoice.total stays the historical contracted commercial amount.
 * Cancelling an unpaid payment-plan line removes that commitment from what
 * the client is still expected to pay — without mutating invoice line history
 * or payment/refund rows.
 *
 * balance_due = max(0, invoice.total − cancelled_plan_amounts − net_paid)
 */

export type BalanceLine = {
  amount: number;
  status: string;
  paidAmount?: number | null;
  refundedAmount?: number | null;
};

/** Sum of cancelled schedule commitments (no longer owed through the plan). */
export function computeCancelledPlanAmount(items: readonly BalanceLine[]): number {
  return items
    .filter((i) => i.status === "cancelled")
    .reduce((sum, i) => sum + i.amount, 0);
}

/** Net retained collections — same rules as computeTotalPaid / portal. */
export function computeNetPaid(items: readonly BalanceLine[]): number {
  return items
    .filter(
      (i) =>
        i.status === "paid"
        || i.status === "partially_paid"
        || i.status === "partially_refunded"
        || i.status === "refunded",
    )
    .reduce((sum, i) => {
      const paid = i.paidAmount != null ? Number(i.paidAmount) : Number(i.amount);
      const refunded = Number(i.refundedAmount ?? 0);
      return sum + paid - refunded;
    }, 0);
}

/** Active (non-cancelled) plan total — matches portal planTotal. */
export function computeActivePlanTotal(items: readonly BalanceLine[]): number {
  return items
    .filter((i) => i.status !== "cancelled")
    .reduce((sum, i) => sum + i.amount, 0);
}

/**
 * Current amount still owed on the invoice given linked schedule lines.
 * When there are no schedule lines, callers should pass [] and use
 * invoice.total − netPaid only via the same formula (cancelled = 0).
 */
export function computeInvoiceBalanceDue(
  invoiceTotal: number,
  scheduleLines: readonly BalanceLine[],
): number {
  const cancelled = computeCancelledPlanAmount(scheduleLines);
  const netPaid = computeNetPaid(scheduleLines);
  return Math.max(0, Number(invoiceTotal) - cancelled - netPaid);
}

/**
 * Authoritative invoice payment status from balance + net paid.
 * - paid: balance is zero
 * - partially_paid: some money retained and balance remains
 * - otherwise leave the prior non-terminal status (typically sent)
 *
 * Never marks Paid when a balance remains.
 */
export function deriveInvoicePaymentStatus(input: {
  balanceDue: number;
  netPaid: number;
  currentStatus: string;
}): "paid" | "partially_paid" | "sent" | null {
  const balanceDue = Number(input.balanceDue);
  const netPaid = Number(input.netPaid);
  if (input.currentStatus === "void" || input.currentStatus === "draft") {
    return null;
  }
  if (balanceDue <= 0) return "paid";
  if (netPaid > 0) return "partially_paid";
  if (input.currentStatus === "paid" || input.currentStatus === "partially_paid") {
    return "sent";
  }
  return null;
}
