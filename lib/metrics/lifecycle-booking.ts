/**
 * Lifecycle Booking metrics — durable first_booked events.
 * Distinct from Financially Committed (`canonical_bookings`).
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  listLifecycleBookingsInPeriod,
  originLabel,
  type LifecycleBookingOrigin,
  type LifecycleBookingRow,
} from "@/lib/lifecycle-bookings/service";
import { getCurrentVenue } from "@/lib/venue/service";

export type DateWindow = { from?: string; to?: string };

export type LifecycleBookingDetail = LifecycleBookingRow & {
  displayName: string;
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
      ? supabase.from("leads").select("id, first_name, last_name, source").in("id", leadIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string; source: string | null }[] }),
    clientIds.length
      ? supabase.from("clients").select("id, first_name, last_name, lead_id, leads(source)").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string; lead_id: string | null; leads: { source: string | null } | null }[] }),
  ]);

  type LeadRow = { id: string; first_name: string; last_name: string; source: string | null };
  type ClientRow = {
    id: string; first_name: string; last_name: string; lead_id: string | null;
    leads: { source: string | null } | null;
  };
  const leadById = new Map(((leads ?? []) as LeadRow[]).map((l) => [l.id, l]));
  const clientById = new Map(((clients ?? []) as unknown as ClientRow[]).map((c) => [c.id, c]));

  return rows.map((r) => {
    const lead = r.leadId ? leadById.get(r.leadId) : null;
    const client = r.clientId ? clientById.get(r.clientId) : null;
    const displayName = lead
      ? `${lead.first_name} ${lead.last_name}`.trim()
      : client
        ? `${client.first_name} ${client.last_name}`.trim()
        : "Booking";
    let source: string | null = lead?.source ?? null;
    if (!source && client?.leads?.source) source = client.leads.source;
    if (r.origin === "direct" || r.origin === "import") {
      // Leadless / explicit import: do not invent a pipeline source.
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
 * Cohort: of leads created in the window, how many eventually have a first
 * lifecycle booking (any time). Uses leads.first_booked_at — write-once.
 */
export async function getLeadCohortLifecycleBookingStats(
  window: { from: string; to: string },
): Promise<{
  leadsEntered: number;
  eventuallyBooked: number;
  conversionRate: number;
  bySource: { source: string; total: number; booked: number; rate: number }[];
}> {
  if (!isSupabaseConfigured) {
    return { leadsEntered: 0, eventuallyBooked: 0, conversionRate: 0, bySource: [] };
  }
  const venue = await getCurrentVenue();
  if (!venue) return { leadsEntered: 0, eventuallyBooked: 0, conversionRate: 0, bySource: [] };
  const supabase = await createClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("id, source, first_booked_at, sales_stage")
    .eq("venue_id", venue.id)
    .gte("created_at", `${window.from}T00:00:00.000Z`)
    .lte("created_at", `${window.to}T23:59:59.999Z`);

  type Row = { id: string; source: string | null; first_booked_at: string | null; sales_stage: string };
  const rows = (leads ?? []) as Row[];
  const leadsEntered = rows.length;
  const eventuallyBooked = rows.filter((l) => !!l.first_booked_at).length;
  const conversionRate = leadsEntered > 0 ? Math.round((100 * eventuallyBooked) / leadsEntered) : 0;

  const totals = new Map<string, { total: number; booked: number }>();
  for (const l of rows) {
    const key = l.source?.trim() ? l.source : "unknown";
    const cur = totals.get(key) ?? { total: 0, booked: 0 };
    cur.total += 1;
    if (l.first_booked_at) cur.booked += 1;
    totals.set(key, cur);
  }
  const bySource = [...totals.entries()]
    .map(([source, v]) => ({
      source,
      total: v.total,
      booked: v.booked,
      rate: v.total > 0 ? Math.round((100 * v.booked) / v.total) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return { leadsEntered, eventuallyBooked, conversionRate, bySource };
}

/** Alias kept for Financially Committed consumers — do not use for Lifecycle Bookings. */
export { getCanonicalBookings as getFinanciallyCommittedBookings } from "@/lib/metrics/booking";
