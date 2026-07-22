import Stripe from "stripe";

import {
  getEnrollmentConfig,
  isFounderPricingActive,
} from "@/lib/marketing/enrollment";
import type { SubscriptionPlanId } from "@/lib/marketing/pricing-page";

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

function readPriceEnv(envName: string): string | null {
  const priceId = process.env[envName]?.trim();
  if (!priceId || priceId.endsWith("...")) return null;
  return priceId;
}

/**
 * Resolves the recurring Price ID for a plan.
 * While the Founder Program is active, prefers Founder Price IDs when set;
 * otherwise falls back to the standard Price ID.
 */
export function getPriceIdForPlan(
  plan: SubscriptionPlanId,
  options?: { founder?: boolean },
): string {
  const useFounder =
    options?.founder ?? isFounderPricingActive(getEnrollmentConfig());

  if (useFounder) {
    const founderPrice = readPriceEnv(PRICE_ENV_FOUNDER[plan]);
    if (founderPrice) return founderPrice;
  }

  const standardEnv = PRICE_ENV_STANDARD[plan];
  const standardPrice = readPriceEnv(standardEnv);
  if (!standardPrice) {
    throw new Error(`${standardEnv} is not configured.`);
  }
  return standardPrice;
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
