/**
 * Single draft-eligibility decision shared by the CTA and generateFollowUpDraft.
 * Does not invent a second purpose model — reuses evaluateCompletedTour +
 * deriveFollowUpWorkflowIntent.
 */

import {
  completedTourDraftAllowed,
  type CompletedTourDecision,
} from "@/lib/luv/completed-tour-intelligence";
import {
  deriveFollowUpWorkflowIntent,
  type FollowUpTourState,
  type FollowUpWorkflowIntent,
} from "@/lib/luv/follow-up-workflow-context";

export type FollowUpDraftEligibility = {
  eligible: boolean;
  workflowIntent: FollowUpWorkflowIntent;
  communicationPurpose: "unresolved_question" | "explicit_request" | "none";
  communicationExcerpt: string | null;
};

/**
 * Gate the "Ask Luv to draft" CTA and generateFollowUpDraft identically.
 *
 * Completed tours: only actionable evaluateCompletedTour decisions may proceed.
 * no_outreach intent → not eligible (silence).
 */
export function resolveFollowUpDraftEligibility(input: {
  tour: FollowUpTourState;
  nextActionText: string | null | undefined;
  /** Required when tour.kind === "completed"; ignored otherwise. */
  completedDecision?: CompletedTourDecision | null;
}): FollowUpDraftEligibility {
  let communicationPurpose: FollowUpDraftEligibility["communicationPurpose"] = "none";
  let communicationExcerpt: string | null = null;

  if (input.tour.kind === "completed") {
    const decision = input.completedDecision ?? { mode: "silence" as const, purpose: "none" as const };
    if (!completedTourDraftAllowed(decision)) {
      return {
        eligible: false,
        workflowIntent: "no_outreach",
        communicationPurpose: "none",
        communicationExcerpt: null,
      };
    }
    communicationPurpose = decision.purpose;
    communicationExcerpt = decision.excerpt;
  }

  const workflowIntent = deriveFollowUpWorkflowIntent({
    tour: input.tour,
    nextActionText: input.nextActionText,
    communicationPurpose,
  });

  if (workflowIntent === "no_outreach") {
    return {
      eligible: false,
      workflowIntent,
      communicationPurpose,
      communicationExcerpt,
    };
  }

  return {
    eligible: true,
    workflowIntent,
    communicationPurpose,
    communicationExcerpt,
  };
}
