/**
 * Venue Partnerships — Program 4, Initiative C, Phase 10 (2026-07-23).
 * Every venue relationship this vendor has, plus the one thing a Partner
 * Vendor can actually edit on it: their venue-specific promotion. Server-
 * only, mirrors lib/vendor-profile/service.ts's withVendor() pattern.
 *
 * getVendorPartnerships (2026-07-24 fix) now calls the get_vendor_partnerships
 * RPC instead of a direct embedded select. The direct read
 * (`.select("...venues(name, logo_url)")`) silently returned a null nested
 * `venues` object for every row, for every vendor, 100% of the time —
 * venues' own RLS policy only recognizes current_user_venue_id()
 * (venue-staff sessions), never a vendor session, so PostgREST's embed
 * enforcement failed silently rather than erroring. That's what produced
 * "Unknown Venue" on every partnership card. Every other vendor read in
 * this codebase already avoids this exact trap by joining venues inside a
 * SECURITY DEFINER function (get_vendor_events etc.) — this brings
 * Partnerships in line with that pattern instead of leaving a second copy
 * of an already-fixed bug. See supabase/migrations/20261170000000_vendor_venue_first_dashboard.sql.
 */
import { createVendorClient as createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { applyLiveVenueBrandingUrls, versionedVenueAssetUrl } from "@/lib/venue/branding-assets";
import type { VendorActionResult, VendorActiveVenueContext, VendorPartnership } from "@/lib/vendors/types";

export async function getVendorPartnerships(): Promise<VendorPartnership[]> {
  if (!isSupabaseConfigured) return [];
  const vendorUser = await getVendorUser();
  if (!vendorUser) return [];
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_vendor_partnerships");
  if (error) return [];
  const result = data as { partnerships?: VendorPartnership[]; error?: string } | null;
  const partnerships = result?.partnerships ?? [];
  if (partnerships.length === 0) return partnerships;

  // Live venue logos (RPC already reads venues.logo_url) — version for cache
  // invalidation the same way as the couple portal / venue shell.
  const admin = createAdminClient();
  const venueIds = [...new Set(partnerships.map((p) => p.venueId).filter(Boolean))];
  const { data: venueRows } = await admin
    .from("venues")
    .select("id, updated_at")
    .in("id", venueIds);
  const updatedAtById = new Map(
    ((venueRows ?? []) as { id: string; updated_at: string }[]).map((r) => [
      r.id,
      r.updated_at,
    ]),
  );

  return partnerships.map((p) => ({
    ...p,
    venueLogoUrl: versionedVenueAssetUrl(
      p.venueLogoUrl,
      updatedAtById.get(p.venueId) ?? null,
    ),
  }));
}

// Venue-First Vendor Dashboard (2026-07-24) — the active venue's
// hero/branding, this vendor's own partnership status with it, and the
// venue's contact team, all resolved server-side in one RPC call.
// p_venue_id is omitted for the common single-venue case (resolves to the
// vendor's most recently added active relationship); passed explicitly by
// the lightweight venue switcher once a vendor has more than one.
export async function getVendorActiveVenue(venueId?: string): Promise<VendorActiveVenueContext> {
  if (!isSupabaseConfigured) return null;
  const vendorUser = await getVendorUser();
  if (!vendorUser) return null;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_vendor_active_venue", { p_venue_id: venueId ?? null });
  if (error) return null;
  const result = data as VendorActiveVenueContext | { error: string };
  if (!result || "error" in result) return null;

  const admin = createAdminClient();
  const { data: venueRow } = await admin
    .from("venues")
    .select("updated_at")
    .eq("id", result.venue.id)
    .maybeSingle<{ updated_at: string }>();

  return {
    ...result,
    venue: applyLiveVenueBrandingUrls(result.venue, venueRow?.updated_at ?? null),
  };
}

export async function updateVenuePromotion(
  relationshipId: string, headline: string, details: string,
): Promise<VendorActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const vendorUser = await getVendorUser();
  if (!vendorUser) return { ok: false, message: "No vendor account found." };
  const supabase = await createClient();

  // RLS (vendor_users_update_own_promotion) already scopes this to the
  // vendor's own relationship row; the .eq is defense-in-depth, not the
  // real gate.
  const { error } = await supabase
    .from("venue_vendor_relationships")
    .update({
      promotion_headline: headline.trim() || null,
      promotion_details: details.trim() || null,
      promotion_updated_at: new Date().toISOString(),
    })
    .eq("id", relationshipId)
    .eq("vendor_id", vendorUser.vendorId);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
