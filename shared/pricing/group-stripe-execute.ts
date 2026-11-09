/**
 * Prospective Stripe coupon apply/remove for Phase 4 group billing.
 *
 * Never midcycle-prorates. Never creates a second subscription.
 * Never mutates a subscription while Phase 3 schedule ownership requires deferral
 * (callers must pass defer_to_schedule decisions, not apply_coupon).
 */

import type { GroupReconcileDecision } from "./group-billing-reconcile";

export type StripeSubscriptionDiscountLike = {
  id: string;
  discount?: {
    coupon?: string | { id?: string } | null;
  } | null;
  discounts?: Array<{
    coupon?: string | { id?: string } | null;
    source?: { coupon?: string | { id?: string } | null } | null;
  }> | null;
  schedule?: string | { id?: string } | null;
};

export type GroupStripeExecutor = {
  subscriptions: {
    retrieve(id: string): Promise<StripeSubscriptionDiscountLike>;
    update(
      id: string,
      params: Record<string, unknown>,
      opts?: { idempotencyKey?: string },
    ): Promise<StripeSubscriptionDiscountLike>;
  };
};

function couponIdOf(sub: StripeSubscriptionDiscountLike): string | null {
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

function scheduleIdOf(sub: StripeSubscriptionDiscountLike): string | null {
  if (!sub.schedule) return null;
  if (typeof sub.schedule === "string") return sub.schedule;
  return sub.schedule.id ?? null;
}

/**
 * Apply or remove the desired coupon prospectively (proration_behavior: none).
 * Refuses when the subscription still has an attached schedule — callers must
 * use Phase 3 schedule-safe deferral in that case.
 */
export async function executeGroupCouponChange(input: {
  stripe: GroupStripeExecutor;
  subscriptionId: string;
  decision: GroupReconcileDecision;
  idempotencyKey: string;
}): Promise<{ ok: boolean; confirmedCouponId: string | null; error?: string }> {
  if (input.decision.action === "noop") {
    return { ok: true, confirmedCouponId: null };
  }
  if (input.decision.action === "defer_to_schedule") {
    return {
      ok: false,
      confirmedCouponId: null,
      error:
        "defer_to_schedule — refuse independent coupon mutation while Phase 3 owns pricing.",
    };
  }

  const before = await input.stripe.subscriptions.retrieve(input.subscriptionId);
  if (scheduleIdOf(before)) {
    return {
      ok: false,
      confirmedCouponId: couponIdOf(before),
      error:
        "Subscription has an attached schedule — defer group coupon change to Phase 3 path.",
    };
  }

  const desiredCoupon =
    input.decision.action === "remove_group_coupon"
      ? null
      : input.decision.desiredStripeCouponId;

  const params: Record<string, unknown> = {
    proration_behavior: "none",
  };
  if (desiredCoupon) {
    params.discounts = [{ coupon: desiredCoupon }];
  } else {
    // Clear all discounts prospectively without proration.
    params.discounts = "";
  }

  await input.stripe.subscriptions.update(input.subscriptionId, params, {
    idempotencyKey: input.idempotencyKey.slice(0, 255),
  });

  const after = await input.stripe.subscriptions.retrieve(input.subscriptionId);
  const confirmed = couponIdOf(after);

  if (desiredCoupon && confirmed !== desiredCoupon) {
    return {
      ok: false,
      confirmedCouponId: confirmed,
      error: `Stripe coupon mismatch after update: expected ${desiredCoupon}, got ${confirmed ?? "none"}`,
    };
  }
  if (!desiredCoupon && confirmed) {
    return {
      ok: false,
      confirmedCouponId: confirmed,
      error: `Expected no coupon after removal; still has ${confirmed}`,
    };
  }

  return { ok: true, confirmedCouponId: confirmed };
}
