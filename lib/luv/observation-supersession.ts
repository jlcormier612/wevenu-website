/**
 * Whether an earlier Luv observation is still actionable given stronger
 * current relationship facts.
 *
 * Tour follow-up is useful while the relationship is still pre-agreement.
 * A signed contract, a received payment, or the venue's Booked decision
 * supersedes that recommendation. Proposal stage alone does not.
 *
 * Delegates to the shared relationship lifecycle resolver so dashboard
 * observations and draft eligibility cannot drift.
 */

import { salesTourFollowUpSuperseded } from "@/lib/luv/relationship-lifecycle-eligibility";

export type TourFollowUpLifecycleFacts = {
  /** Authoritative Booked — first_booked_at, not sales_stage. */
  booked: boolean;
  /** Authoritative Lost — lost_at, not sales_stage. */
  lost: boolean;
  contractSigned: boolean;
  paymentReceived: boolean;
};

export function tourFollowUpSuperseded(
  facts: TourFollowUpLifecycleFacts,
): boolean {
  return salesTourFollowUpSuperseded(facts);
}
