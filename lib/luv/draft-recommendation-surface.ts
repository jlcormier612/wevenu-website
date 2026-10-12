/**
 * Align Luv Noticed observations with proactive recommendation judgment.
 * Draft capability is a separate gate — never reuse proactive silence as a
 * drafting permission block.
 */
import { cohereLeadObservations } from "@/lib/luv/observation-coherence";
import type { FollowUpTourState, FollowUpWorkflowIntent } from "@/lib/luv/follow-up-workflow-context";
import type { LuvObservation } from "@/lib/luv/types";

/** Copy that tells the owner to outreach while proactive recommendation is off. */
const FOLLOW_UP_URGING =
  /\b(follow(?:ing)?\s*up|check[\s-]?in|while the interest is fresh|send a warm|draft a follow-up|ask luv to draft)\b/i;

export function observationUrgesFollowUp(obs: Pick<LuvObservation, "message" | "detail" | "recommendation">): boolean {
  if (obs.recommendation?.type === "draft") return true;
  return FOLLOW_UP_URGING.test(obs.message) || FOLLOW_UP_URGING.test(obs.detail ?? "");
}

/**
 * Remove follow-up urging from detail/message when proactive outreach is off.
 * Keeps factual interest language (e.g. "showing strong interest").
 */
export function neutralizeFollowUpUrgingCopy(obs: LuvObservation): LuvObservation {
  let detail = obs.detail;
  let message = obs.message;
  if (detail && FOLLOW_UP_URGING.test(detail)) {
    // Drop urging secondary lines entirely — do not invent a replacement pitch.
    detail = undefined;
  }
  if (FOLLOW_UP_URGING.test(message)) {
    // Soften rare message-level urging without inventing a new recommendation.
    message = message.replace(FOLLOW_UP_URGING, "engaged").replace(/\s{2,}/g, " ").trim();
  }
  return { ...obs, message, detail };
}

export type DraftSurfaceOptions = {
  /**
   * When true, Luv has no proactive outreach recommendation — neutralize urging
   * and strip draft CTAs from Noticed (owner drafts via the Luv tab capability).
   */
  proactiveRecommended?: boolean;
  /** @deprecated Use proactiveRecommended === false */
  silence?: boolean;
};

/**
 * Align observations with proactive recommendation judgment + coherence.
 * - Dedupes and drops zero-value rows.
 * - When proactive is off: neutralize urging and strip draft recommendations
 *   so Noticed cannot say "strong interest / follow up" beside silence.
 * - Draft capability is unrelated — do not pass draftCapable here.
 */
export function observationsForDraftSurface(
  observations: LuvObservation[],
  /**
   * @deprecated Second arg was draftEligible. Pass proactiveRecommended via opts.
   * Boolean true = proactive on; false = proactive silence.
   */
  proactiveRecommendedOrLegacyEligible = true,
  opts?: DraftSurfaceOptions,
): LuvObservation[] {
  const proactiveRecommended = opts?.proactiveRecommended
    ?? (opts?.silence === true ? false : proactiveRecommendedOrLegacyEligible);
  return cohereLeadObservations(observations, { proactiveRecommended });
}

/**
 * Capability block copy — only when the owner truly cannot draft.
 * Completed-tour proactive silence is NOT a capability block.
 */
export function followUpDraftBlockReason(input: {
  draftCapable?: boolean;
  /** @deprecated Use draftCapable */
  eligible?: boolean;
  capabilityBlockReason?: string | null;
  tour: FollowUpTourState;
  workflowIntent: FollowUpWorkflowIntent;
}): string | null {
  const capable = input.draftCapable ?? input.eligible ?? true;
  if (capable) return null;
  if (input.capabilityBlockReason) return input.capabilityBlockReason;
  return "Luv can’t draft a follow-up for this inquiry right now.";
}

/** True when Luv should not urge proactive outreach (completed-tour silence etc.). */
export function isFollowUpSilenceBlock(input: {
  proactiveRecommended?: boolean;
  /** @deprecated Prefer proactiveRecommended */
  eligible?: boolean;
  tour: FollowUpTourState;
  workflowIntent: FollowUpWorkflowIntent;
}): boolean {
  if (typeof input.proactiveRecommended === "boolean") {
    return !input.proactiveRecommended;
  }
  // Legacy: eligible false + completed/no_outreach meant silence.
  if (input.eligible === false) {
    return input.tour.kind === "completed" || input.workflowIntent === "no_outreach";
  }
  return input.tour.kind === "completed" && input.workflowIntent === "no_outreach";
}
