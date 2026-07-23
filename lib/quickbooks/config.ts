/**
 * QuickBooks Online configuration. Server-only.
 *
 * Mirrors lib/email/send.ts's isEmailConfigured() / lib/lead-intake/
 * turnstile.ts's isTurnstileConfigured() convention exactly: a plain
 * function returning true iff every required env var is present, no
 * network call, no side effects.
 *
 * Required env vars:
 *   QUICKBOOKS_CLIENT_ID              — server only
 *   QUICKBOOKS_CLIENT_SECRET           — server only, never expose to browser
 *   NEXT_PUBLIC_QUICKBOOKS_CLIENT_ID   — same value as QUICKBOOKS_CLIENT_ID,
 *                                        exposed for the client-side
 *                                        authorize-URL builder (OAuth
 *                                        client IDs are not secrets)
 *   QUICKBOOKS_ENVIRONMENT             — "sandbox" (default) | "production"
 */

export function isQuickBooksConfigured(): boolean {
  return !!(process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET);
}

export type QuickBooksEnvironment = "sandbox" | "production";

export function quickBooksEnvironment(): QuickBooksEnvironment {
  return process.env.QUICKBOOKS_ENVIRONMENT === "production" ? "production" : "sandbox";
}

export function quickBooksApiBaseUrl(): string {
  return quickBooksEnvironment() === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

export const QUICKBOOKS_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
export const QUICKBOOKS_REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
export const QUICKBOOKS_AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
export const QUICKBOOKS_SCOPE = "com.intuit.quickbooks.accounting";

/** "Hello to Cheers Services" placeholder Item name — see lib/quickbooks/items.ts. */
export const QUICKBOOKS_DEFAULT_ITEM_NAME = "Hello to Cheers Services";
