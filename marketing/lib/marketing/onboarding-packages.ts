/**
 * Data-driven onboarding add-on packages for pre-checkout selection.
 * New packages can be added here without changing Checkout Session architecture:
 * subscription line item + optional one-time Stripe prices from env.
 */

import type { OnboardingType } from "@/lib/marketing/enrollment";
import { PRICING_PAGE, type SubscriptionPlanId } from "@/lib/marketing/pricing-page";

export type OnboardingPackage = {
  id: OnboardingType;
  title: string;
  priceLabel: string;
  description: string;
  ctaLabel: string;
  /**
   * Env var for an optional one-time Stripe Price ID.
   * When null, the package is included with the subscription (no extra line item).
   */
  stripePriceEnv: string | null;
  defaultSelected: boolean;
};

export const ONBOARDING_SELECTION_COPY = {
  title: "How would you like to get started?",
  intro: [] as const,
  welcomeBack: {
    prompt: "Have we celebrated together before?",
    checkboxLabel: "My venue was part of the Weven family.",
  },
} as const;

/**
 * Catalog of onboarding choices shown before Stripe Checkout.
 * Checkout resolves add-on prices via `stripePriceEnv` — do not hardcode Price IDs.
 */
export const ONBOARDING_PACKAGES: readonly OnboardingPackage[] = [
  {
    id: "self_guided",
    title: "I'll set it up myself",
    priceLabel: "Included",
    description:
      "Get access right away and walk through a short, guided setup. You can change anything later.",
    ctaLabel: "Continue to Checkout",
    stripePriceEnv: null,
    defaultSelected: true,
  },
  {
    id: "white_glove",
    title: "White Glove Setup",
    priceLabel: "+$499 one-time",
    description:
      "We'll help build your Hello to Cheers workspace for you. Give us your venue information and materials, and we'll take care of the setup work.",
    ctaLabel: "Continue to Checkout",
    stripePriceEnv: "STRIPE_PRICE_WHITE_GLOVE",
    defaultSelected: false,
  },
] as const;

export function getOnboardingPackage(id: OnboardingType): OnboardingPackage {
  const pkg = ONBOARDING_PACKAGES.find((entry) => entry.id === id);
  if (!pkg) {
    return ONBOARDING_PACKAGES.find((entry) => entry.defaultSelected) ?? ONBOARDING_PACKAGES[0];
  }
  return pkg;
}

export function getDefaultOnboardingType(): OnboardingType {
  return (
    ONBOARDING_PACKAGES.find((entry) => entry.defaultSelected)?.id ?? "self_guided"
  );
}

/** Display name for a subscription plan (e.g. Celebrate). */
export function getPlanDisplayName(planId: SubscriptionPlanId | string): string {
  const plan = PRICING_PAGE.plans.find((entry) => entry.id === planId);
  return plan?.name ?? planId;
}
