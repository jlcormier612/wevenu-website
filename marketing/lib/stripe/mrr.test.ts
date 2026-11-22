import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  estimateMrrCentsFromPlan,
  mrrCentsFromStripeSubscription,
  summarizeRecurringDiscount,
  unitAmountToMonthlyCents,
  type RecurringCouponLike,
} from "./mrr";

const GATHER_PRODUCT = "prod_gather";
const WG_PRODUCT = "prod_white_glove";

function subWithGather(opts?: {
  discounts?: unknown[];
  unitAmount?: number;
}): Parameters<typeof mrrCentsFromStripeSubscription>[0] {
  return {
    items: {
      data: [
        {
          quantity: 1,
          price: {
            unit_amount: opts?.unitAmount ?? 19900,
            product: GATHER_PRODUCT,
            recurring: { interval: "month", interval_count: 1 },
          },
        },
        {
          quantity: 1,
          price: {
            unit_amount: 49900,
            product: WG_PRODUCT,
            recurring: null,
          },
        },
      ],
    },
    discounts: opts?.discounts ?? [],
  } as unknown as Parameters<typeof mrrCentsFromStripeSubscription>[0];
}

describe("estimateMrrCentsFromPlan — Flourish fallback", () => {
  it("uses $349 (34900) for Flourish / professional — never $399", () => {
    assert.equal(estimateMrrCentsFromPlan("professional"), 34900);
    assert.equal(estimateMrrCentsFromPlan("Flourish"), 34900);
    assert.equal(estimateMrrCentsFromPlan("flourish"), 34900);
    assert.notEqual(estimateMrrCentsFromPlan("professional"), 39900);
  });

  it("keeps Celebrate at $249 and legacy Gather at $149", () => {
    assert.equal(estimateMrrCentsFromPlan("growing"), 24900);
    assert.equal(estimateMrrCentsFromPlan("celebrate"), 24900);
    assert.equal(estimateMrrCentsFromPlan("starter"), 14900);
    assert.equal(estimateMrrCentsFromPlan("gather"), 14900);
  });
});

describe("mrrCentsFromStripeSubscription prefers actual Price amounts", () => {
  it("sums recurring unit amounts and ignores one-time items", () => {
    assert.equal(mrrCentsFromStripeSubscription(subWithGather()), 19900);
  });

  it("preserves a legacy $149 contracted Price without rewriting to $199", () => {
    const subscription = subWithGather({ unitAmount: 14900 });
    assert.equal(mrrCentsFromStripeSubscription(subscription), 14900);
    assert.notEqual(mrrCentsFromStripeSubscription(subscription), 19900);
  });
});

describe("mrrCentsFromStripeSubscription applies recurring coupons", () => {
  const founding: RecurringCouponLike = {
    id: "vMXAjisF",
    name: "Founding Member 10% forever (plans only)",
    percent_off: 10,
    applies_to: { products: [GATHER_PRODUCT] },
  };
  const weven: RecurringCouponLike = {
    id: "6d2PFuDb",
    name: "Former Weven 20% forever (plans only)",
    percent_off: 20,
    applies_to: { products: [GATHER_PRODUCT] },
  };

  it("applies Founding 10% to Gather recurring only → $179.10", () => {
    const subscription = subWithGather({
      discounts: [{ source: { coupon: "vMXAjisF", type: "coupon" } }],
    });
    assert.equal(
      mrrCentsFromStripeSubscription(subscription, { vMXAjisF: founding }),
      17910,
    );
  });

  it("applies Former Weven 20% to Gather recurring only → $159.20", () => {
    const subscription = subWithGather({
      discounts: [{ source: { coupon: "6d2PFuDb", type: "coupon" } }],
    });
    assert.equal(
      mrrCentsFromStripeSubscription(subscription, { "6d2PFuDb": weven }),
      15920,
    );
  });

  it("does not apply a plans-only coupon to a non-matching product id", () => {
    const subscription = {
      items: {
        data: [
          {
            quantity: 1,
            price: {
              unit_amount: 19900,
              product: "prod_other",
              recurring: { interval: "month", interval_count: 1 },
            },
          },
        ],
      },
      discounts: [{ source: { coupon: "vMXAjisF", type: "coupon" } }],
    } as unknown as Parameters<typeof mrrCentsFromStripeSubscription>[0];
    assert.equal(
      mrrCentsFromStripeSubscription(subscription, { vMXAjisF: founding }),
      19900,
    );
  });

  it("ignores expired discounts (end in the past)", () => {
    const subscription = subWithGather({
      discounts: [
        {
          end: 1,
          source: { coupon: "vMXAjisF", type: "coupon" },
        },
      ],
    });
    assert.equal(
      mrrCentsFromStripeSubscription(subscription, { vMXAjisF: founding }),
      19900,
    );
  });

  it("summarizes the active recurring discount for founder notify", () => {
    const subscription = subWithGather({
      discounts: [{ source: { coupon: "vMXAjisF", type: "coupon" } }],
    });
    assert.deepEqual(
      summarizeRecurringDiscount(subscription, { vMXAjisF: founding }),
      {
        couponId: "vMXAjisF",
        name: "Founding Member 10% forever (plans only)",
        percentOff: 10,
        amountOffCents: null,
      },
    );
  });
});

describe("unitAmountToMonthlyCents", () => {
  it("converts yearly to monthly", () => {
    assert.equal(unitAmountToMonthlyCents(238800, "year", 1), 19900);
  });
});
