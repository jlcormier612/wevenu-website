import { type NextRequest, NextResponse } from "next/server";

import { connectStripeAction } from "@/app/(app)/settings/actions";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Stripe Connect OAuth callback.
 *
 * Flow:
 *  1. User clicks "Connect with Stripe" in Settings.
 *  2. Redirected to Stripe: https://connect.stripe.com/oauth/authorize?...
 *  3. User authorizes → Stripe redirects here:
 *     /api/stripe/callback?code=xxx&state={venueId}
 *  4. This route exchanges the code for an account ID and stores it.
 *  5. Redirects to /settings with a success or error param.
 *
 * Requires:
 *   STRIPE_SECRET_KEY      — server-only Stripe secret key
 *   NEXT_PUBLIC_APP_URL    — the public origin (for the redirect URI)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const settingsUrl = new URL("/settings", origin);

  if (error) {
    settingsUrl.searchParams.set("stripe_error", errorDescription ?? error);
    return NextResponse.redirect(settingsUrl);
  }

  if (!code) {
    settingsUrl.searchParams.set("stripe_error", "Missing authorization code.");
    return NextResponse.redirect(settingsUrl);
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !isSupabaseConfigured) {
    settingsUrl.searchParams.set("stripe_error", "Stripe is not configured.");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    // Exchange authorization code for the connected account ID
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
    });

    const tokenResponse = await fetch(
      "https://connect.stripe.com/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${secretKey}`,
        },
        body,
      },
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      settingsUrl.searchParams.set(
        "stripe_error",
        tokenData.error_description ?? tokenData.error,
      );
      return NextResponse.redirect(settingsUrl);
    }

    const stripeAccountId = tokenData.stripe_user_id as string;
    if (!stripeAccountId) {
      settingsUrl.searchParams.set("stripe_error", "No account ID returned.");
      return NextResponse.redirect(settingsUrl);
    }

    // Persist to the venue record
    await connectStripeAction(stripeAccountId);

    settingsUrl.searchParams.set("stripe_success", "1");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    settingsUrl.searchParams.set("stripe_error", message);
    return NextResponse.redirect(settingsUrl);
  }
}
