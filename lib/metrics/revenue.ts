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
import { dateInWindow, isoDateOrNull } from "@/lib/reporting/performance-dates";
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

/** Unpaid balance on issued invoices. Draft and void invoices are excluded. */
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
 * Client ids with at least one non-void invoice whose issue date is in the window.
 *
 * Matches `canonical_gross_booked_revenue`: each invoice uses `issued_at`.
 * A missing issue date is included only when the window is unbounded.
 * Event booking dates and import dates are not used.
 */
export async function listGrossBookedRevenueClientIds(window?: DateWindow): Promise<Set<string>> {
  if (!isSupabaseConfigured) return new Set();
  const venue = await getCurrentVenue();
  if (!venue) return new Set();
  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("client_id, issued_at")
    .eq("venue_id", venue.id)
    .neq("status", "void")
    .not("client_id", "is", null);
  const exclusions = await loadReportingExclusions(supabase, venue.id);
  const ids = new Set<string>();
  for (const row of (invoices ?? []) as { client_id: string | null; issued_at: string | null }[]) {
    if (!row.client_id || exclusions.clientIds.has(row.client_id)) continue;
    if (!dateInWindow(isoDateOrNull(row.issued_at), window ?? {})) continue;
    ids.add(row.client_id);
  }
  return ids;
}

/**
 * Gross Booked Revenue broken out by Revenue Category.
 * Each invoice is dated by issued_at, the same window as
 * canonical_gross_booked_revenue(), so a category breakdown matches the
 * Contracted headline for the same range. A missing issue date is included
 * only when the window is unbounded.
 */
export async function getGrossBookedRevenueByCategory(window?: DateWindow): Promise<{ category: RevenueCategory | "Uncategorized"; amount: number }[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("invoice_line_items")
    .select("amount, revenue_category, invoices!inner(client_id, venue_id, status, issued_at)")
    .eq("invoices.venue_id", venue.id)
    .neq("invoices.status", "void");

  const exclusions = await loadReportingExclusions(supabase, venue.id);

  type Row = {
    amount: number;
    revenue_category: RevenueCategory | null;
    invoices: { client_id: string | null; issued_at: string | null } | null;
  };
  const totals = new Map<string, number>();
  for (const row of (data ?? []) as unknown as Row[]) {
    const clientId = row.invoices?.client_id;
    if (!clientId || exclusions.clientIds.has(clientId)) continue;
    if (!dateInWindow(isoDateOrNull(row.invoices?.issued_at), window ?? {})) continue;
    const category = row.revenue_category ?? "Uncategorized";
    totals.set(category, (totals.get(category) ?? 0) + Number(row.amount));
  }
  return [...totals.entries()].map(([category, amount]) => ({ category: category as RevenueCategory | "Uncategorized", amount }));
}
