/**
 * Event Documents content model — which questionnaire statuses are real
 * event records (returned answers), versus outbound workflow state.
 *
 * Sent / in_progress belong on the Questionnaires tab, not Documents.
 */
const RETURNED = new Set([
  "submitted",
  "resubmitted",
  "complete",
  "changes_requested",
  // Legacy synonym retired in migration but may still appear on old rows.
  "reviewed",
]);

export function isReturnedQuestionnaireDocumentStatus(
  status: string | null | undefined,
): boolean {
  if (!status) return false;
  return RETURNED.has(status);
}
