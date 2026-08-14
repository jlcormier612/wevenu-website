/**
 * Pure helpers for "would this stage move create a new Automation enrollment?"
 * Mirrors triggerSequencesForRelationship's decision: active sequences for
 * lead_stage_changed + destination stage, skipping any sequence where the
 * relationship already has an active enrollment.
 */

/** True when at least one matching active sequence would create a new enrollment. */
export function wouldCreateEnrollmentForSequences(
  matchingActiveSequenceIds: readonly string[],
  activelyEnrolledSequenceIds: ReadonlySet<string>,
): boolean {
  for (const id of matchingActiveSequenceIds) {
    if (!activelyEnrolledSequenceIds.has(id)) return true;
  }
  return false;
}

/**
 * Pre-commit gate for Pipeline stage moves.
 * - No enrollment would occur → commit immediately (no friction).
 * - Enrollment would occur and user has not answered → show confirmation.
 * - Continue → commit; Cancel → abort (lead stays put).
 */
export function resolveStageMoveConfirmGate(
  wouldEnroll: boolean,
  userChoice: "continue" | "cancel" | null,
): "commit" | "show_confirm" | "abort" {
  if (!wouldEnroll) return "commit";
  if (userChoice === null) return "show_confirm";
  if (userChoice === "continue") return "commit";
  return "abort";
}
