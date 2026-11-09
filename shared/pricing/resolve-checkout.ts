/**
 * Launch V1 (+ Phase 2 Weven) Checkout pricing resolution.
 * Uses standard recurring Prices + optional percent-forever coupons.
 * Never selects founder-specific fixed recurring Prices or the legacy $30 coupon.
 *
 * Best-offer at Checkout:
 *   Weven 20% (when declared + Phase 2 ready) beats Founding 10%.
 *   Founding eligibility may still be recorded when Weven wins.
 */

import {
  FOUNDING_PERCENT_OFF,
  PRICING_VERSION_V1,
  WEVEN_PERCENT_OFF,
  isSaasPlanKey,
  listAmountCents,
} from "./catalog";
import { decideFoundingIssuance } from "./founding";
import {
  getPricingLaunchV1Readiness,
  getPricingWevenV1Readiness,
  type PricingLaunchReadiness,
  type PricingWevenReadiness,
} from "./readiness";
import type { OfferType, SaasPlanKey } from "./types";

export { isSaasPlanKey };

export type LaunchCheckoutPricing = {
  plan: SaasPlanKey;
  priceId: string;
  listAmountCents: number;
  /** Eligible to earn a Founding grant after paid completion (soft-100). */
  foundingIssued: boolean;
  foundingPercentOff: number | null;
  /** Explicit former-Weven self-declaration on this Checkout. */
  wevenDeclared: boolean;
  wevenPercentOff: number | null;
  /** Winning discount applied to the Stripe subscription (never stacked). */
  appliedOfferType: OfferType | null;
  /** Coupon attached to the Session (winning discount only). */
  foundingCouponId: string | null;
  allowPromotionCodes: boolean;
  pricingVersion: string;
  mode:
    | "launch_standard"
    | "launch_founding_percent"
    | "launch_weven_percent";
  earnedFoundingCountAtIssue: number;
  issuanceReason: string;
  /** Weven $399 White Glove Price when Phase 2 ready; else null. */
  wevenWhiteGlovePriceId: string | null;
};

export function resolveLaunchCheckoutPricing(input: {
  plan: SaasPlanKey;
  earnedFoundingVenueCount: number;
  programActive?: boolean;
  venueAlreadyEarnedFounding?: boolean;
  /** Force founding on/off when reusing an already-issued offer. */
  honorFoundingIssued?: boolean;
  /** Explicit customer self-declaration (never inferred from email). */
  wevenDeclared?: boolean;
  readiness?: PricingLaunchReadiness;
  wevenReadiness?: PricingWevenReadiness;
}): LaunchCheckoutPricing {
  const readiness = input.readiness ?? getPricingLaunchV1Readiness();
  if (!readiness.ready) {
    throw new Error(
      readiness.flagEnabled
        ? `Pricing Launch V1 configuration incomplete: ${readiness.missing.join(", ")}`
        : "Pricing Launch V1 is not enabled.",
    );
  }

  const wevenReadiness = input.wevenReadiness ?? getPricingWevenV1Readiness();
  const wevenRequested = Boolean(input.wevenDeclared);

  if (wevenRequested && wevenReadiness.mode === "weven_misconfigured") {
    throw new Error(wevenReadiness.diagnosticMessage);
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

  const wevenActive = wevenRequested && wevenReadiness.ready;
  if (wevenActive) {
    const couponId = wevenReadiness.wevenPercentCouponId;
    if (!couponId) {
      throw new Error("STRIPE_WEVEN_PERCENT_COUPON_ID is required for Weven Checkout.");
    }
    return {
      plan: input.plan,
      priceId,
      listAmountCents: listCents,
      foundingIssued,
      foundingPercentOff: foundingIssued ? FOUNDING_PERCENT_OFF : null,
      wevenDeclared: true,
      wevenPercentOff: WEVEN_PERCENT_OFF,
      appliedOfferType: "weven_pct",
      foundingCouponId: couponId,
      allowPromotionCodes: false,
      pricingVersion: PRICING_VERSION_V1,
      mode: "launch_weven_percent",
      earnedFoundingCountAtIssue: earnedCount,
      issuanceReason: foundingIssued
        ? `${issuanceReason}+weven_wins_applied`
        : `weven_only:${issuanceReason}`,
      wevenWhiteGlovePriceId: wevenReadiness.wevenWhiteGlovePriceId,
    };
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
      wevenDeclared: false,
      wevenPercentOff: null,
      appliedOfferType: "founding_pct",
      foundingCouponId: couponId,
      allowPromotionCodes: false,
      pricingVersion: PRICING_VERSION_V1,
      mode: "launch_founding_percent",
      earnedFoundingCountAtIssue: earnedCount,
      issuanceReason,
      wevenWhiteGlovePriceId: null,
    };
  }

  return {
    plan: input.plan,
    priceId,
    listAmountCents: listCents,
    foundingIssued: false,
    foundingPercentOff: null,
    wevenDeclared: false,
    wevenPercentOff: null,
    appliedOfferType: null,
    foundingCouponId: null,
    allowPromotionCodes: true,
    pricingVersion: PRICING_VERSION_V1,
    mode: "launch_standard",
    earnedFoundingCountAtIssue: earnedCount,
    issuanceReason,
    wevenWhiteGlovePriceId: null,
  };
}
