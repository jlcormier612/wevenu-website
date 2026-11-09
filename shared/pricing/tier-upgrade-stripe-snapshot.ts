/**
 * Map an authoritative Stripe Subscription object into the Phase 3 billing
 * snapshot. Activation must call stripe.subscriptions.retrieve and pass the
 * result here — never invent period anchors.
 */

import { planKeyFromLaunchPriceId } from "./tier-upgrade-pricing";
import type { StripeSubscriptionBillingSnapshot } from "./tier-upgrade-types";

/** Minimal Stripe Subscription shape used by Phase 3 (no SDK dependency). */
export type StripeSubscriptionLike = {
  id: string;
  customer?: string | { id?: string } | null;
  status?: string | null;
  cancel_at_period_end?: boolean | null;
  current_period_end?: number | null;
  current_period_start?: number | null;
  billing_cycle_anchor?: number | null;
  schedule?: string | { id?: string } | null;
  items?: {
    data?: Array<{
      price?: { id?: string } | string | null;
      /** Newer Stripe API versions expose period anchors on items */
      current_period_end?: number | null;
      current_period_start?: number | null;
    }>;
  } | null;
  discount?: {
    coupon?: { id?: string } | string | null;
  } | null;
  discounts?: Array<{
    source?: { coupon?: string | { id?: string } | null } | null;
    coupon?: string | { id?: string } | null;
  }> | null;
};

function customerIdOf(sub: StripeSubscriptionLike): string | null {
  if (!sub.customer) return null;
  if (typeof sub.customer === "string") return sub.customer;
  return sub.customer.id ?? null;
}

function scheduleIdOf(sub: StripeSubscriptionLike): string | null {
  if (!sub.schedule) return null;
  if (typeof sub.schedule === "string") return sub.schedule;
  return sub.schedule.id ?? null;
}

function priceIdOf(sub: StripeSubscriptionLike): string | null {
  const item = sub.items?.data?.[0];
  if (!item?.price) return null;
  if (typeof item.price === "string") return item.price;
  return item.price.id ?? null;
}

function couponIdOf(sub: StripeSubscriptionLike): string | null {
  const fromDiscount = sub.discount?.coupon;
  if (typeof fromDiscount === "string" && fromDiscount) return fromDiscount;
  if (fromDiscount && typeof fromDiscount === "object" && fromDiscount.id) {
    return fromDiscount.id;
  }
  const first = sub.discounts?.[0];
  if (!first) return null;
  const sourceCoupon = first.source?.coupon;
  if (typeof sourceCoupon === "string" && sourceCoupon) return sourceCoupon;
  if (sourceCoupon && typeof sourceCoupon === "object" && sourceCoupon.id) {
    return sourceCoupon.id;
  }
  if (typeof first.coupon === "string" && first.coupon) return first.coupon;
  if (first.coupon && typeof first.coupon === "object" && first.coupon.id) {
    return first.coupon.id;
  }
  return null;
}

/**
 * Build a billing snapshot from Stripe. Returns null when required period end
 * is missing — callers must fail closed.
 */
function periodEndOf(sub: StripeSubscriptionLike): number | null {
  if (typeof sub.current_period_end === "number" && sub.current_period_end > 0) {
    return sub.current_period_end;
  }
  const itemEnd = sub.items?.data?.[0]?.current_period_end;
  if (typeof itemEnd === "number" && itemEnd > 0) return itemEnd;
  return null;
}

function periodStartOf(sub: StripeSubscriptionLike): number | null {
  if (
    typeof sub.current_period_start === "number" &&
    sub.current_period_start > 0
  ) {
    return sub.current_period_start;
  }
  const itemStart = sub.items?.data?.[0]?.current_period_start;
  if (typeof itemStart === "number" && itemStart > 0) return itemStart;
  return null;
}

export function billingSnapshotFromStripeSubscription(
  sub: StripeSubscriptionLike,
): StripeSubscriptionBillingSnapshot | null {
  const periodEnd = periodEndOf(sub);
  if (periodEnd == null) return null;

  const periodStart = periodStartOf(sub);

  const priceId = priceIdOf(sub);

  return {
    subscriptionId: sub.id,
    customerId: customerIdOf(sub),
    status: sub.status || "active",
    cancelAtPeriodEnd: sub.cancel_at_period_end === true,
    currentPeriodEndUnix: periodEnd,
    currentPeriodStartUnix: periodStart,
    priceId,
    planKey: planKeyFromLaunchPriceId(priceId),
    couponId: couponIdOf(sub),
    scheduleId: scheduleIdOf(sub),
    billingCycleAnchorUnix:
      typeof sub.billing_cycle_anchor === "number"
        ? sub.billing_cycle_anchor
        : null,
  };
}
