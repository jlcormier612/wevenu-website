/**
 * Stripe Payment Link placeholders for enrollment tiers (ops / legacy).
 * Public checkout uses Checkout Sessions so metadata can be set per purchase.
 * Do not invent URLs — set real Payment Links in the environment when needed.
 */

import type { SubscriptionPlanId } from "@/lib/marketing/pricing-page";

export type PaymentLinkTier = "founder" | "welcome_back" | "standard";

const PAYMENT_LINK_ENV: Record<
  PaymentLinkTier,
  Record<SubscriptionPlanId, string>
> = {
  founder: {
    starter: "STRIPE_PAYMENT_LINK_GATHER_FOUNDER",
    growing: "STRIPE_PAYMENT_LINK_CELEBRATE_FOUNDER",
    professional: "STRIPE_PAYMENT_LINK_FLOURISH_FOUNDER",
  },
  welcome_back: {
    starter: "STRIPE_PAYMENT_LINK_GATHER_WELCOME_BACK",
    growing: "STRIPE_PAYMENT_LINK_CELEBRATE_WELCOME_BACK",
    professional: "STRIPE_PAYMENT_LINK_FLOURISH_WELCOME_BACK",
  },
  standard: {
    starter: "STRIPE_PAYMENT_LINK_GATHER_STANDARD",
    growing: "STRIPE_PAYMENT_LINK_CELEBRATE_STANDARD",
    professional: "STRIPE_PAYMENT_LINK_FLOURISH_STANDARD",
  },
};

/**
 * Returns a configured Stripe Payment Link URL, or null when the placeholder
 * has not been set yet.
 */
export function getPaymentLinkUrl(
  plan: SubscriptionPlanId,
  tier: PaymentLinkTier,
): string | null {
  const envName = PAYMENT_LINK_ENV[tier][plan];
  const value = process.env[envName]?.trim();
  if (!value || value === "https://buy.stripe.com/..." || value.endsWith("...")) {
    return null;
  }
  return value;
}

export function getPaymentLinkEnvName(
  plan: SubscriptionPlanId,
  tier: PaymentLinkTier,
): string {
  return PAYMENT_LINK_ENV[tier][plan];
}
