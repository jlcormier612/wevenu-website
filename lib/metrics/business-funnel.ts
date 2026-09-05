/**
 * Phase 2B — End-to-end Business Funnel composition.
 *
 * Orchestrates authoritative Phase 1 / 2A metrics into one coherent story:
 *   Leads → Tours → Bookings → Financially Committed → Booked $ → Collected → Outstanding
 *
 * Not a second lifecycle or financial architecture. Period strip uses each
 * metric's own clock and NEVER computes conversion % between period stages.
 * Cohort rates use one explicit lead population (see isBusinessFunnelCohortLead).
 *
 * Phase 2C may prepend Website / Marketing without rewriting this shape —
 * leave room at the front of the period strip; do not invent visitor counts.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCanonicalBookings } from "@/lib/metrics/booking";
import { isBusinessFunnelCohortLead } from "@/lib/metrics/cohort-population";
import { getLifecycleBookings } from "@/lib/metrics/lifecycle-booking";
import {
  getGrossBookedRevenue,
  getOutstandingBalance,
  getPaymentsCollected,
} from "@/lib/metrics/revenue";
import { getCurrentVenue } from "@/lib/venue/service";

export type DateWindow = { from: string; to: string };

/** Pure cohort rate: integer percent 0–100; 0 when denominator is 0. */
export function cohortRatePercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((100 * numerator) / denominator);
}

export { isBusinessFunnelCohortLead };

export type BusinessFunnelCohortLeadRow = {
  id: string;
  status: string | null;
  sales_stage: string | null;
  first_booked_at: string | null;
  /** True when the lead has at least one tour_appointments row (any time). */
  eventuallyToured: boolean;
};

export type BusinessFunnelCohortStats = {
  leadsEntered: number;
  eventuallyToured: number;
  eventuallyBooked: number;
  /** Among eventually toured, how many eventually lifecycle-booked. */
  touredAndBooked: number;
  leadToTourRate: number;
  leadToBookingRate: number;
  tourToBookingRate: number;
};

/** Pure cohort math for unit tests and composition. */
export function computeBusinessFunnelCohortStats(
  rows: BusinessFunnelCohortLeadRow[],
): BusinessFunnelCohortStats {
  const cohort = rows.filter(isBusinessFunnelCohortLead);
  const leadsEntered = cohort.length;
  const eventuallyToured = cohort.filter((r) => r.eventuallyToured).length;
  const eventuallyBooked = cohort.filter((r) => !!r.first_booked_at).length;
  const touredAndBooked = cohort.filter((r) => r.eventuallyToured && !!r.first_booked_at).length;
  return {
    leadsEntered,
    eventuallyToured,
    eventuallyBooked,
    touredAndBooked,
    leadToTourRate: cohortRatePercent(eventuallyToured, leadsEntered),
    leadToBookingRate: cohortRatePercent(eventuallyBooked, leadsEntered),
    tourToBookingRate: cohortRatePercent(touredAndBooked, eventuallyToured),
  };
}

export type BusinessFunnelPeriod = {
  /** leads.created_at in window; same exclusion as cohort (cancelled / lost). */
  leads: number;
  /** tour_appointments.scheduled_at in window (appointment count, not distinct leads). */
  tours: number;
  /** lifecycle first_booked occurred_at in window (includes leadless direct/import). */
  bookings: number;
  /** canonical_bookings.booked_at in window. */
  financiallyCommitted: number;
  /** Gross Booked Revenue — commitment booked_at clock. */
  bookedRevenue: number;
  /** Payments Collected — paid_at clock. */
  collectedRevenue: number;
  /**
   * Outstanding = GBR(window) − Collected(window). Mixed clocks — not a
   * point-in-time balance snapshot.
   */
  outstanding: number;
};

export type BusinessFunnelModel = {
  window: DateWindow;
  period: BusinessFunnelPeriod;
  cohort: BusinessFunnelCohortStats;
  /**
   * Product copy: leadless/direct/import appear in period Bookings + money,
   * not in Lead/Tour cohort rates.
   */
  leadlessNote: string;
  outstandingLimitation: string;
};

export const BUSINESS_FUNNEL_LEADLESS_NOTE =
  "Leadless / Direct / Import bookings and revenue appear in Bookings and financial stages, but are not included in Lead → Tour or Lead → Booking cohort rates — they did not enter through the lead funnel.";

export const BUSINESS_FUNNEL_OUTSTANDING_LIMITATION =
  "Outstanding uses the existing formula: Gross Booked Revenue (Financially Committed clients whose commitment date falls in this period) minus Payments Collected (by payment date in this period). Those are different clocks — not a single point-in-time balance snapshot.";

async function countPeriodTours(window: DateWindow): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const venue = await getCurrentVenue();
  if (!venue) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("tour_appointments")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venue.id)
    .gte("scheduled_at", `${window.from}T00:00:00.000Z`)
    .lte("scheduled_at", `${window.to}T23:59:59.999Z`);
  return count ?? 0;
}

async function countPeriodBusinessFunnelLeads(window: DateWindow): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const venue = await getCurrentVenue();
  if (!venue) return 0;
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, status, sales_stage")
    .eq("venue_id", venue.id)
    .gte("created_at", `${window.from}T00:00:00.000Z`)
    .lte("created_at", `${window.to}T23:59:59.999Z`);
  type Row = { id: string; status: string | null; sales_stage: string | null };
  return ((data ?? []) as Row[]).filter(isBusinessFunnelCohortLead).length;
}

async function loadBusinessFunnelCohort(window: DateWindow): Promise<BusinessFunnelCohortStats> {
  if (!isSupabaseConfigured) {
    return computeBusinessFunnelCohortStats([]);
  }
  const venue = await getCurrentVenue();
  if (!venue) return computeBusinessFunnelCohortStats([]);
  const supabase = await createClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("id, status, sales_stage, first_booked_at")
    .eq("venue_id", venue.id)
    .gte("created_at", `${window.from}T00:00:00.000Z`)
    .lte("created_at", `${window.to}T23:59:59.999Z`);

  type LeadRow = {
    id: string;
    status: string | null;
    sales_stage: string | null;
    first_booked_at: string | null;
  };
  const leadRows = ((leads ?? []) as LeadRow[]).filter(isBusinessFunnelCohortLead);
  if (leadRows.length === 0) return computeBusinessFunnelCohortStats([]);

  const leadIds = leadRows.map((l) => l.id);
  const { data: tours } = await supabase
    .from("tour_appointments")
    .select("lead_id")
    .eq("venue_id", venue.id)
    .in("lead_id", leadIds);

  const touredIds = new Set(
    ((tours ?? []) as { lead_id: string | null }[])
      .map((t) => t.lead_id)
      .filter((id): id is string => !!id),
  );

  return computeBusinessFunnelCohortStats(
    leadRows.map((l) => ({
      ...l,
      eventuallyToured: touredIds.has(l.id),
    })),
  );
}

/**
 * Full Business Funnel for the selected reporting window.
 * Reuses Lifecycle Booking, Financially Committed, and revenue RPCs.
 */
export async function getBusinessFunnel(window: DateWindow): Promise<BusinessFunnelModel> {
  const [
    periodLeads,
    periodTours,
    periodBookings,
    financiallyCommitted,
    bookedRevenue,
    collectedRevenue,
    outstanding,
    cohort,
  ] = await Promise.all([
    countPeriodBusinessFunnelLeads(window),
    countPeriodTours(window),
    getLifecycleBookings(window),
    getCanonicalBookings(window),
    getGrossBookedRevenue(window),
    getPaymentsCollected(window),
    getOutstandingBalance(window),
    loadBusinessFunnelCohort(window),
  ]);

  return {
    window,
    period: {
      leads: periodLeads,
      tours: periodTours,
      bookings: periodBookings.length,
      financiallyCommitted: financiallyCommitted.length,
      bookedRevenue: bookedRevenue ?? 0,
      collectedRevenue: collectedRevenue ?? 0,
      outstanding: outstanding ?? 0,
    },
    cohort,
    leadlessNote: BUSINESS_FUNNEL_LEADLESS_NOTE,
    outstandingLimitation: BUSINESS_FUNNEL_OUTSTANDING_LIMITATION,
  };
}
