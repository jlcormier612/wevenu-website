/**
 * Founding Membership lifecycle helpers.
 *
 * Approved policy:
 * - Discount remains while the Stripe subscription is still active
 *   (including cancel_at_period_end until the period actually ends).
 * - When the subscription fully ends (canceled / deleted), Founding
 *   eligibility for *billing* ends — revoke the grant prospectively.
 * - Do not silently re-issue Founding on a later new subscription.
 * - Soft-100 allocations are permanently consumed (`countConsumedFoundingAllocations`
 *   counts earned + revoked). Cancellation ends the discount but does not
 *   reopen the place for another venue.
 * - Soft promotional limit only: never fail Checkout because of the counter.
 *   Concurrent purchases near 100 may yield a small overage (101–103) by design.
 */

export type FoundingSubscriptionLifecycleInput = {
  /** Stripe subscription.status (or "canceled" when deleted). */
  stripeStatus: string;
  /** True for customer.subscription.deleted. */
  deleted?: boolean;
  cancelAtPeriodEnd?: boolean;
};

/**
 * True when Founding billing eligibility must end (subscription fully over).
 * Scheduled cancellation while still active does NOT end Founding.
 */
export function shouldEndFoundingEligibilityOnSubscriptionEvent(
  input: FoundingSubscriptionLifecycleInput,
): boolean {
  if (input.deleted) return true;
  const status = (input.stripeStatus || "").toLowerCase();
  if (status === "canceled" || status === "cancelled") return true;
  // Incomplete expired never activated — treat as ended for safety.
  if (status === "incomplete_expired") return true;
  return false;
}

/** True while the subscription can still bill Founding (active period). */
export function foundingDiscountStillValidOnSubscription(input: {
  stripeStatus: string;
  deleted?: boolean;
}): boolean {
  if (input.deleted) return false;
  const status = (input.stripeStatus || "").toLowerCase();
  return ["active", "trialing", "past_due"].includes(status);
}
