import { createClient } from "@/integrations/supabase/server";
import { syncClientAskGapRecommendations } from "./ask-gap-recommendations";
import { isObservationDismissType } from "./observation-dismiss";
import { filterVisibleRecommendations } from "./recommendation-visibility";
import type { RawRecommendationRow, VenueRecommendation } from "./recommendation-types";
import { syncTourFollowupPatternRecommendation } from "./tour-followup-pattern";

export async function getVenueRecommendations(): Promise<VenueRecommendation[]> {
  try {
    const supabase = await createClient();
    await supabase.rpc("generate_venue_recommendations");
    // Guide-gap layer: Couple Ask information_gap aggregates → luv_recommendations.
    // Classification + published client Guide coverage run in app code; RPC writes.
    await syncClientAskGapRecommendations(supabase);
    // Luv V2: venue-level recurring incomplete tour follow-up pattern.
    await syncTourFollowupPatternRecommendation(supabase);
    const { data, error } = await supabase.rpc("get_venue_recommendations");
    if (error || !data) return [];
    return filterVisibleRecommendations(
      (data as RawRecommendationRow[])
        .filter((row) => !isObservationDismissType(row.type))
        .map(row => ({
        id:          row.id,
        insightId:   row.insight_id,
        type:        row.type,
        title:       row.title,
        body:        row.body,
        priority:    row.priority,
        ctas:        row.ctas        ?? [],
        metadata:    row.metadata    ?? {},
        dismissedAt: row.dismissed_at,
        completedAt: row.completed_at,
        expiresAt:   row.expires_at,
        createdAt:   row.created_at,
      })),
    );
  } catch {
    return [];
  }
}

/** Observation ids dismissed in the last 7 days for the active venue. */
export async function getDismissedObservationIds(): Promise<Set<string>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("list_dismissed_luv_observation_ids");
    if (error || !data) return new Set();
    return new Set(data as string[]);
  } catch {
    return new Set();
  }
}
