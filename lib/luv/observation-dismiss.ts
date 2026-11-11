import type { LuvObservation } from "@/lib/luv/types";
import { isRecommendationActiveForDisplay } from "@/lib/luv/recommendation-visibility";

/** Stored on luv_recommendations.type so Guide-gap / generate rows stay distinct. */
export const OBSERVATION_DISMISS_TYPE_PREFIX = "observation:";

export function observationDismissType(observationId: string): string {
  return `${OBSERVATION_DISMISS_TYPE_PREFIX}${observationId}`;
}

export function isObservationDismissType(type: string): boolean {
  return type.startsWith(OBSERVATION_DISMISS_TYPE_PREFIX);
}

export function observationIdFromDismissType(type: string): string | null {
  if (!isObservationDismissType(type)) return null;
  return type.slice(OBSERVATION_DISMISS_TYPE_PREFIX.length);
}

export function filterVisibleObservations<T extends Pick<LuvObservation, "id">>(
  observations: readonly T[],
  dismissedIds: ReadonlySet<string>,
): T[] {
  if (dismissedIds.size === 0) return [...observations];
  return observations.filter((obs) => !dismissedIds.has(obs.id));
}

/** Same 7-day restore window as luv_recommendations.dismissed_at. */
export function isObservationDismissActive(
  dismissedAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  return !isRecommendationActiveForDisplay({ dismissedAt: dismissedAt ?? null }, nowMs);
}
