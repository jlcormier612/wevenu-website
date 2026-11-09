/**
 * Launch V1 Checkout pricing resolution.
 * Uses standard recurring Prices + optional 10% forever Founding coupon.
 * Never selects founder-specific fixed recurring Prices or the legacy $30 coupon.
 */

import {
  FOUNDING_PERCENT_OFF,
  PRICING_VERSION_V1,
  isSaasPlanKey,
  listAmountCents,
} from "./catalog";
import { decideFoundingIssuance } from "./founding";
import {
  getPricingLaunchV1Readiness,
  type PricingLaunchReadiness,
} from "./readiness";
import type { SaasPlanKey } from "./types";

export { isSaasPlanKey };

export type LaunchCheckoutPricing = {
  plan: SaasPlanKey;
  priceId: string;
  listAmountCents: number;
  foundingIssued: boolean;
  foundingPercentOff: number | null;
  foundingCouponId: string | null;
  allowPromotionCodes: boolean;
  pricingVersion: string;
  mode: "launch_standard" | "launch_founding_percent";
  earnedFoundingCountAtIssue: number;
  issuanceReason: string;
};

export function resolveLaunchCheckoutPricing(input: {
  plan: SaasPlanKey;
  earnedFoundingVenueCount: number;
  programActive?: boolean;
  venueAlreadyEarnedFounding?: boolean;
  /** Force founding on/off when reusing an already-issued offer. */
  honorFoundingIssued?: boolean;
  readiness?: PricingLaunchReadiness;
}): LaunchCheckoutPricing {
  const readiness = input.readiness ?? getPricingLaunchV1Readiness();
  if (!readiness.ready) {
    throw new Error(
      readiness.flagEnabled
        ? `Pricing Launch V1 configuration incomplete: ${readiness.missing.join(", ")}`
        : "Pricing Launch V1 is not enabled.",
    );
  }

  const priceIdByPlan: Record<SaasPlanKey, string | null> = {
    starter: readiness.gatherPriceId,
    growing: readiness.celebratePriceId,
    professional: readiness.flourishPriceId,
  };
  const priceId = priceIdByPlan[input.plan];
  if (!priceId) {
    throw new Error(`Missing Stripe Price for plan ${input.plan}.`);
  }

  const listCents = listAmountCents(input.plan);

  let foundingIssued: boolean;
  let issuanceReason: string;
  let earnedCount = input.earnedFoundingVenueCount;

  if (typeof input.honorFoundingIssued === "boolean") {
    foundingIssued = input.honorFoundingIssued;
    issuanceReason = foundingIssued
      ? "honor_existing_offer"
      : "honor_existing_standard_offer";
  } else {
    const decision = decideFoundingIssuance({
      earnedFoundingVenueCount: input.earnedFoundingVenueCount,
      programActive: input.programActive,
      venueAlreadyEarned: input.venueAlreadyEarnedFounding,
    });
    foundingIssued = decision.issueFounding;
    issuanceReason = decision.reason;
    earnedCount = decision.earnedCount;
  }

  if (foundingIssued) {
    const couponId = readiness.foundingPercentCouponId;
    if (!couponId) {
      throw new Error("STRIPE_FOUNDING_PERCENT_COUPON_ID is required for Founding Checkout.");
    }
    return {
      plan: input.plan,
      priceId,
      listAmountCents: listCents,
      foundingIssued: true,
      foundingPercentOff: FOUNDING_PERCENT_OFF,
      foundingCouponId: couponId,
      allowPromotionCodes: false,
      pricingVersion: PRICING_VERSION_V1,
      mode: "launch_founding_percent",
      earnedFoundingCountAtIssue: earnedCount,
      issuanceReason,
    };
  }

  return {
    plan: input.plan,
    priceId,
    listAmountCents: listCents,
    foundingIssued: false,
    foundingPercentOff: null,
    foundingCouponId: null,
    allowPromotionCodes: true,
    pricingVersion: PRICING_VERSION_V1,
    mode: "launch_standard",
    earnedFoundingCountAtIssue: earnedCount,
    issuanceReason,
  };
}
