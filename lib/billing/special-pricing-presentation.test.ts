import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildUnlinkedSpecialPricingPayload,
  resolveCustomerBilledPlanKey,
  UNLINKED_SPECIAL_PRICING_MESSAGE,
} from "./special-pricing-presentation";

describe("special pricing honesty", () => {
  it("does not invent starter when saas_plan_key is null", () => {
    assert.equal(resolveCustomerBilledPlanKey(null), null);
    assert.equal(resolveCustomerBilledPlanKey(""), null);
    assert.equal(resolveCustomerBilledPlanKey("not-a-plan"), null);
  });

  it("accepts real catalog plan keys only", () => {
    assert.equal(resolveCustomerBilledPlanKey("starter"), "starter");
    assert.equal(resolveCustomerBilledPlanKey("growing"), "growing");
    assert.equal(resolveCustomerBilledPlanKey("professional"), "professional");
  });

  it("unlinked payload omits catalog recurring prices", () => {
    const payload = buildUnlinkedSpecialPricingPayload(null);
    assert.equal(payload.hasBilledPlan, false);
    assert.equal(payload.currentTier, null);
    assert.equal(payload.standardRecurringPrice, null);
    assert.equal(payload.actualRecurringPrice, null);
    assert.equal(payload.message, UNLINKED_SPECIAL_PRICING_MESSAGE);
    assert.doesNotMatch(JSON.stringify(payload), /\$199|Gather|19900/);
  });
});
