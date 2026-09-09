/**
 * Portal paid / remaining — same refund-net discipline as venue
 * `computeTotalPaid`, using visible (non-cancelled) schedule lines only so
 * cancelled rows cannot leave contradictory totals.
 */

export type PortalTotalsLine = {
  amount: number;
  status: string;
  paidAmount?: number | null;
  refundedAmount?: number | null;
};

export type PortalScheduleTotals = {
  /** Sum of visible line amounts (excludes cancelled). */
  planTotal: number;
  /** Net retained collections on visible lines. */
  paid: number;
  /** planTotal − paid, floored at 0. */
  remaining: number;
};

function netCollected(line: PortalTotalsLine): number {
  if (
    line.status !== "paid"
    && line.status !== "partially_refunded"
    && line.status !== "refunded"
  ) {
    return 0;
  }
  const paid = line.paidAmount ?? line.amount;
  const refunded = line.refundedAmount ?? 0;
  return Math.max(0, paid - refunded);
}

/**
 * @param lineItems Visible portal lines (RPC already omits cancelled).
 *   Pass cancelled lines only if you need them excluded here too.
 */
export function computePortalScheduleTotals(
  lineItems: readonly PortalTotalsLine[],
): PortalScheduleTotals {
  const visible = lineItems.filter((l) => l.status !== "cancelled");
  const planTotal = visible.reduce((sum, l) => sum + l.amount, 0);
  const paid = visible.reduce((sum, l) => sum + netCollected(l), 0);
  return {
    planTotal,
    paid,
    remaining: Math.max(0, planTotal - paid),
  };
}
