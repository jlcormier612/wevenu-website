import Stripe from "stripe";

import {
  getEnrollmentConfig,
  isFounderPricingActive,
} from "@/lib/marketing/enrollment";
import type { SubscriptionPlanId } from "@/lib/marketing/pricing-page";
import {
  resolveCheckoutPricing,
  resolveGatherPriceId,
  resolveLegacyCheckoutPricing,
  type CheckoutPricingResolution,
} from "@/lib/stripe/checkout-pricing";
import { isPricingLaunchV1Ready } from "@shared/pricing";

export {
  resolveCheckoutPricing,
  resolveFoundingCouponId,
  resolveGatherPriceId,
  resolveLegacyCheckoutPricing,
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
 * Legacy: Gather $149; Founding uses coupon / founder Prices.
 * Launch V1 callers should use getCheckoutPricingForPlan with launch context.
 */
export function getPriceIdForPlan(
  plan: SubscriptionPlanId,
  options?: { founder?: boolean },
): string {
  if (isPricingLaunchV1Ready()) {
    throw new Error(
      "Pricing Launch V1 is ready — use getCheckoutPricingForPlan with launch context.",
    );
  }
  const useFounder =
    options?.founder ?? isFounderPricingActive(getEnrollmentConfig());
  return resolveLegacyCheckoutPricing(plan, { founder: useFounder }).priceId;
}

/** Full Checkout pricing resolution (price + optional Founding coupon). */
export function getCheckoutPricingForPlan(
  plan: SubscriptionPlanId,
  options?: {
    founder?: boolean;
    launch?: {
      earnedFoundingVenueCount: number;
      programActive?: boolean;
      venueAlreadyEarnedFounding?: boolean;
      honorFoundingIssued?: boolean;
    };
  },
): CheckoutPricingResolution {
  if (isPricingLaunchV1Ready()) {
    if (!options?.launch) {
      throw new Error(
        "Pricing Launch V1 is ready — Checkout must supply launch issuance context.",
      );
    }
    return resolveCheckoutPricing(plan, { launch: options.launch });
  }
  const useFounder =
    options?.founder ?? isFounderPricingActive(getEnrollmentConfig());
  return resolveLegacyCheckoutPricing(plan, { founder: useFounder });
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
