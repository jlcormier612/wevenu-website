/**
 * Resolve SaaS Checkout price + Founding coupon for Hello to Cheers (System A).
 *
 * Gather (starter): canonical $149 Price + optional $30/mo Founding coupon → $119.
 * Celebrate / Flourish: keep existing standard / Founder Price ID env model.
 *
 * Env names only — never hardcode Stripe Price / Coupon IDs.
 */

import type { SubscriptionPlanId } from "@/lib/marketing/pricing-page";

export type CheckoutPricingResolution = {
  plan: SubscriptionPlanId;
  /** Recurring Price ID for the subscription line item */
  priceId: string;
  /**
   * When set, Checkout Session must use `discounts: [{ coupon }]` and must NOT
   * set `allow_promotion_codes` (Stripe forbids both).
   */
  foundingCouponId: string | null;
  allowPromotionCodes: boolean;
  /** How the price was chosen (for logs / tests) */
  mode:
    | "gather_standard"
    | "gather_founding_coupon"
    | "gather_founding_legacy_price"
    | "plan_standard"
    | "plan_founder_price";
};

function readEnvId(envName: string): string | null {
  const value = process.env[envName]?.trim();
  if (!value || value.endsWith("...")) return null;
  return value;
}

/** Canonical Gather ($149) Price — preferred env names then legacy starter. */
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

/** $30/mo Founding Member coupon → $119 on Gather. */
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
 * Resolve recurring Price (+ optional Founding coupon) for a Checkout Session.
 */
export function resolveCheckoutPricing(
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
