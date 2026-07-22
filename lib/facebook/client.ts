/**
 * Meta Graph API client. Server-only, raw fetch — same convention as
 * lib/quickbooks/client.ts and every other provider integration in this
 * codebase.
 *
 * Token model is genuinely different from QuickBooks: there is no
 * rotating refresh token. A long-lived user access token (~60 days) is
 * extended by continuing to use it; if it lapses entirely, the venue must
 * re-authorize. Page access tokens derived from a still-valid user token
 * don't expire independently and need no separate refresh handling.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { FACEBOOK_TOKEN_URL, facebookGraphApiBaseUrl } from "@/lib/facebook/config";
import * as repo from "@/lib/facebook/repository";

const REFRESH_BUFFER_MS = 5 * 24 * 60 * 60 * 1000; // re-extend if within 5 days of expiry

export type FacebookFetchResult = { ok: true; response: Response } | { ok: false; error: string; retryable: boolean };

async function extendUserToken(venueId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const connection = await repo.getConnectionWithTokens(admin, venueId);
  if (!connection) return { ok: false, error: "Not connected to Facebook." };

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId ?? "",
    client_secret: appSecret ?? "",
    fb_exchange_token: connection.userAccessToken,
  });

  const response = await fetch(`${FACEBOOK_TOKEN_URL}?${params}`);
  const data = await response.json().catch(() => null) as { access_token?: string; expires_in?: number; error?: { message?: string } } | null;

  if (!response.ok || !data?.access_token) {
    const message = data?.error?.message ?? "Could not extend Facebook connection.";
    await repo.setConnectionError(admin, venueId, message);
    return { ok: false, error: message };
  }

  await admin.from("facebook_connections").update({
    user_access_token: data.access_token,
    user_token_expires_at: new Date(Date.now() + (data.expires_in ?? 5_184_000) * 1000).toISOString(),
  }).eq("venue_id", venueId);

  return { ok: true };
}

async function getValidPageToken(venueId: string): Promise<{ ok: true; pageAccessToken: string; pageId: string } | { ok: false; error: string; retryable: boolean }> {
  const admin = createAdminClient();
  let connection = await repo.getConnectionWithTokens(admin, venueId);
  if (!connection || connection.status !== "connected") {
    return { ok: false, error: "Not connected to Facebook.", retryable: false };
  }
  if (!connection.pageAccessToken || !connection.pageId) {
    return { ok: false, error: "No Page selected yet.", retryable: false };
  }

  const expiresAt = new Date(connection.userTokenExpiresAt).getTime();
  if (Date.now() >= expiresAt) {
    return { ok: false, error: "Facebook connection expired — please reconnect.", retryable: false };
  }
  if (Date.now() >= expiresAt - REFRESH_BUFFER_MS) {
    const extended = await extendUserToken(venueId);
    if (!extended.ok) return { ok: false, error: extended.error, retryable: false };
    connection = await repo.getConnectionWithTokens(admin, venueId);
  }

  return { ok: true, pageAccessToken: connection!.pageAccessToken!, pageId: connection!.pageId! };
}

/** GET/POST against the Graph API using the venue's Page access token. */
export async function facebookFetch(venueId: string, path: string, init?: RequestInit): Promise<FacebookFetchResult> {
  const token = await getValidPageToken(venueId);
  if (!token.ok) return { ok: false, error: token.error, retryable: token.retryable };

  const separator = path.includes("?") ? "&" : "?";
  const url = `${facebookGraphApiBaseUrl()}${path}${separator}access_token=${encodeURIComponent(token.pageAccessToken)}`;
  const response = await fetch(url, init);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // Meta's error codes for an expired/invalid token are 190; everything
    // else 4xx is generally a permanent validation error, 5xx is transient.
    const retryable = response.status === 429 || response.status >= 500;
    return { ok: false, error: `Facebook API error ${response.status}: ${body.slice(0, 500)}`, retryable };
  }

  return { ok: true, response };
}
