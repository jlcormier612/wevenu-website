import { type NextRequest, NextResponse } from "next/server";

import { connectFacebookAction } from "@/app/(app)/settings/facebook-actions";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import {
  exchangeFacebookAuthorizationCode,
  exchangeFacebookLongLivedUserToken,
  facebookPublicAppOrigin,
  facebookUsesLoginForBusiness,
} from "@/lib/facebook/config";

/**
 * Facebook OAuth callback. Mirrors app/api/quickbooks/callback/route.ts's
 * shape (state = venueId for CSRF, exchange code for a token, persist,
 * redirect back with a success/error param).
 *
 * Post-OAuth browser redirects use NEXT_PUBLIC_APP_URL — never
 * request.nextUrl.origin (ECS/ALB internal hostnames are not browser-routable).
 *
 * Facebook Login for Business (FACEBOOK_LOGIN_CONFIG_ID): single code
 * exchange → non-expiring system-user token; no fb_exchange_token step.
 *
 * Legacy scope-based Facebook Login: code → short-lived user token →
 * long-lived user token (~60 days).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const publicOrigin = facebookPublicAppOrigin();
  const settingsUrl = new URL("/settings", publicOrigin);

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
    const redirectUri = `${publicOrigin}/api/facebook/callback`;

    const initial = await exchangeFacebookAuthorizationCode(code, redirectUri);
    if (!initial.ok) {
      settingsUrl.searchParams.set("facebook_error", initial.message);
      return NextResponse.redirect(settingsUrl);
    }

    let accessToken = initial.accessToken;
    let expiresIn = initial.expiresIn;

    if (!facebookUsesLoginForBusiness()) {
      const longLived = await exchangeFacebookLongLivedUserToken(accessToken);
      if (!longLived.ok) {
        settingsUrl.searchParams.set("facebook_error", longLived.message);
        return NextResponse.redirect(settingsUrl);
      }
      accessToken = longLived.accessToken;
      expiresIn = longLived.expiresIn;
    }

    await connectFacebookAction({ userAccessToken: accessToken, expiresIn });

    settingsUrl.searchParams.set("facebook_success", "1");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    settingsUrl.searchParams.set("facebook_error", message);
    return NextResponse.redirect(settingsUrl);
  }
}
