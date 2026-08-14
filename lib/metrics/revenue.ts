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
 * Gross Booked Revenue broken out by Revenue Category, for booked clients
 * only. Best-effort: rows backfilled with no confident signal (see the
 * migration's own comment) will show under whichever category the backfill
 * assigned, most commonly "Other." Work Package R1 — optional date window,
 * filtered on booked_at (the exact same field/semantic
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

  // The embed above only proves the invoice exists; still need to filter
  // to booked clients specifically — done as a second, explicit pass
  // rather than a harder-to-verify nested-embed filter, matching this
  // codebase's own documented preference for flat fetch + JS aggregation
  // over untested embedded-relationship filtering (lib/playbooks/
  // repository.ts's own precedent).
  let bookingsQuery = supabase.from("canonical_bookings").select("client_id, booked_at").eq("venue_id", venue.id);
  if (window?.from) bookingsQuery = bookingsQuery.gte("booked_at", window.from);
  if (window?.to) bookingsQuery = bookingsQuery.lte("booked_at", window.to);
  const { data: bookings } = await bookingsQuery;
  const bookedClientIds = new Set((bookings ?? []).map((b: { client_id: string }) => b.client_id));

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
