/**
 * Align Luv Noticed draft CTAs with resolveFollowUpDraftEligibility.
 * Momentum / interest observations may still be factually true while
 * completed-tour silence correctly blocks drafting — never urge follow-up
 * or advertise a draft action that the Luv panel cannot perform.
 */
import type { FollowUpTourState, FollowUpWorkflowIntent } from "@/lib/luv/follow-up-workflow-context";
import { LUV_FOLLOW_UP_SILENCE } from "@/lib/luv/luv-panel-copy";
import type { LuvObservation } from "@/lib/luv/types";

/** Copy that tells the owner to outreach while drafting is blocked. */
const FOLLOW_UP_URGING =
  /\b(follow(?:ing)?\s*up|check[\s-]?in|while the interest is fresh|send a warm|draft a follow-up|ask luv to draft)\b/i;

export function observationUrgesFollowUp(obs: Pick<LuvObservation, "message" | "detail" | "recommendation">): boolean {
  if (obs.recommendation?.type === "draft") return true;
  return FOLLOW_UP_URGING.test(obs.message) || FOLLOW_UP_URGING.test(obs.detail ?? "");
}

/**
 * Remove follow-up urging from detail/message when drafting is closed.
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
   * Completed-tour / no_outreach silence — Noticed must not contradict the
   * Luv tab's "nothing that needs a follow-up" state.
   */
  silence?: boolean;
};

/**
 * Align observations with the draft gate.
 * - Keeps draft recommendations when ineligible so the panel can render the
 *   accurate ineligible reason (same-record path).
 * - Neutralizes follow-up-urging copy when the gate is closed.
 */
export function observationsForDraftSurface(
  observations: LuvObservation[],
  draftEligible: boolean,
  opts?: DraftSurfaceOptions,
): LuvObservation[] {
  if (draftEligible) return observations;
  // `silence` is reserved for callers documenting completed-tour / no_outreach;
  // neutralization applies for any closed draft gate so Noticed never urges
  // follow-up the Luv panel cannot perform.
  void opts?.silence;
  return observations.map((obs) => {
    const wasDraft = obs.recommendation?.type === "draft";
    if (!wasDraft && !observationUrgesFollowUp(obs)) return obs;
    // Neutralize urging copy; keep draft recommendations so the panel can
    // render the accurate server ineligible reason instead of a dead draft
    // button, a Link, or contradictory urging.
    return neutralizeFollowUpUrgingCopy(obs);
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

export function isFollowUpSilenceBlock(input: {
  eligible: boolean;
  tour: FollowUpTourState;
  workflowIntent: FollowUpWorkflowIntent;
}): boolean {
  if (input.eligible) return false;
  return input.tour.kind === "completed" || input.workflowIntent === "no_outreach";
}
