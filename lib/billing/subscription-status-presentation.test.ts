/**
 * Regression: provisioned/complimentary venues must not look like paid subscribers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSubscriptionStatusPresentation } from "./subscription-status-presentation";

const base = {
  venueName: "CONNECT-ACCEPT-DISPOSABLE",
  saasSubscriptionStatus: null as string | null,
  saasStripeCustomerId: null as string | null,
  entitlementStatus: "active" as string | null,
  cancelAtPeriodEnd: false,
  accessDisabled: false,
  accessOverrideUntil: null as string | null,
  currentPeriodEnd: null as string | null,
  accessEndsAt: null as string | null,
};

describe("buildSubscriptionStatusPresentation", () => {
  it("does not claim an active subscription when Stripe status and customer are absent", () => {
    const view = buildSubscriptionStatusPresentation(base);
    assert.equal(view.subscriptionUnlinked, true);
    assert.equal(view.billingCustomerLinked, false);
    assert.equal(view.stripeStatusLabel, "Not linked");
    assert.equal(view.headline, "No subscription is linked yet.");
    assert.doesNotMatch(view.headline, /subscription is active/i);
    assert.match(view.detail, /not linked to a paid Stripe subscription/i);
  });

  it("keeps paid active subscriptions labeled as active", () => {
    const view = buildSubscriptionStatusPresentation({
      ...base,
      venueName: "Sweet Daisy Barn & Farm",
      saasSubscriptionStatus: "active",
      saasStripeCustomerId: "cus_test",
      currentPeriodEnd: "2027-01-15T00:00:00.000Z",
      accessEndsAt: "2027-01-15T00:00:00.000Z",
    });
    assert.equal(view.subscriptionUnlinked, false);
    assert.equal(view.billingCustomerLinked, true);
    assert.equal(view.stripeStatusLabel, "active");
    assert.equal(view.headline, "Your subscription is active.");
  });

  it("shows override copy without inventing Stripe paid status", () => {
    const view = buildSubscriptionStatusPresentation({
      ...base,
      accessOverrideUntil: "2027-06-01T00:00:00.000Z",
    });
    assert.equal(view.headline, "Access is temporarily extended.");
    assert.match(view.detail, /does not change your Stripe invoices/i);
    assert.equal(view.stripeStatusLabel, "Not linked");
  });

  it("distinguishes customer-linked-but-status-pending from paid active", () => {
    const view = buildSubscriptionStatusPresentation({
      ...base,
      saasStripeCustomerId: "cus_pending",
      saasSubscriptionStatus: null,
    });
    assert.equal(view.subscriptionUnlinked, false);
    assert.equal(view.billingCustomerLinked, true);
    assert.equal(view.stripeStatusLabel, "Pending");
    assert.doesNotMatch(view.headline, /subscription is active/i);
  });

  it("preserves past_due and cancel-at-period-end messaging", () => {
    const pastDue = buildSubscriptionStatusPresentation({
      ...base,
      saasSubscriptionStatus: "past_due",
      saasStripeCustomerId: "cus_x",
    });
    assert.equal(pastDue.headline, "Payment past due.");

    const canceling = buildSubscriptionStatusPresentation({
      ...base,
      saasSubscriptionStatus: "active",
      saasStripeCustomerId: "cus_x",
      cancelAtPeriodEnd: true,
      accessEndsAt: "2027-02-01T00:00:00.000Z",
    });
    assert.equal(canceling.headline, "Cancellation scheduled.");
    assert.equal(canceling.periodEndLabelKey, "Access ends");
  });
});
