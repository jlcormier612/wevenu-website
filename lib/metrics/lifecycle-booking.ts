/**
 * Lifecycle Booking metrics — durable first_booked events.
 * Distinct from Financially Committed (`canonical_bookings`).
 * Acquisition attribution uses frozen acquisition_source (Phase 2A).
 */
import {
  reportingSourceDisplayLabel,
  reportingSourceGroupKey,
} from "@/lib/attribution/source";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  listLifecycleBookingsInPeriod,
  originLabel,
  type LifecycleBookingOrigin,
  type LifecycleBookingRow,
} from "@/lib/lifecycle-bookings/service";
import { isBusinessFunnelCohortLead } from "@/lib/metrics/cohort-population";
import { getCurrentVenue } from "@/lib/venue/service";

export type DateWindow = { from?: string; to?: string };

export type LifecycleBookingDetail = LifecycleBookingRow & {
  displayName: string;
  /** Frozen acquisition source (raw key); null = Unknown / Unattributed. */
  source: string | null;
  originLabel: string;
};

/** First lifecycle bookings in the window (Overview / Bookings count). */
export async function getLifecycleBookings(window?: DateWindow): Promise<LifecycleBookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  return listLifecycleBookingsInPeriod(supabase, venue.id, {
    from: window?.from,
    to: window?.to,
  });
}

export async function getLifecycleBookingsWithNames(window?: DateWindow): Promise<LifecycleBookingDetail[]> {
  const rows = await getLifecycleBookings(window);
  if (rows.length === 0) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();

  const leadIds = [...new Set(rows.map((r) => r.leadId).filter((v): v is string => !!v))];
  const clientIds = [...new Set(rows.map((r) => r.clientId).filter((v): v is string => !!v))];

  const [{ data: leads }, { data: clients }] = await Promise.all([
    leadIds.length
      ? supabase.from("leads").select("id, first_name, last_name, acquisition_source").in("id", leadIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string; acquisition_source: string | null }[] }),
    clientIds.length
      ? supabase.from("clients").select("id, first_name, last_name, lead_id").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string; lead_id: string | null }[] }),
  ]);

  type LeadRow = { id: string; first_name: string; last_name: string; acquisition_source: string | null };
  type ClientRow = { id: string; first_name: string; last_name: string; lead_id: string | null };
  const leadById = new Map(((leads ?? []) as LeadRow[]).map((l) => [l.id, l]));
  const clientById = new Map(((clients ?? []) as ClientRow[]).map((c) => [c.id, c]));

  return rows.map((r) => {
    const lead = r.leadId ? leadById.get(r.leadId) : null;
    const client = r.clientId ? clientById.get(r.clientId) : null;
    const displayName = lead
      ? `${lead.first_name} ${lead.last_name}`.trim()
      : client
        ? `${client.first_name} ${client.last_name}`.trim()
        : "Booking";
    // Prefer event stamp; fall back to lead frozen source (pre-stamp rows).
    let source: string | null = r.acquisitionSource ?? lead?.acquisition_source ?? null;
    if (r.origin === "direct" || r.origin === "import") {
      if (!r.leadId && !client?.lead_id) source = null;
    }
    return {
      ...r,
      displayName: displayName || "Booking",
      source,
      originLabel: originLabel(r.origin),
    };
  });
}

export async function getLifecycleBookingsByOrigin(
  window?: DateWindow,
): Promise<{ origin: LifecycleBookingOrigin; label: string; count: number }[]> {
  const rows = await getLifecycleBookings(window);
  const counts: Record<LifecycleBookingOrigin, number> = { pipeline: 0, direct: 0, import: 0 };
  for (const r of rows) counts[r.origin] += 1;
  return (Object.keys(counts) as LifecycleBookingOrigin[]).map((origin) => ({
    origin,
    label: originLabel(origin),
    count: counts[origin],
  }));
}

/** Pipeline snapshot: leads currently in sales_stage = booked. */
export async function getCurrentlyBookedPipelineCount(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const venue = await getCurrentVenue();
  if (!venue) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venue.id)
    .eq("sales_stage", "booked");
  return count ?? 0;
}

/**
 * Cohort: of leads created in the window (Business Funnel population —
 * excludes status=cancelled and sales_stage=lost), how many eventually have
 * a first lifecycle booking (any time). Uses leads.first_booked_at — write-once.
 * By-source uses frozen acquisition_source (not editable operational source).
 *
 * Same population as Phase 2B Business Funnel Lead → Booking so Reporting
 * never presents two different Lead → Booking rates.
 */
export async function getLeadCohortLifecycleBookingStats(
  window: { from: string; to: string },
): Promise<{
  leadsEntered: number;
  eventuallyBooked: number;
  conversionRate: number;
  bySource: { source: string; label: string; total: number; booked: number; rate: number }[];
}> {
  if (!isSupabaseConfigured) {
    return { leadsEntered: 0, eventuallyBooked: 0, conversionRate: 0, bySource: [] };
  }
  const venue = await getCurrentVenue();
  if (!venue) return { leadsEntered: 0, eventuallyBooked: 0, conversionRate: 0, bySource: [] };
  const supabase = await createClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("id, acquisition_source, first_booked_at, sales_stage, status")
    .eq("venue_id", venue.id)
    .gte("created_at", `${window.from}T00:00:00.000Z`)
    .lte("created_at", `${window.to}T23:59:59.999Z`);

  type Row = {
    id: string;
    acquisition_source: string | null;
    first_booked_at: string | null;
    sales_stage: string | null;
    status: string | null;
  };
  const rows = ((leads ?? []) as Row[]).filter(isBusinessFunnelCohortLead);
  const leadsEntered = rows.length;
  const eventuallyBooked = rows.filter((l) => !!l.first_booked_at).length;
  const conversionRate = leadsEntered > 0 ? Math.round((100 * eventuallyBooked) / leadsEntered) : 0;

  const totals = new Map<string, { total: number; booked: number }>();
  for (const l of rows) {
    const key = reportingSourceGroupKey(l.acquisition_source);
    const cur = totals.get(key) ?? { total: 0, booked: 0 };
    cur.total += 1;
    if (l.first_booked_at) cur.booked += 1;
    totals.set(key, cur);
  }
  const bySource = [...totals.entries()]
    .map(([source, v]) => ({
      source,
      label: reportingSourceDisplayLabel(source === "unknown" ? null : source),
      total: v.total,
      booked: v.booked,
      rate: v.total > 0 ? Math.round((100 * v.booked) / v.total) : 0,
    }))
    .sort((a, b) => {
      if (a.source === "unknown") return 1;
      if (b.source === "unknown") return -1;
      return b.total - a.total;
    });

  return { leadsEntered, eventuallyBooked, conversionRate, bySource };
}

/** Alias kept for Financially Committed consumers — do not use for Lifecycle Bookings. */
export { getCanonicalBookings as getFinanciallyCommittedBookings } from "@/lib/metrics/booking";
