/**
 * Phase 3 automatic tier-upgrade domain types.
 */

import type { OfferType, SaasPlanKey } from "./types";

export type TierUpgradeStatus =
  | "evaluated"
  | "pending_notice"
  | "notice_sent"
  | "scheduled"
  | "applied"
  | "superseded"
  | "cancelled"
  | "failed"
  | "blocked_hold"
  | "blocked_legacy"
  | "blocked_review";

export const ACTIVE_TIER_UPGRADE_STATUSES: readonly TierUpgradeStatus[] = [
  "evaluated",
  "pending_notice",
  "notice_sent",
  "scheduled",
  "blocked_hold",
  "blocked_legacy",
  "blocked_review",
  "failed",
] as const;

export const TERMINAL_TIER_UPGRADE_STATUSES: readonly TierUpgradeStatus[] = [
  "applied",
  "superseded",
  "cancelled",
] as const;

export type TierUpgradeAuditEntry = {
  at: string;
  by: string;
  action: string;
  note?: string | null;
  detail?: Record<string, unknown>;
};

export type TierUpgradeErrorEntry = {
  at: string;
  code: string;
  message: string;
  retryable: boolean;
};

export type TierUpgradeRecord = {
  id: string;
  venueId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string | null;
  currentPlanKey: SaasPlanKey;
  requiredPlanKey: SaasPlanKey;
  peakCount: number;
  peakYear: number;
  evaluationAsOf: string;
  evaluatedAt: string;
  status: TierUpgradeStatus;
  noticeWindowDays: number;
  noticeDueAt: string | null;
  noticeSentAt: string | null;
  noticeIdempotencyKey: string | null;
  /**
   * provider_accepted | simulated | failed | not_sent
   * Only provider_accepted satisfies the billing apply gate.
   */
  noticeDeliveryStatus: string | null;
  noticeProviderMessageId: string | null;
  currentPeriodEndAt: string | null;
  currentPeriodStartAt: string | null;
  scheduledEffectiveAt: string | null;
  skippedImminentRenewal: boolean;
  currentListAmountCents: number;
  requiredListAmountCents: number;
  appliedOfferType: OfferType | null;
  appliedPercentOff: number | null;
  expectedRecurringAmountCents: number;
  currentStripePriceId: string | null;
  requiredStripePriceId: string | null;
  stripeCouponId: string | null;
  stripeScheduleId: string | null;
  stripeSchedulePhaseStartAt: string | null;
  evaluationIdempotencyKey: string;
  scheduleIdempotencyKey: string | null;
  errorHistory: TierUpgradeErrorEntry[];
  audit: TierUpgradeAuditEntry[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type TierUpgradeHoldRecord = {
  id: string;
  venueId: string;
  stripeSubscriptionId: string | null;
  active: boolean;
  reason: string;
  placedBy: string;
  placedAt: string;
  expiresAt: string | null;
  releasedAt: string | null;
  releasedBy: string | null;
  releaseReason: string | null;
  audit: TierUpgradeAuditEntry[];
  createdAt: string;
  updatedAt: string;
};

/** Stripe subscription snapshot needed for timing + legacy detection (no secrets). */
export type StripeSubscriptionBillingSnapshot = {
  subscriptionId: string;
  customerId: string | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  /** Authoritative Stripe current_period_end (unix seconds) */
  currentPeriodEndUnix: number | null;
  /** Authoritative Stripe current_period_start (unix seconds) — required when skipping imminent renewal */
  currentPeriodStartUnix: number | null;
  /**
   * Optional explicit next period end from Stripe schedule / future invoice.
   * Prefer this over deriving subsequent renewal from interval arithmetic.
   */
  nextPeriodEndUnix?: number | null;
  /** Recurring subscription item price id */
  priceId: string | null;
  /** Plan key inferred from known V1 price ids, or null if legacy/unknown */
  planKey: SaasPlanKey | null;
  /** Coupon id currently applied (discounts[0].source.coupon), if any */
  couponId: string | null;
  /** Existing subscription schedule id, if any */
  scheduleId: string | null;
  /** Billing cycle anchor unix when available (must be preserved; never reset) */
  billingCycleAnchorUnix?: number | null;
};

export type TierUpgradeNoticeDraft = {
  templateId: "tier_upgrade_notice";
  subject: string;
  vars: {
    venue_name: string;
    current_plan_name: string;
    new_plan_name: string;
    effective_date: string;
    current_amount: string;
    new_amount: string;
    discount_label: string;
    peak_count: string;
    peak_year: string;
    contact_email: string;
  };
  idempotencyKey: string;
};

/** Intended Stripe Subscription Schedule mutation — never auto-executed in local Phase 3. */
export type StripeScheduleUpgradeIntent = {
  mode: "create_schedule_from_subscription" | "update_existing_schedule";
  subscriptionId: string;
  existingScheduleId: string | null;
  effectiveUnix: number;
  currentPriceId: string;
  nextPriceId: string;
  preserveCouponId: string | null;
  prorationBehavior: "none";
  endBehavior: "release";
  idempotencyKey: string;
  notes: string[];
};

/** Intent to clear an obsolete HTC-managed schedule after cancel/supersede/hold. */
export type StripeScheduleReleaseIntent = {
  mode: "release_or_cancel_schedule";
  subscriptionId: string;
  scheduleId: string;
  reason: string;
  idempotencyKey: string;
  notes: string[];
};
