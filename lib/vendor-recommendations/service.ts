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
  const result = await withVenue(async (c, venueId) => {
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
