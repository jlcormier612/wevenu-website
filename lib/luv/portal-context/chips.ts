/**
 * Ask Luv suggested chips — eligibility from the same portal snapshot used to answer.
 */

import { hasAuthoritativeNextPayment } from "@/lib/luv/portal-context/build";
import type { LuvAskPortalContext } from "@/lib/luv/portal-context/types";

export const LUV_ASK_CHIP_NEXT_PAYMENT = "When is my next payment due?";

const BASE_CHIPS = [
  "How do I sign my contract?",
  "Where do I find Documents?",
  "How do I complete Your Choices?",
  "Is there parking for guests?",
  "What's the rain plan?",
  "Can we have sparklers?",
] as const;

/**
 * Suggested chips for Ask Luv.
 * Payment due-date chip appears ONLY when the snapshot has an authoritative next payment.
 */
export function resolveLuvAskSuggestedChips(
  ctx: LuvAskPortalContext | null | undefined,
): string[] {
  const chips: string[] = [];
  if (hasAuthoritativeNextPayment(ctx)) {
    chips.push(LUV_ASK_CHIP_NEXT_PAYMENT);
  }
  chips.push(...BASE_CHIPS);
  return chips;
}
