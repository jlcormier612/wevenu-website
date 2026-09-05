/**
 * Phase 2A — Attribution metrics (coverage, tours/bookings/revenue by source, time-to-book).
 * Uses frozen acquisition_source — never operational leads.source edits.
 */
import { resolveDeterministicClientAcquisitionSource, resolveDeterministicFinancialAcquisitionSource } from "@/lib/attribution/resolve-client";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { listLifecycleBookingsInPeriod } from "@/lib/lifecycle-bookings/service";
import { getCanonicalBookings } from "@/lib/metrics/booking";
import { getCurrentVenue } from "@/lib/venue/service";
import {
  computeSourceCoverage,
  groupCountsByReportingSource,
  median,
  reportingSourceDisplayLabel,
  reportingSourceGroupKey,
  timeToBookDays,
  type SourceCoverage,
  UNKNOWN_SOURCE_KEY,
} from "@/lib/attribution/source";

export type DateWindow = { from?: string; to?: string };

export type SourceCountRow = { key: string; label: string; count: number };

export type SourceMoneyRow = { key: string; label: string; amount: number };

export { resolveDeterministicClientAcquisitionSource, resolveDeterministicFinancialAcquisitionSource };

function emptyCoverage(): SourceCoverage {
  return { known: 0, total: 0, percent: 0 };
}

/** Lead source coverage: leads created in window, using frozen acquisition_source. */
export async function getLeadSourceCoverage(window: { from: string; to: string }): Promise<SourceCoverage> {
  if (!isSupabaseConfigured) return emptyCoverage();
  const venue = await getCurrentVenue();
  if (!venue) return emptyCoverage();
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("acquisition_source")
    .eq("venue_id", venue.id)
    .gte("created_at", `${window.from}T00:00:00.000Z`)
    .lte("created_at", `${window.to}T23:59:59.999Z`);
  return computeSourceCoverage(
    ((data ?? []) as { acquisition_source: string | null }[]).map((r) => r.acquisition_source),
  );
}

/** Lifecycle Booking source coverage: first_booked in window via stamped acquisition_source. */
export async function getLifecycleBookingSourceCoverage(window?: DateWindow): Promise<SourceCoverage> {
  if (!isSupabaseConfigured) return emptyCoverage();
  const venue = await getCurrentVenue();
  if (!venue) return emptyCoverage();
  const supabase = await createClient();
  const rows = await listLifecycleBookingsInPeriod(supabase, venue.id, {
    from: window?.from,
    to: window?.to,
  });
  return computeSourceCoverage(rows.map((r) => r.acquisitionSource));
}

/**
 * Tours by source — period activity by tour_appointments.scheduled_at.
 * Source from lead.acquisition_source only; no inference from the appointment.
 */
export async function getToursByAcquisitionSource(window?: DateWindow): Promise<SourceCountRow[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();

  let q = supabase
    .from("tour_appointments")
    .select("id, lead_id, leads(acquisition_source)")
    .eq("venue_id", venue.id);
  if (window?.from) q = q.gte("scheduled_at", `${window.from}T00:00:00.000Z`);
  if (window?.to) q = q.lte("scheduled_at", `${window.to}T23:59:59.999Z`);
  const { data } = await q;

  type Row = {
    id: string;
    lead_id: string | null;
    leads: { acquisition_source: string | null } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  return groupCountsByReportingSource(
    rows.map((r) => ({
      source: r.lead_id ? r.leads?.acquisition_source ?? null : null,
    })),
  );
}

/** Lifecycle first bookings in window grouped by frozen acquisition source. */
export async function getLifecycleBookingsByAcquisitionSource(window?: DateWindow): Promise<SourceCountRow[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const rows = await listLifecycleBookingsInPeriod(supabase, venue.id, {
    from: window?.from,
    to: window?.to,
  });
  return groupCountsByReportingSource(rows.map((r) => ({ source: r.acquisitionSource })));
}

/**
 * Gross Booked Revenue by acquisition source — Financially Committed window (booked_at).
 * Per invoice: event→client→lead.acquisition_source when event_id set; else client→lead.
 * Multi-event clients with one originating lead remain attributed (schema: one lead_id).
 * Leadless / missing acquisition_source → Unknown. Not lifecycle Booking revenue.
 */
export async function getGrossBookedRevenueByAcquisitionSource(
  window?: DateWindow,
): Promise<SourceMoneyRow[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();

  const bookings = await getCanonicalBookings(window);
  if (bookings.length === 0) return [];

  const clientIds = [...new Set(bookings.map((b) => b.clientId))];

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, client_id, event_id, subtotal, discount_amount, status")
    .eq("venue_id", venue.id)
    .neq("status", "void")
    .in("client_id", clientIds);

  type Inv = {
    id: string;
    client_id: string | null;
    event_id: string | null;
    subtotal: number | null;
    discount_amount: number | null;
  };
  const invRows = (invoices ?? []) as Inv[];
  const bookedSet = new Set(clientIds);
  const attributable = invRows.filter((inv) => inv.client_id && bookedSet.has(inv.client_id));

  const sourceByInv = await resolveDeterministicFinancialAcquisitionSource(
    supabase,
    venue.id,
    attributable.map((inv) => ({
      id: inv.id,
      clientId: inv.client_id,
      eventId: inv.event_id,
    })),
  );

  const totals = new Map<string, number>();
  for (const inv of attributable) {
    const raw = sourceByInv.get(inv.id) ?? null;
    const key = reportingSourceGroupKey(raw);
    const amount = Number(inv.subtotal ?? 0) - Number(inv.discount_amount ?? 0);
    totals.set(key, (totals.get(key) ?? 0) + amount);
  }

  return [...totals.entries()]
    .map(([key, amount]) => ({
      key,
      label: reportingSourceDisplayLabel(key === UNKNOWN_SOURCE_KEY ? null : key),
      amount,
    }))
    .sort((a, b) => {
      if (a.key === UNKNOWN_SOURCE_KEY) return 1;
      if (b.key === UNKNOWN_SOURCE_KEY) return -1;
      return b.amount - a.amount;
    });
}

/**
 * Payments Collected by acquisition source — windowed by paid_at.
 * Schedule event_id / client_id → frozen lead acquisition_source.
 */
export async function getPaymentsCollectedByAcquisitionSource(
  window?: DateWindow,
): Promise<SourceMoneyRow[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();

  let payQ = supabase
    .from("payment_line_items")
    .select("id, amount, paid_amount, refunded_amount, status, paid_at, schedule_id")
    .eq("venue_id", venue.id)
    .in("status", ["paid", "partially_refunded", "refunded"]);
  if (window?.from) payQ = payQ.gte("paid_at", `${window.from}T00:00:00.000Z`);
  if (window?.to) payQ = payQ.lte("paid_at", `${window.to}T23:59:59.999Z`);
  const { data: payments } = await payQ;
  type Pay = {
    id: string;
    amount: number;
    paid_amount: number | null;
    refunded_amount: number | null;
    schedule_id: string;
  };
  const payRows = (payments ?? []) as Pay[];
  if (payRows.length === 0) return [];

  const scheduleIds = [...new Set(payRows.map((p) => p.schedule_id))];
  const { data: schedules } = await supabase
    .from("payment_schedules")
    .select("id, client_id, event_id")
    .eq("venue_id", venue.id)
    .in("id", scheduleIds);

  type Sch = { id: string; client_id: string | null; event_id: string | null };
  const schById = new Map(((schedules ?? []) as Sch[]).map((s) => [s.id, s]));

  const sourceBySchedule = await resolveDeterministicFinancialAcquisitionSource(
    supabase,
    venue.id,
    [...schById.values()].map((s) => ({
      id: s.id,
      clientId: s.client_id,
      eventId: s.event_id,
    })),
  );

  const totals = new Map<string, number>();
  for (const p of payRows) {
    const raw = sourceBySchedule.get(p.schedule_id) ?? null;
    const key = reportingSourceGroupKey(raw);
    const amount = Number(p.paid_amount ?? p.amount) - Number(p.refunded_amount ?? 0);
    totals.set(key, (totals.get(key) ?? 0) + amount);
  }

  return [...totals.entries()]
    .map(([key, amount]) => ({
      key,
      label: reportingSourceDisplayLabel(key === UNKNOWN_SOURCE_KEY ? null : key),
      amount,
    }))
    .sort((a, b) => {
      if (a.key === UNKNOWN_SOURCE_KEY) return 1;
      if (b.key === UNKNOWN_SOURCE_KEY) return -1;
      return b.amount - a.amount;
    });
}

/**
 * Median days lead.created_at → first lifecycle booking (occurred_at) for
 * lead-linked first_booked rows in the window. Excludes incalculable rows.
 */
export async function getMedianTimeToBookDays(window?: DateWindow): Promise<{
  medianDays: number | null;
  sampleSize: number;
}> {
  if (!isSupabaseConfigured) return { medianDays: null, sampleSize: 0 };
  const venue = await getCurrentVenue();
  if (!venue) return { medianDays: null, sampleSize: 0 };
  const supabase = await createClient();
  const bookings = await listLifecycleBookingsInPeriod(supabase, venue.id, {
    from: window?.from,
    to: window?.to,
  });
  const leadIds = [...new Set(bookings.map((b) => b.leadId).filter((v): v is string => !!v))];
  if (leadIds.length === 0) return { medianDays: null, sampleSize: 0 };

  const { data: leads } = await supabase
    .from("leads")
    .select("id, created_at")
    .eq("venue_id", venue.id)
    .in("id", leadIds);
  const createdById = new Map(
    ((leads ?? []) as { id: string; created_at: string }[]).map((l) => [l.id, l.created_at]),
  );

  const days: number[] = [];
  for (const b of bookings) {
    if (!b.leadId) continue;
    const d = timeToBookDays(createdById.get(b.leadId), b.occurredAt);
    if (d != null) days.push(d);
  }
  return { medianDays: median(days), sampleSize: days.length };
}
