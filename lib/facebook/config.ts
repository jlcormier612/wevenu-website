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
 *   FACEBOOK_LOGIN_CONFIG_ID — Facebook Login for Business configuration ID
 *     (Meta App Dashboard → Facebook Login for Business → Configurations).
 *     When set, OAuth uses config_id instead of scope; required for Business
 *     Login system-user access tokens (authorization code grant, no expiry).
 *   FACEBOOK_GRAPH_API_VERSION — pinned explicitly since Meta deprecates
 *     old Graph API versions on a schedule.
 */

import { publicAppOrigin } from "@/lib/env";

export function isFacebookConfigured(): boolean {
  return !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
}

export function facebookGraphApiVersion(): string {
  return process.env.FACEBOOK_GRAPH_API_VERSION ?? "v21.0";
}

export function facebookGraphApiBaseUrl(): string {
  return `https://graph.facebook.com/${facebookGraphApiVersion()}`;
}

export const FACEBOOK_OAUTH_DIALOG_URL = "https://www.facebook.com/v21.0/dialog/oauth";
export const FACEBOOK_TOKEN_URL = "https://graph.facebook.com/oauth/access_token";
/** Meta Lead Ads use case permissions — see developers.facebook.com/docs/permissions */
export const FACEBOOK_OAUTH_SCOPES =
  "pages_show_list,pages_manage_metadata,pages_manage_ads,leads_retrieval,pages_read_engagement";
/** @deprecated Use FACEBOOK_OAUTH_SCOPES */
export const FACEBOOK_DEAUTHORIZE_SCOPE = FACEBOOK_OAUTH_SCOPES;

/** Stored expiry for non-expiring Business Integration system user tokens. */
export const FACEBOOK_NON_EXPIRING_TOKEN_SECONDS = 10 * 365 * 24 * 60 * 60;

export function facebookLoginConfigId(): string | null {
  const id = process.env.FACEBOOK_LOGIN_CONFIG_ID?.trim();
  return id || null;
}

export function facebookUsesLoginForBusiness(): boolean {
  return !!facebookLoginConfigId();
}

/** Public browser-facing app origin — never derive from request Host behind ALB/ECS. */
export function facebookPublicAppOrigin(): string {
  return publicAppOrigin();
}

export type FacebookCodeExchangeResult =
  | { ok: true; accessToken: string; expiresIn: number }
  | { ok: false; message: string };

/** Exchange an OAuth authorization code for an access token. */
export async function exchangeFacebookAuthorizationCode(
  code: string,
  redirectUri: string,
): Promise<FacebookCodeExchangeResult> {
  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    return { ok: false, message: "Facebook is not configured." };
  }

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  // Manual redirect OAuth (our Connect flow) always needs redirect_uri to match
  // the authorize dialog. Meta's JS-SDK SUAT examples omit it; we do not use that path.
  const response = await fetch(`${FACEBOOK_TOKEN_URL}?${params}`);
  const data = await response.json().catch(() => null) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  } | null;

  if (!response.ok || !data?.access_token) {
    return { ok: false, message: data?.error?.message ?? "Token exchange failed." };
  }

  const expiresIn = data.expires_in && data.expires_in > 0
    ? data.expires_in
    : facebookUsesLoginForBusiness()
      ? FACEBOOK_NON_EXPIRING_TOKEN_SECONDS
      : 5_184_000;

  return { ok: true, accessToken: data.access_token, expiresIn };
}

/** Exchange a short-lived user token for a long-lived one (~60 days). */
export async function exchangeFacebookLongLivedUserToken(
  shortLivedToken: string,
): Promise<FacebookCodeExchangeResult> {
  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    return { ok: false, message: "Facebook is not configured." };
  }

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });
  const response = await fetch(`${FACEBOOK_TOKEN_URL}?${params}`);
  const data = await response.json().catch(() => null) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  } | null;

  if (!response.ok || !data?.access_token) {
    return { ok: false, message: data?.error?.message ?? "Could not obtain a long-lived token." };
  }

  return { ok: true, accessToken: data.access_token, expiresIn: data.expires_in ?? 5_184_000 };
}

export type FacebookTokenInspection =
  | {
      ok: true;
      type: string;
      scopes: string[];
      granularPageIds: string[];
      hasPageAccess: boolean;
    }
  | { ok: false; message: string };

/** Inspect a freshly exchanged token (never logs the token itself). */
export async function inspectFacebookAccessToken(accessToken: string): Promise<FacebookTokenInspection> {
  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();
  if (!appId || !appSecret) return { ok: false, message: "Facebook is not configured." };

  const appTokenParams = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "client_credentials",
  });
  const appTokenRes = await fetch(`${FACEBOOK_TOKEN_URL}?${appTokenParams}`, {
    signal: AbortSignal.timeout(12_000),
  });
  const appTokenData = await appTokenRes.json().catch(() => null) as { access_token?: string; error?: { message?: string } } | null;
  if (!appTokenRes.ok || !appTokenData?.access_token) {
    return { ok: false, message: appTokenData?.error?.message ?? "Could not inspect Facebook token." };
  }

  const url =
    `${facebookGraphApiBaseUrl()}/debug_token` +
    `?input_token=${encodeURIComponent(accessToken)}` +
    `&access_token=${encodeURIComponent(appTokenData.access_token)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  const body = await res.json().catch(() => null) as {
    data?: {
      type?: string;
      scopes?: string[];
      granular_scopes?: { scope?: string; target_ids?: (string | number)[] }[];
    };
    error?: { message?: string };
  } | null;
  if (!res.ok || body?.error || !body?.data) {
    return { ok: false, message: body?.error?.message ?? "Could not inspect Facebook token." };
  }

  const scopes = body.data.scopes ?? [];
  const pageIds = new Set<string>();
  for (const entry of body.data.granular_scopes ?? []) {
    const scope = String(entry.scope ?? "");
    if (!scope.startsWith("pages_") && scope !== "leads_retrieval" && scope !== "pages_manage_ads") continue;
    for (const id of entry.target_ids ?? []) pageIds.add(String(id));
  }
  const hasPageAccess =
    pageIds.size > 0 ||
    scopes.includes("pages_show_list") ||
    scopes.includes("pages_manage_metadata") ||
    scopes.includes("leads_retrieval");

  console.error(
    "[facebook oauth] token_inspect",
    JSON.stringify({ type: body.data.type, scopes, granularPageCount: pageIds.size, hasPageAccess }),
  );

  return {
    ok: true,
    type: String(body.data.type ?? ""),
    scopes,
    granularPageIds: [...pageIds],
    hasPageAccess,
  };
}

/**
 * Build the Meta OAuth dialog URL. Prefers FACEBOOK_APP_ID (runtime secret /
 * ECS) then NEXT_PUBLIC_FACEBOOK_APP_ID (build-time). App ID is not secret —
 * storing it server-side lets Connect work even when a deploy omitted the
 * public build arg.
 *
 * When FACEBOOK_LOGIN_CONFIG_ID is set, uses Facebook Login for Business
 * (config_id replaces scope; system-user configs also need override_default_response_type).
 */
export function buildFacebookOAuthUrl(venueId: string): string | null {
  const clientId =
    process.env.FACEBOOK_APP_ID?.trim() ||
    process.env.NEXT_PUBLIC_FACEBOOK_APP_ID?.trim() ||
    "";
  const appUrl = facebookPublicAppOrigin();
  const configId = facebookLoginConfigId();
  if (!clientId || !appUrl || !venueId.trim()) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: `${appUrl}/api/facebook/callback`,
    state: venueId,
    // Force Meta to re-prompt permissions/assets after a prior public_profile-only grant.
    auth_type: "rerequest",
    display: "page",
  });

  if (configId) {
    params.set("config_id", configId);
    params.set("override_default_response_type", "true");
  } else {
    params.set("scope", FACEBOOK_OAUTH_SCOPES);
  }

  console.error(
    "[facebook oauth] connect_url",
    JSON.stringify({
      hasConfigId: !!configId,
      configIdLast4: configId ? configId.slice(-4) : null,
      usesScope: !configId,
      dialog: FACEBOOK_OAUTH_DIALOG_URL,
    }),
  );

  return `${FACEBOOK_OAUTH_DIALOG_URL}?${params}`;
}
