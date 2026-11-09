/**
 * Phase 4 group billing reconcile — prospective, Phase 3 schedule-safe.
 *
 * Rules:
 * - Never midcycle-prorate.
 * - Never invent a second subscription.
 * - If an HTC-managed pending/scheduled tier upgrade exists, defer coupon
 *   mutation to that schedule (update expected amounts / preserveCouponId)
 *   instead of racing an independent subscription discount update.
 * - Earned Founding / Weven grants are never deleted; group eligibility is
 *   eligibility-based and may be revoked prospectively via coupon removal.
 */

import { selectBestOffer, type EligibleGrant } from "./best-offer";
import {
  FOUNDING_PERCENT_OFF,
  GROUP_PERCENT_OFF,
  WEVEN_PERCENT_OFF,
  amountAfterPercentOff,
  listAmountCents,
} from "./catalog";
import {
  resolveGroupPercentCouponId,
  resolveLaunchFoundingPercentCouponId,
  resolveWevenPercentCouponId,
} from "./readiness";
import type { OfferType, SaasPlanKey } from "./types";
import type { TierUpgradeRecord, TierUpgradeStatus } from "./tier-upgrade-types";

const SCHEDULE_OWNED_STATUSES: TierUpgradeStatus[] = [
  "pending_notice",
  "evaluated",
  "notice_sent",
  "scheduled",
];

export type GroupReconcileVenueInput = {
  venueId: string;
  organizationId: string;
  planKey: SaasPlanKey;
  stripeSubscriptionId: string | null;
  /** Earned grants for this venue (Founding / Weven / founder_override). */
  grants: EligibleGrant[];
  /** True when org currently qualifies for group (paid ≥2). */
  groupEligible: boolean;
  /** Active Phase 3 upgrade for this venue, if any. */
  pendingTierUpgrade: TierUpgradeRecord | null;
  currentStripeCouponId?: string | null;
  currentAppliedOfferType?: OfferType | null;
};

export type GroupReconcileDecision =
  | {
      action: "noop";
      reason: string;
      desiredOfferType: OfferType | null;
      expectedRecurringAmountCents: number;
    }
  | {
      action: "apply_coupon" | "remove_group_coupon" | "defer_to_schedule";
      reason: string;
      desiredOfferType: OfferType | null;
      desiredPercentOff: number;
      desiredStripeCouponId: string | null;
      expectedRecurringAmountCents: number;
      relatedTierUpgradeId: string | null;
      /** When deferring, the coupon the schedule must preserve. */
      schedulePreserveCouponId: string | null;
    };

export function couponIdForOfferType(offerType: OfferType | null): string | null {
  if (offerType === "weven_pct") return resolveWevenPercentCouponId();
  if (offerType === "founding_pct") return resolveLaunchFoundingPercentCouponId();
  if (offerType === "group_pct") return resolveGroupPercentCouponId();
  return null;
}

/**
 * Build the effective grant list for best-offer, injecting a synthetic
 * eligibility-based group grant when the organization qualifies.
 * Group is NOT a durable lifetime grant row — it tracks eligibility.
 */
export function grantsWithGroupEligibility(input: {
  grants: EligibleGrant[];
  groupEligible: boolean;
}): EligibleGrant[] {
  const base = input.grants.filter((g) => g.offerType !== "group_pct");
  if (!input.groupEligible) return base;
  return [
    ...base,
    {
      id: "group-eligibility",
      offerType: "group_pct",
      percentOff: GROUP_PERCENT_OFF,
      status: "earned",
    },
  ];
}

export function decideGroupBillingAdjustment(
  input: GroupReconcileVenueInput,
): GroupReconcileDecision {
  const grants = grantsWithGroupEligibility({
    grants: input.grants,
    groupEligible: input.groupEligible,
  });
  const best = selectBestOffer({
    listAmountCents: listAmountCents(input.planKey),
    grants,
  });

  const desiredOfferType = best.offerType;
  const desiredPercentOff = best.percentOff;
  const desiredStripeCouponId = couponIdForOfferType(desiredOfferType);
  const expectedRecurringAmountCents = best.expectedAmountCents;

  const currentOffer = input.currentAppliedOfferType ?? null;
  const currentCoupon = input.currentStripeCouponId ?? null;

  const alreadyCorrect =
    currentOffer === desiredOfferType &&
    (desiredStripeCouponId == null
      ? !currentCoupon
      : currentCoupon === desiredStripeCouponId);

  if (alreadyCorrect) {
    return {
      action: "noop",
      reason: "Subscription already reflects the best eligible offer.",
      desiredOfferType,
      expectedRecurringAmountCents,
    };
  }

  const pending = input.pendingTierUpgrade;
  const scheduleOwned =
    pending && SCHEDULE_OWNED_STATUSES.includes(pending.status);

  if (scheduleOwned && pending) {
    return {
      action: "defer_to_schedule",
      reason:
        "Active HTC Phase 3 schedule owns coupon timing — defer group coupon mutation; update schedule expected amounts.",
      desiredOfferType,
      desiredPercentOff,
      desiredStripeCouponId,
      expectedRecurringAmountCents,
      relatedTierUpgradeId: pending.id,
      schedulePreserveCouponId: desiredStripeCouponId,
    };
  }

  if (desiredOfferType === "group_pct") {
    return {
      action: "apply_coupon",
      reason: "Apply group 10% prospectively on next renewal (no midcycle proration).",
      desiredOfferType,
      desiredPercentOff,
      desiredStripeCouponId,
      expectedRecurringAmountCents,
      relatedTierUpgradeId: null,
      schedulePreserveCouponId: null,
    };
  }

  if (currentOffer === "group_pct" && desiredOfferType !== "group_pct") {
    // Removing group — either fall back to founding/weven coupon or none.
    if (desiredOfferType === "founding_pct" || desiredOfferType === "weven_pct") {
      return {
        action: "apply_coupon",
        reason:
          "Group eligibility ended; apply preserved lifetime offer prospectively.",
        desiredOfferType,
        desiredPercentOff,
        desiredStripeCouponId,
        expectedRecurringAmountCents,
        relatedTierUpgradeId: null,
        schedulePreserveCouponId: null,
      };
    }
    return {
      action: "remove_group_coupon",
      reason:
        "Group eligibility ended with no other percentage offer — remove group coupon prospectively.",
      desiredOfferType: null,
      desiredPercentOff: 0,
      desiredStripeCouponId: null,
      expectedRecurringAmountCents: listAmountCents(input.planKey),
      relatedTierUpgradeId: null,
      schedulePreserveCouponId: null,
    };
  }

  if (desiredOfferType === "founding_pct" || desiredOfferType === "weven_pct") {
    return {
      action: "apply_coupon",
      reason: `Apply ${desiredOfferType} prospectively (beats or replaces current discount).`,
      desiredOfferType,
      desiredPercentOff,
      desiredStripeCouponId,
      expectedRecurringAmountCents,
      relatedTierUpgradeId: null,
      schedulePreserveCouponId: null,
    };
  }

  return {
    action: "noop",
    reason: "No coupon change required.",
    desiredOfferType,
    expectedRecurringAmountCents,
  };
}

/** Preview recurring amount for a plan under group (and optional other grants). */
export function previewGroupRecurringAmountCents(input: {
  planKey: SaasPlanKey;
  groupEligible: boolean;
  hasFounding?: boolean;
  hasWeven?: boolean;
}): number {
  const grants: EligibleGrant[] = [];
  if (input.hasFounding) {
    grants.push({
      id: "f",
      offerType: "founding_pct",
      percentOff: FOUNDING_PERCENT_OFF,
      status: "earned",
    });
  }
  if (input.hasWeven) {
    grants.push({
      id: "w",
      offerType: "weven_pct",
      percentOff: WEVEN_PERCENT_OFF,
      status: "earned",
    });
  }
  const withGroup = grantsWithGroupEligibility({
    grants,
    groupEligible: input.groupEligible,
  });
  return selectBestOffer({
    listAmountCents: listAmountCents(input.planKey),
    grants: withGroup,
  }).expectedAmountCents;
}

export function amountAfterGroupOnly(planKey: SaasPlanKey): number {
  return amountAfterPercentOff(listAmountCents(planKey), GROUP_PERCENT_OFF);
}
