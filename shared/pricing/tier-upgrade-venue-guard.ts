/**
 * Multi-venue isolation checks for Phase 3 evaluation.
 */

import type { StripeSubscriptionBillingSnapshot } from "./tier-upgrade-types";

export function assertVenueSubscriptionIsolation(input: {
  venueId: string;
  venueStripeSubscriptionId: string | null | undefined;
  venueStripeCustomerId: string | null | undefined;
  snapshot: StripeSubscriptionBillingSnapshot;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.venueStripeSubscriptionId) {
    return { ok: false, reason: "Venue has no saas_stripe_subscription_id." };
  }
  if (input.snapshot.subscriptionId !== input.venueStripeSubscriptionId) {
    return {
      ok: false,
      reason: `Stripe subscription ${input.snapshot.subscriptionId} does not match venue mapping ${input.venueStripeSubscriptionId}.`,
    };
  }
  if (
    input.venueStripeCustomerId &&
    input.snapshot.customerId &&
    input.snapshot.customerId !== input.venueStripeCustomerId
  ) {
    return {
      ok: false,
      reason: `Stripe customer ${input.snapshot.customerId} does not match venue mapping ${input.venueStripeCustomerId} (venue ${input.venueId}).`,
    };
  }
  return { ok: true };
}
