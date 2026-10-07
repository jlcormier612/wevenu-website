/**
 * Luv tab header copy. Eligibility stays in resolveFollowUpDraftEligibility.
 * This only chooses the sentence the header is allowed to promise.
 */
export const LUV_FOLLOW_UP_PROMISE =
  "Your venue assistant can help draft a follow-up. You review, edit, and send it yourself.";

export const LUV_FOLLOW_UP_SILENCE =
  "There's nothing that needs a follow-up right now.";

export function luvPanelDescription(followUpDraftEligible: boolean): string {
  return followUpDraftEligible ? LUV_FOLLOW_UP_PROMISE : LUV_FOLLOW_UP_SILENCE;
}
