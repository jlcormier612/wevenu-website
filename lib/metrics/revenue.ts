/**
 * Reporting & Analytics — Canonical Metric Implementation.
 *
 * Canonical Revenue family (§3 of the brief). "Revenue" alone is not a
 * metric name here, per the brief's own instruction — every export below
 * is one of the four named replacements. Each wraps a `security definer`
 * SQL function that derives its venue from the caller's own session via
 * `current_user_venue_id()` — never accepts a venue id as a parameter (see
 * that migration's own comment for why: a caller-supplied venue id on a
 * security-definer function would bypass RLS entirely).
 */

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { loadReportingExclusions } from "@/lib/reporting/business-scope";
import { getCurrentVenue } from "@/lib/venue/service";

export type DateWindow = { from?: string; to?: string };

async function callNumericRpc(fn: string, window?: DateWindow): Promise<number | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, {
    p_from: window?.from ?? null,
    p_to: window?.to ?? null,
  });
  if (error) return null;
  return data === null ? null : Number(data);
}

/** Total contracted value of booked events — excludes taxes, refunds, and outstanding-balance status. */
export async function getGrossBookedRevenue(window?: DateWindow): Promise<number | null> {
  return callNumericRpc("canonical_gross_booked_revenue", window);
}

/** Money successfully received — not invoiced, not contracted, actually paid, net of refunds. */
export async function getPaymentsCollected(window?: DateWindow): Promise<number | null> {
  return callNumericRpc("canonical_payments_collected", window);
}

/** Gross Booked Revenue minus Payments Collected — derived, not independently summed. */
export async function getOutstandingBalance(window?: DateWindow): Promise<number | null> {
  return callNumericRpc("canonical_outstanding_balance", window);
}

/** Gross Booked Revenue divided by Bookings. Also listed under the Booking family (§2) — one implementation, cross-referenced from both. */
export async function getAverageBookingValue(window?: DateWindow): Promise<number | null> {
  return callNumericRpc("canonical_average_booking_value", window);
}

/** The 11 certified Revenue Categories — a reporting dimension on invoice_line_items, not a separate revenue definition (§3). */
export const REVENUE_CATEGORIES = [
  "Venue Rental", "Packages", "Inventory", "Food & Beverage", "Alcohol",
  "Venue Services", "Venue Vendors", "Service Charges", "Discounts",
  "Taxes", "Other",
] as const;
export type RevenueCategory = (typeof REVENUE_CATEGORIES)[number];

/**
 * Client ids in the Gross Booked Revenue (Contracted) population for a window.
 *
 * Matches `canonical_gross_booked_revenue`: first non-cancelled `events.booked_at`
 * per client (NOT `canonical_bookings.booked_at`, which is financially-committed
 * signed+deposit and can select a different cohort for the same calendar range).
 */
export async function listGrossBookedRevenueClientIds(window?: DateWindow): Promise<Set<string>> {
  if (!isSupabaseConfigured) return new Set();
  const venue = await getCurrentVenue();
  if (!venue) return new Set();
  const supabase = await createClient();

  let eventsQuery = supabase
    .from("events")
    .select("client_id, booked_at")
    .eq("venue_id", venue.id)
    .not("booked_at", "is", null)
    .neq("status", "cancelled")
    .not("client_id", "is", null);
  if (window?.from) eventsQuery = eventsQuery.gte("booked_at", window.from);
  if (window?.to) eventsQuery = eventsQuery.lte("booked_at", `${window.to}T23:59:59.999Z`);
  const { data: events } = await eventsQuery;
  const exclusions = await loadReportingExclusions(supabase, venue.id);

  // First booked_at per client (ascending) — same distinct-on semantics as the RPC.
  const firstByClient = new Map<string, string>();
  for (const row of (events ?? []) as { client_id: string; booked_at: string }[]) {
    if (!row.client_id || exclusions.clientIds.has(row.client_id)) continue;
    const prev = firstByClient.get(row.client_id);
    if (!prev || row.booked_at < prev) firstByClient.set(row.client_id, row.booked_at);
  }
  return new Set(firstByClient.keys());
}

/**
 * Gross Booked Revenue broken out by Revenue Category, for booked clients
 * only. Best-effort: rows backfilled with no confident signal (see the
 * migration's own comment) will show under whichever category the backfill
 * assigned, most commonly "Other." Work Package R1 — optional date window,
 * filtered on events.booked_at (the exact same field/semantic
 * canonical_gross_booked_revenue() itself windows on), so a report's
 * category breakdown always matches its own headline Gross Booked Revenue
 * number for the same range.
 */
export async function getGrossBookedRevenueByCategory(window?: DateWindow): Promise<{ category: RevenueCategory | "Uncategorized"; amount: number }[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("invoice_line_items")
    .select("amount, revenue_category, invoices!inner(client_id, venue_id, status)")
    .eq("invoices.venue_id", venue.id)
    .neq("invoices.status", "void");

  const bookedClientIds = await listGrossBookedRevenueClientIds(window);

  type Row = { amount: number; revenue_category: RevenueCategory | null; invoices: { client_id: string | null } | null };
  const totals = new Map<string, number>();
  for (const row of (data ?? []) as unknown as Row[]) {
    const clientId = row.invoices?.client_id;
    if (!clientId || !bookedClientIds.has(clientId)) continue;
    const category = row.revenue_category ?? "Uncategorized";
    totals.set(category, (totals.get(category) ?? 0) + Number(row.amount));
  }
  return [...totals.entries()].map(([category, amount]) => ({ category: category as RevenueCategory | "Uncategorized", amount }));
}
