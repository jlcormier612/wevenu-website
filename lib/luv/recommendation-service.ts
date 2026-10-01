import { createClient } from "@/integrations/supabase/server";
import { syncClientAskGapRecommendations } from "./ask-gap-recommendations";
import { isObservationDismissType } from "./observation-dismiss";
import { filterVisibleRecommendations } from "./recommendation-visibility";
import type { RawRecommendationRow, VenueRecommendation } from "./recommendation-types";
import {
  PHASE5_SPOT_PATTERN_TYPES,
  syncPhase5SpotPatternRecommendations,
} from "./spot-patterns";
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
 * Recently dismissed pattern rows are excluded from get_venue_recommendations
 * (correct — they must not render). We still load them so global observation
 * lists can suppress redundant individual S2/S3 / tour-no-followup cards
 * during the same 7-day cooldown.
 */
async function loadRecentlyDismissedPatternRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  types: readonly string[],
): Promise<VenueRecommendation[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("luv_recommendations")
    .select(
      "id, insight_id, type, title, body, priority, ctas, metadata, dismissed_at, completed_at, expires_at, created_at",
    )
    .in("type", [...types])
    .not("dismissed_at", "is", null)
    .gt("dismissed_at", since);
  if (error || !data) return [];
  return (data as RawRecommendationRow[]).map(mapRecommendationRow);
}

async function readPersistedVenueRecommendations(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<VenueRecommendation[]> {
  const { data, error } = await supabase.rpc("get_venue_recommendations");
  if (error || !data) return [];
  const visible = filterVisibleRecommendations(
    (data as RawRecommendationRow[])
      .filter((row) => !isObservationDismissType(row.type))
      .map(mapRecommendationRow),
  );
  const dismissedPatterns = await loadRecentlyDismissedPatternRows(supabase, [
    TOUR_FOLLOWUP_PATTERN_TYPE,
    ...PHASE5_SPOT_PATTERN_TYPES,
  ]);
  const extras = dismissedPatterns.filter(
    (rec) => !visible.some((v) => v.id === rec.id),
  );
  return extras.length > 0 ? [...visible, ...extras] : visible;
}

/**
 * READ-ONLY: persisted recommendations for surfaces that must not manufacture
 * venue-wide intelligence (Dashboard GET).
 *
 * Does not call generate_venue_recommendations or any recommendation sync.
 */
export async function readVenueRecommendations(): Promise<VenueRecommendation[]> {
  try {
    const supabase = await createClient();
    return await readPersistedVenueRecommendations(supabase);
  } catch {
    return [];
  }
}

/**
 * REFRESH then READ: generate + sync venue-wide recommendation layers, then
 * return the persisted set. Explicit caller opt-in only — never Dashboard GET.
 */
export async function refreshVenueRecommendations(): Promise<VenueRecommendation[]> {
  try {
    const supabase = await createClient();
    await supabase.rpc("generate_venue_recommendations");
    // Guide-gap layer: Couple Ask information_gap aggregates → luv_recommendations.
    await syncClientAskGapRecommendations(supabase);
    // Luv V2: venue-level recurring incomplete tour follow-up pattern.
    await syncTourFollowupPatternRecommendation(supabase);
    // Phase 5 Spot Patterns (L2 only — never Dashboard L1).
    await syncPhase5SpotPatternRecommendations(supabase);
    return await readPersistedVenueRecommendations(supabase);
  } catch {
    return [];
  }
}

/**
 * @deprecated Prefer readVenueRecommendations (Dashboard) or
 * refreshVenueRecommendations (explicit manufacture). Kept as the refresh
 * path so existing non-Dashboard callers keep current freshness behavior.
 */
export async function getVenueRecommendations(): Promise<VenueRecommendation[]> {
  return refreshVenueRecommendations();
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
