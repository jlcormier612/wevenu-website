import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { getPricingDisplayState, PRICING_PAGE } from "./pricing-page";

const ENV_KEYS = [
  "PRICING_LAUNCH_V1",
  "PRICING_WEVEN_V1",
  "STRIPE_PRICE_GATHER_199",
  "STRIPE_PRICE_GROWING",
  "STRIPE_PRICE_PROFESSIONAL",
  "STRIPE_FOUNDING_PERCENT_COUPON_ID",
  "STRIPE_WEVEN_PERCENT_COUPON_ID",
  "STRIPE_PRICE_WHITE_GLOVE_WEVEN",
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function stash() {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
}

function restore() {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => restore());

describe("Pricing page V1 content", () => {
  it("never advertises Custom, $149, Up to 200, or Dec 2026 deadline", () => {
    stash();
    process.env.PRICING_LAUNCH_V1 = "true";
    process.env.STRIPE_PRICE_GATHER_199 = "price_gather_199";
    process.env.STRIPE_PRICE_GROWING = "price_celebrate";
    process.env.STRIPE_PRICE_PROFESSIONAL = "price_flourish";
    process.env.STRIPE_FOUNDING_PERCENT_COUPON_ID = "coupon_founding_10";

    const { page } = getPricingDisplayState();
    assert.equal(page.plans.length, 3);
    assert.deepEqual(
      page.plans.map((p) => p.name),
      ["Gather", "Celebrate", "Flourish"],
    );
    assert.equal(page.plans[0]?.price, "$199");
    assert.equal(page.plans[0]?.foundingPrice, "$179.10");
    assert.equal(page.plans[0]?.capacity, "0–25 annual celebrations");
    assert.equal(page.plans[2]?.capacity, "76+ annual celebrations");

    const blob = JSON.stringify(page);
    assert.equal(page.plans.every((p) => p.name !== "Custom"), true);
    assert.equal(blob.includes('"Custom"'), false);
    assert.equal(blob.includes("$149"), false);
    assert.equal(blob.includes("Up to 200"), false);
    assert.equal(blob.includes("December 31, 2026"), false);
    assert.equal(blob.includes("Price locked"), false);
    assert.match(blob, /10% Founding discount stays with you/);
    assert.match(blob, /additional venue receives 10%/i);
    assert.match(blob, /45-minute walkthrough/);
    assert.equal(page.included.headline, "Everything you need. All included.");
    assert.equal(page.included.features.length, 12);
    assert.equal(page.welcomeBack.headline, "To our friends from Weven");
    assert.match(page.welcomeBack.thankYou, /20% off/);
    assert.equal(
      page.faq.some((f) => f.question === "Can I move to a lower plan?"),
      true,
    );
  });

  it("shows V1 amounts even when Launch flag is off, but disables checkout", () => {
    stash();
    const { page, checkoutAvailable } = getPricingDisplayState();
    assert.equal(checkoutAvailable, false);
    assert.equal(page.plans[0]?.price, "$199");
    assert.equal(PRICING_PAGE.hero.headline.includes("Simple monthly pricing"), true);
  });
});
