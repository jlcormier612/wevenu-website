import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  getPricingLaunchMode,
  getPricingLaunchOperationalSignal,
  getPricingLaunchV1Readiness,
  isPricingLaunchV1Misconfigured,
  isPricingLaunchV1Ready,
} from "./readiness";
import { resolveLaunchCheckoutPricing } from "./resolve-checkout";

const ENV_KEYS = [
  "PRICING_LAUNCH_V1",
  "STRIPE_PRICE_GATHER_199",
  "STRIPE_GATHER_PRICE_ID",
  "STRIPE_GATHER_PRICE_ID_V1",
  "STRIPE_PRICE_GROWING",
  "STRIPE_PRICE_PROFESSIONAL",
  "STRIPE_FOUNDING_PERCENT_COUPON_ID",
  "STRIPE_FOUNDING_COUPON_ID",
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

describe("Pricing Launch V1 readiness — tri-state", () => {
  it("defaults to legacy mode when flag is off", () => {
    stashEnv();
    const readiness = getPricingLaunchV1Readiness();
    assert.equal(readiness.mode, "legacy");
    assert.equal(isPricingLaunchV1Ready(), false);
    assert.equal(isPricingLaunchV1Misconfigured(), false);
    assert.equal(getPricingLaunchMode(), "legacy");
  });

  it("is v1_misconfigured when flag is on but Stripe config is missing — no legacy fallback", () => {
    stashEnv();
    process.env.PRICING_LAUNCH_V1 = "true";
    const readiness = getPricingLaunchV1Readiness();
    assert.equal(readiness.mode, "v1_misconfigured");
    assert.equal(readiness.ready, false);
    assert.equal(isPricingLaunchV1Misconfigured(), true);
    assert.ok(readiness.missing.length > 0);
    assert.match(readiness.diagnosticMessage, /incomplete/i);
    assert.throws(() =>
      resolveLaunchCheckoutPricing({
        plan: "starter",
        earnedFoundingVenueCount: 0,
      }),
    );
  });

  it("is v1_ready only when flag + prices + founding percent coupon are set", () => {
    stashEnv();
    process.env.PRICING_LAUNCH_V1 = "true";
    process.env.STRIPE_PRICE_GATHER_199 = "price_199";
    process.env.STRIPE_PRICE_GROWING = "price_249";
    process.env.STRIPE_PRICE_PROFESSIONAL = "price_349";
    process.env.STRIPE_FOUNDING_PERCENT_COUPON_ID = "coupon_10";
    process.env.STRIPE_FOUNDING_COUPON_ID = "FOUNDING100";
    assert.equal(getPricingLaunchMode(), "v1_ready");
    assert.equal(isPricingLaunchV1Ready(), true);
    assert.equal(isPricingLaunchV1Misconfigured(), false);
  });

  it("does not treat the legacy $30 coupon env as the Launch Founding coupon", () => {
    stashEnv();
    process.env.PRICING_LAUNCH_V1 = "true";
    process.env.STRIPE_PRICE_GATHER_199 = "price_199";
    process.env.STRIPE_PRICE_GROWING = "price_249";
    process.env.STRIPE_PRICE_PROFESSIONAL = "price_349";
    process.env.STRIPE_FOUNDING_COUPON_ID = "FOUNDING100";
    const readiness = getPricingLaunchV1Readiness();
    assert.equal(readiness.mode, "v1_misconfigured");
    assert.ok(
      readiness.missing.some((m) => m.includes("STRIPE_FOUNDING_PERCENT_COUPON_ID")),
    );
  });

  it("exposes a secret-free operational signal for deployment verification", () => {
    stashEnv();
    process.env.PRICING_LAUNCH_V1 = "true";
    process.env.STRIPE_PRICE_GATHER_199 = "price_secret_value";
    const signal = getPricingLaunchOperationalSignal();
    assert.equal(signal.mode, "v1_misconfigured");
    assert.ok(signal.missing.length > 0);
    assert.equal(JSON.stringify(signal).includes("price_secret_value"), false);
  });
});

describe("resolveLaunchCheckoutPricing", () => {
  it("uses standard Prices and 10% coupon when founding issued", () => {
    stashEnv();
    process.env.PRICING_LAUNCH_V1 = "true";
    process.env.STRIPE_PRICE_GATHER_199 = "price_199";
    process.env.STRIPE_PRICE_GROWING = "price_249";
    process.env.STRIPE_PRICE_PROFESSIONAL = "price_349";
    process.env.STRIPE_FOUNDING_PERCENT_COUPON_ID = "coupon_10";

    const founding = resolveLaunchCheckoutPricing({
      plan: "starter",
      earnedFoundingVenueCount: 0,
    });
    assert.equal(founding.mode, "launch_founding_percent");
    assert.equal(founding.priceId, "price_199");
    assert.equal(founding.foundingCouponId, "coupon_10");
    assert.equal(founding.listAmountCents, 19900);
    assert.equal(founding.allowPromotionCodes, false);

    const standard = resolveLaunchCheckoutPricing({
      plan: "growing",
      earnedFoundingVenueCount: 100,
    });
    assert.equal(standard.mode, "launch_standard");
    assert.equal(standard.foundingCouponId, null);
    assert.equal(standard.priceId, "price_249");
    assert.equal(standard.listAmountCents, 24900);
  });

  it("honors an already-issued founding offer without rechecking capacity", () => {
    stashEnv();
    process.env.PRICING_LAUNCH_V1 = "true";
    process.env.STRIPE_PRICE_GATHER_199 = "price_199";
    process.env.STRIPE_PRICE_GROWING = "price_249";
    process.env.STRIPE_PRICE_PROFESSIONAL = "price_349";
    process.env.STRIPE_FOUNDING_PERCENT_COUPON_ID = "coupon_10";

    const honored = resolveLaunchCheckoutPricing({
      plan: "professional",
      earnedFoundingVenueCount: 150,
      honorFoundingIssued: true,
    });
    assert.equal(honored.foundingIssued, true);
    assert.equal(honored.mode, "launch_founding_percent");
    assert.equal(honored.issuanceReason, "honor_existing_offer");
  });
});
