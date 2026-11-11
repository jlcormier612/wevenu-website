/**
 * Luv tab header copy.
 * Draft capability and proactive recommendation are independent gates.
 */
export const LUV_FOLLOW_UP_PROMISE =
  "Your venue assistant can help draft a follow-up. You review, edit, and send it yourself.";

/** Proactive empty-state / observation silence — not a drafting permission block. */
export const LUV_FOLLOW_UP_SILENCE =
  "There's nothing that needs a follow-up right now.";

/**
 * When Luv has no urgent proactive recommendation but the owner may still draft.
 */
export const LUV_FOLLOW_UP_OWNER_AVAILABLE =
  "No urgent follow-up right now. You can still ask Luv to draft a message when you want.";

export type LuvPanelDescriptionInput = {
  draftCapable: boolean;
  proactiveRecommended: boolean;
  capabilityBlockReason?: string | null;
};

export function luvPanelDescription(
  input: boolean | LuvPanelDescriptionInput,
): string {
  // Legacy boolean: treated as draftCapable with proactive assumed true when capable.
  if (typeof input === "boolean") {
    return input ? LUV_FOLLOW_UP_PROMISE : LUV_FOLLOW_UP_SILENCE;
  }
  if (!input.draftCapable) {
    return (
      input.capabilityBlockReason
      ?? "Luv can’t draft a follow-up for this inquiry right now."
    );
  }
  if (!input.proactiveRecommended) {
    return LUV_FOLLOW_UP_OWNER_AVAILABLE;
  }
  return LUV_FOLLOW_UP_PROMISE;
}
