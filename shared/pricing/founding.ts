/**
 * Soft Founding Member milestone — promotional target of 100 earned venues.
 *
 * Issuance for *new* Checkout Sessions uses earned count < capacity.
 * Once an offer is issued on a Session, it is honored for that Session's life
 * regardless of later completions that push earned count to/above capacity.
 */

import { getFounderProgramCapacity } from "../relationships/founder-program";
import { FOUNDING_PERCENT_OFF } from "./catalog";

export { FOUNDING_PERCENT_OFF };

export type FoundingIssuanceDecision = {
  issueFounding: boolean;
  earnedCount: number;
  capacity: number;
  reason:
    | "issued_under_milestone"
    | "milestone_reached"
    | "program_inactive"
    | "venue_already_earned";
};

/**
 * Decide whether a *new* Checkout may receive the Founding offer.
 * Does not reserve capacity. Concurrent issuances near the milestone may
 * produce a small overage of earned members — by design.
 */
export function decideFoundingIssuance(input: {
  earnedFoundingVenueCount: number;
  programActive?: boolean;
  capacity?: number;
  /** When this venue already holds an earned founding grant, do not re-issue. */
  venueAlreadyEarned?: boolean;
}): FoundingIssuanceDecision {
  const capacity = input.capacity ?? getFounderProgramCapacity();
  const earnedCount = Math.max(0, input.earnedFoundingVenueCount);
  const programActive = input.programActive !== false;

  if (input.venueAlreadyEarned) {
    return {
      issueFounding: false,
      earnedCount,
      capacity,
      reason: "venue_already_earned",
    };
  }

  if (!programActive) {
    return {
      issueFounding: false,
      earnedCount,
      capacity,
      reason: "program_inactive",
    };
  }

  if (earnedCount >= capacity) {
    return {
      issueFounding: false,
      earnedCount,
      capacity,
      reason: "milestone_reached",
    };
  }

  return {
    issueFounding: true,
    earnedCount,
    capacity,
    reason: "issued_under_milestone",
  };
}

/**
 * Display remaining for marketing — never negative.
 * Soft milestone: actual earned may later exceed capacity; remaining stays 0.
 */
export function foundingSpotsRemainingForDisplay(
  earnedFoundingVenueCount: number,
  capacity: number = getFounderProgramCapacity(),
): number {
  return Math.max(0, capacity - Math.max(0, earnedFoundingVenueCount));
}

/**
 * Whether the paid customer's founding discount must be honored.
 * Depends only on the issued offer — never rechecks the milestone.
 */
export function shouldHonorIssuedFoundingOffer(offer: {
  foundingIssued: boolean;
}): boolean {
  return offer.foundingIssued === true;
}

/**
 * Expected discounted recurring amount for reconciliation (cents).
 */
export function expectedFoundingInvoiceCents(listAmountCents: number): number {
  return Math.round(listAmountCents * (1 - FOUNDING_PERCENT_OFF / 100));
}
