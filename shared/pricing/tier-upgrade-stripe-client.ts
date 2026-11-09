/**
 * Resolve the SaaS (platform) Stripe secret for Phase 3.
 * Client construction lives in venue-app `lib/billing/saas-stripe.ts` so
 * marketing/workspace builds do not need the stripe package.
 */

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
