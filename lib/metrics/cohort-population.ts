/**
 * Shared Reporting cohort lead population (Phase 2B).
 *
 * Customer-facing Lead → Booking rates (Business Funnel, Overview tile,
 * Sales cohort, saved-report export) must use this filter so Reporting
 * never presents two different rates for the same relationship.
 */
export function isBusinessFunnelCohortLead(row: {
  status: string | null | undefined;
  sales_stage: string | null | undefined;
}): boolean {
  if (row.status === "cancelled") return false;
  if (row.sales_stage === "lost") return false;
  return true;
}
