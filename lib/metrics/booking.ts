/**
 * Reporting — Financially Committed read layer.
 *
 * `canonical_bookings` = signed contract AND lowest-sort-order payment line
 * paid. This is NOT Lifecycle Booking (see lib/metrics/lifecycle-booking.ts).
 *
 * booked_at on this view = later of signed_at and deposit-proxy paid_at —
 * distinct from leads.first_booked_at and events.booked_at.
 */

import { createClient } from "@/integrations/supabase/server";
import { reportingSourceGroupKey } from "@/lib/attribution/source";
import { resolveDeterministicClientAcquisitionSource } from "@/lib/attribution/resolve-client";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

export type CanonicalBooking = {
  clientId: string;
  contractId: string;
  signedAt: string;
  depositPaidAt: string | null;
  bookedAt: string;
};

type BookingRow = {
  client_id: string; contract_id: string; signed_at: string;
  deposit_paid_at: string | null; booked_at: string;
};

function mapBooking(r: BookingRow): CanonicalBooking {
  return {
    clientId: r.client_id, contractId: r.contract_id, signedAt: r.signed_at,
    depositPaidAt: r.deposit_paid_at, bookedAt: r.booked_at,
  };
}

/** Every canonical Booking for the current venue, optionally windowed by booked_at. */
export async function getCanonicalBookings(opts?: { from?: string; to?: string }): Promise<CanonicalBooking[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();

  let query = supabase.from("canonical_bookings").select("*").eq("venue_id", venue.id);
  if (opts?.from) query = query.gte("booked_at", opts.from);
  if (opts?.to) query = query.lte("booked_at", opts.to);
  const { data } = await query;
  return ((data ?? []) as BookingRow[]).map(mapBooking);
}

/** Bookings whose booked_at falls in the current calendar month. */
export async function getBookingsThisMonth(): Promise<CanonicalBooking[]> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return getCanonicalBookings({ from });
}

/** Bookings whose booked_at falls in the current calendar year. */
export async function getBookingsThisYear(): Promise<CanonicalBooking[]> {
  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1).toISOString();
  return getCanonicalBookings({ from });
}

/**
 * Financially Committed clients grouped by frozen acquisition source.
 * Prefer lib/metrics/attribution.ts for Reporting; kept for legacy callers.
 * Multi-event clients → unknown (no invented allocation).
 */
export async function getBookingsByLeadSource(): Promise<{ source: string; count: number }[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();

  const { data: bookings } = await supabase.from("canonical_bookings").select("client_id").eq("venue_id", venue.id);
  const clientIds = [...new Set((bookings ?? []).map((b: { client_id: string }) => b.client_id))];
  if (clientIds.length === 0) return [];

  const sourceByClient = await resolveDeterministicClientAcquisitionSource(supabase, venue.id, clientIds);

  const counts = new Map<string, number>();
  for (const id of clientIds) {
    const source = reportingSourceGroupKey(sourceByClient.get(id) ?? null);
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return [...counts.entries()].map(([source, count]) => ({ source, count }));
}

/**
 * "Bookings by Coordinator" (§2) — NOT IMPLEMENTED. No structured field
 * anywhere associates a Client/Lead/Event with a responsible staff member;
 * the only near-miss is `tour_appointments.assigned_to`, a free-text
 * "coordinator name or initials" column with no referential integrity to
 * `venue_staff` — not a reliable source for a canonical metric requiring
 * one formula, one source of truth. Per the brief's own final rule
 * ("if implementing any metric requires changing these approved business
 * definitions, stop immediately and explain why"): implementing this
 * would require either inventing a coordinator-assignment schema (a real
 * product feature decision, out of scope for a reporting-metric phase) or
 * silently trusting unreliable free text. Registered in
 * `lib/metrics/registry.ts` as `canonical_pending`, not implemented here.
 */
export function getBookingsByCoordinator(): never {
  throw new Error(
    "Bookings by Coordinator is not implemented — no structured coordinator-assignment field exists on Lead/Client/Event. See lib/metrics/registry.ts.",
  );
}

/**
 * "Booking Forecast" (§2) — NOT IMPLEMENTED. The brief gives an explicit
 * formula for every other Booking metric except this one; inventing a
 * forecasting methodology (linear projection? pipeline-weighted? seasonal?)
 * would be inventing a new metric, which §"Do not invent new metrics"
 * forbids. Registered as `canonical_pending` pending a product decision on
 * methodology.
 */
export function getBookingForecast(): never {
  throw new Error(
    "Booking Forecast is not implemented — no forecasting methodology was specified in the certified definitions. See lib/metrics/registry.ts.",
  );
}
