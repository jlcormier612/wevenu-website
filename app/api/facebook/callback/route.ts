import { type NextRequest, NextResponse } from "next/server";

import { connectFacebookAction } from "@/app/(app)/settings/facebook-actions";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import { FACEBOOK_TOKEN_URL } from "@/lib/facebook/config";

/**
 * Facebook OAuth callback. Mirrors app/api/quickbooks/callback/route.ts's
 * shape (state = venueId for CSRF, exchange code for a token, persist,
 * redirect back with a success/error param) — with the two real
 * differences Meta's flow needs: a short-lived user token must be
 * exchanged a SECOND time for a long-lived one (Meta has no rotating
 * refresh token the way QBO does), and there's no realmId-equivalent —
 * the Page (and therefore which "account" this connection is scoped to)
 * is chosen afterward, in Settings, not during this callback.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const settingsUrl = new URL("/settings", origin);

  if (error) {
    settingsUrl.searchParams.set("facebook_error", errorDescription ?? error);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code) {
    settingsUrl.searchParams.set("facebook_error", "Missing authorization code.");
    return NextResponse.redirect(settingsUrl);
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret || !isSupabaseConfigured) {
    settingsUrl.searchParams.set("facebook_error", "Facebook is not configured.");
    return NextResponse.redirect(settingsUrl);
  }

  const venue = await getCurrentVenue();
  if (!venue || venue.id !== state) {
    settingsUrl.searchParams.set("facebook_error", "Session/venue mismatch. Please try connecting again.");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Step 1: exchange the authorization code for a short-lived user token.
    const shortLivedParams = new URLSearchParams({
      client_id: appId, client_secret: appSecret, redirect_uri: `${appUrl}/api/facebook/callback`, code,
    });
    const shortLivedRes = await fetch(`${FACEBOOK_TOKEN_URL}?${shortLivedParams}`);
    const shortLivedData = await shortLivedRes.json().catch(() => null) as { access_token?: string; error?: { message?: string } } | null;
    if (!shortLivedRes.ok || !shortLivedData?.access_token) {
      settingsUrl.searchParams.set("facebook_error", shortLivedData?.error?.message ?? "Token exchange failed.");
      return NextResponse.redirect(settingsUrl);
    }

    // Step 2: exchange the short-lived token for a long-lived one (~60 days).
    const longLivedParams = new URLSearchParams({
      grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret,
      fb_exchange_token: shortLivedData.access_token,
    });
    const longLivedRes = await fetch(`${FACEBOOK_TOKEN_URL}?${longLivedParams}`);
    const longLivedData = await longLivedRes.json().catch(() => null) as { access_token?: string; expires_in?: number; error?: { message?: string } } | null;
    if (!longLivedRes.ok || !longLivedData?.access_token) {
      settingsUrl.searchParams.set("facebook_error", longLivedData?.error?.message ?? "Could not obtain a long-lived token.");
      return NextResponse.redirect(settingsUrl);
    }

    await connectFacebookAction({
      userAccessToken: longLivedData.access_token,
      expiresIn: longLivedData.expires_in ?? 5_184_000, // ~60 days, Meta's typical long-lived token lifetime
    });

    settingsUrl.searchParams.set("facebook_success", "1");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    settingsUrl.searchParams.set("facebook_error", message);
    return NextResponse.redirect(settingsUrl);
  }
}
