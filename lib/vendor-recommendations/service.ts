import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { networkVendorIdsToSeed } from "@/lib/vendor-recommendations/network-inheritance";
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

/**
 * Seed client-facing recommendations from the Vendor Network once per event
 * when the event has no recommendation rows yet. Does not re-add excluded
 * vendors (delete sticks). Does not mutate Network classifications or other events.
 */
export async function ensureEventRecommendationsFromNetwork(
  eventId: string,
): Promise<RecommendationActionResult & { seeded?: number; recommendations?: EventVendorRecommendation[] }> {
  const result = await withVenue(async (c, venueId) => {
    const existing = await repo.getEventRecommendations(c, venueId, eventId);
    const network = await repo.listNetworkVendorsForRecommendationSeed(c, venueId);
    const toSeed = networkVendorIdsToSeed(
      network,
      existing.map((r) => r.vendorId),
    );
    let seeded = 0;
    if (toSeed.length > 0) {
      seeded = await repo.insertRecommendationsIfMissing(c, venueId, eventId, toSeed);
    }
    const recommendations = seeded > 0
      ? await repo.getEventRecommendations(c, venueId, eventId)
      : existing;
    return { ok: true as const, seeded, recommendations };
  });
  return result as RecommendationActionResult & {
    seeded?: number;
    recommendations?: EventVendorRecommendation[];
  };
}

/** Page load / editor: seed from Network when empty, then return event rows. */
export async function getOrEnsureEventRecommendations(
  eventId: string,
): Promise<EventVendorRecommendation[]> {
  const ensured = await ensureEventRecommendationsFromNetwork(eventId);
  if (ensured.ok && ensured.recommendations) return ensured.recommendations;
  return getEventRecommendations(eventId);
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

export async function updateRecommendationNote(
  recommendationId: string,
  note: string | null,
): Promise<RecommendationActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.updateRecommendationNote(c, venueId, recommendationId, note);
    return { ok: true } as RecommendationActionResult;
  });
  return result as RecommendationActionResult;
}
