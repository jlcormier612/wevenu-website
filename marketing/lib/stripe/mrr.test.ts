import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  estimateMrrCentsFromPlan,
  mrrCentsFromStripeSubscription,
  unitAmountToMonthlyCents,
} from "./mrr";

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
    const subscription = {
      items: {
        data: [
          {
            quantity: 1,
            price: {
              unit_amount: 14900,
              recurring: { interval: "month", interval_count: 1 },
            },
          },
          {
            quantity: 1,
            price: {
              unit_amount: 49900,
              recurring: null,
            },
          },
        ],
      },
    } as unknown as Parameters<typeof mrrCentsFromStripeSubscription>[0];

    assert.equal(mrrCentsFromStripeSubscription(subscription), 14900);
  });

  it("preserves a legacy $149 contracted Price without rewriting to $199", () => {
    const subscription = {
      items: {
        data: [
          {
            quantity: 1,
            price: {
              unit_amount: 14900,
              recurring: { interval: "month", interval_count: 1 },
            },
          },
        ],
      },
    } as unknown as Parameters<typeof mrrCentsFromStripeSubscription>[0];

    assert.equal(mrrCentsFromStripeSubscription(subscription), 14900);
    assert.notEqual(mrrCentsFromStripeSubscription(subscription), 19900);
  });
});

describe("unitAmountToMonthlyCents", () => {
  it("converts yearly to monthly", () => {
    assert.equal(unitAmountToMonthlyCents(238800, "year", 1), 19900);
  });
});
