/**
 * Bookings-by-Source data for Reporting overview (period) and Sales (lead cohort).
 * Reuses lifecycle first_booked + frozen acquisition_source — no new taxonomies.
 */
import {
  BOOKINGS_BY_SOURCE_COHORT_BASIS,
  BOOKINGS_BY_SOURCE_PERIOD_BASIS,
  buildBookingsBySourceBreakdown,
  buildBookingsBySourceBreakdownFromCounts,
  type BookingsBySourceBreakdown,
} from "@/lib/attribution/bookings-by-source";
import {
  reportingSourceDisplayLabel,
  reportingSourceGroupKey,
  UNKNOWN_SOURCE_KEY,
} from "@/lib/attribution/source";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  listFirstBookedLeadIds,
  listLifecycleBookingsInPeriod,
} from "@/lib/lifecycle-bookings/service";
import {
  isBusinessFunnelCohortLead,
  leadHasLifecycleBooking,
} from "@/lib/metrics/cohort-population";
import { onlyBusinessReporting } from "@/lib/reporting/business-scope";
import { getCurrentVenue } from "@/lib/venue/service";

export type DateWindow = { from: string; to: string };

export type BookingsBySourceReport = BookingsBySourceBreakdown & {
  basis: string;
  /** period = booked during window; cohort = leads created in window who later booked */
  mode: "period" | "cohort";
};

function empty(mode: "period" | "cohort"): BookingsBySourceReport {
  return {
    total: 0,
    slices: [],
    mode,
    basis: mode === "period" ? BOOKINGS_BY_SOURCE_PERIOD_BASIS : BOOKINGS_BY_SOURCE_COHORT_BASIS,
  };
}

/**
 * Overview / Bookings-period: first_booked rows whose occurred_at falls in the window.
 */
export async function getPeriodBookingsBySource(
  window: DateWindow,
): Promise<BookingsBySourceReport> {
  if (!isSupabaseConfigured) return empty("period");
  const venue = await getCurrentVenue();
  if (!venue) return empty("period");
  const supabase = await createClient();
  const rows = await listLifecycleBookingsInPeriod(supabase, venue.id, {
    from: window.from,
    to: window.to,
  });
  const breakdown = buildBookingsBySourceBreakdown(rows.map((r) => r.acquisitionSource));
  return {
    ...breakdown,
    mode: "period",
    basis: BOOKINGS_BY_SOURCE_PERIOD_BASIS,
  };
}

/**
 * Sales lead-conversion: lifecycle bookings attributed to leads created in the window.
 * Counts each first_booked once (one per lead relationship). Uses frozen lead
 * acquisition_source so period tables and this chart cannot disagree on source labels.
 */
export async function getLeadCohortBookingsBySource(
  window: DateWindow,
): Promise<BookingsBySourceReport> {
  if (!isSupabaseConfigured) return empty("cohort");
  const venue = await getCurrentVenue();
  if (!venue) return empty("cohort");
  const supabase = await createClient();

  const { data: leads } = await onlyBusinessReporting(
    supabase
      .from("leads")
      .select("id, acquisition_source, first_booked_at, sales_stage, status")
      .eq("venue_id", venue.id)
      .gte("created_at", `${window.from}T00:00:00.000Z`)
      .lte("created_at", `${window.to}T23:59:59.999Z`),
  );

  type LeadRow = {
    id: string;
    acquisition_source: string | null;
    first_booked_at: string | null;
    sales_stage: string | null;
    status: string | null;
  };
  const cohort = ((leads ?? []) as LeadRow[]).filter(isBusinessFunnelCohortLead);
  if (cohort.length === 0) return empty("cohort");

  const bookedIds = await listFirstBookedLeadIds(
    supabase,
    venue.id,
    cohort.map((l) => l.id),
  );

  const bookedSources = cohort
    .filter((l) =>
      leadHasLifecycleBooking({
        first_booked_at: l.first_booked_at,
        hasFirstBookedEvent: bookedIds.has(l.id),
      }),
    )
    .map((l) => l.acquisition_source);

  // Prefer building from raw sources so Unknown / Website rollups match period charts.
  const breakdown = buildBookingsBySourceBreakdown(bookedSources);
  return {
    ...breakdown,
    mode: "cohort",
    basis: BOOKINGS_BY_SOURCE_COHORT_BASIS,
  };
}

/** Test helper: cohort counts from eventuallyBooked-style aggregates. */
export function breakdownFromCohortBookedCounts(
  rows: Array<{ key: string; eventuallyBooked: number; label?: string }>,
): BookingsBySourceBreakdown {
  return buildBookingsBySourceBreakdownFromCounts(
    rows.map((r) => ({
      key: reportingSourceGroupKey(r.key === UNKNOWN_SOURCE_KEY ? null : r.key),
      label: r.label ?? reportingSourceDisplayLabel(r.key === UNKNOWN_SOURCE_KEY ? null : r.key),
      count: r.eventuallyBooked,
    })),
  );
}
