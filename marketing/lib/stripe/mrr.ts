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

/** Coupon fields needed to apply a recurring discount to MRR. */
export type RecurringCouponLike = {
  id?: string | null;
  name?: string | null;
  percent_off?: number | null;
  amount_off?: number | null;
  /**
   * When `products` is a non-empty list, the coupon only applies to those
   * product ids. Missing / empty means unrestricted (legacy coupons).
   */
  applies_to?: { products?: readonly string[] | null } | null;
  valid?: boolean | null;
};

export type RecurringDiscountSummary = {
  couponId: string | null;
  name: string;
  percentOff: number | null;
  amountOffCents: number | null;
};

type DiscountLike = {
  end?: number | null;
  coupon?: string | RecurringCouponLike | null;
  source?: { coupon?: string | RecurringCouponLike | null; type?: string | null } | null;
};

function couponRefFromDiscount(discount: DiscountLike): string | RecurringCouponLike | null {
  if (discount.coupon) return discount.coupon;
  const sourceCoupon = discount.source?.coupon;
  return sourceCoupon ?? null;
}

/** Active subscription-level (and item-level) discount objects. */
export function listActiveSubscriptionDiscounts(
  subscription: Stripe.Subscription,
): DiscountLike[] {
  const now = Math.floor(Date.now() / 1000);
  const top = ((subscription as { discounts?: DiscountLike[] | null }).discounts ??
    []) as DiscountLike[];
  const itemDiscounts: DiscountLike[] = [];
  for (const item of subscription.items?.data ?? []) {
    const raw = (item as { discounts?: DiscountLike[] | null }).discounts;
    if (Array.isArray(raw)) itemDiscounts.push(...raw);
  }
  return [...top, ...itemDiscounts].filter((d) => {
    if (typeof d.end === "number" && d.end > 0 && d.end <= now) return false;
    return Boolean(couponRefFromDiscount(d));
  });
}

/** Coupon ids referenced by active subscription discounts (not expanded). */
export function couponIdsFromSubscription(subscription: Stripe.Subscription): string[] {
  const ids: string[] = [];
  for (const discount of listActiveSubscriptionDiscounts(subscription)) {
    const ref = couponRefFromDiscount(discount);
    if (typeof ref === "string" && ref.trim()) ids.push(ref.trim());
    else if (ref && typeof ref === "object" && typeof ref.id === "string" && ref.id) {
      ids.push(ref.id);
    }
  }
  return [...new Set(ids)];
}

function resolveCoupon(
  ref: string | RecurringCouponLike,
  couponsById?: Readonly<Record<string, RecurringCouponLike>>,
): RecurringCouponLike | null {
  if (typeof ref === "string") {
    return couponsById?.[ref] ?? null;
  }
  if (ref.id && couponsById?.[ref.id]) {
    // Prefer retrieved coupon (includes applies_to + percent_off).
    return { ...ref, ...couponsById[ref.id] };
  }
  return ref;
}

function couponAppliesToProduct(
  coupon: RecurringCouponLike,
  productId: string | null,
): boolean {
  if (coupon.valid === false) return false;
  const products = coupon.applies_to?.products;
  if (!Array.isArray(products) || products.length === 0) {
    // Unrestricted — applies to recurring items (WG one-time never enters this path).
    return true;
  }
  if (!productId) return false;
  return products.includes(productId);
}

function applyCouponToAmountCents(
  amountCents: number,
  coupon: RecurringCouponLike,
): number {
  if (amountCents <= 0) return 0;
  if (typeof coupon.percent_off === "number" && coupon.percent_off > 0) {
    return Math.round(amountCents * (1 - coupon.percent_off / 100));
  }
  if (typeof coupon.amount_off === "number" && coupon.amount_off > 0) {
    return Math.max(0, amountCents - coupon.amount_off);
  }
  return amountCents;
}

function productIdFromPrice(price: Stripe.Price | null | undefined): string | null {
  if (!price) return null;
  const product = price.product;
  if (typeof product === "string") return product;
  if (product && typeof product === "object" && "id" in product) {
    return (product as { id: string }).id;
  }
  return null;
}

/**
 * Sum recurring line items on a Stripe Subscription into monthly MRR (cents).
 * Skips one-time items (e.g. White Glove add-on on the Checkout Session).
 * Applies active subscription percent/amount coupons to eligible products.
 *
 * Pass `couponsById` when discount.coupon is an id string (common on modern
 * Stripe API versions where expand does not inline coupon objects).
 */
export function mrrCentsFromStripeSubscription(
  subscription: Stripe.Subscription,
  couponsById?: Readonly<Record<string, RecurringCouponLike>>,
): number {
  const discounts = listActiveSubscriptionDiscounts(subscription);
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
    let amount =
      unitAmountToMonthlyCents(
        unit,
        price.recurring.interval,
        price.recurring.interval_count ?? 1,
      ) * qty;
    const productId = productIdFromPrice(price);
    for (const discount of discounts) {
      const ref = couponRefFromDiscount(discount);
      if (!ref) continue;
      const coupon = resolveCoupon(ref, couponsById);
      if (!coupon) continue;
      if (!couponAppliesToProduct(coupon, productId)) continue;
      amount = applyCouponToAmountCents(amount, coupon);
    }
    total += amount;
  }
  return total;
}

/** Human-facing summary of the first active recurring coupon on a subscription. */
export function summarizeRecurringDiscount(
  subscription: Stripe.Subscription,
  couponsById?: Readonly<Record<string, RecurringCouponLike>>,
): RecurringDiscountSummary | null {
  for (const discount of listActiveSubscriptionDiscounts(subscription)) {
    const ref = couponRefFromDiscount(discount);
    if (!ref) continue;
    const coupon = resolveCoupon(ref, couponsById);
    if (!coupon) continue;
    const percent =
      typeof coupon.percent_off === "number" ? coupon.percent_off : null;
    const amountOff =
      typeof coupon.amount_off === "number" ? coupon.amount_off : null;
    if (percent == null && amountOff == null) continue;
    const name =
      (coupon.name && coupon.name.trim()) ||
      (percent != null ? `${percent}% recurring discount` : "Recurring discount");
    return {
      couponId: typeof coupon.id === "string" ? coupon.id : null,
      name,
      percentOff: percent,
      amountOffCents: amountOff,
    };
  }
  return null;
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
