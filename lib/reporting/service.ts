/**
 * Work Package R1 — Reporting composition layer.
 *
 * Every number in here is either read straight from `lib/metrics/*`
 * (the canonical layer) or is a plain re-grouping/bucketing of the exact
 * same canonical rows (e.g. "bookings by month" buckets
 * `getCanonicalBookings()`'s own rows by the month of their own
 * `bookedAt` — it does not recompute what a Booking is). No function in
 * this file independently decides what counts as a Booking, Revenue, or a
 * conversion stage — see lib/metrics/registry.ts for why that rule exists.
 *
 * Drill-down rows link to the existing Relationship Workspace
 * (`/clients/{clientId}`) — Reporting never renders a second event/booking
 * management surface (brief §28/§29).
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import { getCanonicalBookings, type CanonicalBooking } from "@/lib/metrics/booking";
import type { TrendPoint } from "@/components/dashboard-system/trend-chart";

export type DateWindow = { from: string; to: string };

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

/** Every calendar month from `from` to `to`, inclusive — so a month with zero activity still shows as 0, never silently omitted (brief §33). */
function monthBuckets(from: string, to: string): { key: string; label: string }[] {
  const buckets: { key: string; label: string }[] = [];
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  // Cap at 24 buckets — a multi-year custom range would otherwise render an
  // unreadable trend; monthly granularity beyond 2 years isn't a "keep it
  // simple" trend anymore (brief §16).
  let guard = 0;
  while (cursor <= last && guard < 24) {
    buckets.push({ key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`, label: cursor.toLocaleDateString("en-US", { month: "short" }) });
    cursor.setMonth(cursor.getMonth() + 1);
    guard++;
  }
  return buckets;
}

export type BookingDrillRow = { clientId: string; clientName: string; contractId: string; bookedAt: string; source: string | null };

/**
 * Canonical Bookings in range, with client name + frozen acquisition source
 * (leads.acquisition_source) for display — never mutable leads.source.
 *
 * Work Package R3 — a real, previously-undetected bug fixed here:
 * `canonical_bookings` is a *view*, not a table, so it carries no foreign
 * key constraint PostgREST's schema cache can discover — embedding
 * `clients!inner(...)` directly off it doesn't silently degrade, it
 * returns a hard PGRST200 error ("Could not find a relationship"). This
 * function's original version never checked that error, so `data` was
 * always `null` and every caller (the entire Bookings report — its count,
 * trend, and detail list) silently rendered as if there were zero
 * bookings, for every venue, since R1. Verified live this phase (a direct
 * query with the exact original `.select()` string reproduces the error).
 * Fixed using this codebase's own established pattern for exactly this
 * situation (see getGrossBookedRevenueByCategory's own comment): two flat
 * queries — canonical_bookings for the venue-scoped, date-windowed rows,
 * then `clients` (a real table, so embedding `leads(acquisition_source)` off *it*
 * works) for display fields — joined in JS, not a broken embedded filter.
 */
export async function getBookingsWithClientNames(window: DateWindow): Promise<BookingDrillRow[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();

  const { data: bookings } = await supabase
    .from("canonical_bookings")
    .select("client_id, contract_id, booked_at")
    .eq("venue_id", venue.id)
    .gte("booked_at", window.from)
    .lte("booked_at", window.to)
    .order("booked_at", { ascending: false });
  const bookingRows = (bookings ?? []) as { client_id: string; contract_id: string; booked_at: string }[];
  if (bookingRows.length === 0) return [];

  const clientIds = [...new Set(bookingRows.map((b) => b.client_id))];
  const { data: clients } = await supabase
    .from("clients")
    .select("id, first_name, last_name, partner_first_name, partner_last_name, leads(acquisition_source)")
    .in("id", clientIds);

  type ClientRow = { id: string; first_name: string; last_name: string; partner_first_name: string | null; partner_last_name: string | null; leads: { acquisition_source: string | null } | null };
  const clientById = new Map(((clients ?? []) as unknown as ClientRow[]).map((c) => [c.id, c]));

  return bookingRows.map((b) => {
    const c = clientById.get(b.client_id);
    const primary = c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : "Client";
    const partner = c?.partner_first_name ? ` & ${[c.partner_first_name, c.partner_last_name].filter(Boolean).join(" ")}` : "";
    return { clientId: b.client_id, clientName: `${primary}${partner}`, contractId: b.contract_id, bookedAt: b.booked_at, source: c?.leads?.acquisition_source ?? null };
  });
}

/** Bookings-per-month trend, bucketed from the exact same canonical rows the Bookings report's own count uses — never a separate formula. */
export function bookingsToTrend(bookings: CanonicalBooking[] | BookingDrillRow[], window: DateWindow): TrendPoint[] {
  const buckets = monthBuckets(window.from, window.to);
  const counts = new Map<string, number>();
  for (const b of bookings) {
    const at = "bookedAt" in b ? b.bookedAt : "";
    const key = monthKey(at);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return buckets.map((b) => ({ label: b.label, value: counts.get(b.key) ?? 0 }));
}

/** Gross Booked Revenue per month — same subtotal-minus-discount, non-void, booked-client-scoped formula canonical_gross_booked_revenue() uses server-side, just grouped by the booking's own booked_at month instead of summed once. */
export async function getRevenueTrend(window: DateWindow): Promise<TrendPoint[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();

  const { data: bookings } = await supabase
    .from("canonical_bookings")
    .select("client_id, booked_at")
    .eq("venue_id", venue.id)
    .gte("booked_at", window.from)
    .lte("booked_at", window.to);
  const bookingRows = (bookings ?? []) as { client_id: string; booked_at: string }[];
  if (bookingRows.length === 0) return monthBuckets(window.from, window.to).map((b) => ({ label: b.label, value: 0 }));

  const clientIds = [...new Set(bookingRows.map((b) => b.client_id))];
  const { data: invoices } = await supabase
    .from("invoices")
    .select("client_id, subtotal, discount_amount, status")
    .eq("venue_id", venue.id)
    .neq("status", "void")
    .in("client_id", clientIds);

  const bookedAtByClient = new Map(bookingRows.map((b) => [b.client_id, b.booked_at]));
  const buckets = monthBuckets(window.from, window.to);
  const totals = new Map<string, number>();
  for (const inv of (invoices ?? []) as { client_id: string; subtotal: number; discount_amount: number }[]) {
    const bookedAt = bookedAtByClient.get(inv.client_id);
    if (!bookedAt) continue;
    const key = monthKey(bookedAt);
    totals.set(key, (totals.get(key) ?? 0) + (Number(inv.subtotal) - Number(inv.discount_amount)));
  }
  return buckets.map((b) => ({ label: b.label, value: Math.round(totals.get(b.key) ?? 0) }));
}

export type LeadSummary = { total: number; bySourceTrend: TrendPoint[] };

/** Leads received per month, by created_at — the same "entered the pipeline" date canonical_conversion_funnel() now windows on (migration 20261257000000). Plain COUNT, not a funnel/conversion calculation. */
export async function getLeadsTrend(window: DateWindow): Promise<{ total: number; trend: TrendPoint[] }> {
  if (!isSupabaseConfigured) return { total: 0, trend: [] };
  const venue = await getCurrentVenue();
  if (!venue) return { total: 0, trend: [] };
  const supabase = await createClient();

  const { data } = await supabase.from("leads").select("created_at")
    .eq("venue_id", venue.id).neq("status", "cancelled")
    .gte("created_at", window.from).lte("created_at", window.to + "T23:59:59");
  const rows = (data ?? []) as { created_at: string }[];
  const buckets = monthBuckets(window.from, window.to);
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(monthKey(r.created_at), (counts.get(monthKey(r.created_at)) ?? 0) + 1);
  return { total: rows.length, trend: buckets.map((b) => ({ label: b.label, value: counts.get(b.key) ?? 0 })) };
}

export type EventDrillRow = { id: string; clientId: string | null; name: string; eventDate: string | null; eventType: string | null; guestCount: number | null };

/** Events in range, for the Events report's trend/type breakdown/detail list. Plain scoped read — event count is not a canonical-registry metric (no ambiguity/duplicate-formula risk existed to resolve). */
export async function getEventsInRange(window: DateWindow): Promise<EventDrillRow[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();

  const { data } = await supabase.from("events")
    .select("id, client_id, name, event_date, event_type, guest_count")
    .eq("venue_id", venue.id)
    .gte("event_date", window.from).lte("event_date", window.to)
    .order("event_date", { ascending: true });
  return ((data ?? []) as { id: string; client_id: string | null; name: string; event_date: string | null; event_type: string | null; guest_count: number | null }[])
    .map((r) => ({ id: r.id, clientId: r.client_id, name: r.name, eventDate: r.event_date, eventType: r.event_type, guestCount: r.guest_count }));
}

/** Simple average — not a Metric Registry entry (no ambiguity ever existed for "average guest count"), same discipline as every other plain scoped read in this file. */
export function averageGuestCount(events: EventDrillRow[]): number {
  const withCount = events.filter((e) => e.guestCount != null && e.guestCount! > 0);
  if (withCount.length === 0) return 0;
  return Math.round(withCount.reduce((sum, e) => sum + (e.guestCount ?? 0), 0) / withCount.length);
}

export function eventsToTrend(events: EventDrillRow[], window: DateWindow): TrendPoint[] {
  const buckets = monthBuckets(window.from, window.to);
  const counts = new Map<string, number>();
  for (const e of events) {
    if (!e.eventDate) continue;
    const key = monthKey(e.eventDate);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return buckets.map((b) => ({ label: b.label, value: counts.get(b.key) ?? 0 }));
}

export function eventsByType(events: EventDrillRow[]): { type: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    const type = e.eventType || "Unspecified";
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count }));
}

// ---- Work Package R2 — drill-down detail --------------------------------

export type FunnelStageKey =
  | "inquiry" | "tourScheduled" | "proposalSent" | "contractSent"
  | "contractSigned" | "depositReceived" | "booked";

export type FunnelLeadRow = { id: string; name: string; source: string; createdAt: string; status: string };

/**
 * All seven funnel stages' underlying leads, from one call to
 * canonical_conversion_funnel_leads() — the exact same join conditions the
 * aggregate counts use, never a second approximation (brief §12). The caller
 * filters this one result set by stage rather than issuing a separate query
 * per stage. The RPC `source` column is frozen leads.acquisition_source
 * (migration 20261339), never mutable leads.source.
 */
export async function getFunnelLeadsRaw(window: DateWindow): Promise<Record<FunnelStageKey, FunnelLeadRow[]>> {
  const empty: Record<FunnelStageKey, FunnelLeadRow[]> = {
    inquiry: [], tourScheduled: [], proposalSent: [], contractSent: [], contractSigned: [], depositReceived: [], booked: [],
  };
  if (!isSupabaseConfigured) return empty;
  const venue = await getCurrentVenue();
  if (!venue) return empty;
  const supabase = await createClient();
  const { data } = await supabase.rpc("canonical_conversion_funnel_leads", { p_from: window.from, p_to: window.to });
  type Row = {
    lead_id: string; lead_name: string; source: string | null; created_at: string; status: string;
    reached_tour: boolean; reached_proposal: boolean; reached_contract_sent: boolean;
    reached_contract_signed: boolean; reached_deposit: boolean; reached_booked: boolean;
  };
  const rows = (data ?? []) as Row[];
  const toRow = (r: Row): FunnelLeadRow => ({ id: r.lead_id, name: r.lead_name, source: r.source ?? "unknown", createdAt: r.created_at, status: r.status });
  return {
    inquiry: rows.map(toRow),
    tourScheduled: rows.filter((r) => r.reached_tour).map(toRow),
    proposalSent: rows.filter((r) => r.reached_proposal).map(toRow),
    contractSent: rows.filter((r) => r.reached_contract_sent).map(toRow),
    contractSigned: rows.filter((r) => r.reached_contract_signed).map(toRow),
    depositReceived: rows.filter((r) => r.reached_deposit).map(toRow),
    booked: rows.filter((r) => r.reached_booked).map(toRow),
  };
}

export type PaymentDetailRow = { id: string; clientName: string; clientId: string; label: string; amount: number; paidAt: string };

/** The actual payment records behind "Payments Collected" — same net-of-refund rows canonical_payments_collected() sums, never a second total. */
export async function getPaymentsCollectedDetail(window: DateWindow): Promise<PaymentDetailRow[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("payment_line_items")
    .select("id, label, paid_amount, amount, refunded_amount, paid_at, schedule_id, payment_schedules!inner(client_id, clients!inner(first_name, last_name))")
    .eq("venue_id", venue.id)
    .in("status", ["paid", "partially_refunded", "refunded"])
    .gte("paid_at", window.from).lte("paid_at", window.to + "T23:59:59")
    .order("paid_at", { ascending: false });

  type Row = {
    id: string; label: string; paid_amount: number | null; amount: number; refunded_amount: number | null; paid_at: string;
    payment_schedules: { client_id: string; clients: { first_name: string; last_name: string } | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    clientId: r.payment_schedules?.client_id ?? "",
    clientName: r.payment_schedules?.clients ? `${r.payment_schedules.clients.first_name} ${r.payment_schedules.clients.last_name}` : "Client",
    label: r.label,
    amount: Number(r.paid_amount ?? r.amount) - Number(r.refunded_amount ?? 0),
    paidAt: r.paid_at,
  }));
}

export type OutstandingDetailRow = { clientId: string; clientName: string; booked: number; collected: number; outstanding: number; hasOverdue: boolean };

/**
 * Per-client breakdown of Outstanding Balance — booked/collected use the
 * exact same booked_at/paid_at window filters canonical_gross_booked_revenue()
 * and canonical_payments_collected() themselves use, so these rows sum to
 * the same total as the headline Outstanding Balance card for the same
 * range. `hasOverdue` is deliberately a separate, current-state fact (is
 * anything overdue right now) — not summed into the windowed dollar figure,
 * since "is this client currently overdue" isn't itself a windowed question.
 */
export async function getOutstandingBalanceDetail(window: DateWindow): Promise<OutstandingDetailRow[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();

  const { data: bookings } = await supabase.from("canonical_bookings").select("client_id, booked_at")
    .eq("venue_id", venue.id).gte("booked_at", window.from).lte("booked_at", window.to);
  const bookingRows = (bookings ?? []) as { client_id: string; booked_at: string }[];
  if (bookingRows.length === 0) return [];
  const clientIds = bookingRows.map((b) => b.client_id);

  const [{ data: clients }, { data: invoices }, { data: payments }, { data: overdue }] = await Promise.all([
    supabase.from("clients").select("id, first_name, last_name").in("id", clientIds),
    supabase.from("invoices").select("client_id, subtotal, discount_amount, status").eq("venue_id", venue.id).neq("status", "void").in("client_id", clientIds),
    supabase.from("payment_line_items").select("schedule_id, paid_amount, amount, refunded_amount, paid_at, payment_schedules!inner(client_id)")
      .eq("venue_id", venue.id).in("status", ["paid", "partially_refunded", "refunded"])
      .gte("paid_at", window.from).lte("paid_at", window.to + "T23:59:59"),
    supabase.from("payment_line_items").select("schedule_id, payment_schedules!inner(client_id)").eq("venue_id", venue.id).eq("status", "overdue").in("payment_schedules.client_id", clientIds),
  ]);

  const nameByClient = new Map((clients ?? []).map((c: { id: string; first_name: string; last_name: string }) => [c.id, `${c.first_name} ${c.last_name}`]));
  const bookedByClient = new Map<string, number>();
  for (const inv of (invoices ?? []) as { client_id: string; subtotal: number; discount_amount: number }[]) {
    bookedByClient.set(inv.client_id, (bookedByClient.get(inv.client_id) ?? 0) + (Number(inv.subtotal) - Number(inv.discount_amount)));
  }
  const collectedByClient = new Map<string, number>();
  for (const p of (payments ?? []) as unknown as { paid_amount: number | null; amount: number; refunded_amount: number | null; payment_schedules: { client_id: string } | null }[]) {
    const cid = p.payment_schedules?.client_id;
    if (!cid) continue;
    collectedByClient.set(cid, (collectedByClient.get(cid) ?? 0) + (Number(p.paid_amount ?? p.amount) - Number(p.refunded_amount ?? 0)));
  }
  const overdueClientIds = new Set(
    ((overdue ?? []) as unknown as { payment_schedules: { client_id: string } | null }[]).map((r) => r.payment_schedules?.client_id).filter((v): v is string => !!v),
  );

  return clientIds
    .map((cid) => {
      const booked = bookedByClient.get(cid) ?? 0;
      const collected = collectedByClient.get(cid) ?? 0;
      return {
        clientId: cid, clientName: nameByClient.get(cid) ?? "Client",
        booked, collected, outstanding: booked - collected,
        hasOverdue: overdueClientIds.has(cid),
      };
    })
    .filter((r) => r.outstanding !== 0)
    .sort((a, b) => b.outstanding - a.outstanding);
}

export type CategoryDetailRow = { clientId: string; clientName: string; amount: number };

/** Which booked clients contributed to a given Revenue Category, for the same window getGrossBookedRevenueByCategory() itself uses. */
export async function getCategoryDetail(category: string, window: DateWindow): Promise<CategoryDetailRow[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();

  const { data: bookings } = await supabase.from("canonical_bookings").select("client_id, booked_at")
    .eq("venue_id", venue.id).gte("booked_at", window.from).lte("booked_at", window.to);
  const bookedClientIds = new Set((bookings ?? []).map((b: { client_id: string }) => b.client_id));
  if (bookedClientIds.size === 0) return [];

  const { data } = await supabase
    .from("invoice_line_items")
    .select("amount, revenue_category, invoices!inner(client_id, venue_id, status, clients!inner(first_name, last_name))")
    .eq("invoices.venue_id", venue.id).neq("invoices.status", "void")
    .eq("revenue_category", category === "Uncategorized" ? null as unknown as string : category);

  type Row = { amount: number; invoices: { client_id: string; clients: { first_name: string; last_name: string } | null } | null };
  const totals = new Map<string, { name: string; amount: number }>();
  for (const row of (data ?? []) as unknown as Row[]) {
    const clientId = row.invoices?.client_id;
    if (!clientId || !bookedClientIds.has(clientId)) continue;
    const name = row.invoices?.clients ? `${row.invoices.clients.first_name} ${row.invoices.clients.last_name}` : "Client";
    const cur = totals.get(clientId) ?? { name, amount: 0 };
    cur.amount += Number(row.amount);
    totals.set(clientId, cur);
  }
  return [...totals.entries()].map(([clientId, v]) => ({ clientId, clientName: v.name, amount: v.amount })).sort((a, b) => b.amount - a.amount);
}
