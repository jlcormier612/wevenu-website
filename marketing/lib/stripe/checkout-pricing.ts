/**
 * Resolve SaaS Checkout price + Founding/Weven discount for Hello to Cheers.
 *
 * Paths:
 * - Legacy (default): Gather $149 + optional $30 forever coupon / founder Prices.
 * - Launch V1: Gather $199 / Celebrate $249 / Flourish $349 + optional 10% Founding.
 * - Phase 2 Weven (when declared + ready): same list Prices + 20% forever Weven coupon
 *   (best-offer; may still earn a Founding grant without stacking coupons).
 *
 * Env names only — never hardcode Stripe Price / Coupon IDs.
 */

import type { SubscriptionPlanId } from "@/lib/marketing/pricing-page";
import {
  isPricingLaunchV1Ready,
  resolveLaunchCheckoutPricing,
  type LaunchCheckoutPricing,
} from "@shared/pricing";

export type CheckoutPricingResolution = {
  plan: SubscriptionPlanId;
  /** Recurring Price ID for the subscription line item */
  priceId: string;
  /**
   * When set, Checkout Session must use `discounts: [{ coupon }]` and must NOT
   * set `allow_promotion_codes` (Stripe forbids both).
   * Holds the winning coupon (Founding 10% or Weven 20%).
   */
  foundingCouponId: string | null;
  allowPromotionCodes: boolean;
  /** How the price was chosen (for logs / tests) */
  mode:
    | "gather_standard"
    | "gather_founding_coupon"
    | "gather_founding_legacy_price"
    | "plan_standard"
    | "plan_founder_price"
    | "launch_standard"
    | "launch_founding_percent"
    | "launch_weven_percent";
  /** Present on Launch V1 resolutions only */
  launch?: LaunchCheckoutPricing;
};

function readEnvId(envName: string): string | null {
  const value = process.env[envName]?.trim();
  if (!value || value.endsWith("...")) return null;
  return value;
}

/** Canonical Gather Price — preferred env names then legacy starter. */
export function resolveGatherPriceId(): string {
  const priceId =
    readEnvId("STRIPE_GATHER_PRICE_ID") ||
    readEnvId("GATHER_PRICE_ID") ||
    readEnvId("STRIPE_PRICE_STARTER");
  if (!priceId) {
    throw new Error(
      "Gather Price is not configured. Set STRIPE_GATHER_PRICE_ID (or GATHER_PRICE_ID / STRIPE_PRICE_STARTER).",
    );
  }
  return priceId;
}

/** Legacy $30/mo Founding Member coupon → $119 on Gather. Not used by Launch V1. */
export function resolveFoundingCouponId(): string | null {
  return (
    readEnvId("STRIPE_FOUNDING_COUPON_ID") ||
    readEnvId("FOUNDING_MEMBER_COUPON_ID") ||
    readEnvId("STRIPE_FOUNDING_MEMBER_COUPON_ID")
  );
}

const PRICE_ENV_STANDARD: Record<SubscriptionPlanId, string> = {
  starter: "STRIPE_PRICE_STARTER",
  growing: "STRIPE_PRICE_GROWING",
  professional: "STRIPE_PRICE_PROFESSIONAL",
};

const PRICE_ENV_FOUNDER: Record<SubscriptionPlanId, string> = {
  starter: "STRIPE_PRICE_STARTER_FOUNDER",
  growing: "STRIPE_PRICE_GROWING_FOUNDER",
  professional: "STRIPE_PRICE_PROFESSIONAL_FOUNDER",
};

function readRequiredStandardPrice(plan: SubscriptionPlanId): string {
  if (plan === "starter") return resolveGatherPriceId();
  const envName = PRICE_ENV_STANDARD[plan];
  const priceId = readEnvId(envName);
  if (!priceId) {
    throw new Error(`${envName} is not configured.`);
  }
  return priceId;
}

/**
 * Whether checkout.session.completed may provision / activate.
 * Failed or unpaid payment must not activate a venue.
 */
export function shouldProvisionFromCheckoutSession(input: {
  paymentStatus: string | null | undefined;
  subscriptionStatus?: string | null;
}): boolean {
  const payment = (input.paymentStatus ?? "").toLowerCase();
  const sub = (input.subscriptionStatus ?? "").toLowerCase();

  if (sub && !["active", "trialing"].includes(sub)) {
    return false;
  }

  if (payment === "unpaid") return false;
  if (payment === "paid" || payment === "no_payment_required") return true;

  // Missing payment_status: only provision when subscription is known healthy
  if (!payment && sub && ["active", "trialing"].includes(sub)) return true;

  return false;
}

/**
 * Legacy Resolve recurring Price (+ optional Founding coupon) for a Checkout Session.
 */
export function resolveLegacyCheckoutPricing(
  plan: SubscriptionPlanId,
  options?: { founder?: boolean },
): CheckoutPricingResolution {
  const founder = Boolean(options?.founder);

  if (plan === "starter") {
    const gatherPriceId = resolveGatherPriceId();
    if (!founder) {
      return {
        plan,
        priceId: gatherPriceId,
        foundingCouponId: null,
        allowPromotionCodes: true,
        mode: "gather_standard",
      };
    }

    const couponId = resolveFoundingCouponId();
    if (couponId) {
      return {
        plan,
        priceId: gatherPriceId,
        foundingCouponId: couponId,
        allowPromotionCodes: false,
        mode: "gather_founding_coupon",
      };
    }

    // Transition fallback: separate Founder Price ID until coupon is configured.
    const legacyFounder = readEnvId(PRICE_ENV_FOUNDER.starter);
    if (legacyFounder) {
      return {
        plan,
        priceId: legacyFounder,
        foundingCouponId: null,
        allowPromotionCodes: true,
        mode: "gather_founding_legacy_price",
      };
    }

    return {
      plan,
      priceId: gatherPriceId,
      foundingCouponId: null,
      allowPromotionCodes: true,
      mode: "gather_standard",
    };
  }

  if (founder) {
    const founderPrice = readEnvId(PRICE_ENV_FOUNDER[plan]);
    if (founderPrice) {
      return {
        plan,
        priceId: founderPrice,
        foundingCouponId: null,
        allowPromotionCodes: true,
        mode: "plan_founder_price",
      };
    }
  }

  return {
    plan,
    priceId: readRequiredStandardPrice(plan),
    foundingCouponId: null,
    allowPromotionCodes: true,
    mode: "plan_standard",
  };
}

/**
 * Resolve Checkout pricing.
 *
 * When Launch V1 is ready, `options.launch` must supply earned founding count
 * (and optional honor/venue flags). Without launch options while ready, throws
 * so callers cannot accidentally skip the soft-milestone issuance decision.
 *
 * When Launch V1 is not ready, uses the legacy path unchanged.
 */
export function resolveCheckoutPricing(
  plan: SubscriptionPlanId,
  options?: {
    founder?: boolean;
    launch?: {
      earnedFoundingVenueCount: number;
      programActive?: boolean;
      venueAlreadyEarnedFounding?: boolean;
      honorFoundingIssued?: boolean;
      /** Explicit former-Weven self-declaration (never inferred from email). */
      wevenDeclared?: boolean;
    };
  },
): CheckoutPricingResolution {
  if (isPricingLaunchV1Ready()) {
    if (!options?.launch) {
      throw new Error(
        "Pricing Launch V1 is ready — Checkout must supply launch issuance context.",
      );
    }
    const launch = resolveLaunchCheckoutPricing({
      plan,
      earnedFoundingVenueCount: options.launch.earnedFoundingVenueCount,
      programActive: options.launch.programActive,
      venueAlreadyEarnedFounding: options.launch.venueAlreadyEarnedFounding,
      honorFoundingIssued: options.launch.honorFoundingIssued,
      wevenDeclared: options.launch.wevenDeclared,
    });
    return {
      plan,
      priceId: launch.priceId,
      foundingCouponId: launch.foundingCouponId,
      allowPromotionCodes: launch.allowPromotionCodes,
      mode: launch.mode,
      launch,
    };
  }

  return resolveLegacyCheckoutPricing(plan, { founder: options?.founder });
}
