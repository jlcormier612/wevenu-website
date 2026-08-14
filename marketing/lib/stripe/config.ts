import Stripe from "stripe";

import {
  getEnrollmentConfig,
  isFounderPricingActive,
} from "@/lib/marketing/enrollment";
import type { SubscriptionPlanId } from "@/lib/marketing/pricing-page";
import {
  resolveCheckoutPricing,
  resolveGatherPriceId,
  type CheckoutPricingResolution,
} from "@/lib/stripe/checkout-pricing";

export {
  resolveCheckoutPricing,
  resolveFoundingCouponId,
  resolveGatherPriceId,
  shouldProvisionFromCheckoutSession,
  type CheckoutPricingResolution,
} from "@/lib/stripe/checkout-pricing";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function getMarketingSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MARKETING_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

function readPriceEnv(envName: string): string | null {
  const priceId = process.env[envName]?.trim();
  if (!priceId || priceId.endsWith("...")) return null;
  return priceId;
}

/**
 * Resolves the recurring Price ID for a plan.
 * Gather (starter): canonical Gather Price ($149); Founding uses coupon at Checkout
 * (see resolveCheckoutPricing). Other plans: Founder Price IDs while program active.
 */
export function getPriceIdForPlan(
  plan: SubscriptionPlanId,
  options?: { founder?: boolean },
): string {
  const useFounder =
    options?.founder ?? isFounderPricingActive(getEnrollmentConfig());
  return resolveCheckoutPricing(plan, { founder: useFounder }).priceId;
}

/** Full Checkout pricing resolution (price + optional Founding coupon). */
export function getCheckoutPricingForPlan(
  plan: SubscriptionPlanId,
  options?: { founder?: boolean },
): CheckoutPricingResolution {
  const useFounder =
    options?.founder ?? isFounderPricingActive(getEnrollmentConfig());
  return resolveCheckoutPricing(plan, { founder: useFounder });
}

/**
 * Resolves an optional one-time onboarding add-on Price ID from its env var
 * (e.g. STRIPE_PRICE_WHITE_GLOVE). Used on the same Checkout Session as the plan.
 */
export function getOnboardingAddonPriceId(envName: string): string | null {
  return readPriceEnv(envName);
}

/** @deprecated Prefer getOnboardingAddonPriceId — kept for older call sites */
export function getWhiteGlovePriceId(): string | null {
  return getOnboardingAddonPriceId("STRIPE_PRICE_WHITE_GLOVE");
}

export function isSubscriptionPlanId(value: string): value is SubscriptionPlanId {
  return value === "starter" || value === "growing" || value === "professional";
}

/** @deprecated Prefer resolveGatherPriceId — alias for ops docs */
export function getGatherPriceId(): string {
  return resolveGatherPriceId();
}
