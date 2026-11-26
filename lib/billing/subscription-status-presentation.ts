/**
 * Customer-facing Subscription status presentation.
 * Stripe remains SoT for subscription facts; HTC access is separate.
 */

export type SubscriptionStatusPresentationInput = {
  venueName: string;
  saasSubscriptionStatus: string | null | undefined;
  saasStripeCustomerId: string | null | undefined;
  entitlementStatus: string | null | undefined;
  cancelAtPeriodEnd: boolean;
  accessDisabled: boolean;
  accessOverrideUntil: string | null | undefined;
  currentPeriodEnd: string | null | undefined;
  accessEndsAt: string | null | undefined;
};

export type SubscriptionStatusPresentation = {
  headline: string;
  detail: string;
  /** Customer-facing Stripe subscription status label (never invents "active"). */
  stripeStatusLabel: string;
  entitlementStatusLabel: string;
  periodEndLabelKey: "Access ends" | "Current period ends";
  periodEndIso: string | null;
  billingCustomerLinked: boolean;
  /** True when this venue has no Stripe SaaS subscription record. */
  subscriptionUnlinked: boolean;
};

function formatUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "—";
  return (
    t.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }) + " (UTC)"
  );
}

function titleCaseStatus(raw: string): string {
  return raw.replace(/_/g, " ");
}

/**
 * Build honest subscription-status copy from venue entitlement fields.
 * Does not invent a paid subscription from HTC access alone.
 */
export function buildSubscriptionStatusPresentation(
  input: SubscriptionStatusPresentationInput,
): SubscriptionStatusPresentation {
  const rawStatus = input.saasSubscriptionStatus?.trim() || null;
  const billingCustomerLinked = Boolean(input.saasStripeCustomerId?.trim());
  const subscriptionUnlinked = !rawStatus && !billingCustomerLinked;
  const cancelAtPeriodEnd = input.cancelAtPeriodEnd === true;
  const entitlementStatus = input.entitlementStatus?.trim() || "active";
  const periodEnd = input.currentPeriodEnd ?? null;
  const accessEndsAt = input.accessEndsAt ?? periodEnd;
  const overrideUntil = input.accessOverrideUntil ?? null;
  const locked = input.accessDisabled === true;

  let headline = "Your subscription is active.";
  let detail = `Hello to Cheers for ${input.venueName} renews according to your Stripe billing period.`;
  let stripeStatusLabel = rawStatus ? titleCaseStatus(rawStatus) : "Not linked";

  if (locked) {
    headline = "Access is currently paused.";
    detail =
      "Your venue workspace is suspended. Update payment or contact Hello to Cheers to restore access. Your data is preserved.";
  } else if (overrideUntil) {
    headline = "Access is temporarily extended.";
    detail = `Hello to Cheers has extended access through ${formatUtc(overrideUntil)}. This does not change your Stripe invoices.`;
  } else if (subscriptionUnlinked) {
    headline = "No subscription is linked yet.";
    detail =
      entitlementStatus === "active"
        ? "This venue currently has Hello to Cheers access, but it is not linked to a paid Stripe subscription. Renewal dates and the billing portal appear after a subscription is linked."
        : "This venue is not linked to a Stripe billing customer or subscription yet.";
    stripeStatusLabel = "Not linked";
  } else if (!rawStatus && billingCustomerLinked) {
    headline = "Billing customer linked — subscription status pending.";
    detail =
      "A Stripe billing customer is linked to this venue, but subscription status has not been confirmed yet. Refresh shortly or contact Hello to Cheers if this persists.";
    stripeStatusLabel = "Pending";
  } else if (cancelAtPeriodEnd) {
    headline = "Cancellation scheduled.";
    detail = `Your subscription will not renew. Access continues through ${formatUtc(accessEndsAt)}. You can reverse cancellation in the billing portal before that date.`;
  } else if (entitlementStatus === "grace") {
    headline = "Payment needs attention.";
    detail = `Your services remain available during the grace period. Access is scheduled to pause on ${formatUtc(accessEndsAt)} if payment stays unresolved.`;
  } else if (rawStatus === "past_due" || rawStatus === "unpaid") {
    headline = "Payment past due.";
    detail = "Please update your payment method to keep uninterrupted access.";
  } else if (rawStatus && rawStatus !== "active" && rawStatus !== "trialing") {
    // Known non-active Stripe status: do not claim "subscription is active".
    headline = `Subscription status: ${titleCaseStatus(rawStatus)}.`;
    detail = `Hello to Cheers access for ${input.venueName} follows your entitlement and Stripe billing records.`;
  }

  return {
    headline,
    detail,
    stripeStatusLabel,
    entitlementStatusLabel:
      titleCaseStatus(entitlementStatus) + (locked ? " (suspended)" : ""),
    periodEndLabelKey: cancelAtPeriodEnd ? "Access ends" : "Current period ends",
    periodEndIso: accessEndsAt,
    billingCustomerLinked,
    subscriptionUnlinked,
  };
}

export function formatSubscriptionPeriodEnd(iso: string | null | undefined): string {
  return formatUtc(iso);
}
