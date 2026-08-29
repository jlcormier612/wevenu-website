import { type NextRequest, NextResponse } from "next/server";

import { connectQuickBooksAction } from "@/app/(app)/settings/actions";
import { isSupabaseConfigured, publicAppOrigin } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import { QUICKBOOKS_TOKEN_URL } from "@/lib/quickbooks/config";

/**
 * QuickBooks Online OAuth callback. Mirrors app/api/stripe/callback/route.ts
 * exactly, with two real differences from Stripe's flow: QBO's callback
 * also returns a realmId (the connected company's ID), and the token
 * exchange uses HTTP Basic auth (client_id:client_secret), not a Bearer
 * token.
 *
 * Flow:
 *  1. User clicks "Connect with QuickBooks" in Settings, or in the Guided
 *     Setup wizard's "payments" step (Hospitality Success Platform §1.2,
 *     2026-07-22 — Financial Setup folded into the main step sequence).
 *  2. Redirected to Intuit: https://appcenter.intuit.com/connect/oauth2?...
 *  3. User authorizes → Intuit redirects here:
 *     /api/quickbooks/callback?code=xxx&realmId=yyy&state={venueId}:{returnTo}
 *  4. This route exchanges the code for tokens and stores them.
 *  5. Redirects back to wherever the connect flow started — /settings, or
 *     /setup-hub/financials when connecting from Setup Hub Financials — with
 *     a success or error param.
 *     The `returnTo` half of `state` isn't itself trust-sensitive (it only
 *     picks which page shows the toast), so it's read even before the CSRF
 *     check below can run.
 *
 * Post-OAuth browser redirects use NEXT_PUBLIC_APP_URL via publicAppOrigin()
 * — never request.nextUrl.origin (ECS/ALB internal hostnames are not
 * browser-routable), matching app/api/facebook/callback/route.ts.
 *
 * Requires:
 *   QUICKBOOKS_CLIENT_ID / QUICKBOOKS_CLIENT_SECRET
 *   NEXT_PUBLIC_APP_URL — the public origin (redirect URI + return redirect)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const [stateVenueId, stateReturnTo] = (state ?? "").split(":");
  const origin = publicAppOrigin();
  const destinationUrl = stateReturnTo === "onboarding"
    ? new URL("/setup-hub/financials", origin)
    : new URL("/settings/integrations", origin);

  if (error) {
    destinationUrl.searchParams.set("quickbooks_error", errorDescription ?? error);
    return NextResponse.redirect(destinationUrl);
  }

  if (!code) {
    destinationUrl.searchParams.set("quickbooks_error", "Missing authorization code.");
    return NextResponse.redirect(destinationUrl);
  }

  if (!realmId) {
    destinationUrl.searchParams.set("quickbooks_error", "No company (realm) ID returned.");
    return NextResponse.redirect(destinationUrl);
  }

  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  if (!clientId || !clientSecret || !isSupabaseConfigured) {
    destinationUrl.searchParams.set("quickbooks_error", "QuickBooks is not configured.");
    return NextResponse.redirect(destinationUrl);
  }

  // CSRF: state must match the caller's actual venue. Stripe's callback
  // skips this since connectStripeAccount() always resolves venue from the
  // session regardless of state; added here anyway as defense-in-depth
  // since Intuit's own OAuth guide documents state verification as
  // expected, and it's cheap.
  const venue = await getCurrentVenue();
  if (!venue || venue.id !== stateVenueId) {
    destinationUrl.searchParams.set("quickbooks_error", "Session/venue mismatch. Please try connecting again.");
    return NextResponse.redirect(destinationUrl);
  }

  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const tokenResponse = await fetch(QUICKBOOKS_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${appUrl}/api/quickbooks/callback`,
      }),
    });

    const tokenData = await tokenResponse.json() as {
      access_token?: string; refresh_token?: string;
      expires_in?: number; x_refresh_token_expires_in?: number;
      error?: string; error_description?: string;
    };

    if (!tokenResponse.ok || !tokenData.access_token || !tokenData.refresh_token) {
      destinationUrl.searchParams.set("quickbooks_error", tokenData.error_description ?? tokenData.error ?? "Token exchange failed.");
      return NextResponse.redirect(destinationUrl);
    }

    await connectQuickBooksAction({
      realmId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      accessTokenExpiresIn: tokenData.expires_in ?? 3600,
      refreshTokenExpiresIn: tokenData.x_refresh_token_expires_in ?? 8_726_400,
    });

    destinationUrl.searchParams.set("quickbooks_success", "1");
    return NextResponse.redirect(destinationUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    destinationUrl.searchParams.set("quickbooks_error", message);
    return NextResponse.redirect(destinationUrl);
  }
}
