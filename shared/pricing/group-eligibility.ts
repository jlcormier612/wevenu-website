/**
 * Phase 4 group pricing eligibility — pure rules.
 *
 * Spaces / rooms within one venue never count as additional properties.
 * Membership must be explicit. Email / Stripe Customer matching never qualifies.
 */

import {
  GROUP_QUALIFYING_SUBSCRIPTION_STATUSES,
  type GroupQualifyingSubscriptionStatus,
  type MembershipStatus,
  type OrgCheckoutReservationRecord,
  type VenueSubscriptionEligibilityInput,
} from "./group-types";

export function isGroupQualifyingSubscriptionStatus(
  status: string | null | undefined,
): status is GroupQualifyingSubscriptionStatus {
  if (!status) return false;
  return (GROUP_QUALIFYING_SUBSCRIPTION_STATUSES as readonly string[]).includes(
    status,
  );
}

/**
 * A venue counts toward organization group eligibility when:
 * - membership is active (or pending_activation only after paid? — paid activation
 *   uses active; pending_activation alone does NOT count until subscription is live)
 * - SaaS subscription status is qualifying (active / trialing / past_due)
 *
 * pending_review memberships never count (founder review gate for ambiguous dupes).
 */
export function venueCountsTowardGroupEligibility(
  input: VenueSubscriptionEligibilityInput,
): boolean {
  if (input.membershipStatus !== "active") return false;
  return isGroupQualifyingSubscriptionStatus(input.subscriptionStatus);
}

export type GroupEligibilityEvaluation = {
  qualifyingVenueCount: number;
  reservedCheckoutCount: number;
  /** Effective count used for Checkout coupon selection (includes reserved). */
  effectiveCountForCheckout: number;
  groupEligible: boolean;
  /** True when Checkout may attach group 10% (includes reserved second seat). */
  groupEligibleForCheckout: boolean;
  qualifyingVenueIds: string[];
  reason: string;
};

export function evaluateGroupEligibility(input: {
  members: VenueSubscriptionEligibilityInput[];
  reservations?: OrgCheckoutReservationRecord[];
  nowIso?: string;
}): GroupEligibilityEvaluation {
  const now = input.nowIso ?? new Date().toISOString();
  const qualifying = input.members.filter(venueCountsTowardGroupEligibility);
  const qualifyingVenueIds = qualifying.map((m) => m.venueId);

  const activeReservations = (input.reservations ?? []).filter((r) => {
    if (r.status !== "reserved" || !r.countsTowardEligibility) return false;
    if (r.expiresAt && r.expiresAt < now) return false;
    return true;
  });

  const qualifyingVenueCount = qualifying.length;
  const reservedCheckoutCount = activeReservations.length;
  const effectiveCountForCheckout =
    qualifyingVenueCount + reservedCheckoutCount;

  const groupEligible = qualifyingVenueCount >= 2;
  const groupEligibleForCheckout = effectiveCountForCheckout >= 2;

  let reason: string;
  if (groupEligible) {
    reason = `Organization has ${qualifyingVenueCount} qualifying active subscriptions — group 10% eligible.`;
  } else if (groupEligibleForCheckout) {
    reason = `Checkout reservation bridges to group eligibility (${qualifyingVenueCount} paid + ${reservedCheckoutCount} reserved).`;
  } else if (qualifyingVenueCount === 1) {
    reason =
      "Single qualifying venue — group pricing not yet available (need a second property).";
  } else {
    reason = "No qualifying venue subscriptions for group pricing.";
  }

  return {
    qualifyingVenueCount,
    reservedCheckoutCount,
    effectiveCountForCheckout,
    groupEligible,
    groupEligibleForCheckout,
    qualifyingVenueIds,
    reason,
  };
}

/**
 * Ambiguous Add Another Venue cases that should queue founder review
 * without blocking legitimate operators by default.
 */
export function shouldRequireMembershipReview(input: {
  /** Normalized proposed venue name. */
  proposedVenueNameNormalized: string;
  existingMemberVenueNamesNormalized: string[];
  /** Same Stripe customer as an existing member (signal only). */
  sharesStripeCustomerWithMember?: boolean;
}): { reviewRequired: boolean; reason: string | null } {
  const proposed = input.proposedVenueNameNormalized.trim().toLowerCase();
  if (!proposed) {
    return { reviewRequired: false, reason: null };
  }
  const collision = input.existingMemberVenueNamesNormalized.some(
    (n) => n.trim().toLowerCase() === proposed,
  );
  if (collision) {
    return {
      reviewRequired: true,
      reason:
        "Proposed property name matches an existing member venue — founder review before group eligibility.",
    };
  }
  // Shared Stripe Customer alone is NOT sufficient to block; it is a soft signal.
  if (input.sharesStripeCustomerWithMember) {
    return {
      reviewRequired: false,
      reason: null,
    };
  }
  return { reviewRequired: false, reason: null };
}

export function membershipIsBillableOrgLink(
  status: MembershipStatus,
): boolean {
  return (
    status === "active" ||
    status === "pending_activation" ||
    status === "pending_review"
  );
}
