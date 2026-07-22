import type Stripe from "stripe";

/**
 * Convert a recurring Stripe Price amount into monthly cents.
 * One-time prices (onboarding add-ons) are ignored by callers that filter recurring.
 */
export function unitAmountToMonthlyCents(
  unitAmount: number,
  interval: Stripe.Price.Recurring.Interval,
  intervalCount = 1,
): number {
  const count = Math.max(1, intervalCount);
  switch (interval) {
    case "month":
      return Math.round(unitAmount / count);
    case "year":
      return Math.round(unitAmount / (12 * count));
    case "week":
      return Math.round((unitAmount * 52) / (12 * count));
    case "day":
      return Math.round((unitAmount * 365) / (12 * count));
    default:
      return unitAmount;
  }
}

/**
 * Sum recurring line items on a Stripe Subscription into monthly MRR (cents).
 * Skips one-time items (e.g. White Glove add-on on the Checkout Session).
 */
export function mrrCentsFromStripeSubscription(
  subscription: Stripe.Subscription,
): number {
  let total = 0;
  for (const item of subscription.items?.data ?? []) {
    const price = item.price;
    if (!price?.recurring) continue;
    const unit =
      typeof price.unit_amount === "number"
        ? price.unit_amount
        : typeof price.unit_amount_decimal === "string"
          ? Math.round(Number(price.unit_amount_decimal))
          : 0;
    if (!unit) continue;
    const qty = item.quantity ?? 1;
    total +=
      unitAmountToMonthlyCents(
        unit,
        price.recurring.interval,
        price.recurring.interval_count ?? 1,
      ) * qty;
  }
  return total;
}

/** Rough MRR from plan tier when Stripe price objects are unavailable. */
export function estimateMrrCentsFromPlan(plan: string): number {
  const key = plan.trim().toLowerCase();
  if (key === "starter" || key === "gather") return 14900;
  if (key === "growing" || key === "celebrate") return 24900;
  if (key === "professional" || key === "flourish") return 39900;
  return 0;
}
