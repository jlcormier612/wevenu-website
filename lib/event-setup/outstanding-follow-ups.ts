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
  step?: SetupStepKey,
): string {
  if (decision == null && status === "needs_action") return "Decide";
  // Planning inclusion stays Included until released — Draft must not replace inclusion.
  if (decision === "set_up" && step === "planning") {
    if (status === "shared") return "Released";
    if (status === "draft" || status === "included") return "Included";
  }
  // Portal-facing content uses Released; Shared remains the readiness enum.
  if (status === "shared") return "Released";
  return readinessLabel[status];
}

/** Event-specific template/offering name for Overview — not the Setup Profile name. */
export function setupStepTemplateLabel(
  step: SetupStepKey,
  templateNames: {
    planning: string | null;
    timeline: string | null;
    inventory: string | null;
    eventOrder: string | null;
  },
  extras?: {
    clientChecklistName?: string | null;
    preferredFloorPlanName?: string | null;
  },
): string | null {
  if (step === "planning") {
    return extras?.clientChecklistName?.trim() || templateNames.planning || null;
  }
  if (step === "timeline") return templateNames.timeline;
  if (step === "inventory") return templateNames.inventory;
  if (step === "event_order") return templateNames.eventOrder;
  if (step === "floor_plans") return extras?.preferredFloorPlanName?.trim() || null;
  return null;
}
