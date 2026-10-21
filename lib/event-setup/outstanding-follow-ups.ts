/**
 * Event Setup "Outstanding" list — only genuine follow-up on Included areas.
 * Undecided Set up / Skip choices stay on the step rows; they are not failures
 * and must not duplicate as competing checklist items.
 *
 * Prepared Draft content (Planning awaiting release, recoverable Inventory /
 * Event Order drafts, etc.) is not outstanding — the single Release to client
 * portal action handles that. Questionnaires stay on their own schedule.
 *
 * Unavailable = genuine broken configuration. Needs action = missing required
 * configuration (for example Inventory Included with no starting offering).
 */
import type { SetupReadinessStatus } from "@/lib/event-setup/readiness-detail";
import type { SetupDecision, SetupStepKey } from "@/lib/event-setup/state";

export function isOutstandingFollowUp(
  decision: SetupDecision | null | undefined,
  status: SetupReadinessStatus,
  step?: SetupStepKey,
): boolean {
  if (decision !== "set_up") return false;
  if (step === "questionnaires") return false;
  // Draft means prepared or recoverable content — not a yellow-list blocker.
  if (status === "draft") return false;
  return status === "unavailable" || status === "needs_action";
}

/** Badge copy for undecided rows — not the same as an Included area that still needs work. */
export function setupStatusBadgeLabel(
  decision: SetupDecision | null | undefined,
  status: SetupReadinessStatus,
  readinessLabel: Record<SetupReadinessStatus, string>,
): string {
  if (decision == null && status === "needs_action") return "Decide";
  return readinessLabel[status];
}
