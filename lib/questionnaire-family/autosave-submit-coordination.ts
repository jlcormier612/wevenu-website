/**
 * Coordinates questionnaire autosave vs explicit Submit so same-session races
 * do not surface as "updated elsewhere" conflicts.
 *
 * Legitimate concurrent-edit protection (server stale token) remains intact.
 */

export type QuestionnaireFormUiState =
  | "idle"
  | "submitting"
  | "success"
  | "already_submitted"
  | "stale";

/** Autosave stale responses must not override an in-flight or completed submit. */
export function shouldApplyAutosaveStale(
  uiState: QuestionnaireFormUiState,
): boolean {
  return uiState === "idle";
}

/**
 * Before Submit, wait for any in-flight autosave so expectedUpdatedAt matches
 * the row the server last wrote. Does not remove concurrency checks.
 */
export async function awaitPendingAutosave(
  pending: Promise<unknown> | null | undefined,
): Promise<void> {
  if (!pending) return;
  try {
    await pending;
  } catch {
    // Autosave network errors are non-fatal for submit; submit carries full payload.
  }
}
