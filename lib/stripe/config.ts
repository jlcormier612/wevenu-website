/**
 * Stripe Connect (Standard) configuration. Server-only.
 *
 * Mirrors lib/quickbooks/config.ts's isQuickBooksConfigured() convention
 * exactly: a plain function returning true iff every required env var is
 * present, no network call, no side effects.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY                 — server only
 *   STRIPE_WEBHOOK_SECRET              — server only, verifies webhook signatures
 *   NEXT_PUBLIC_STRIPE_CLIENT_ID       — OAuth client ID for the client-side
 *                                        authorize-URL builder (not a secret)
 */
import Stripe from "stripe";

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function isStripeWebhookConfigured(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

let cachedClient: Stripe | null = null;

/** Server-only Stripe SDK client, lazily constructed once per process. */
export function getStripeClient(): Stripe {
  if (!cachedClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured.");
    cachedClient = new Stripe(secretKey);
  }
  return cachedClient;
}

export const STRIPE_OAUTH_AUTHORIZE_URL = "https://connect.stripe.com/oauth/authorize";
export const STRIPE_OAUTH_TOKEN_URL = "https://connect.stripe.com/oauth/token";
export const STRIPE_OAUTH_DEAUTHORIZE_URL = "https://connect.stripe.com/oauth/deauthorize";

/** "Accepted payment methods" — an allowed-values list, not a fixed union of booleans, so a future Stripe-supported method is an allowed-values addition, never a schema change. */
export const STRIPE_SUPPORTED_PAYMENT_METHODS = ["card", "us_bank_account"] as const;
