/**
 * Venue-app SaaS Stripe client (platform account — never Connect).
 */

import { resolveSaasStripeSecretKey } from "@shared/pricing";

export async function createSaasStripeClient(): Promise<{
  // Keep Stripe typed only inside venue-app, which depends on the stripe package.
  stripe: import("stripe").default;
  keySource: "HTC_SAAS_STRIPE_SECRET_KEY" | "STRIPE_SECRET_KEY";
}> {
  const key = resolveSaasStripeSecretKey();
  if (!key) {
    throw new Error(
      "SaaS Stripe secret missing — set HTC_SAAS_STRIPE_SECRET_KEY on venue-app.",
    );
  }
  if (
    !key.startsWith("sk_test_") &&
    process.env.ALLOW_LIVE_STRIPE_TIER_UPGRADE !== "true"
  ) {
    throw new Error("Refusing non-test Stripe key for Phase 3 tier-upgrade operations.");
  }
  const Stripe = (await import("stripe")).default;
  const keySource = process.env.HTC_SAAS_STRIPE_SECRET_KEY?.trim()
    ? "HTC_SAAS_STRIPE_SECRET_KEY"
    : "STRIPE_SECRET_KEY";
  return { stripe: new Stripe(key), keySource };
}
