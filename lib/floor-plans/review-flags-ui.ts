/**
 * Client-side coordination for Phase 5 review-flag panel refresh.
 * Room edits on cards revalidate the server tree, but the panel keeps its own
 * client list — broadcast so open reviews appear without a full remount.
 */

export const FLOOR_PLAN_REVIEW_FLAGS_CHANGED_EVENT =
  "htc:floor-plan-review-flags-changed";

export function notifyFloorPlanReviewFlagsChanged(eventId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(FLOOR_PLAN_REVIEW_FLAGS_CHANGED_EVENT, {
      detail: { eventId },
    }),
  );
}

/** Stable fingerprint so prop updates (e.g. layout room) re-trigger a fetch. */
export function floorPlanSpaceFingerprint(
  floorPlans: ReadonlyArray<{ id: string; spaceId: string | null }>,
): string {
  return floorPlans
    .map((p) => `${p.id}:${p.spaceId ?? ""}`)
    .sort()
    .join("|");
}
