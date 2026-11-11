import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveRelationshipForSubscription } from "./resolve-subscription-relationship";

const A = {
  id: "rel_a",
  stripeSubscriptionId: "sub_a",
  stripeCustomerId: "cus_shared",
};
const B = {
  id: "rel_b",
  stripeSubscriptionId: "sub_b",
  stripeCustomerId: "cus_shared",
};

describe("resolveRelationshipForSubscription", () => {
  it("resolves by subscription id for two venues under one customer", () => {
    const r = resolveRelationshipForSubscription([A, B], {
      stripeSubscriptionId: "sub_b",
      stripeCustomerId: "cus_shared",
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.relationship.id, "rel_b");
      assert.equal(r.how, "subscription_id");
    }
  });

  it("fails closed when only a shared customer is available", () => {
    const r = resolveRelationshipForSubscription([A, B], {
      stripeSubscriptionId: "sub_unknown",
      stripeCustomerId: "cus_shared",
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.reason, "ambiguous");
      assert.deepEqual(r.candidateIds, ["rel_a", "rel_b"]);
    }
  });

  it("allows unique customer match when only one relationship exists", () => {
    const r = resolveRelationshipForSubscription([A], {
      stripeCustomerId: "cus_shared",
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.relationship.id, "rel_a");
  });

  it("does not use email — email is not an input", () => {
    const r = resolveRelationshipForSubscription([A, B], {
      stripeSubscriptionId: null,
      stripeCustomerId: null,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "not_found");
  });

  it("handles duplicate events by stable subscription match", () => {
    const first = resolveRelationshipForSubscription([A, B], {
      stripeSubscriptionId: "sub_a",
      stripeCustomerId: "cus_shared",
    });
    const second = resolveRelationshipForSubscription([A, B], {
      stripeSubscriptionId: "sub_a",
      stripeCustomerId: "cus_shared",
    });
    assert.deepEqual(first, second);
    assert.equal(first.ok && first.relationship.id, "rel_a");
  });
});
