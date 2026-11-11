/**
 * Draft capability vs proactive outreach recommendation.
 *
 * Capability: may the owner ask Luv to draft? (permission / record eligibility)
 * Proactive: should Luv urge outreach right now? (contextual judgment)
 *
 * These must never be the same gate. A completed tour can silence proactive
 * outreach while still allowing owner-initiated drafting.
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
  /**
   * @deprecated Prefer draftCapable — kept as alias for proactive-era callers.
   * Now means draftCapable (owner may draft), not "proactive outreach recommended".
   */
  eligible: boolean;
  /** Owner may initiate a review-only draft for this lead. */
  draftCapable: boolean;
  capabilityBlockReason: string | null;
  /** Luv should proactively recommend outreach (Noticed / silence copy). */
  proactiveRecommended: boolean;
  /**
   * Intent for draft generation. When proactive is silent but owner drafts,
   * uses gentle_check_in (never no_outreach for a capable owner draft).
   */
  workflowIntent: FollowUpWorkflowIntent;
  communicationPurpose: "unresolved_question" | "explicit_request" | "none";
  communicationExcerpt: string | null;
};

export type LeadDraftCapabilityInput = {
  leadStatus?: string | null;
  salesStage?: string | null;
  lostAt?: string | null;
};

/** Hard blocks on owner drafting — never "completed tour" alone. */
export function resolveOwnerDraftCapability(input: LeadDraftCapabilityInput): {
  draftCapable: boolean;
  capabilityBlockReason: string | null;
} {
  const status = (input.leadStatus ?? "").toLowerCase();
  if (status === "lost" || input.lostAt) {
    return {
      draftCapable: false,
      capabilityBlockReason: "This inquiry is marked lost — drafting a follow-up isn’t available.",
    };
  }
  if (status === "archived") {
    return {
      draftCapable: false,
      capabilityBlockReason: "This inquiry is archived — drafting isn’t available.",
    };
  }
  return { draftCapable: true, capabilityBlockReason: null };
}

/**
 * Shared decision for CTA + generateFollowUpDraft.
 * Proactive silence (completed tour / no_outreach) does not disable drafting.
 */
export function resolveFollowUpDraftEligibility(input: {
  tour: FollowUpTourState;
  nextActionText: string | null | undefined;
  /** Required when tour.kind === "completed"; ignored otherwise. */
  completedDecision?: CompletedTourDecision | null;
  leadStatus?: string | null;
  lostAt?: string | null;
}): FollowUpDraftEligibility {
  const capability = resolveOwnerDraftCapability({
    leadStatus: input.leadStatus,
    lostAt: input.lostAt,
  });

  let communicationPurpose: FollowUpDraftEligibility["communicationPurpose"] = "none";
  let communicationExcerpt: string | null = null;

  if (input.tour.kind === "completed") {
    const decision = input.completedDecision ?? { mode: "silence" as const, purpose: "none" as const };
    if (completedTourDraftAllowed(decision)) {
      communicationPurpose = decision.purpose;
      communicationExcerpt = decision.excerpt;
    }
  }

  const proactiveIntent = deriveFollowUpWorkflowIntent({
    tour: input.tour,
    nextActionText: input.nextActionText,
    communicationPurpose,
  });
  const proactiveRecommended = proactiveIntent !== "no_outreach";

  // Owner-initiated drafts never use no_outreach — gentle_check_in with tour
  // prohibitions keeps wording honest when Luv has nothing urgent to urge.
  const workflowIntent: FollowUpWorkflowIntent = proactiveRecommended
    ? proactiveIntent
    : "gentle_check_in";

  return {
    eligible: capability.draftCapable,
    draftCapable: capability.draftCapable,
    capabilityBlockReason: capability.capabilityBlockReason,
    proactiveRecommended,
    workflowIntent,
    communicationPurpose,
    communicationExcerpt,
  };
}
