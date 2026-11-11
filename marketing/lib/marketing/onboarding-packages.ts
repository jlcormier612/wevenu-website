/**
 * Data-driven onboarding add-on packages for pre-checkout selection.
 * New packages can be added here without changing Checkout Session architecture:
 * subscription line item + optional one-time Stripe prices from env.
 */

import type { OnboardingType } from "@/lib/marketing/enrollment";
import {
  getPricingPage,
  type SubscriptionPlanId,
} from "@/lib/marketing/pricing-page";

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

/** Phase 2 ready — promises 20% Weven discount at Checkout. */
export const ONBOARDING_SELECTION_COPY = {
  title: "How would you like to get started?",
  intro: [] as const,
  welcomeBack: {
    prompt: "Were you a Weven customer?",
    body: "We'd love to welcome you back! Former Weven venue customers receive 20% off their Hello to Cheers subscription for life.",
    checkboxLabel: "Yes, my venue was a Weven customer.",
    support:
      "We'll apply your discount now and confirm your eligibility afterward. No need to wait to get started.",
    appliedBanner: "Welcome back. Your former Weven customer discount is applied.",
  },
  whiteGloveWevenPriceLabel: "+$399 one-time",
} as const;

/** Phase 2 off — keep the self-ID checkbox as a CRM flag without advertising 20%. */
export const ONBOARDING_SELECTION_COPY_LEGACY = {
  title: "How would you like to get started?",
  intro: [] as const,
  welcomeBack: {
    prompt: "Have we celebrated together before?",
    body: null as string | null,
    checkboxLabel: "My venue was part of the Weven family.",
    support: null as string | null,
    appliedBanner: null as string | null,
  },
  whiteGloveWevenPriceLabel: "+$499 one-time",
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
  const plan = getPricingPage().plans.find((entry) => entry.id === planId);
  return plan?.name ?? planId;
}
