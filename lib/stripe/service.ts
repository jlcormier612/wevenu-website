/**
 * Stripe Connect (Standard) application service. Server-only.
 *
 * Two confirmed-live gaps fixed here (docs/venue-payment-processing-
 * architecture.md §3): connectStripeAccount() used to set
 * stripe_charges_enabled: true unconditionally the moment OAuth succeeded,
 * never reading Stripe's own flag; disconnectStripeAccount() only ever
 * cleared local columns, never calling Stripe's own deauthorize endpoint.
 * Both mirror the QuickBooks integration's connect/disconnect shape.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import * as venueRepo from "@/lib/venue/repository";
import { getStripeClient, isStripeConfigured, STRIPE_OAUTH_DEAUTHORIZE_URL, STRIPE_SUPPORTED_PAYMENT_METHODS } from "@/lib/stripe/config";
import type { StripeActionResult } from "@/lib/stripe/types";
import type { StripePaymentMethodType } from "@/lib/venue/types";

/**
 * Store a confirmed Stripe Connect account. Reads the connected account's
 * real charges_enabled flag rather than assuming it — a venue mid-KYC now
 * correctly shows "connected, but not yet able to accept charges" instead
 * of a false "ready to charge."
 */
export async function connectStripeAccount(accountId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await createClient();
  const venue = await getCurrentVenue();
  if (!venue) return;

  let chargesEnabled = false;
  if (isStripeConfigured()) {
    try {
      const account = await getStripeClient().accounts.retrieve(accountId);
      chargesEnabled = !!account.charges_enabled;
    } catch (err) {
      console.error("[stripe] could not retrieve connected account after OAuth", err);
    }
  }

  await venueRepo.updateVenueFields(supabase, venue.id, {
    stripe_account_id: accountId,
    stripe_onboarding_status: "connected",
    stripe_charges_enabled: chargesEnabled,
    stripe_charges_enabled_verified_at: new Date().toISOString(),
  });
}

/**
 * Calls Stripe's own deauthorize endpoint before clearing local state —
 * mirrors disconnectQuickBooksAccount() exactly. Best-effort: revoke
 * failure still clears local state, never leaving a venue stuck
 * "connected" locally to a revoke call that failed for an unrelated
 * reason.
 */
export async function disconnectStripeAccount(): Promise<StripeActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const supabase = await createClient();
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };

  const clientId = process.env.NEXT_PUBLIC_STRIPE_CLIENT_ID;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (venue.stripeAccountId && clientId && secretKey) {
    try {
      await fetch(STRIPE_OAUTH_DEAUTHORIZE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${secretKey}`,
        },
        body: new URLSearchParams({ client_id: clientId, stripe_user_id: venue.stripeAccountId }),
      });
    } catch {
      // Revoke is best-effort — local disconnect proceeds regardless, see docstring above.
    }
  }

  await venueRepo.updateVenueFields(supabase, venue.id, {
    stripe_account_id: null,
    stripe_onboarding_status: "not_started",
    stripe_charges_enabled: false,
    stripe_charges_enabled_verified_at: null,
  });
  return { ok: true };
}

/** "Accepted payment methods" — a checklist in Financial Settings, not a single ACH toggle. At least one method must remain selected. */
export async function updateAcceptedPaymentMethods(methods: StripePaymentMethodType[]): Promise<StripeActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const unique = Array.from(new Set(methods)).filter((m) =>
    (STRIPE_SUPPORTED_PAYMENT_METHODS as readonly string[]).includes(m));
  if (unique.length === 0) return { ok: false, message: "Select at least one payment method." };

  const supabase = await createClient();
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };

  await venueRepo.updateVenueFields(supabase, venue.id, { stripe_accepted_payment_methods: unique });
  return { ok: true };
}
