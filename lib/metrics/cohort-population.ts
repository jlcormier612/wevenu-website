/**
 * Shared Reporting cohort lead population.
 *
 * A lead that entered the funnel stays in the cohort even if it later
 * became Lost. Lost means a real opportunity we did not win — excluding
 * those records would inflate conversion.
 *
 * Direct Adds never appear here (they are not leads).
 * Deleted records are gone from `leads` and therefore gone from the cohort.
 */
export function isBusinessFunnelCohortLead(_row: {
  status?: string | null | undefined;
  sales_stage?: string | null | undefined;
}): boolean {
  return true;
}

/** Lead-derived Booking: durable first_booked date or an undated first_booked event. */
export function leadHasLifecycleBooking(row: {
  first_booked_at?: string | null;
  hasFirstBookedEvent?: boolean;
}): boolean {
  return !!row.first_booked_at || !!row.hasFirstBookedEvent;
}
