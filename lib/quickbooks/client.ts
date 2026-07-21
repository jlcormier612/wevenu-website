/**
 * QuickBooks Online API client. Server-only, no SDK — raw fetch, matching
 * this codebase's convention for every other provider integration
 * (Resend, Twilio, Stripe Connect).
 *
 * Token refresh is lazy-on-401 layered under a proactive pre-call check,
 * not a separate polling cron: the only caller of the QBO API is the sync
 * queue processor, which already runs on a 5-minute cron tick, so a
 * separate "refresh 5 minutes before expiry" job would have nothing to do
 * that this doesn't already cover.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { QUICKBOOKS_TOKEN_URL, quickBooksApiBaseUrl } from "@/lib/quickbooks/config";
import * as repo from "@/lib/quickbooks/repository";

const REFRESH_BUFFER_MS = 2 * 60 * 1000; // refresh if within 2 minutes of expiry

function basicAuthHeader(): string {
  const id = process.env.QUICKBOOKS_CLIENT_ID ?? "";
  const secret = process.env.QUICKBOOKS_CLIENT_SECRET ?? "";
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

type TokenResult =
  | { ok: true; accessToken: string; realmId: string }
  | { ok: false; error: string; refreshTokenDead: boolean };

/**
 * Refreshes the venue's access token if it's expired or about to be,
 * persisting the rotated refresh token immediately — QBO invalidates the
 * prior refresh token on every use, so a delay here breaks future
 * refreshes. Returns the (possibly still-valid, unrefreshed) access token
 * otherwise.
 */
export async function getValidAccessToken(venueId: string): Promise<TokenResult> {
  const admin = createAdminClient();
  const connection = await repo.getConnectionWithTokens(admin, venueId);
  if (!connection || connection.status !== "connected") {
    return { ok: false, error: "Not connected to QuickBooks.", refreshTokenDead: false };
  }

  const expiresAt = new Date(connection.accessTokenExpiresAt).getTime();
  if (Date.now() < expiresAt - REFRESH_BUFFER_MS) {
    return { ok: true, accessToken: connection.accessToken, realmId: connection.realmId };
  }

  // Refresh token expired outright — no point attempting the call.
  if (Date.now() >= new Date(connection.refreshTokenExpiresAt).getTime()) {
    await repo.setConnectionError(admin, venueId, "QuickBooks connection expired — please reconnect.");
    return { ok: false, error: "QuickBooks connection expired — please reconnect.", refreshTokenDead: true };
  }

  const response = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: basicAuthHeader(),
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: connection.refreshToken }),
  });
  const data = await response.json().catch(() => null) as {
    access_token?: string; refresh_token?: string; expires_in?: number; x_refresh_token_expires_in?: number;
    error?: string; error_description?: string;
  } | null;

  if (!response.ok || !data?.access_token || !data.refresh_token) {
    const message = data?.error_description ?? data?.error ?? "Could not refresh QuickBooks connection.";
    // A 400/401 on refresh means the refresh token itself is dead (revoked
    // from Intuit's side, or genuinely expired) — this requires a human to
    // reconnect, not another retry.
    const refreshTokenDead = response.status === 400 || response.status === 401;
    if (refreshTokenDead) await repo.setConnectionError(admin, venueId, message);
    return { ok: false, error: message, refreshTokenDead };
  }

  const now = Date.now();
  await repo.updateTokens(admin, venueId, {
    accessToken: data.access_token,
    accessTokenExpiresAt: new Date(now + (data.expires_in ?? 3600) * 1000).toISOString(),
    refreshToken: data.refresh_token,
    refreshTokenExpiresAt: new Date(now + (data.x_refresh_token_expires_in ?? 8_726_400) * 1000).toISOString(),
  });

  return { ok: true, accessToken: data.access_token, realmId: connection.realmId };
}

export type QuickBooksFetchResult =
  | { ok: true; response: Response }
  | { ok: false; error: string; retryable: boolean };

/**
 * Thin wrapper: resolves a valid token, calls the QBO REST API, and does
 * exactly one forced-refresh retry on an unexpected 401 (the token looked
 * valid locally but QBO rejected it anyway — rare, but a single retry
 * layer catches it without the processor needing to know about tokens at
 * all).
 */
export async function quickBooksFetch(venueId: string, path: string, init?: RequestInit): Promise<QuickBooksFetchResult> {
  const token = await getValidAccessToken(venueId);
  if (!token.ok) return { ok: false, error: token.error, retryable: !token.refreshTokenDead };

  const url = `${quickBooksApiBaseUrl()}/v3/company/${token.realmId}${path}`;
  const doFetch = (accessToken: string) => fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });

  let response = await doFetch(token.accessToken);
  if (response.status === 401) {
    const admin = createAdminClient();
    await admin.from("quickbooks_connections").update({ access_token_expires_at: new Date(0).toISOString() }).eq("venue_id", venueId);
    const retried = await getValidAccessToken(venueId);
    if (!retried.ok) return { ok: false, error: retried.error, retryable: !retried.refreshTokenDead };
    response = await doFetch(retried.accessToken);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // 4xx other than 401/429 are generally permanent (validation errors) —
    // 429/5xx are transient and worth retrying.
    const retryable = response.status === 429 || response.status >= 500;
    return { ok: false, error: `QuickBooks API error ${response.status}: ${body.slice(0, 500)}`, retryable };
  }

  return { ok: true, response };
}
