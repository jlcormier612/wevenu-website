/**
 * Book-time / session-bound ensure — uses the caller's supabase client
 * (inherit path) rather than getCurrentVenue().
 */
import type { createClient } from "@/integrations/supabase/server";

import { networkVendorIdsToSeed } from "@/lib/vendor-recommendations/network-inheritance";
import * as repo from "@/lib/vendor-recommendations/repository";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export async function ensureEventRecommendationsFromNetworkForVenue(
  client: DbClient,
  venueId: string,
  eventId: string,
): Promise<{ seeded: number }> {
  const existing = await repo.getEventRecommendations(client, venueId, eventId);
  const network = await repo.listNetworkVendorsForRecommendationSeed(client, venueId);
  const toSeed = networkVendorIdsToSeed(
    network,
    existing.map((r) => r.vendorId),
  );
  if (toSeed.length === 0) return { seeded: 0 };
  const seeded = await repo.insertRecommendationsIfMissing(client, venueId, eventId, toSeed);
  return { seeded };
}
