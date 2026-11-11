/**
 * Phase 4 organization + group pricing types.
 */

import type { OfferType, SaasPlanKey } from "./types";

export type OrganizationStatus = "active" | "archived";
export type OrganizationReviewStatus =
  | "none"
  | "pending_review"
  | "approved"
  | "flagged";

export type MembershipStatus =
  | "active"
  | "inactive"
  | "pending_activation"
  | "pending_review";

export type OrgAdminStatus = "active" | "revoked";

export type CheckoutReservationStatus =
  | "reserved"
  | "fulfilled"
  | "released"
  | "superseded";

export type GroupBillingAdjustmentStatus =
  | "pending"
  | "deferred_to_schedule"
  | "applied"
  | "cancelled"
  | "failed";

/** Subscription statuses that count toward group eligibility. */
export const GROUP_QUALIFYING_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  /** Transient dunning — do not immediately break the organization. */
  "past_due",
] as const;

export type GroupQualifyingSubscriptionStatus =
  (typeof GROUP_QUALIFYING_SUBSCRIPTION_STATUSES)[number];

export type SaasOrganizationRecord = {
  id: string;
  name: string;
  status: OrganizationStatus;
  reviewStatus: OrganizationReviewStatus;
  reviewNotes: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};

export type OrganizationMembershipRecord = {
  id: string;
  organizationId: string;
  venueId: string;
  status: MembershipStatus;
  role: "member" | "primary";
  effectiveFrom: string;
  effectiveTo: string | null;
  createdByUserId: string | null;
  reviewRequired: boolean;
  reviewReason: string | null;
  audit: Array<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationAdminRecord = {
  id: string;
  organizationId: string;
  userId: string | null;
  emailNormalized: string | null;
  status: OrgAdminStatus;
  canManageMembership: boolean;
  canPurchaseVenues: boolean;
  canViewBilling: boolean;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
};

export type OrgCheckoutReservationRecord = {
  id: string;
  organizationId: string;
  sourceVenueId: string | null;
  checkoutOfferId: string | null;
  stripeCheckoutSessionId: string | null;
  status: CheckoutReservationStatus;
  countsTowardEligibility: boolean;
  planKey: SaasPlanKey | null;
  expiresAt: string | null;
  fulfilledVenueId: string | null;
  fulfilledAt: string | null;
  releasedAt: string | null;
  releaseReason: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GroupEligibilitySnapshot = {
  id: string;
  organizationId: string;
  qualifyingVenueCount: number;
  reservedCheckoutCount: number;
  groupEligible: boolean;
  reason: string;
  memberVenueIds: string[];
  evaluatedAt: string;
  triggerEvent: string | null;
  metadata: Record<string, unknown>;
};

export type GroupBillingAdjustmentRecord = {
  id: string;
  organizationId: string;
  venueId: string;
  stripeSubscriptionId: string | null;
  status: GroupBillingAdjustmentStatus;
  desiredOfferType: OfferType | null;
  desiredPercentOff: number | null;
  desiredStripeCouponId: string | null;
  previousOfferType: OfferType | null;
  previousStripeCouponId: string | null;
  expectedRecurringAmountCents: number | null;
  relatedTierUpgradeId: string | null;
  idempotencyKey: string;
  errorMessage: string | null;
  appliedAt: string | null;
  audit: Array<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
};

export type VenueSubscriptionEligibilityInput = {
  venueId: string;
  membershipStatus: MembershipStatus;
  /** Authoritative SaaS subscription status; null = no valid subscription. */
  subscriptionStatus: string | null;
  cancelAtPeriodEnd?: boolean;
};
