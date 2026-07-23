import { type NextRequest, NextResponse } from "next/server";

import { connectStripeAction } from "@/app/(app)/settings/actions";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

/**
 * Stripe Connect OAuth callback.
 *
 * Flow:
 *  1. User clicks "Connect with Stripe" in Settings, or in the Guided
 *     Setup wizard's "payments" step (Hospitality Success Platform §1.2,
 *     2026-07-22 — Financial Setup folded into the main step sequence).
 *  2. Redirected to Stripe: https://connect.stripe.com/oauth/authorize?...
 *  3. User authorizes → Stripe redirects here:
 *     /api/stripe/callback?code=xxx&state={venueId}:{returnTo}
 *  4. This route exchanges the code for an account ID and stores it.
 *  5. Redirects back to wherever the connect flow started — /settings, or
 *     plain /setup for onboarding (which naturally resumes at the
 *     "payments" step via the wizard's existing setup_last_step
 *     resumability, the same mechanism the QuickBooks callback already
 *     relies on) — with a success or error param.
 *
 * Requires:
 *   STRIPE_SECRET_KEY      — server-only Stripe secret key
 *   NEXT_PUBLIC_APP_URL    — the public origin (for the redirect URI)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const [stateVenueId, stateReturnTo] = (state ?? "").split(":");
  const destinationUrl = stateReturnTo === "onboarding"
    ? new URL("/setup", origin)
    : new URL("/settings", origin);

  if (error) {
    destinationUrl.searchParams.set("stripe_error", errorDescription ?? error);
    return NextResponse.redirect(destinationUrl);
  }

  if (!code) {
    destinationUrl.searchParams.set("stripe_error", "Missing authorization code.");
    return NextResponse.redirect(destinationUrl);
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !isSupabaseConfigured) {
    destinationUrl.searchParams.set("stripe_error", "Stripe is not configured.");
    return NextResponse.redirect(destinationUrl);
  }

  // CSRF: state must match the caller's actual venue. This previously
  // wasn't checked at all (unlike the QuickBooks callback, which always
  // has) — added as a real fix, not defense-in-depth this time; there was
  // genuinely no verification here before. The returnTo half isn't itself
  // trust-sensitive (it only picks which page shows the toast), same as
  // the QuickBooks callback's identical check.
  const venue = await getCurrentVenue();
  if (!venue || venue.id !== stateVenueId) {
    destinationUrl.searchParams.set("stripe_error", "Session/venue mismatch. Please try connecting again.");
    return NextResponse.redirect(destinationUrl);
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
      destinationUrl.searchParams.set(
        "stripe_error",
        tokenData.error_description ?? tokenData.error,
      );
      return NextResponse.redirect(destinationUrl);
    }

    const stripeAccountId = tokenData.stripe_user_id as string;
    if (!stripeAccountId) {
      destinationUrl.searchParams.set("stripe_error", "No account ID returned.");
      return NextResponse.redirect(destinationUrl);
    }

    // Persist to the venue record
    await connectStripeAction(stripeAccountId);

    destinationUrl.searchParams.set("stripe_success", "1");
    return NextResponse.redirect(destinationUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    destinationUrl.searchParams.set("stripe_error", message);
    return NextResponse.redirect(destinationUrl);
  }
}
