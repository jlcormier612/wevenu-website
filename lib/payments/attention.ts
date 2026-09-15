/**
 * Payments attention population — same condition the Payments list
 * `?filter=attention` uses (schedules whose deriveScheduleStatus is
 * "attention": overdue / refunded line items).
 *
 * Dashboard Today's Focus surfaces payment urgency through Event
 * Readiness (briefing.needsAttentionNow). Do not re-derive that here.
 */
export function paymentsAttentionHref(): string {
  return "/payments?filter=attention";
}
