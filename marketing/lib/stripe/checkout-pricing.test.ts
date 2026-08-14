/**
 * Gather Checkout pricing + payment gate (SaaS System A).
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  resolveCheckoutPricing,
  resolveFoundingCouponId,
  resolveGatherPriceId,
  shouldProvisionFromCheckoutSession,
} from "./checkout-pricing";

const ENV_KEYS = [
  "STRIPE_GATHER_PRICE_ID",
  "GATHER_PRICE_ID",
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_STARTER_FOUNDER",
  "STRIPE_PRICE_GROWING",
  "STRIPE_PRICE_GROWING_FOUNDER",
  "STRIPE_FOUNDING_COUPON_ID",
  "FOUNDING_MEMBER_COUPON_ID",
  "STRIPE_FOUNDING_MEMBER_COUPON_ID",
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function stashEnv() {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  restoreEnv();
});

describe("resolveGatherPriceId", () => {
  it("prefers STRIPE_GATHER_PRICE_ID over legacy starter", () => {
    stashEnv();
    process.env.STRIPE_GATHER_PRICE_ID = "price_gather_149";
    process.env.STRIPE_PRICE_STARTER = "price_starter_legacy";
    assert.equal(resolveGatherPriceId(), "price_gather_149");
  });

  it("falls back to GATHER_PRICE_ID then STRIPE_PRICE_STARTER", () => {
    stashEnv();
    process.env.GATHER_PRICE_ID = "price_gather_alias";
    assert.equal(resolveGatherPriceId(), "price_gather_alias");
    delete process.env.GATHER_PRICE_ID;
    process.env.STRIPE_PRICE_STARTER = "price_starter";
    assert.equal(resolveGatherPriceId(), "price_starter");
  });
});

describe("resolveFoundingCouponId", () => {
  it("reads STRIPE_FOUNDING_COUPON_ID or FOUNDING_MEMBER_COUPON_ID", () => {
    stashEnv();
    process.env.FOUNDING_MEMBER_COUPON_ID = "coupon_founding_30";
    assert.equal(resolveFoundingCouponId(), "coupon_founding_30");
    process.env.STRIPE_FOUNDING_COUPON_ID = "coupon_stripe_named";
    assert.equal(resolveFoundingCouponId(), "coupon_stripe_named");
  });
});

describe("resolveCheckoutPricing — Gather", () => {
  it("non-founding uses canonical Gather price with promo codes allowed", () => {
    stashEnv();
    process.env.STRIPE_GATHER_PRICE_ID = "price_gather_149";
    process.env.STRIPE_FOUNDING_COUPON_ID = "coupon_founding_30";
    const resolved = resolveCheckoutPricing("starter", { founder: false });
    assert.equal(resolved.priceId, "price_gather_149");
    assert.equal(resolved.foundingCouponId, null);
    assert.equal(resolved.allowPromotionCodes, true);
    assert.equal(resolved.mode, "gather_standard");
  });

  it("founding applies coupon on $149 Gather (not a separate $119 price)", () => {
    stashEnv();
    process.env.STRIPE_GATHER_PRICE_ID = "price_gather_149";
    process.env.STRIPE_FOUNDING_COUPON_ID = "coupon_founding_30";
    process.env.STRIPE_PRICE_STARTER_FOUNDER = "price_founder_119_legacy";
    const resolved = resolveCheckoutPricing("starter", { founder: true });
    assert.equal(resolved.priceId, "price_gather_149");
    assert.equal(resolved.foundingCouponId, "coupon_founding_30");
    assert.equal(resolved.allowPromotionCodes, false);
    assert.equal(resolved.mode, "gather_founding_coupon");
  });

  it("founding without coupon falls back to legacy Founder Price ID", () => {
    stashEnv();
    process.env.STRIPE_GATHER_PRICE_ID = "price_gather_149";
    process.env.STRIPE_PRICE_STARTER_FOUNDER = "price_founder_119_legacy";
    const resolved = resolveCheckoutPricing("starter", { founder: true });
    assert.equal(resolved.priceId, "price_founder_119_legacy");
    assert.equal(resolved.foundingCouponId, null);
    assert.equal(resolved.mode, "gather_founding_legacy_price");
  });
});

describe("resolveCheckoutPricing — Celebrate", () => {
  it("uses Founder Price ID while founding when set", () => {
    stashEnv();
    process.env.STRIPE_PRICE_GROWING = "price_celebrate";
    process.env.STRIPE_PRICE_GROWING_FOUNDER = "price_celebrate_founder";
    const resolved = resolveCheckoutPricing("growing", { founder: true });
    assert.equal(resolved.priceId, "price_celebrate_founder");
    assert.equal(resolved.foundingCouponId, null);
    assert.equal(resolved.mode, "plan_founder_price");
  });
});

describe("shouldProvisionFromCheckoutSession", () => {
  it("provisions when payment is paid and subscription active", () => {
    assert.equal(
      shouldProvisionFromCheckoutSession({
        paymentStatus: "paid",
        subscriptionStatus: "active",
      }),
      true,
    );
  });

  it("does not provision unpaid payment", () => {
    assert.equal(
      shouldProvisionFromCheckoutSession({
        paymentStatus: "unpaid",
        subscriptionStatus: "incomplete",
      }),
      false,
    );
  });

  it("does not provision incomplete subscription even if payment looks paid", () => {
    assert.equal(
      shouldProvisionFromCheckoutSession({
        paymentStatus: "paid",
        subscriptionStatus: "incomplete",
      }),
      false,
    );
  });

  it("allows trialing with no_payment_required", () => {
    assert.equal(
      shouldProvisionFromCheckoutSession({
        paymentStatus: "no_payment_required",
        subscriptionStatus: "trialing",
      }),
      true,
    );
  });
});
