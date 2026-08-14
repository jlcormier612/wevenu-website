/**
 * Pure helpers for Tour Completed trigger fire rules and enrollment skip.
 * Mirrors updateTourStatus → triggerSequencesForRelationship("tour_completed").
 */

/** Fire only when status newly becomes completed (not on no-op re-writes). */
export function shouldFireTourCompletedTrigger(
  previousStatus: string,
  nextStatus: string,
): boolean {
  return nextStatus === "completed" && previousStatus !== "completed";
}

/** Existing active-enrollment uniqueness: skip insert when already active. */
export function wouldCreateTourCompletedEnrollment(
  matchingActiveSequenceIds: readonly string[],
  activelyEnrolledSequenceIds: ReadonlySet<string>,
): boolean {
  for (const id of matchingActiveSequenceIds) {
    if (!activelyEnrolledSequenceIds.has(id)) return true;
  }
  return false;
}
