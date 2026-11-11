/**
 * Display rules for luv_recommendations — must match
 * get_venue_recommendations: hide completed rows, and hide dismissals
 * until the 7-day restore window elapses.
 */
export const RECOMMENDATION_DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export type RecommendationVisibilityFields = {
  dismissedAt?: string | null;
  completedAt?: string | null;
};

export function isRecommendationActiveForDisplay(
  rec: RecommendationVisibilityFields,
  nowMs: number = Date.now(),
): boolean {
  if (rec.completedAt) return false;
  if (!rec.dismissedAt) return true;
  const dismissedMs = Date.parse(rec.dismissedAt);
  if (Number.isNaN(dismissedMs)) return false;
  return dismissedMs <= nowMs - RECOMMENDATION_DISMISS_COOLDOWN_MS;
}

export function filterVisibleRecommendations<T extends RecommendationVisibilityFields>(
  recommendations: T[],
  nowMs: number = Date.now(),
): T[] {
  return recommendations.filter((rec) => isRecommendationActiveForDisplay(rec, nowMs));
}
