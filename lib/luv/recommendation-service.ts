import { createClient } from "@/integrations/supabase/server";
import { syncClientAskGapRecommendations } from "./ask-gap-recommendations";
import { isObservationDismissType } from "./observation-dismiss";
import { filterVisibleRecommendations } from "./recommendation-visibility";
import type { RawRecommendationRow, VenueRecommendation } from "./recommendation-types";
import {
  TOUR_FOLLOWUP_PATTERN_TYPE,
  syncTourFollowupPatternRecommendation,
} from "./tour-followup-pattern";

function mapRecommendationRow(row: RawRecommendationRow): VenueRecommendation {
  return {
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
  };
}

/**
 * Recently dismissed tour_followup_pattern rows are excluded from
 * get_venue_recommendations (correct — they must not render). We still load
 * them here so Dashboard selection can suppress redundant individual
 * tour-no-followup observations during the same 7-day cooldown.
 */
async function loadRecentlyDismissedTourFollowupPattern(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<VenueRecommendation | null> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("luv_recommendations")
    .select(
      "id, insight_id, type, title, body, priority, ctas, metadata, dismissed_at, completed_at, expires_at, created_at",
    )
    .eq("type", TOUR_FOLLOWUP_PATTERN_TYPE)
    .not("dismissed_at", "is", null)
    .gt("dismissed_at", since)
    .maybeSingle();
  if (error || !data) return null;
  return mapRecommendationRow(data as RawRecommendationRow);
}

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
    const visible = filterVisibleRecommendations(
      (data as RawRecommendationRow[])
        .filter((row) => !isObservationDismissType(row.type))
        .map(mapRecommendationRow),
    );
    const dismissedPattern = await loadRecentlyDismissedTourFollowupPattern(supabase);
    if (
      dismissedPattern &&
      !visible.some((rec) => rec.id === dismissedPattern.id)
    ) {
      return [...visible, dismissedPattern];
    }
    return visible;
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
