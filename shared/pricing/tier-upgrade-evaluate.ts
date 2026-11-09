/**
 * Pure Phase 3 upgrade evaluation (no Stripe / DB side effects).
 */

import { createHash } from "node:crypto";

import type { EligibleGrant } from "./best-offer";
import {
  evaluateEventVolume,
  recommendedUpgrade,
  type EventVolumeEvaluation,
  type EventVolumeInputEvent,
} from "./event-volume";
import {
  isLegacyOrUnmappedSubscriptionPrice,
  previewUpgradeAmounts,
  resolveRequiredLaunchPriceId,
} from "./tier-upgrade-pricing";
import { assessExistingSubscriptionSchedule } from "./tier-upgrade-stripe-plan";
import {
  chooseEligibleRenewal,
  DEFAULT_TIER_UPGRADE_NOTICE_DAYS,
} from "./tier-upgrade-timing";
import type {
  StripeSubscriptionBillingSnapshot,
  TierUpgradeRecord,
  TierUpgradeStatus,
} from "./tier-upgrade-types";
import type { SaasPlanKey } from "./types";

export type TierUpgradeEvaluationDecision =
  | {
      action: "none";
      reason: string;
      volume: EventVolumeEvaluation;
    }
  | {
      action: "cancel_pending";
      reason: string;
      volume: EventVolumeEvaluation;
      pendingId: string;
      /** When set, orchestrator must emit a schedule release intent */
      releaseScheduleId: string | null;
    }
  | {
      action: "block_hold";
      reason: string;
      volume: EventVolumeEvaluation;
      requiredPlan: SaasPlanKey;
      /** Cancel any previously scheduled upgrade when a hold is placed */
      cancelPendingId: string | null;
      releaseScheduleId: string | null;
    }
  | {
      action: "block_legacy";
      reason: string;
      volume: EventVolumeEvaluation;
      requiredPlan: SaasPlanKey;
    }
  | {
      action: "block_review";
      reason: string;
      volume: EventVolumeEvaluation;
      requiredPlan: SaasPlanKey;
      cancelPendingId: string | null;
      releaseScheduleId: string | null;
    }
  | {
      action: "upsert_pending";
      reason: string;
      volume: EventVolumeEvaluation;
      requiredPlan: SaasPlanKey;
      status: Extract<
        TierUpgradeStatus,
        "evaluated" | "pending_notice" | "blocked_hold" | "blocked_legacy" | "blocked_review"
      >;
      draft: Omit<
        TierUpgradeRecord,
        "id" | "createdAt" | "updatedAt" | "errorHistory" | "audit" | "metadata"
      > & {
        errorHistory?: TierUpgradeRecord["errorHistory"];
        audit?: TierUpgradeRecord["audit"];
        metadata?: TierUpgradeRecord["metadata"];
      };
    };

function civilDateFromUnix(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

export function buildEvaluationIdempotencyKey(input: {
  venueId: string;
  subscriptionId: string;
  requiredPlan: SaasPlanKey;
  peakCount: number;
  peakYear: number | null;
  effectiveUnix: number;
}): string {
  const raw = [
    input.venueId,
    input.subscriptionId,
    input.requiredPlan,
    String(input.peakCount),
    String(input.peakYear ?? "none"),
    String(input.effectiveUnix),
  ].join("|");
  return `tier-up:${createHash("sha256").update(raw).digest("hex").slice(0, 32)}`;
}

export function buildNoticeIdempotencyKey(upgradeId: string, effectiveAt: string): string {
  return `tier-up-notice:${upgradeId}:${effectiveAt.slice(0, 10)}`;
}

function releaseIdFromPending(
  pending: TierUpgradeRecord | null,
): string | null {
  return pending?.stripeScheduleId ?? null;
}

/**
 * Decide whether to create/update/cancel a pending upgrade for one venue.
 * Upgrade-only. Never schedules a downgrade.
 */
export function decideTierUpgrade(input: {
  venueId: string;
  events: EventVolumeInputEvent[];
  subscription: StripeSubscriptionBillingSnapshot;
  grants: EligibleGrant[];
  activeHold: boolean;
  existingPending: TierUpgradeRecord | null;
  nowUnix?: number;
  noticeWindowDays?: number;
}): TierUpgradeEvaluationDecision {
  const nowUnix = input.nowUnix ?? Math.floor(Date.now() / 1000);
  const asOfDate = civilDateFromUnix(nowUnix);
  const volume = evaluateEventVolume({
    events: input.events,
    asOfDate,
  });

  const currentPlan = input.subscription.planKey;
  if (!currentPlan) {
    const legacy = isLegacyOrUnmappedSubscriptionPrice({
      priceId: input.subscription.priceId,
      planKey: null,
    });
    return {
      action: "block_legacy",
      reason: legacy.reason ?? "Unknown subscription plan mapping.",
      volume,
      requiredPlan: volume.recommendedPlan,
    };
  }

  if (
    input.subscription.cancelAtPeriodEnd ||
    ["canceled", "unpaid", "incomplete_expired"].includes(input.subscription.status)
  ) {
    if (input.existingPending) {
      return {
        action: "cancel_pending",
        reason: `Subscription status ${input.subscription.status} / cancel_at_period_end — cancelling pending upgrade.`,
        volume,
        pendingId: input.existingPending.id,
        releaseScheduleId: releaseIdFromPending(input.existingPending),
      };
    }
    return {
      action: "none",
      reason: "Subscription is cancelling or inactive; no upgrade.",
      volume,
    };
  }

  const required = recommendedUpgrade({
    currentPlan,
    recommendedPlan: volume.recommendedPlan,
  });

  if (!required) {
    if (input.existingPending) {
      return {
        action: "cancel_pending",
        reason:
          "Peak volume no longer requires a higher tier before the upgrade takes effect; cancelling pending upgrade (no automatic downgrade of an already-applied tier).",
        volume,
        pendingId: input.existingPending.id,
        releaseScheduleId: releaseIdFromPending(input.existingPending),
      };
    }
    return {
      action: "none",
      reason: "Current plan already meets or exceeds required tier.",
      volume,
    };
  }

  const legacy = isLegacyOrUnmappedSubscriptionPrice({
    priceId: input.subscription.priceId,
    planKey: currentPlan,
  });
  if (legacy.legacy) {
    return {
      action: "block_legacy",
      reason: legacy.reason ?? "Legacy subscription blocked.",
      volume,
      requiredPlan: required,
    };
  }

  // Founder hold — cancel any previously scheduled Stripe change, then flag.
  if (input.activeHold) {
    return {
      action: "block_hold",
      reason: "Founder upgrade hold is active — evaluate/flag only, do not reprice.",
      volume,
      requiredPlan: required,
      cancelPendingId: input.existingPending?.id ?? null,
      releaseScheduleId: releaseIdFromPending(input.existingPending),
    };
  }

  const renewal = chooseEligibleRenewal({
    nowUnix,
    currentPeriodEndUnix: input.subscription.currentPeriodEndUnix,
    currentPeriodStartUnix: input.subscription.currentPeriodStartUnix,
    nextPeriodEndUnix: input.subscription.nextPeriodEndUnix,
    noticeWindowDays: input.noticeWindowDays ?? DEFAULT_TIER_UPGRADE_NOTICE_DAYS,
  });

  if (!renewal.ok) {
    return {
      action: "block_review",
      reason: renewal.reason,
      volume,
      requiredPlan: required,
      cancelPendingId: null,
      releaseScheduleId: null,
    };
  }

  const scheduleAssessment = assessExistingSubscriptionSchedule({
    subscription: input.subscription,
    htcScheduleId: input.existingPending?.stripeScheduleId ?? null,
  });
  if (scheduleAssessment.action === "block_review") {
    return {
      action: "block_review",
      reason: scheduleAssessment.reason,
      volume,
      requiredPlan: required,
      cancelPendingId: null,
      releaseScheduleId: null,
    };
  }

  const amounts = previewUpgradeAmounts({
    currentPlan,
    requiredPlan: required,
    grants: input.grants,
  });

  const evaluationIdempotencyKey = buildEvaluationIdempotencyKey({
    venueId: input.venueId,
    subscriptionId: input.subscription.subscriptionId,
    requiredPlan: required,
    peakCount: volume.peakCount,
    peakYear: volume.peakYear,
    effectiveUnix: renewal.effectiveUnix,
  });

  const requiredPriceId = resolveRequiredLaunchPriceId(required);
  const status: "pending_notice" = "pending_notice";
  const periodEnd = input.subscription.currentPeriodEndUnix!;
  const periodStart = input.subscription.currentPeriodStartUnix;

  return {
    action: "upsert_pending",
    reason: `Volume requires ${required}; scheduling for eligible renewal with notice.`,
    volume,
    requiredPlan: required,
    status,
    draft: {
      venueId: input.venueId,
      stripeSubscriptionId: input.subscription.subscriptionId,
      stripeCustomerId: input.subscription.customerId,
      currentPlanKey: currentPlan,
      requiredPlanKey: required,
      peakCount: volume.peakCount,
      peakYear: volume.peakYear ?? Number.parseInt(asOfDate.slice(0, 4), 10),
      evaluationAsOf: asOfDate,
      evaluatedAt: new Date(nowUnix * 1000).toISOString(),
      status,
      noticeWindowDays: input.noticeWindowDays ?? DEFAULT_TIER_UPGRADE_NOTICE_DAYS,
      noticeDueAt: renewal.noticeDueAt,
      noticeSentAt: null,
      noticeIdempotencyKey: null,
      noticeDeliveryStatus: "not_sent",
      noticeProviderMessageId: null,
      currentPeriodEndAt: new Date(periodEnd * 1000).toISOString(),
      currentPeriodStartAt:
        periodStart != null ? new Date(periodStart * 1000).toISOString() : null,
      scheduledEffectiveAt: renewal.effectiveAt,
      skippedImminentRenewal: renewal.skippedImminentRenewal,
      currentListAmountCents: amounts.currentListAmountCents,
      requiredListAmountCents: amounts.requiredListAmountCents,
      appliedOfferType: amounts.appliedOfferType,
      appliedPercentOff: amounts.appliedPercentOff,
      expectedRecurringAmountCents: amounts.expectedRecurringAmountCents,
      currentStripePriceId: input.subscription.priceId,
      requiredStripePriceId: requiredPriceId,
      stripeCouponId: input.subscription.couponId,
      stripeScheduleId:
        scheduleAssessment.action === "update_existing"
          ? scheduleAssessment.scheduleId
          : input.existingPending?.stripeScheduleId ?? null,
      stripeSchedulePhaseStartAt: null,
      evaluationIdempotencyKey,
      scheduleIdempotencyKey: `tier-up-sched:${evaluationIdempotencyKey}`,
      metadata: {
        scheduleAssessment: scheduleAssessment.action,
        billingIntervalSeconds: renewal.billingIntervalSeconds,
      },
    },
  };
}

/** When a later evaluation raises the required tier further, prefer the higher target. */
export function shouldSupersedePending(input: {
  existing: TierUpgradeRecord;
  nextRequired: SaasPlanKey;
}): boolean {
  const order: SaasPlanKey[] = ["starter", "growing", "professional"];
  return order.indexOf(input.nextRequired) > order.indexOf(input.existing.requiredPlanKey);
}
