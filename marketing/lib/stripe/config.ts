import Stripe from "stripe";

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

const PRICE_ENV: Record<SubscriptionPlanId, string> = {
  starter: "STRIPE_PRICE_STARTER",
  growing: "STRIPE_PRICE_GROWING",
  professional: "STRIPE_PRICE_PROFESSIONAL",
};

export function getPriceIdForPlan(plan: SubscriptionPlanId): string {
  const envName = PRICE_ENV[plan];
  const priceId = process.env[envName];
  if (!priceId) {
    throw new Error(`${envName} is not configured.`);
  }
  return priceId;
}

export function isSubscriptionPlanId(value: string): value is SubscriptionPlanId {
  return value === "starter" || value === "growing" || value === "professional";
}
