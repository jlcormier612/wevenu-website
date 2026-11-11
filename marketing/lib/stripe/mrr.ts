import type Stripe from "stripe";

import { listAmountCents } from "@shared/pricing";

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
 * Prefer this over plan-tier estimates whenever Stripe price objects are available.
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

/**
 * Rough MRR from plan tier when Stripe price objects are unavailable.
 *
 * Standard list amounts (authoritative catalog):
 * - Gather $149 legacy / $199 Launch V1 — Gather uses catalog only when callers
 *   already know Launch context; legacy Gather stays $149 here for Sandbox.
 * - Celebrate $249
 * - Flourish $349 (corrected from a stale $399 fallback that could inflate CRM MRR)
 *
 * Does not rewrite historical Stripe invoices. Prefer mrrCentsFromStripeSubscription
 * whenever the subscription's Price amount is known.
 */
export function estimateMrrCentsFromPlan(plan: string): number {
  const key = plan.trim().toLowerCase();

  if (key === "starter" || key === "gather") {
    // Legacy contracted Gather remains $149 until Launch cutover; Launch paths
    // should prefer Stripe unit_amount. Catalog Gather list is $199.
    return 14900;
  }
  if (key === "growing" || key === "celebrate") {
    return listAmountCents("growing");
  }
  if (key === "professional" || key === "flourish") {
    return listAmountCents("professional"); // $349 — never $399
  }
  return 0;
}
