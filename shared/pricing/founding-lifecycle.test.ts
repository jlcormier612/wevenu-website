import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  foundingDiscountStillValidOnSubscription,
  shouldEndFoundingEligibilityOnSubscriptionEvent,
} from "./founding-lifecycle";

describe("founding lifecycle", () => {
  it("keeps Founding while cancel_at_period_end but still active", () => {
    assert.equal(
      shouldEndFoundingEligibilityOnSubscriptionEvent({
        stripeStatus: "active",
        cancelAtPeriodEnd: true,
      }),
      false,
    );
    assert.equal(
      foundingDiscountStillValidOnSubscription({ stripeStatus: "active" }),
      true,
    );
  });

  it("ends Founding when the subscription is fully canceled or deleted", () => {
    assert.equal(
      shouldEndFoundingEligibilityOnSubscriptionEvent({
        stripeStatus: "canceled",
      }),
      true,
    );
    assert.equal(
      shouldEndFoundingEligibilityOnSubscriptionEvent({
        stripeStatus: "active",
        deleted: true,
      }),
      true,
    );
  });
});
