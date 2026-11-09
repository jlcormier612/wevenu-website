/**
 * Discount-preserving list/expected amounts for Phase 3 tier upgrades.
 */

import {
  amountAfterPercentOff,
  getCatalogEntry,
  listAmountCents,
} from "./catalog";
import { selectBestOffer, type EligibleGrant } from "./best-offer";
import type { OfferType, SaasPlanKey } from "./types";
import {
  resolveLaunchCelebratePriceId,
  resolveLaunchFlourishPriceId,
  resolveLaunchGatherPriceId,
  resolveLaunchFoundingPercentCouponId,
  resolveWevenPercentCouponId,
} from "./readiness";

export type TierUpgradeAmountPreview = {
  currentListAmountCents: number;
  requiredListAmountCents: number;
  appliedOfferType: OfferType | null;
  appliedPercentOff: number | null;
  expectedRecurringAmountCents: number;
  currentPlanName: string;
  requiredPlanName: string;
  discountLabel: string;
};

export function previewUpgradeAmounts(input: {
  currentPlan: SaasPlanKey;
  requiredPlan: SaasPlanKey;
  grants: EligibleGrant[];
}): TierUpgradeAmountPreview {
  const currentList = listAmountCents(input.currentPlan);
  const requiredList = listAmountCents(input.requiredPlan);
  const best = selectBestOffer({
    listAmountCents: requiredList,
    grants: input.grants,
  });
  const discountLabel =
    best.offerType === "weven_pct"
      ? "Former Weven 20% lifetime discount"
      : best.offerType === "founding_pct"
        ? "Founding Member 10% lifetime discount"
        : best.offerType
          ? `${best.offerType} ${best.percentOff}%`
          : "No promotional discount";

  return {
    currentListAmountCents: currentList,
    requiredListAmountCents: requiredList,
    appliedOfferType: best.offerType,
    appliedPercentOff: best.percentOff > 0 ? best.percentOff : null,
    expectedRecurringAmountCents: best.expectedAmountCents,
    currentPlanName: getCatalogEntry(input.currentPlan).name,
    requiredPlanName: getCatalogEntry(input.requiredPlan).name,
    discountLabel,
  };
}

/** Known Launch V1 recurring Price IDs from env (Sandbox/Test). */
export function knownLaunchV1PriceIds(): Partial<Record<SaasPlanKey, string>> {
  const out: Partial<Record<SaasPlanKey, string>> = {};
  const gather = resolveLaunchGatherPriceId();
  const celebrate = resolveLaunchCelebratePriceId();
  const flourish = resolveLaunchFlourishPriceId();
  if (gather) out.starter = gather;
  if (celebrate) out.growing = celebrate;
  if (flourish) out.professional = flourish;
  return out;
}

export function planKeyFromLaunchPriceId(
  priceId: string | null | undefined,
): SaasPlanKey | null {
  if (!priceId) return null;
  const known = knownLaunchV1PriceIds();
  for (const [plan, id] of Object.entries(known) as [SaasPlanKey, string][]) {
    if (id === priceId) return plan;
  }
  return null;
}

export function resolveRequiredLaunchPriceId(
  plan: SaasPlanKey,
): string | null {
  return knownLaunchV1PriceIds()[plan] ?? null;
}

/**
 * Legacy / unsafe-to-auto-reprice detection.
 * Legacy $149 Gather and founder-specific prices are excluded.
 */
export function isLegacyOrUnmappedSubscriptionPrice(input: {
  priceId: string | null;
  planKey: SaasPlanKey | null;
}): { legacy: boolean; reason: string | null } {
  if (!input.priceId) {
    return { legacy: true, reason: "Subscription has no recurring price id." };
  }
  if (!input.planKey) {
    return {
      legacy: true,
      reason:
        "Subscription price is not a known Launch V1 Gather/Celebrate/Flourish Price — founder review required before automatic repricing.",
    };
  }
  return { legacy: false, reason: null };
}

/** Expected coupon id for the winning offer type (must match live Stripe). */
export function expectedCouponIdForOffer(
  offerType: OfferType | null,
): string | null {
  if (offerType === "weven_pct") return resolveWevenPercentCouponId();
  if (offerType === "founding_pct") return resolveLaunchFoundingPercentCouponId();
  return null;
}

export function expectedAmountForPlanAndPercent(
  plan: SaasPlanKey,
  percentOff: number,
): number {
  return amountAfterPercentOff(listAmountCents(plan), percentOff);
}
