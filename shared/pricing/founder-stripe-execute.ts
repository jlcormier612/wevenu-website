/**
 * Stripe Test execution for Phase 5 founder arrangements.
 *
 * Mechanisms:
 * - percent_off / amount_off → durable Stripe Coupon (idempotent id) + subscription discounts
 * - fixed_rate / rate_freeze → durable Stripe Price (lookup_key) + subscription item price swap
 * - Always proration_behavior: none; never invent a second subscription
 */

import type { FounderArrangementRecord } from "./founder-types";
import type { FounderReconcileDecision } from "./founder-billing-reconcile";

/**
 * Structural Stripe surface used by Phase 5. Real Stripe SDK clients are
 * assigned via `as unknown as StripeFounderExecutor` at the venue-app boundary
 * (SDK param types are invariant vs our loose test doubles).
 */
export type StripeFounderExecutor = {
  coupons: {
    retrieve(id: string): Promise<{ id: string }>;
    create(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params: any,
      opts?: { idempotencyKey?: string },
    ): Promise<{ id: string }>;
  };
  prices: {
    list(params: {
      lookup_keys?: string[];
      active?: boolean;
      limit?: number;
    }): Promise<{ data: Array<{ id: string; unit_amount: number | null }> }>;
    create(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params: any,
      opts?: { idempotencyKey?: string },
    ): Promise<{ id: string; unit_amount: number | null }>;
  };
  subscriptions: {
    retrieve(
      id: string,
      params?: { expand?: string[] },
    ): Promise<StripeSubscriptionLike>;
    update(
      id: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params: any,
      opts?: { idempotencyKey?: string },
    ): Promise<StripeSubscriptionLike>;
  };
};

export type StripeSubscriptionLike = {
  id: string;
  schedule?: string | { id?: string } | null;
  discount?: {
    coupon?: string | { id?: string } | null;
  } | null;
  discounts?: Array<{
    coupon?: string | { id?: string } | null;
    source?: { coupon?: string | { id?: string } | null } | null;
  }> | null;
  items?: {
    data?: Array<{
      id: string;
      price?: { id?: string; unit_amount?: number | null } | string | null;
    }>;
  } | null;
};

function couponIdOf(sub: StripeSubscriptionLike): string | null {
  const fromDiscount = sub.discount?.coupon;
  if (typeof fromDiscount === "string" && fromDiscount) return fromDiscount;
  if (fromDiscount && typeof fromDiscount === "object" && fromDiscount.id) {
    return fromDiscount.id;
  }
  const first = sub.discounts?.[0];
  if (!first || typeof first === "string") return null;
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

function scheduleIdOf(sub: StripeSubscriptionLike): string | null {
  if (!sub.schedule) return null;
  if (typeof sub.schedule === "string") return sub.schedule;
  return sub.schedule.id ?? null;
}

function primaryItem(sub: StripeSubscriptionLike): {
  id: string;
  priceId: string | null;
} | null {
  const item = sub.items?.data?.[0];
  if (!item) return null;
  const price =
    typeof item.price === "string"
      ? item.price
      : item.price?.id ?? null;
  return { id: item.id, priceId: price };
}

/** Stable Stripe coupon id for a founder percent/amount arrangement. */
export function founderCouponIdFor(arrangement: FounderArrangementRecord): string {
  const short = arrangement.id.replace(/-/g, "").slice(0, 18);
  if (arrangement.kind === "percent_off") {
    return `htc_fnd_pct_${arrangement.percentOff}_${short}`;
  }
  if (arrangement.kind === "amount_off") {
    return `htc_fnd_amt_${arrangement.amountOffCents}_${short}`;
  }
  return `htc_fnd_${short}`;
}

/** Stable lookup_key for a founder fixed recurring Price. */
export function founderPriceLookupKey(input: {
  amountCents: number;
  productId: string;
}): string {
  return `htc_founder_fixed_${input.amountCents}_${input.productId.slice(-8)}`;
}

/**
 * Ensure a durable percent or amount coupon exists for the arrangement.
 */
export async function ensureFounderCoupon(input: {
  stripe: StripeFounderExecutor;
  arrangement: FounderArrangementRecord;
}): Promise<{ couponId: string }> {
  const arrangement = input.arrangement;
  if (arrangement.kind !== "percent_off" && arrangement.kind !== "amount_off") {
    throw new Error(`ensureFounderCoupon_unsupported_kind:${arrangement.kind}`);
  }
  const id = founderCouponIdFor(arrangement);
  try {
    const existing = await input.stripe.coupons.retrieve(id);
    return { couponId: existing.id };
  } catch {
    // create
  }

  const params: Record<string, unknown> = {
    id,
    name:
      arrangement.customerFacingLabel ||
      (arrangement.kind === "percent_off"
        ? `HTC special ${arrangement.percentOff}%`
        : `HTC special $${((arrangement.amountOffCents ?? 0) / 100).toFixed(0)} off`),
    duration: "forever",
    metadata: {
      htc_founder_arrangement_id: arrangement.id,
      htc_venue_id: arrangement.venueId,
      htc_phase: "5",
    },
  };
  if (arrangement.kind === "percent_off") {
    params.percent_off = arrangement.percentOff;
  } else {
    params.amount_off = arrangement.amountOffCents;
    params.currency = "usd";
  }

  const created = await input.stripe.coupons.create(params, {
    idempotencyKey: `founder-coupon-${arrangement.id}`.slice(0, 255),
  });
  return { couponId: created.id };
}

/**
 * Ensure a durable Stripe Price exists for a fixed recurring amount.
 * Reuses by lookup_key to avoid unbounded duplicates on retries.
 */
export async function ensureFounderFixedPrice(input: {
  stripe: StripeFounderExecutor;
  amountCents: number;
  productId: string;
  arrangementId: string;
  nickname?: string;
}): Promise<{ priceId: string }> {
  const lookupKey = founderPriceLookupKey({
    amountCents: input.amountCents,
    productId: input.productId,
  });
  const listed = await input.stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  const existing = listed.data[0];
  if (existing) return { priceId: existing.id };

  const created = await input.stripe.prices.create(
    {
      product: input.productId,
      currency: "usd",
      unit_amount: input.amountCents,
      recurring: { interval: "month" },
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      nickname:
        input.nickname ||
        `HTC founder fixed $${(input.amountCents / 100).toFixed(2)}`,
      metadata: {
        htc_founder_arrangement_id: input.arrangementId,
        htc_phase: "5",
        htc_fixed_amount_cents: String(input.amountCents),
      },
    },
    {
      idempotencyKey: `founder-price-${lookupKey}`.slice(0, 255),
    },
  );
  return { priceId: created.id };
}

export async function executeFounderBillingChange(input: {
  stripe: StripeFounderExecutor;
  subscriptionId: string;
  decision: FounderReconcileDecision;
  idempotencyKey: string;
  /** Required when applying fixed prices that need creation. */
  productId?: string | null;
  arrangement?: FounderArrangementRecord | null;
}): Promise<{
  ok: boolean;
  confirmedCouponId: string | null;
  confirmedPriceId: string | null;
  error?: string;
  deferred?: boolean;
}> {
  if (input.decision.action === "noop" || input.decision.action === "tier_freeze_only") {
    return { ok: true, confirmedCouponId: null, confirmedPriceId: null };
  }
  if (input.decision.action === "defer_to_schedule") {
    return {
      ok: false,
      confirmedCouponId: null,
      confirmedPriceId: null,
      deferred: true,
      error:
        "defer_to_schedule — refuse independent founder mutation while Phase 3 owns pricing.",
    };
  }

  const expand = { expand: ["discounts", "items.data.price"] };
  const before = await input.stripe.subscriptions.retrieve(
    input.subscriptionId,
    expand,
  );
  if (scheduleIdOf(before)) {
    return {
      ok: false,
      confirmedCouponId: couponIdOf(before),
      confirmedPriceId: primaryItem(before)?.priceId ?? null,
      deferred: true,
      error:
        "Subscription has an attached schedule — defer founder change to Phase 3 path.",
    };
  }

  const item = primaryItem(before);
  if (!item) {
    return {
      ok: false,
      confirmedCouponId: null,
      confirmedPriceId: null,
      error: "Subscription has no items.",
    };
  }

  let desiredCoupon: string | null | undefined;
  let desiredPrice: string | null | undefined;

  switch (input.decision.action) {
    case "apply_percent_coupon":
    case "apply_amount_coupon": {
      let couponId = input.decision.desiredStripeCouponId;
      if (!couponId && input.arrangement) {
        const ensured = await ensureFounderCoupon({
          stripe: input.stripe,
          arrangement: input.arrangement,
        });
        couponId = ensured.couponId;
      }
      desiredCoupon = couponId;
      desiredPrice = input.decision.desiredStripePriceId;
      break;
    }
    case "apply_earned_coupon":
      desiredCoupon = input.decision.desiredStripeCouponId;
      desiredPrice = input.decision.desiredStripePriceId;
      break;
    case "clear_discounts":
      desiredCoupon = null;
      break;
    case "apply_fixed_price": {
      let priceId = input.decision.desiredStripePriceId;
      if (!priceId && input.arrangement && input.productId) {
        const amount =
          input.arrangement.fixedRateCents ??
          input.arrangement.frozenListAmountCents;
        if (amount == null) {
          return {
            ok: false,
            confirmedCouponId: null,
            confirmedPriceId: null,
            error: "Fixed-rate arrangement missing amount.",
          };
        }
        const ensured = await ensureFounderFixedPrice({
          stripe: input.stripe,
          amountCents: amount,
          productId: input.productId,
          arrangementId: input.arrangement.id,
        });
        priceId = ensured.priceId;
      }
      desiredPrice = priceId;
      desiredCoupon = null;
      break;
    }
    case "restore_catalog_price":
      desiredPrice = input.decision.desiredStripePriceId;
      desiredCoupon = null;
      break;
    default:
      return {
        ok: false,
        confirmedCouponId: null,
        confirmedPriceId: null,
        error: `Unsupported action`,
      };
  }

  const params: Record<string, unknown> = {
    proration_behavior: "none",
  };

  // Prefer empty array for Stripe API 2024+ discount removal. An empty string
  // can be ignored or mis-encoded by some SDK serializers, leaving the coupon.
  if (desiredCoupon === null) {
    params.discounts = [];
  } else if (typeof desiredCoupon === "string") {
    params.discounts = [{ coupon: desiredCoupon }];
  }

  if (desiredPrice) {
    params.items = [{ id: item.id, price: desiredPrice }];
  }

  await input.stripe.subscriptions.update(input.subscriptionId, params, {
    idempotencyKey: input.idempotencyKey.slice(0, 255),
  });

  let after = await input.stripe.subscriptions.retrieve(
    input.subscriptionId,
    expand,
  );
  let confirmedCoupon = couponIdOf(after);
  const confirmedPrice = primaryItem(after)?.priceId ?? null;

  // Fallback clear if empty-array update did not remove the discount.
  if (desiredCoupon === null && confirmedCoupon) {
    await input.stripe.subscriptions.update(
      input.subscriptionId,
      { proration_behavior: "none", discounts: "" },
      {
        idempotencyKey: `${input.idempotencyKey}:clear`.slice(0, 255),
      },
    );
    after = await input.stripe.subscriptions.retrieve(
      input.subscriptionId,
      expand,
    );
    confirmedCoupon = couponIdOf(after);
  }

  if (desiredCoupon && confirmedCoupon !== desiredCoupon) {
    return {
      ok: false,
      confirmedCouponId: confirmedCoupon,
      confirmedPriceId: primaryItem(after)?.priceId ?? confirmedPrice,
      error: `Stripe coupon mismatch: expected ${desiredCoupon}, got ${confirmedCoupon ?? "none"}`,
    };
  }
  if (desiredCoupon === null && confirmedCoupon) {
    return {
      ok: false,
      confirmedCouponId: confirmedCoupon,
      confirmedPriceId: primaryItem(after)?.priceId ?? confirmedPrice,
      error: `Expected no coupon; still has ${confirmedCoupon}`,
    };
  }
  if (desiredPrice && confirmedPrice !== desiredPrice) {
    return {
      ok: false,
      confirmedCouponId: confirmedCoupon,
      confirmedPriceId: confirmedPrice,
      error: `Stripe price mismatch: expected ${desiredPrice}, got ${confirmedPrice ?? "none"}`,
    };
  }

  return {
    ok: true,
    confirmedCouponId: confirmedCoupon,
    confirmedPriceId: confirmedPrice,
  };
}
