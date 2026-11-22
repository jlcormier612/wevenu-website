/**
 * Stripe percent coupons used for recurring SaaS discounts must be restricted
 * via `applies_to.products` to plan products only. Unrestricted coupons also
 * discount one-time White Glove line items in the same Checkout Session
 * (Batch 3.2 founding defect: $499 → $449.10).
 */

export type CouponAppliesTo = {
  products?: readonly string[] | null;
} | null;

export type SubscriptionCouponOneTimeCheck =
  | { ok: true }
  | {
      ok: false;
      reason: "unrestricted" | "includes_one_time_product";
    };

/** Non-empty product restriction list, or null if the coupon is unrestricted. */
export function couponRestrictedProductIds(
  appliesTo: CouponAppliesTo,
): readonly string[] | null {
  const products = appliesTo?.products;
  if (!Array.isArray(products) || products.length === 0) return null;
  return products;
}

/**
 * True when a subscription percent coupon is safe to combine with a one-time
 * add-on product in the same Checkout Session.
 */
export function subscriptionCouponAllowsOneTimeProduct(args: {
  couponAppliesTo: CouponAppliesTo;
  oneTimeProductId: string;
}): SubscriptionCouponOneTimeCheck {
  const products = couponRestrictedProductIds(args.couponAppliesTo);
  if (!products) {
    return { ok: false, reason: "unrestricted" };
  }
  if (products.includes(args.oneTimeProductId)) {
    return { ok: false, reason: "includes_one_time_product" };
  }
  return { ok: true };
}

/** Expected initial Checkout totals (pre-tax) for human-assisted Batch 3.2A. */
export const EXPECTED_GATHER_CHECKOUT_TOTALS_CENTS = {
  standardSelfGuided: 19900,
  wevenWhiteGlove: 15920 + 39900, // $558.20
  foundingWhiteGlove: 17910 + 49900, // $678.10 — WG must stay $499
} as const;
