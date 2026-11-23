/**
 * Stage 2 — map an accepted Custom Offer snapshot onto Stripe Checkout params.
 * Pure helpers + thin Stripe ensure helpers (no CRM I/O).
 */

import type { SalesOfferAcceptedSnapshot } from "./sales-offer-types";

export type SalesOfferCouponSpec =
  | {
      kind: "percent_off";
      percentOff: number;
      duration: "forever" | "repeating";
      durationInMonths: number | null;
      couponId: string;
    }
  | {
      kind: "amount_off";
      amountOffCents: number;
      duration: "forever" | "repeating";
      durationInMonths: number | null;
      couponId: string;
    };

export function salesOfferOnboardingType(
  snapshot: Pick<SalesOfferAcceptedSnapshot, "whiteGloveMode">,
): "self_guided" | "white_glove" {
  return snapshot.whiteGloveMode === "none" ? "self_guided" : "white_glove";
}

/** One-time White Glove charge in cents (0 = waived or none). */
export function salesOfferWhiteGloveChargeCents(
  snapshot: Pick<
    SalesOfferAcceptedSnapshot,
    "whiteGloveMode" | "whiteGloveAmountCents"
  >,
): number {
  if (snapshot.whiteGloveMode === "none" || snapshot.whiteGloveMode === "waived") {
    return 0;
  }
  return Math.max(0, snapshot.whiteGloveAmountCents || 0);
}

/**
 * Build a coupon that brings list price down to the accepted monthly rate.
 * Returns null when the accepted monthly equals list (standard pricing).
 */
export function salesOfferCouponSpec(
  snapshot: SalesOfferAcceptedSnapshot,
): SalesOfferCouponSpec | null {
  const list = snapshot.listAmountCents;
  const monthly = snapshot.monthlyRecurringCents;
  if (monthly >= list) return null;

  const duration: "forever" | "repeating" =
    snapshot.durationMode === "billing_cycles" ? "repeating" : "forever";
  const durationInMonths =
    duration === "repeating"
      ? Math.max(1, snapshot.durationBillingCycles ?? 1)
      : null;

  const short =
    `${snapshot.offerId.replace(/-/g, "").slice(0, 12)}_${snapshot.revision}_${snapshot.termsHash.slice(0, 8)}`;

  if (snapshot.pricingKind === "percent_off" && snapshot.percentOff != null) {
    return {
      kind: "percent_off",
      percentOff: snapshot.percentOff,
      duration,
      durationInMonths,
      couponId: `htc_so_pct_${short}`.slice(0, 40),
    };
  }

  const amountOff =
    snapshot.pricingKind === "amount_off" && snapshot.amountOffCents != null
      ? snapshot.amountOffCents
      : list - monthly;

  if (amountOff <= 0) return null;

  return {
    kind: "amount_off",
    amountOffCents: amountOff,
    duration,
    durationInMonths,
    couponId: `htc_so_amt_${short}`.slice(0, 40),
  };
}

export type StripeCouponEnsure = {
  coupons: {
    retrieve(id: string): Promise<{ id: string }>;
    create(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params: any,
      opts?: { idempotencyKey?: string },
    ): Promise<{ id: string }>;
  };
};

export async function ensureSalesOfferCoupon(input: {
  stripe: StripeCouponEnsure;
  spec: SalesOfferCouponSpec;
  offerId: string;
}): Promise<string> {
  try {
    const existing = await input.stripe.coupons.retrieve(input.spec.couponId);
    return existing.id;
  } catch {
    // create below
  }

  const params: Record<string, unknown> = {
    id: input.spec.couponId,
    name: `HTC custom offer`,
    duration: input.spec.duration,
    metadata: {
      htc_sales_offer_id: input.offerId,
      htc_stage: "2",
    },
  };
  if (input.spec.duration === "repeating" && input.spec.durationInMonths) {
    params.duration_in_months = input.spec.durationInMonths;
  }
  if (input.spec.kind === "percent_off") {
    params.percent_off = input.spec.percentOff;
  } else {
    params.amount_off = input.spec.amountOffCents;
    params.currency = "usd";
  }

  const created = await input.stripe.coupons.create(params, {
    idempotencyKey: `sales-offer-coupon-${input.spec.couponId}`.slice(0, 255),
  });
  return created.id;
}

export type StripePriceEnsure = {
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
    ): Promise<{ id: string }>;
  };
};

/** One-time White Glove Price for a custom amount (lookup_key reused). */
export async function ensureSalesOfferWhiteGlovePrice(input: {
  stripe: StripePriceEnsure;
  productId: string;
  amountCents: number;
  offerId: string;
  revision: number;
}): Promise<string> {
  const lookupKey =
    `htc_so_wg_${input.amountCents}_${input.offerId.replace(/-/g, "").slice(0, 10)}_r${input.revision}`.slice(
      0,
      200,
    );
  const listed = await input.stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  if (listed.data[0]) return listed.data[0].id;

  const created = await input.stripe.prices.create(
    {
      product: input.productId,
      currency: "usd",
      unit_amount: input.amountCents,
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      nickname: `HTC offer WG $${(input.amountCents / 100).toFixed(2)}`,
      metadata: {
        htc_sales_offer_id: input.offerId,
        htc_stage: "2",
      },
    },
    {
      idempotencyKey: `sales-offer-wg-${lookupKey}`.slice(0, 255),
    },
  );
  return created.id;
}
