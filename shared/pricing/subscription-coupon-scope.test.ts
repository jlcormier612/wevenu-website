import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EXPECTED_GATHER_CHECKOUT_TOTALS_CENTS,
  couponRestrictedProductIds,
  subscriptionCouponAllowsOneTimeProduct,
} from "./subscription-coupon-scope";
import {
  FOUNDING_PERCENT_OFF,
  WEVEN_PERCENT_OFF,
  WEVEN_WHITE_GLOVE_AMOUNT_CENTS,
  WHITE_GLOVE_AMOUNT_CENTS,
  amountAfterPercentOff,
  listAmountCents,
} from "./catalog";

const PLAN_PRODUCTS = [
  "prod_plan_gather",
  "prod_plan_celebrate",
  "prod_plan_flourish",
] as const;

const WHITE_GLOVE_PRODUCT = "prod_white_glove";

describe("subscriptionCouponAllowsOneTimeProduct", () => {
  it("rejects unrestricted coupons (founding Batch 3.2 defect shape)", () => {
    const check = subscriptionCouponAllowsOneTimeProduct({
      couponAppliesTo: null,
      oneTimeProductId: WHITE_GLOVE_PRODUCT,
    });
    assert.deepEqual(check, { ok: false, reason: "unrestricted" });
    assert.equal(couponRestrictedProductIds(null), null);
    assert.equal(couponRestrictedProductIds({ products: [] }), null);
  });

  it("rejects coupons that explicitly include the White Glove product", () => {
    const check = subscriptionCouponAllowsOneTimeProduct({
      couponAppliesTo: {
        products: [...PLAN_PRODUCTS, WHITE_GLOVE_PRODUCT],
      },
      oneTimeProductId: WHITE_GLOVE_PRODUCT,
    });
    assert.deepEqual(check, {
      ok: false,
      reason: "includes_one_time_product",
    });
  });

  it("allows plan-only coupons with White Glove as a separate one-time product", () => {
    const check = subscriptionCouponAllowsOneTimeProduct({
      couponAppliesTo: { products: [...PLAN_PRODUCTS] },
      oneTimeProductId: WHITE_GLOVE_PRODUCT,
    });
    assert.deepEqual(check, { ok: true });
  });
});

describe("EXPECTED_GATHER_CHECKOUT_TOTALS_CENTS", () => {
  it("keeps Founding 10% on Gather recurring only — White Glove stays $499", () => {
    const gather = listAmountCents("starter");
    const foundingRecurring = amountAfterPercentOff(
      gather,
      FOUNDING_PERCENT_OFF,
    );
    assert.equal(foundingRecurring, 17910);
    assert.equal(WHITE_GLOVE_AMOUNT_CENTS, 49900);
    assert.equal(
      foundingRecurring + WHITE_GLOVE_AMOUNT_CENTS,
      EXPECTED_GATHER_CHECKOUT_TOTALS_CENTS.foundingWhiteGlove,
    );
    assert.equal(
      EXPECTED_GATHER_CHECKOUT_TOTALS_CENTS.foundingWhiteGlove,
      67810,
    );
    // Regression: unrestricted 10% on both lines produced $449.10 WG.
    assert.notEqual(
      Math.round(WHITE_GLOVE_AMOUNT_CENTS * 0.9),
      WHITE_GLOVE_AMOUNT_CENTS,
    );
    assert.equal(Math.round(WHITE_GLOVE_AMOUNT_CENTS * 0.9), 44910);
  });

  it("keeps Former Weven 20% recurring + $399 White Glove honor-system total", () => {
    const gather = listAmountCents("starter");
    const wevenRecurring = amountAfterPercentOff(gather, WEVEN_PERCENT_OFF);
    assert.equal(wevenRecurring, 15920);
    assert.equal(WEVEN_WHITE_GLOVE_AMOUNT_CENTS, 39900);
    assert.equal(
      wevenRecurring + WEVEN_WHITE_GLOVE_AMOUNT_CENTS,
      EXPECTED_GATHER_CHECKOUT_TOTALS_CENTS.wevenWhiteGlove,
    );
    assert.equal(
      EXPECTED_GATHER_CHECKOUT_TOTALS_CENTS.wevenWhiteGlove,
      55820,
    );
  });

  it("keeps standard Gather self-guided at $199", () => {
    assert.equal(
      EXPECTED_GATHER_CHECKOUT_TOTALS_CENTS.standardSelfGuided,
      listAmountCents("starter"),
    );
  });
});
