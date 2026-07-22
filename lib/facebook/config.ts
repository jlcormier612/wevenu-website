/**
 * Facebook / Instagram Lead Ads config. Same is{Provider}Configured()
 * convention as lib/quickbooks/config.ts, lib/email/send.ts.
 *
 * Env vars:
 *   FACEBOOK_APP_ID / NEXT_PUBLIC_FACEBOOK_APP_ID — OAuth client ID
 *     (declared twice — not a secret, safe to expose client-side, same
 *     convention as QUICKBOOKS_CLIENT_ID).
 *   FACEBOOK_APP_SECRET — server-only, used for token exchange and
 *     webhook signature verification.
 *   FACEBOOK_WEBHOOK_VERIFY_TOKEN — the arbitrary string used in Meta's
 *     one-time hub.verify_token subscription handshake.
 *   FACEBOOK_GRAPH_API_VERSION — pinned explicitly since Meta deprecates
 *     old Graph API versions on a schedule.
 */
export function isFacebookConfigured(): boolean {
  return !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
}

export function facebookGraphApiVersion(): string {
  return process.env.FACEBOOK_GRAPH_API_VERSION ?? "v21.0";
}

export function facebookGraphApiBaseUrl(): string {
  return `https://graph.facebook.com/${facebookGraphApiVersion()}`;
}

export const FACEBOOK_OAUTH_DIALOG_URL = "https://www.facebook.com/dialog/oauth";
export const FACEBOOK_TOKEN_URL = "https://graph.facebook.com/oauth/access_token";
export const FACEBOOK_DEAUTHORIZE_SCOPE = "pages_show_list,pages_manage_metadata,leads_retrieval,pages_read_engagement";
