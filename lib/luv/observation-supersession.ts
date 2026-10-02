/**
 * Whether an earlier Luv observation is still actionable given stronger
 * current relationship facts.
 *
 * Tour follow-up is useful while the relationship is still pre-agreement.
 * A signed contract, a received payment, or the venue's Booked decision
 * supersedes that recommendation. Proposal stage alone does not.
 */

export type TourFollowUpLifecycleFacts = {
  salesStage: string | null;
  contractSigned: boolean;
  paymentReceived: boolean;
};

export function tourFollowUpSuperseded(
  facts: TourFollowUpLifecycleFacts,
): boolean {
  if (facts.salesStage === "booked" || facts.salesStage === "lost") return true;
  if (facts.contractSigned) return true;
  if (facts.paymentReceived) return true;
  return false;
}
