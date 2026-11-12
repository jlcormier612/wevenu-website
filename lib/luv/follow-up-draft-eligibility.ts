/**
 * Draft capability vs proactive outreach recommendation.
 *
 * Capability: may the owner ask Luv to draft? (permission / record eligibility)
 * Proactive: should Luv urge outreach right now? (contextual judgment)
 *
 * These must never be the same gate. A completed tour can silence proactive
 * outreach while still allowing owner-initiated drafting — unless the
 * relationship lifecycle has commercially superseded sales follow-ups.
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
import {
  isIntentEligibleForLifecycle,
  resolveRelationshipLifecycle,
  type RelationshipLifecycleFacts,
} from "@/lib/luv/relationship-lifecycle-eligibility";

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
  /** Lifecycle snapshot for audit / draft context. */
  lifecycle?: ReturnType<typeof resolveRelationshipLifecycle>;
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
 * Proactive silence (completed tour / no_outreach) does not disable drafting
 * unless relationship lifecycle has superseded sales follow-ups.
 */
export function resolveFollowUpDraftEligibility(input: {
  tour: FollowUpTourState;
  nextActionText: string | null | undefined;
  /** Required when tour.kind === "completed"; ignored otherwise. */
  completedDecision?: CompletedTourDecision | null;
  leadStatus?: string | null;
  lostAt?: string | null;
  /** Authoritative commercial / booking facts — not sales_stage. */
  lifecycleFacts?: RelationshipLifecycleFacts | null;
}): FollowUpDraftEligibility {
  const capability = resolveOwnerDraftCapability({
    leadStatus: input.leadStatus,
    lostAt: input.lostAt,
  });

  const lifecycle = resolveRelationshipLifecycle({
    leadStatus: input.leadStatus,
    lostAt: input.lostAt,
    ...(input.lifecycleFacts ?? {}),
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

  // Commercial commitment / Booked / lost supersede proactive sales outreach.
  const lifecycleAllowsProactive = lifecycle.salesFollowUpAllowed
    || proactiveIntent === "answer_questions";
  const proactiveRecommended =
    proactiveIntent !== "no_outreach" && lifecycleAllowsProactive;

  // Owner-initiated drafts never use no_outreach — gentle_check_in with tour
  // prohibitions keeps wording honest when Luv has nothing urgent to urge.
  let workflowIntent: FollowUpWorkflowIntent = proactiveRecommended
    ? proactiveIntent
    : "gentle_check_in";

  if (communicationPurpose !== "none" && proactiveIntent === "answer_questions") {
    workflowIntent = "answer_questions";
  }

  // Sales follow-up generation is blocked when lifecycle supersedes — including
  // owner-initiated gentle_check_in. Purpose-built answer_questions remains.
  let draftCapable = capability.draftCapable;
  let capabilityBlockReason = capability.capabilityBlockReason;

  if (draftCapable && !isIntentEligibleForLifecycle(workflowIntent, lifecycle)) {
    draftCapable = false;
    capabilityBlockReason =
      lifecycle.salesFollowUpBlockReason
      ?? "A sales follow-up isn’t appropriate for this relationship right now.";
  }

  // Owner-capable + proactive silence → gentle_check_in for wording honesty.
  // Lifecycle-blocked drafts keep the blocked intent out of generation.
  if (draftCapable && !proactiveRecommended && workflowIntent !== "answer_questions") {
    workflowIntent = "gentle_check_in";
  }

  return {
    eligible: draftCapable,
    draftCapable,
    capabilityBlockReason,
    proactiveRecommended,
    workflowIntent,
    communicationPurpose,
    communicationExcerpt,
    lifecycle,
  };
}
