/**
 * Leads by Source — composition for Sales / Overview.
 * Same frozen acquisition_source vocabulary as Bookings by Source.
 */
import {
  buildBookingsBySourceBreakdown,
  type BookingsBySourceBreakdown,
} from "@/lib/attribution/bookings-by-source";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { onlyBusinessReporting } from "@/lib/reporting/business-scope";
import { getCurrentVenue } from "@/lib/venue/service";

export type DateWindow = { from: string; to: string };

export const LEADS_BY_SOURCE_BASIS =
  "New leads received in this period, grouped by acquisition source captured at entry. Missing source is Not recorded.";

export type LeadsBySourceReport = BookingsBySourceBreakdown & {
  basis: string;
};

function empty(): LeadsBySourceReport {
  return { total: 0, slices: [], basis: LEADS_BY_SOURCE_BASIS };
}

/** Leads created in the window, by frozen acquisition_source. */
export async function getLeadsBySource(window: DateWindow): Promise<LeadsBySourceReport> {
  if (!isSupabaseConfigured) return empty();
  const venue = await getCurrentVenue();
  if (!venue) return empty();
  const supabase = await createClient();

  const { data } = await onlyBusinessReporting(
    supabase
      .from("leads")
      .select("acquisition_source")
      .eq("venue_id", venue.id)
      .gte("created_at", `${window.from}T00:00:00.000Z`)
      .lte("created_at", `${window.to}T23:59:59.999Z`),
  );

  const sources = ((data ?? []) as { acquisition_source: string | null }[]).map(
    (r) => r.acquisition_source,
  );
  const breakdown = buildBookingsBySourceBreakdown(sources);
  return { ...breakdown, basis: LEADS_BY_SOURCE_BASIS };
}
