/**
 * Stage 1F — resolve a unique product venue for partner (vendor/client) portal access
 * when inbox items were ingested without relatedVenueId.
 */
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type PartnerVenueResolve =
  | { ok: true; venueId: string }
  | { ok: false; error: "missing_ids" | "ambiguous" | "not_found" | "no_admin" };

/** Prefer explicit venueId; otherwise unique active venue_vendor_relationships row. */
export async function resolveVenueForVendor(opts: {
  venueId?: string | null;
  vendorId?: string | null;
}): Promise<PartnerVenueResolve> {
  const explicit = opts.venueId?.trim() || null;
  if (explicit) return { ok: true, venueId: explicit };
  const vendorId = opts.vendorId?.trim() || null;
  if (!vendorId) return { ok: false, error: "missing_ids" };

  const sb = admin();
  if (!sb) return { ok: false, error: "no_admin" };

  const { data, error } = await sb
    .from("venue_vendor_relationships")
    .select("venue_id")
    .eq("vendor_id", vendorId)
    .eq("status", "active")
    .limit(5);

  if (error || !data?.length) return { ok: false, error: "not_found" };
  const unique = [...new Set(data.map((r) => String(r.venue_id)).filter(Boolean))];
  if (unique.length === 1) return { ok: true, venueId: unique[0]! };
  return { ok: false, error: "ambiguous" };
}

/** Client feedback usually carries venue; if missing, fail closed (no guess). */
export async function resolveVenueForClient(opts: {
  venueId?: string | null;
  clientId?: string | null;
}): Promise<PartnerVenueResolve> {
  const explicit = opts.venueId?.trim() || null;
  if (explicit) return { ok: true, venueId: explicit };
  // Do not invent a venue from clientId alone — multi-venue clients exist.
  void opts.clientId;
  return { ok: false, error: "missing_ids" };
}
