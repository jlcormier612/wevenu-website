/**
 * Persist Stripe Connect capability flags onto the matching venue row.
 *
 * Used by OAuth connect (session venue) and by Connect webhooks
 * (account id → venue). Checkout reads venues.stripe_charges_enabled via
 * get_portal_checkout_context — stale true after Stripe disables charges
 * is the defect this module closes when driven by account.updated.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

export type ConnectedAccountCapabilitySnapshot = {
  chargesEnabled: boolean;
  verifiedAt: string;
};

/** Read Stripe's own charges_enabled (never invent true). */
export function chargesEnabledFromAccount(account: Pick<Stripe.Account, "charges_enabled">): boolean {
  return !!account.charges_enabled;
}

export function capabilitySnapshotFromAccount(
  account: Pick<Stripe.Account, "charges_enabled">,
  verifiedAt: string = new Date().toISOString(),
): ConnectedAccountCapabilitySnapshot {
  return {
    chargesEnabled: chargesEnabledFromAccount(account),
    verifiedAt,
  };
}

/**
 * Update the venue whose stripe_account_id matches. Returns false when no
 * connected venue owns that account — callers must not invent a venue.
 */
export async function persistConnectedAccountCapabilitiesByAccountId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
  stripeAccountId: string,
  snapshot: ConnectedAccountCapabilitySnapshot,
): Promise<{ ok: true; venueId: string } | { ok: false; reason: "not_found" | "update_failed"; message?: string }> {
  const { data: venue, error: lookupError } = await admin
    .from("venues")
    .select("id")
    .eq("stripe_account_id", stripeAccountId)
    .maybeSingle<{ id: string }>();

  if (lookupError) {
    return { ok: false, reason: "update_failed", message: lookupError.message };
  }
  if (!venue?.id) {
    return { ok: false, reason: "not_found" };
  }

  const { error: updateError } = await admin
    .from("venues")
    .update({
      stripe_charges_enabled: snapshot.chargesEnabled,
      stripe_charges_enabled_verified_at: snapshot.verifiedAt,
    })
    .eq("id", venue.id)
    .eq("stripe_account_id", stripeAccountId);

  if (updateError) {
    return { ok: false, reason: "update_failed", message: updateError.message };
  }

  return { ok: true, venueId: venue.id };
}
