/**
 * Phase 6 — Refer a Venue types.
 * Workflow status is informational; reward eligibility is durable and separate.
 */

import type { SaasPlanKey } from "./types";

export type ReferralWorkflowStatus =
  | "submitted"
  | "under_review"
  | "contacted"
  | "interested"
  | "converted"
  | "qualification_pending"
  | "reward_eligible"
  | "reward_issued"
  | "closed_not_eligible"
  | "closed_duplicate"
  | "closed_declined";

export type ReferralAttributionMatchMethod =
  | "website_domain"
  | "business_identity"
  | "founder_confirmed"
  | "enrollment_association";

export type ReferralAttributionStatus =
  | "proposed"
  | "confirmed"
  | "rejected"
  | "superseded";

export type ReferralRewardStatus =
  | "pending_qualification"
  | "eligible"
  | "approved"
  | "issuing"
  | "issued"
  | "applied"
  | "failed"
  | "reversed"
  | "voided";

export type ReferralActivityKind =
  | "note"
  | "status_change"
  | "assignment"
  | "attribution"
  | "qualification"
  | "reward"
  | "exception";

/** Customer-facing sanitized statuses (never expose founder notes). */
export type CustomerReferralStatus =
  | "referral_received"
  | "reviewing"
  | "venue_joined"
  | "credit_pending"
  | "credit_earned"
  | "credit_applied"
  | "closed";

export type VenueReferralRecord = {
  id: string;
  referringVenueId: string;
  referringOrganizationId: string | null;
  submittedByUserId: string | null;
  submittedByEmail: string | null;
  referredVenueName: string;
  referredCity: string;
  referredState: string;
  referredWebsite: string;
  referredWebsiteDomain: string;
  referredContactEmail: string;
  referredContactName: string;
  referredContactRole: string | null;
  notes: string | null;
  status: ReferralWorkflowStatus;
  assignedOwnerEmail: string | null;
  linkedRelationshipId: string | null;
  linkedVenueId: string | null;
  isSelfReferral: boolean;
  isSameOrganization: boolean;
  isExistingPayingCustomer: boolean;
  isDuplicateClaim: boolean;
  blockedReason: string | null;
  programPolicyVersion: string;
  qualificationDays: number;
  audit: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type VenueReferralDraft = {
  referringVenueId: string;
  referringOrganizationId?: string | null;
  submittedByUserId?: string | null;
  submittedByEmail?: string | null;
  referredVenueName: string;
  referredCity: string;
  referredState: string;
  referredWebsite: string;
  referredWebsiteDomain: string;
  referredContactEmail: string;
  referredContactName: string;
  referredContactRole?: string | null;
  notes?: string | null;
  programPolicyVersion: string;
  qualificationDays: number;
  isSelfReferral?: boolean;
  isSameOrganization?: boolean;
  isExistingPayingCustomer?: boolean;
  isDuplicateClaim?: boolean;
  blockedReason?: string | null;
  status?: ReferralWorkflowStatus;
  metadata?: Record<string, unknown>;
};

export type ReferralAttributionRecord = {
  id: string;
  referralId: string;
  referredVenueId: string;
  referredStripeSubscriptionId: string | null;
  referredStripeCustomerId: string | null;
  matchMethod: ReferralAttributionMatchMethod;
  matchEvidence: Record<string, unknown>;
  confirmedByEmail: string | null;
  confirmedAt: string | null;
  convertedAt: string | null;
  firstPaidInvoiceId: string | null;
  firstPaidInvoiceAt: string | null;
  qualificationStartsAt: string | null;
  qualificationEndsAt: string | null;
  status: ReferralAttributionStatus;
  rejectionReason: string | null;
  idempotencyKey: string;
  audit: Array<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
};

export type ReferralRewardRecord = {
  id: string;
  referralId: string;
  attributionId: string;
  referringVenueId: string;
  referringStripeSubscriptionId: string;
  referringStripeCustomerId: string;
  referredVenueId: string;
  qualifyingInvoiceId: string | null;
  eligibilityAt: string | null;
  rewardAmountCents: number;
  currency: string;
  valuationAt: string;
  valuationPlanKey: SaasPlanKey | null;
  valuationListAmountCents: number | null;
  valuationSource: string | null;
  valuationSnapshot: Record<string, unknown>;
  status: ReferralRewardStatus;
  approvedByEmail: string | null;
  approvedAt: string | null;
  approvalNotes: string | null;
  rejectedByEmail: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  stripeInvoiceItemId: string | null;
  stripeCreditIdempotencyKey: string | null;
  issuedAt: string | null;
  appliedInvoiceId: string | null;
  appliedAt: string | null;
  lastError: string | null;
  retryCount: number;
  audit: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ReferralActivityRecord = {
  id: string;
  referralId: string;
  actorEmail: string;
  kind: ReferralActivityKind;
  body: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ReferralValuationSnapshot = {
  amountCents: number;
  currency: string;
  planKey: SaasPlanKey | null;
  listAmountCents: number | null;
  source: string;
  snapshot: Record<string, unknown>;
  valuedAt: string;
};
