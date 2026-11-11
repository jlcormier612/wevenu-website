import { NextResponse } from "next/server";

import {
  getPricingLaunchOperationalSignal,
  getPricingOfferStore,
  getPricingWevenOperationalSignal,
  preferPostgresPricingOfferStore,
  requireDurablePricingOfferStore,
} from "@shared/pricing";

export const runtime = "nodejs";

/**
 * Access-controlled operational readiness signal for Pricing Launch V1.
 * Auth: Bearer PRODUCT_SYNC_API_KEY.
 * Never returns Stripe secret values or database credentials.
 */
function authorize(request: Request): boolean {
  const expected = process.env.PRODUCT_SYNC_API_KEY?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return Boolean(key && key === expected);
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signal = getPricingLaunchOperationalSignal();
  const wevenSignal = getPricingWevenOperationalSignal();
  let durableStore = false;
  let earnedFoundingCount: number | null = null;
  let pendingWevenClaims: number | null = null;
  let storeError: string | null = null;

  try {
    const preferPg = preferPostgresPricingOfferStore();
    const store =
      signal.flagEnabled || signal.ready
        ? requireDurablePricingOfferStore()
        : getPricingOfferStore();
    durableStore = Boolean(store.durable && preferPg);
    if (store.durable) {
      earnedFoundingCount = await store.countEarnedFoundingVenues();
      const pending = await store.listWevenClaims({
        reviewStatus: "pending",
        limit: 500,
      });
      pendingWevenClaims = pending.length;
    }
  } catch (error) {
    storeError = error instanceof Error ? error.message : String(error);
  }

  const body = {
    ok: true,
    pricing: signal,
    weven: wevenSignal,
    offerStore: {
      prefersPostgres: preferPostgresPricingOfferStore(),
      durable: durableStore,
      earnedFoundingCount,
      pendingWevenClaims,
      error: storeError,
    },
    envPresent: {
      STRIPE_PRICE_GATHER_199: Boolean(process.env.STRIPE_PRICE_GATHER_199?.trim()),
      STRIPE_PRICE_GROWING: Boolean(process.env.STRIPE_PRICE_GROWING?.trim()),
      STRIPE_PRICE_PROFESSIONAL: Boolean(
        process.env.STRIPE_PRICE_PROFESSIONAL?.trim(),
      ),
      STRIPE_FOUNDING_PERCENT_COUPON_ID: Boolean(
        process.env.STRIPE_FOUNDING_PERCENT_COUPON_ID?.trim(),
      ),
      STRIPE_PRICE_WHITE_GLOVE: Boolean(
        process.env.STRIPE_PRICE_WHITE_GLOVE?.trim(),
      ),
      STRIPE_WEVEN_PERCENT_COUPON_ID: Boolean(
        process.env.STRIPE_WEVEN_PERCENT_COUPON_ID?.trim() ||
          process.env.STRIPE_COUPON_WEVEN_20?.trim(),
      ),
      STRIPE_PRICE_WHITE_GLOVE_WEVEN: Boolean(
        process.env.STRIPE_PRICE_WHITE_GLOVE_WEVEN?.trim() ||
          process.env.STRIPE_PRICE_WHITE_GLOVE_WEVEN_399?.trim(),
      ),
      PRICING_LAUNCH_V1: process.env.PRICING_LAUNCH_V1 ?? null,
      PRICING_WEVEN_V1: process.env.PRICING_WEVEN_V1 ?? null,
      SUPABASE_SERVICE_ROLE_KEY: Boolean(
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
      ),
    },
  };

  return NextResponse.json(body);
}
