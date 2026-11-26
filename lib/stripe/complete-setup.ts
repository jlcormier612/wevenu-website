/**
 * Resume incomplete Standard Connect merchant onboarding without disconnecting
 * or creating a second Stripe account.
 *
 * Architecture: HTC uses Standard Connect + OAuth. Stripe Account Links with
 * type `account_onboarding` are supported for Standard accounts and send the
 * existing connected account into Stripe-hosted onboarding for outstanding
 * requirements. Express `login_links` are not used (Standard has a full
 * Dashboard; login_links return 400 for Standard).
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured, publicAppOrigin } from "@/lib/env";
import { chargesEnabledFromAccount } from "@/lib/stripe/account-capabilities";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/config";
import type { StripeActionResult } from "@/lib/stripe/types";
import { getCurrentVenue } from "@/lib/venue/service";
import * as venueRepo from "@/lib/venue/repository";

export type StripeSetupReturnTo = "settings" | "onboarding";

export function buildStripeCompleteSetupReturnUrls(
  returnTo: StripeSetupReturnTo = "settings",
): { returnUrl: string; refreshUrl: string } {
  const origin = publicAppOrigin();
  const path =
    returnTo === "onboarding" ? "/setup-hub/financials" : "/settings/integrations";
  const base = `${origin}${path}`;
  return {
    returnUrl: `${base}?stripe_setup=returned`,
    refreshUrl: `${base}?stripe_setup=refresh`,
  };
}

/**
 * Create a single-use Stripe Account Link for the venue's existing connected
 * Standard account so the venue can finish KYC / bank / ToS without OAuth again.
 */
export async function createCompleteStripeSetupLink(
  returnTo: StripeSetupReturnTo = "settings",
): Promise<StripeActionResult & { url?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  if (!isStripeConfigured()) return { ok: false, message: "Stripe is not configured." };

  const { requireCapability } = await import("@/lib/authorization/membership");
  const gate = await requireCapability(
    "settings.integrations",
    "You do not have permission to manage integrations.",
  );
  if (!gate.ok) return { ok: false, message: gate.error };

  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  if (!venue.stripeAccountId || venue.stripeOnboardingStatus !== "connected") {
    return { ok: false, message: "Connect Stripe before completing setup." };
  }
  if (venue.stripeChargesEnabled) {
    return { ok: false, message: "Stripe setup is already complete for this venue." };
  }

  const { returnUrl, refreshUrl } = buildStripeCompleteSetupReturnUrls(returnTo);

  try {
    const link = await getStripeClient().accountLinks.create({
      account: venue.stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });
    if (!link.url) {
      return { ok: false, message: "Stripe did not return a setup link. Try again." };
    }
    return { ok: true, url: link.url };
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Could not open Stripe setup. Try again in a moment.";
    console.error("[stripe] accountLinks.create failed", err);
    return { ok: false, message };
  }
}

/**
 * Re-read the connected account's charges_enabled from Stripe and persist it.
 * Used after returning from Account Link onboarding and for manual refresh.
 * Does not enable payments locally unless Stripe reports charges_enabled.
 */
export async function refreshStripeChargesEnabled(): Promise<
  StripeActionResult & { chargesEnabled?: boolean }
> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  if (!isStripeConfigured()) return { ok: false, message: "Stripe is not configured." };

  const { requireCapability } = await import("@/lib/authorization/membership");
  const gate = await requireCapability(
    "settings.integrations",
    "You do not have permission to manage integrations.",
  );
  if (!gate.ok) return { ok: false, message: gate.error };

  const supabase = await createClient();
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  if (!venue.stripeAccountId || venue.stripeOnboardingStatus !== "connected") {
    return { ok: false, message: "No connected Stripe account to refresh." };
  }

  try {
    const account = await getStripeClient().accounts.retrieve(venue.stripeAccountId);
    const chargesEnabled = chargesEnabledFromAccount(account);
    await venueRepo.updateVenueFields(supabase, venue.id, {
      stripe_charges_enabled: chargesEnabled,
      stripe_charges_enabled_verified_at: new Date().toISOString(),
    });
    return { ok: true, chargesEnabled };
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Could not refresh Stripe status. Try again in a moment.";
    console.error("[stripe] refresh charges_enabled failed", err);
    return { ok: false, message };
  }
}
