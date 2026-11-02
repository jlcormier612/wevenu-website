/**
 * Couple submit → venue confirm intermediate state.
 * progress_state = in_progress without status=complete.
 */
import type { PortalTask } from "@/lib/portal/types";

/**
 * Triggers where couple submit advances progress_state to in_progress and the
 * venue still confirms before status=complete. Home demotes these from Next
 * Steps without marking the task complete.
 */
const SUBMIT_AWAITING_VENUE_TRIGGERS = new Set([
  "vendor_selected",
  "questionnaire_submitted",
  "seating_submitted",
  "timeline_submitted",
]);

/**
 * True when the couple has submitted and is waiting on the venue.
 * Does NOT treat the task as complete — venue confirm still finishes it.
 */
export function isSubmittedAwaitingVenue(
  t: Pick<PortalTask, "status" | "progressState" | "autoCompleteTrigger">,
): boolean {
  if (t.status === "complete") return false;
  if (t.progressState !== "in_progress") return false;
  const trigger = t.autoCompleteTrigger;
  if (!trigger) return false;
  return SUBMIT_AWAITING_VENUE_TRIGGERS.has(trigger);
}
