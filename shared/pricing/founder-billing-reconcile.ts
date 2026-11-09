/**
 * Phase 5 founder billing reconcile — dollar best-offer + Phase 3 schedule-safe.
 */

import type { EligibleGrant } from "./best-offer";
import {
  amountForFounderArrangement,
  isFinancialKind,
  resolveBaseListAmountCents,
  selectWinningCommercialPrice,
} from "./founder-arrange";
import type {
  CommercialCandidate,
  FounderArrangementRecord,
} from "./founder-types";
import {
  couponIdForOfferType,
} from "./group-billing-reconcile";
import type { SaasPlanKey } from "./types";
import type { TierUpgradeRecord, TierUpgradeStatus } from "./tier-upgrade-types";

const SCHEDULE_OWNED_STATUSES: TierUpgradeStatus[] = [
  "pending_notice",
  "evaluated",
  "notice_sent",
  "scheduled",
];

export type FounderReconcileVenueInput = {
  venueId: string;
  planKey: SaasPlanKey;
  stripeSubscriptionId: string;
  grants: EligibleGrant[];
  groupEligible: boolean;
  arrangements: FounderArrangementRecord[];
  pendingTierUpgrade: TierUpgradeRecord | null;
  currentStripeCouponId?: string | null;
  currentStripePriceId?: string | null;
  currentListAmountCents?: number | null;
  catalogPriceIdForPlan?: string | null;
  nowIso?: string;
};

export type FounderReconcileDecision =
  | {
      action: "noop";
      reason: string;
      winner: CommercialCandidate;
      expectedRecurringAmountCents: number;
    }
  | {
      action:
        | "apply_percent_coupon"
        | "apply_amount_coupon"
        | "apply_fixed_price"
        | "restore_catalog_price"
        | "clear_discounts"
        | "apply_earned_coupon"
        | "defer_to_schedule"
        | "tier_freeze_only";
      reason: string;
      winner: CommercialCandidate;
      expectedRecurringAmountCents: number;
      desiredStripeCouponId: string | null;
      desiredStripePriceId: string | null;
      relatedArrangementId: string | null;
      relatedTierUpgradeId: string | null;
      schedulePreserveCouponId: string | null;
      percentOff: number | null;
      amountOffCents: number | null;
    };

function earnedCouponForWinner(
  winner: CommercialCandidate,
): string | null {
  if (winner.source === "weven_pct") return couponIdForOfferType("weven_pct");
  if (winner.source === "founding_pct") {
    return couponIdForOfferType("founding_pct");
  }
  if (winner.source === "group_pct") return couponIdForOfferType("group_pct");
  return null;
}

function activeFinancialArrangement(
  arrangements: FounderArrangementRecord[],
  planKey: SaasPlanKey,
  nowIso?: string,
): FounderArrangementRecord | null {
  const now = nowIso ? Date.parse(nowIso) : Date.now();
  const list = arrangements.filter((a) => {
    if (!isFinancialKind(a.kind)) return false;
    if (a.status !== "active" && a.status !== "scheduled") return false;
    if (Date.parse(a.effectiveAt) > now) return false;
    if (a.expiresAt && Date.parse(a.expiresAt) <= now) return false;
    return true;
  });
  // Prefer fixed_rate / rate_freeze over percent/amount when selecting mechanism;
  // commercial selection already picked the winner by dollars.
  return list[0] ?? null;
}

/**
 * Decide Stripe mutation for the venue under founder + earned + group offers.
 */
export function decideFounderBillingAdjustment(
  input: FounderReconcileVenueInput,
): FounderReconcileDecision {
  const selection = selectWinningCommercialPrice({
    planKey: input.planKey,
    grants: input.grants,
    groupEligible: input.groupEligible,
    arrangements: input.arrangements,
    nowIso: input.nowIso,
  });
  const winner = selection.winner;
  const expected = winner.expectedAmountCents;

  const pending = input.pendingTierUpgrade;
  const scheduleOwned =
    pending && SCHEDULE_OWNED_STATUSES.includes(pending.status);

  const tierFreeze = input.arrangements.find(
    (a) =>
      (a.status === "active" || a.status === "scheduled") &&
      a.kind === "tier_freeze" &&
      a.preventsTierUpgrade &&
      (!a.expiresAt ||
        Date.parse(a.expiresAt) >
          (input.nowIso ? Date.parse(input.nowIso) : Date.now())),
  );

  if (winner.source === "standard") {
    const needsClearCoupon = Boolean(input.currentStripeCouponId);
    const needsRestorePrice =
      Boolean(input.catalogPriceIdForPlan) &&
      Boolean(input.currentStripePriceId) &&
      input.catalogPriceIdForPlan !== input.currentStripePriceId;

    if (!needsClearCoupon && !needsRestorePrice) {
      return {
        action: tierFreeze ? "tier_freeze_only" : "noop",
        reason: tierFreeze
          ? "Tier freeze active; catalog price already correct."
          : "Already on standard catalog pricing.",
        winner,
        expectedRecurringAmountCents: expected,
        desiredStripeCouponId: null,
        desiredStripePriceId: input.catalogPriceIdForPlan ?? null,
        relatedArrangementId: null,
        relatedTierUpgradeId: pending?.id ?? null,
        schedulePreserveCouponId: null,
        percentOff: null,
        amountOffCents: null,
      };
    }

    if (scheduleOwned && pending) {
      return {
        action: "defer_to_schedule",
        reason:
          "Phase 3 schedule owns pricing — defer restore of standard catalog.",
        winner,
        expectedRecurringAmountCents: expected,
        desiredStripeCouponId: null,
        desiredStripePriceId: input.catalogPriceIdForPlan ?? null,
        relatedArrangementId: null,
        relatedTierUpgradeId: pending.id,
        schedulePreserveCouponId: null,
        percentOff: null,
        amountOffCents: null,
      };
    }

    if (needsRestorePrice) {
      return {
        action: "restore_catalog_price",
        reason: "Restore Launch V1 catalog Price after founder fixed-rate ended.",
        winner,
        expectedRecurringAmountCents: expected,
        desiredStripeCouponId: null,
        desiredStripePriceId: input.catalogPriceIdForPlan ?? null,
        relatedArrangementId: null,
        relatedTierUpgradeId: null,
        schedulePreserveCouponId: null,
        percentOff: null,
        amountOffCents: null,
      };
    }

    return {
      action: "clear_discounts",
      reason: "Clear Stripe discounts; resume standard catalog amount.",
      winner,
      expectedRecurringAmountCents: expected,
      desiredStripeCouponId: null,
      desiredStripePriceId: null,
      relatedArrangementId: null,
      relatedTierUpgradeId: null,
      schedulePreserveCouponId: null,
      percentOff: null,
      amountOffCents: null,
    };
  }

  if (
    winner.source === "weven_pct" ||
    winner.source === "founding_pct" ||
    winner.source === "group_pct"
  ) {
    const coupon = earnedCouponForWinner(winner);
    if (input.currentStripeCouponId === coupon) {
      return {
        action: "noop",
        reason: `Already applying ${winner.source}.`,
        winner,
        expectedRecurringAmountCents: expected,
      };
    }
    if (scheduleOwned && pending) {
      return {
        action: "defer_to_schedule",
        reason: "Phase 3 schedule owns coupon timing — preserve earned/group offer.",
        winner,
        expectedRecurringAmountCents: expected,
        desiredStripeCouponId: coupon,
        desiredStripePriceId: input.catalogPriceIdForPlan ?? null,
        relatedArrangementId: null,
        relatedTierUpgradeId: pending.id,
        schedulePreserveCouponId: coupon,
        percentOff: winner.percentOff ?? null,
        amountOffCents: null,
      };
    }
    return {
      action: "apply_earned_coupon",
      reason: `Apply best earned/group offer (${winner.source}).`,
      winner,
      expectedRecurringAmountCents: expected,
      desiredStripeCouponId: coupon,
      desiredStripePriceId: input.catalogPriceIdForPlan ?? null,
      relatedArrangementId: null,
      relatedTierUpgradeId: null,
      schedulePreserveCouponId: null,
      percentOff: winner.percentOff ?? null,
      amountOffCents: null,
    };
  }

  // Founder override wins
  const arrangement =
    input.arrangements.find((a) => a.id === winner.arrangementId) ??
    activeFinancialArrangement(
      input.arrangements,
      input.planKey,
      input.nowIso,
    );

  if (!arrangement) {
    return {
      action: "noop",
      reason: "Founder winner without arrangement row — no mutation.",
      winner,
      expectedRecurringAmountCents: expected,
    };
  }

  if (scheduleOwned && pending) {
    return {
      action: "defer_to_schedule",
      reason:
        "Phase 3 schedule owns pricing — defer founder Stripe mutation; update schedule expected amounts.",
      winner,
      expectedRecurringAmountCents: expected,
      desiredStripeCouponId: arrangement.stripeCouponId,
      desiredStripePriceId: arrangement.stripePriceId,
      relatedArrangementId: arrangement.id,
      relatedTierUpgradeId: pending.id,
      schedulePreserveCouponId: arrangement.stripeCouponId,
      percentOff: arrangement.percentOff,
      amountOffCents: arrangement.amountOffCents,
    };
  }

  if (arrangement.kind === "fixed_rate" || arrangement.kind === "rate_freeze") {
    const desiredPrice = arrangement.stripePriceId;
    if (
      desiredPrice &&
      input.currentStripePriceId === desiredPrice &&
      !input.currentStripeCouponId
    ) {
      return {
        action: "noop",
        reason: "Fixed/frozen Stripe Price already applied.",
        winner,
        expectedRecurringAmountCents: expected,
      };
    }
    return {
      action: "apply_fixed_price",
      reason: `Apply founder ${arrangement.kind} as distinct recurring Price.`,
      winner,
      expectedRecurringAmountCents: expected,
      desiredStripeCouponId: null,
      desiredStripePriceId: desiredPrice,
      relatedArrangementId: arrangement.id,
      relatedTierUpgradeId: null,
      schedulePreserveCouponId: null,
      percentOff: null,
      amountOffCents: null,
    };
  }

  if (arrangement.kind === "percent_off") {
    if (
      arrangement.stripeCouponId &&
      input.currentStripeCouponId === arrangement.stripeCouponId
    ) {
      return {
        action: "noop",
        reason: "Founder percent coupon already applied.",
        winner,
        expectedRecurringAmountCents: expected,
      };
    }
    return {
      action: "apply_percent_coupon",
      reason: `Apply founder ${arrangement.percentOff}% coupon.`,
      winner,
      expectedRecurringAmountCents: expected,
      desiredStripeCouponId: arrangement.stripeCouponId,
      desiredStripePriceId: input.catalogPriceIdForPlan ?? null,
      relatedArrangementId: arrangement.id,
      relatedTierUpgradeId: null,
      schedulePreserveCouponId: null,
      percentOff: arrangement.percentOff,
      amountOffCents: null,
    };
  }

  if (arrangement.kind === "amount_off") {
    if (
      arrangement.stripeCouponId &&
      input.currentStripeCouponId === arrangement.stripeCouponId
    ) {
      return {
        action: "noop",
        reason: "Founder amount-off coupon already applied.",
        winner,
        expectedRecurringAmountCents: expected,
      };
    }
    return {
      action: "apply_amount_coupon",
      reason: `Apply founder $${((arrangement.amountOffCents ?? 0) / 100).toFixed(0)} off coupon.`,
      winner,
      expectedRecurringAmountCents: expected,
      desiredStripeCouponId: arrangement.stripeCouponId,
      desiredStripePriceId: input.catalogPriceIdForPlan ?? null,
      relatedArrangementId: arrangement.id,
      relatedTierUpgradeId: null,
      schedulePreserveCouponId: null,
      percentOff: null,
      amountOffCents: arrangement.amountOffCents,
    };
  }

  return {
    action: "noop",
    reason: "No founder billing mutation required.",
    winner,
    expectedRecurringAmountCents: expected,
  };
}

/** Customer-facing label for the winning commercial source. */
export function customerFacingOfferLabel(
  winner: CommercialCandidate,
): string {
  switch (winner.source) {
    case "weven_pct":
      return "Former Weven pricing";
    case "founding_pct":
      return "Founding Member pricing";
    case "group_pct":
      return "Multi-venue group pricing";
    case "founder_override":
      return winner.label || "Special pricing";
    default:
      return "Standard pricing";
  }
}

export function projectedAmountForPlanWithArrangements(input: {
  planKey: SaasPlanKey;
  grants: EligibleGrant[];
  groupEligible: boolean;
  arrangements: FounderArrangementRecord[];
}): number {
  return selectWinningCommercialPrice(input).winner.expectedAmountCents;
}

export function amountUnderArrangementAgainstBase(
  arrangement: FounderArrangementRecord,
  planKey: SaasPlanKey,
  arrangements: FounderArrangementRecord[],
): number | null {
  const base = resolveBaseListAmountCents({ planKey, arrangements });
  return amountForFounderArrangement(arrangement, base);
}
