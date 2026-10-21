/**
 * Event Setup "Outstanding" list — only genuine follow-up on Included areas.
 * Undecided Set up / Skip choices stay on the step rows; they are not failures
 * and must not duplicate as competing checklist items.
 *
 * Questionnaires are never outstanding for portal settle — they stay on their
 * own schedule. Event Order drafts are prepared content; sharing is separate
 * and does not block Prepare and release portal.
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
  if (step === "event_order" && status === "draft") return false;
  return status === "draft" || status === "unavailable" || status === "needs_action";
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
