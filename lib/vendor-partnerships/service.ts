/**
 * Venue Partnerships — Program 4, Initiative C, Phase 10 (2026-07-23).
 * Every venue relationship this vendor has, plus the one thing a Partner
 * Vendor can actually edit on it: their venue-specific promotion. Server-
 * only, mirrors lib/vendor-profile/service.ts's withVendor() pattern.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getVendorUser } from "@/lib/vendor-auth/service";
import type { VendorActionResult, VendorPartnership } from "@/lib/vendors/types";

export async function getVendorPartnerships(): Promise<VendorPartnership[]> {
  if (!isSupabaseConfigured) return [];
  const vendorUser = await getVendorUser();
  if (!vendorUser) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("venue_vendor_relationships")
    .select("id, venue_id, status, preference_level, added_at, promotion_headline, promotion_details, venues(name, logo_url)")
    .eq("vendor_id", vendorUser.vendorId)
    .neq("status", "removed")
    .order("added_at", { ascending: false });

  type Row = {
    id: string; venue_id: string; status: string; preference_level: string; added_at: string;
    promotion_headline: string | null; promotion_details: string | null;
    venues: { name: string; logo_url: string | null } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return [];

  const { data: assignments } = await supabase
    .from("event_vendor_assignments")
    .select("venue_id")
    .eq("vendor_id", vendorUser.vendorId);
  const eventCountByVenue = new Map<string, number>();
  for (const a of (assignments ?? []) as { venue_id: string }[]) {
    eventCountByVenue.set(a.venue_id, (eventCountByVenue.get(a.venue_id) ?? 0) + 1);
  }

  return rows.map((r) => ({
    id: r.id,
    venueId: r.venue_id,
    venueName: r.venues?.name ?? "Unknown Venue",
    venueLogoUrl: r.venues?.logo_url ?? null,
    status: r.status,
    preferenceLevel: r.preference_level,
    addedAt: r.added_at,
    promotionHeadline: r.promotion_headline,
    promotionDetails: r.promotion_details,
    activeEventCount: eventCountByVenue.get(r.venue_id) ?? 0,
  }));
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
