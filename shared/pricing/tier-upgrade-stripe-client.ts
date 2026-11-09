/**
 * SaaS (platform) Stripe client for Phase 3 — never Connect.
 *
 * Avoid `import("stripe")` in exported type positions so marketing builds that
 * import `@shared/pricing` do not require the stripe package for typecheck.
 */

export type SaasStripeClientLike = {
  subscriptions: {
    retrieve(
      id: string,
      params?: Record<string, unknown>,
    ): Promise<Record<string, unknown>>;
  };
};

export function resolveSaasStripeSecretKey(): string | null {
  const saas = process.env.HTC_SAAS_STRIPE_SECRET_KEY?.trim();
  if (saas) return saas;
  // Marketing task uses STRIPE_SECRET_KEY bound to the SaaS secret.
  // Venue-app Connect key must NOT be used for SaaS subscription retrieve.
  const explicit = process.env.HTC_SAAS_STRIPE_USE_DEFAULT_SECRET === "true";
  if (explicit) {
    const fallback = process.env.STRIPE_SECRET_KEY?.trim();
    if (fallback) return fallback;
  }
  return null;
}

export async function createSaasStripeClient(): Promise<{
  stripe: SaasStripeClientLike;
  keySource: "HTC_SAAS_STRIPE_SECRET_KEY" | "STRIPE_SECRET_KEY";
}> {
  const key = resolveSaasStripeSecretKey();
  if (!key) {
    throw new Error(
      "SaaS Stripe secret missing — set HTC_SAAS_STRIPE_SECRET_KEY (venue-app) or HTC_SAAS_STRIPE_USE_DEFAULT_SECRET=true on marketing.",
    );
  }
  if (!key.startsWith("sk_test_") && process.env.ALLOW_LIVE_STRIPE_TIER_UPGRADE !== "true") {
    throw new Error("Refusing non-test Stripe key for Phase 3 tier-upgrade operations.");
  }
  // Runtime-only resolution — do not reference stripe in type space.
  const stripeModule = (await Function('return import("stripe")')()) as {
    default: new (apiKey: string) => SaasStripeClientLike;
  };
  const keySource = process.env.HTC_SAAS_STRIPE_SECRET_KEY?.trim()
    ? "HTC_SAAS_STRIPE_SECRET_KEY"
    : "STRIPE_SECRET_KEY";
  return { stripe: new stripeModule.default(key), keySource };
}
