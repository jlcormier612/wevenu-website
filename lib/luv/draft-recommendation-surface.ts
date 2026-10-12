/**
 * Align Luv Noticed draft CTAs with resolveFollowUpDraftEligibility.
 * Momentum / interest observations may still be true while completed-tour
 * silence correctly blocks drafting — never advertise a draft action then.
 */
import type { FollowUpTourState, FollowUpWorkflowIntent } from "@/lib/luv/follow-up-workflow-context";
import { LUV_FOLLOW_UP_SILENCE } from "@/lib/luv/luv-panel-copy";
import type { LuvObservation } from "@/lib/luv/types";

/** Strip draft-type recommendations when the draft gate is closed. */
export function observationsForDraftSurface(
  observations: LuvObservation[],
  draftEligible: boolean,
): LuvObservation[] {
  if (draftEligible) return observations;
  return observations.map((obs) => {
    if (obs.recommendation?.type !== "draft") return obs;
    const { recommendation: _removed, ...rest } = obs;
    return rest;
  });
}

/**
 * Accurate block copy — never invent "recent outreach" or "stage" when the
 * gate is completed-tour silence / no_outreach.
 */
export function followUpDraftBlockReason(input: {
  eligible: boolean;
  tour: FollowUpTourState;
  workflowIntent: FollowUpWorkflowIntent;
}): string | null {
  if (input.eligible) return null;
  if (input.tour.kind === "completed" || input.workflowIntent === "no_outreach") {
    return LUV_FOLLOW_UP_SILENCE;
  }
  return "Luv can’t draft a follow-up for this inquiry right now.";
}
