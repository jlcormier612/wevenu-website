import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/vendor-recommendations/repository";
import type { EventVendorRecommendation, RecommendationActionResult } from "@/lib/vendor-recommendations/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(fn: (c: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>): Promise<T | RecommendationActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  return fn(supabase, venue.id);
}

export async function getEventRecommendations(eventId: string): Promise<EventVendorRecommendation[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getEventRecommendations(await createClient(), venue.id, eventId);
}

export async function addRecommendation(eventId: string, vendorId: string, note: string | null): Promise<RecommendationActionResult> {
  if (!vendorId) return { ok: false, message: "Choose a vendor." };
  const result = await withVenue(async (c, venueId) => {
    // Venue-scoped only — reject cross-venue / unknown vendor ids.
    const { data: rel, error } = await c
      .from("venue_vendor_relationships")
      .select("vendor_id,status")
      .eq("venue_id", venueId)
      .eq("vendor_id", vendorId)
      .maybeSingle<{ vendor_id: string; status: string }>();
    if (error) throw error;
    if (!rel) return { ok: false, message: "That vendor is not in this venue's Vendor Network." } as RecommendationActionResult;
    if (rel.status === "inactive") {
      return { ok: false, message: "Inactive Vendor Network relationships cannot be highlighted for an event." } as RecommendationActionResult;
    }
    await repo.addRecommendation(c, venueId, eventId, vendorId, note);
    return { ok: true } as RecommendationActionResult;
  });
  return result as RecommendationActionResult;
}

export async function removeRecommendation(recommendationId: string): Promise<RecommendationActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.removeRecommendation(c, venueId, recommendationId);
    return { ok: true } as RecommendationActionResult;
  });
  return result as RecommendationActionResult;
}
