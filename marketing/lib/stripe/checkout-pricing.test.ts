/**
 * Gather Checkout pricing + payment gate (SaaS System A).
 * Legacy path remains default; Launch V1 only when readiness is true.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  getPricingDisplayState,
  getPricingPage,
  PRICING_PAGE,
} from "@/lib/marketing/pricing-page";
import {
  resolveCheckoutPricing,
  resolveFoundingCouponId,
  resolveGatherPriceId,
  resolveLegacyCheckoutPricing,
  shouldProvisionFromCheckoutSession,
} from "./checkout-pricing";

const ENV_KEYS = [
  "PRICING_LAUNCH_V1",
  "STRIPE_PRICE_GATHER_199",
  "STRIPE_GATHER_PRICE_ID",
  "GATHER_PRICE_ID",
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_STARTER_FOUNDER",
  "STRIPE_PRICE_GROWING",
  "STRIPE_PRICE_GROWING_FOUNDER",
  "STRIPE_PRICE_PROFESSIONAL",
  "STRIPE_FOUNDING_COUPON_ID",
  "FOUNDING_MEMBER_COUPON_ID",
  "STRIPE_FOUNDING_MEMBER_COUPON_ID",
  "STRIPE_FOUNDING_PERCENT_COUPON_ID",
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

describe("resolveCheckoutPricing — legacy Gather (Launch V1 off)", () => {
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

describe("resolveCheckoutPricing — legacy Celebrate", () => {
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

describe("resolveCheckoutPricing — Launch V1", () => {
  function enableLaunch() {
    process.env.PRICING_LAUNCH_V1 = "true";
    process.env.STRIPE_PRICE_GATHER_199 = "price_gather_199";
    process.env.STRIPE_PRICE_GROWING = "price_celebrate_249";
    process.env.STRIPE_PRICE_PROFESSIONAL = "price_flourish_349";
    process.env.STRIPE_FOUNDING_PERCENT_COUPON_ID = "coupon_founding_10";
    // Legacy $30 must not be selected on launch path.
    process.env.STRIPE_FOUNDING_COUPON_ID = "FOUNDING100";
    process.env.STRIPE_PRICE_GROWING_FOUNDER = "price_celebrate_founder_fixed";
  }

  it("requires launch issuance context when ready", () => {
    stashEnv();
    enableLaunch();
    assert.throws(() => resolveCheckoutPricing("starter", { founder: true }));
  });

  it("uses $199 Gather + 10% coupon — never $30 coupon or founder Prices", () => {
    stashEnv();
    enableLaunch();
    const resolved = resolveCheckoutPricing("starter", {
      launch: { earnedFoundingVenueCount: 0 },
    });
    assert.equal(resolved.mode, "launch_founding_percent");
    assert.equal(resolved.priceId, "price_gather_199");
    assert.equal(resolved.foundingCouponId, "coupon_founding_10");
    assert.notEqual(resolved.foundingCouponId, "FOUNDING100");
    assert.equal(resolved.launch?.listAmountCents, 19900);
  });

  it("uses standard Celebrate after milestone without founder fixed Price", () => {
    stashEnv();
    enableLaunch();
    const resolved = resolveCheckoutPricing("growing", {
      launch: { earnedFoundingVenueCount: 100 },
    });
    assert.equal(resolved.mode, "launch_standard");
    assert.equal(resolved.priceId, "price_celebrate_249");
    assert.equal(resolved.foundingCouponId, null);
    assert.notEqual(resolved.priceId, "price_celebrate_founder_fixed");
  });

  it("keeps legacy resolver available for existing subscriptions / cutover", () => {
    stashEnv();
    enableLaunch();
    process.env.STRIPE_GATHER_PRICE_ID = "price_gather_149";
    process.env.STRIPE_FOUNDING_COUPON_ID = "FOUNDING100";
    const legacy = resolveLegacyCheckoutPricing("starter", { founder: true });
    assert.equal(legacy.priceId, "price_gather_149");
    assert.equal(legacy.foundingCouponId, "FOUNDING100");
  });
});

describe("marketing + checkout price consistency", () => {
  it("advertises legacy $149/$119 while Launch V1 is off", () => {
    stashEnv();
    const display = getPricingDisplayState();
    assert.equal(display.mode, "legacy");
    assert.equal(display.checkoutAvailable, true);
    assert.equal(display.page.plans[0]?.price, "$149");
    assert.equal(display.page.plans[0]?.foundingPrice, "$119");
    assert.equal(PRICING_PAGE.plans[0]?.price, "$149");
  });

  it("advertises catalog $199/$179.10 only when Launch V1 is ready", () => {
    stashEnv();
    process.env.PRICING_LAUNCH_V1 = "true";
    process.env.STRIPE_PRICE_GATHER_199 = "price_gather_199";
    process.env.STRIPE_PRICE_GROWING = "price_celebrate_249";
    process.env.STRIPE_PRICE_PROFESSIONAL = "price_flourish_349";
    process.env.STRIPE_FOUNDING_PERCENT_COUPON_ID = "coupon_founding_10";
    const display = getPricingDisplayState();
    assert.equal(display.mode, "v1_ready");
    assert.equal(display.checkoutAvailable, true);
    assert.equal(display.page.plans[0]?.price, "$199");
    assert.equal(display.page.plans[0]?.foundingPrice, "$179.10");
    assert.equal(display.page.plans[1]?.foundingPrice, "$224.10");
    assert.equal(display.page.plans[2]?.foundingPrice, "$314.10");
    const checkout = resolveCheckoutPricing("starter", {
      launch: { earnedFoundingVenueCount: 0 },
    });
    assert.equal(checkout.launch?.listAmountCents, 19900);
  });

  it("shows V1 amounts but disables purchase when flag is on and config is incomplete", () => {
    stashEnv();
    process.env.PRICING_LAUNCH_V1 = "true";
    process.env.STRIPE_PRICE_GATHER_199 = "price_gather_199";
    process.env.STRIPE_PRICE_GROWING = "price_celebrate_249";
    process.env.STRIPE_PRICE_PROFESSIONAL = "price_flourish_349";
    // Missing founding percent coupon → misconfigured; must NOT fall back to $149.
    const display = getPricingDisplayState();
    assert.equal(display.mode, "v1_misconfigured");
    assert.equal(display.checkoutAvailable, false);
    assert.equal(display.page.plans[0]?.price, "$199");
    assert.notEqual(display.page.plans[0]?.price, "$149");
    assert.equal(getPricingPage().plans[0]?.price, "$199");
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
