/**
 * Human-facing attention reasons for a payment schedule row.
 * Matches deriveScheduleStatus attention: overdue / refunded / partially_refunded.
 */
export function paymentAttentionReasons(s: {
  overdueCount: number;
  refundedCount: number;
  partiallyRefundedCount: number;
}): string[] {
  const reasons: string[] = [];
  if (s.overdueCount > 0) {
    reasons.push(`${s.overdueCount} overdue payment${s.overdueCount === 1 ? "" : "s"}`);
  }
  if (s.refundedCount > 0) {
    reasons.push(`${s.refundedCount} refunded payment${s.refundedCount === 1 ? "" : "s"}`);
  }
  if (s.partiallyRefundedCount > 0) {
    reasons.push(
      `${s.partiallyRefundedCount} partially refunded payment${s.partiallyRefundedCount === 1 ? "" : "s"}`,
    );
  }
  return reasons;
}
