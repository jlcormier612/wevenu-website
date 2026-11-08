import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateVenueEntitlement,
  entitlementDecisionToVenuePatch,
  noticeStartsAt,
} from "./evaluate";
import type { VenueEntitlementSnapshot } from "./types";

const base: VenueEntitlementSnapshot = {
  manualSecurityLock: false,
  accessOverrideUntil: null,
  pauseBillingSuspend: false,
  saasSubscriptionStatus: "active",
  cancelAtPeriodEnd: false,
  currentPeriodEnd: "2026-12-01T00:00:00.000Z",
  dunningStartedAt: null,
  dunningClearedAt: null,
  retentionHold: false,
  accessLossReason: null,
  accessEndedAt: null,
};

describe("evaluateVenueEntitlement", () => {
  it("keeps access for active subscription", () => {
    const d = evaluateVenueEntitlement(base, new Date("2026-11-15T00:00:00.000Z"));
    assert.equal(d.entitled, true);
    assert.equal(d.entitlementStatus, "active");
    assert.equal(d.reasonCode, "stripe_paid_through");
  });

  it("keeps access when cancel_at_period_end before period end", () => {
    const d = evaluateVenueEntitlement(
      { ...base, cancelAtPeriodEnd: true },
      new Date("2026-11-15T00:00:00.000Z"),
    );
    assert.equal(d.entitled, true);
    assert.equal(d.entitlementStatus, "scheduled_end");
    assert.equal(d.accessEndsAt, "2026-12-01T00:00:00.000Z");
    assert.equal(d.clientVendorNoticeStartsAt, noticeStartsAt("2026-12-01T00:00:00.000Z"));
  });

  it("suspends after period end for scheduled cancel", () => {
    const d = evaluateVenueEntitlement(
      { ...base, cancelAtPeriodEnd: true },
      new Date("2026-12-02T00:00:00.000Z"),
    );
    assert.equal(d.entitled, false);
    assert.equal(d.accessLossReason, "voluntary_cancel");
  });

  it("allows grace during past_due within 21 days", () => {
    const d = evaluateVenueEntitlement(
      {
        ...base,
        saasSubscriptionStatus: "past_due",
        dunningStartedAt: "2026-11-01T00:00:00.000Z",
        currentPeriodEnd: null,
      },
      new Date("2026-11-10T00:00:00.000Z"),
    );
    assert.equal(d.entitled, true);
    assert.equal(d.entitlementStatus, "grace");
    assert.equal(d.accessEndsAt, "2026-11-22T00:00:00.000Z");
  });

  it("suspends for nonpayment after day 21", () => {
    const d = evaluateVenueEntitlement(
      {
        ...base,
        saasSubscriptionStatus: "past_due",
        dunningStartedAt: "2026-11-01T00:00:00.000Z",
      },
      new Date("2026-11-23T00:00:00.000Z"),
    );
    assert.equal(d.entitled, false);
    assert.equal(d.accessLossReason, "nonpayment");
    assert.equal(d.reasonCode, "dunning_exhausted");
  });

  it("founder override extends access past dunning deadline", () => {
    const d = evaluateVenueEntitlement(
      {
        ...base,
        saasSubscriptionStatus: "past_due",
        dunningStartedAt: "2026-11-01T00:00:00.000Z",
        accessOverrideUntil: "2026-12-15T00:00:00.000Z",
      },
      new Date("2026-11-25T00:00:00.000Z"),
    );
    assert.equal(d.entitled, true);
    assert.equal(d.reasonCode, "access_override");
  });

  it("manual security lock beats override and payment", () => {
    const d = evaluateVenueEntitlement(
      {
        ...base,
        manualSecurityLock: true,
        accessOverrideUntil: "2026-12-15T00:00:00.000Z",
        saasSubscriptionStatus: "active",
      },
      new Date("2026-11-15T00:00:00.000Z"),
    );
    assert.equal(d.entitled, false);
    assert.equal(d.accessLossReason, "manual_security");
    assert.equal(d.reasonCode, "manual_security_lock");
  });

  it("pause_billing_suspend defers nonpayment suspend", () => {
    const d = evaluateVenueEntitlement(
      {
        ...base,
        saasSubscriptionStatus: "past_due",
        dunningStartedAt: "2026-11-01T00:00:00.000Z",
        pauseBillingSuspend: true,
      },
      new Date("2026-11-25T00:00:00.000Z"),
    );
    assert.equal(d.entitled, true);
    assert.equal(d.reasonCode, "pause_billing_suspend");
  });

  it("canceled subscription after period end is not entitled", () => {
    const d = evaluateVenueEntitlement(
      {
        ...base,
        saasSubscriptionStatus: "canceled",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: "2026-11-01T00:00:00.000Z",
      },
      new Date("2026-11-15T00:00:00.000Z"),
    );
    assert.equal(d.entitled, false);
  });

  it("patch sets access_disabled false when entitled", () => {
    const d = evaluateVenueEntitlement(base, new Date("2026-11-15T00:00:00.000Z"));
    const patch = entitlementDecisionToVenuePatch(d, {
      stripeStatus: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: "2026-12-01T00:00:00.000Z",
    });
    assert.equal(patch.access_disabled, false);
    assert.equal(patch.account_status, "active");
    assert.equal(patch.saas_subscription_status, "active");
  });

  it("patch starts retention fields when not entitled", () => {
    const d = evaluateVenueEntitlement(
      { ...base, cancelAtPeriodEnd: true },
      new Date("2026-12-02T00:00:00.000Z"),
    );
    const patch = entitlementDecisionToVenuePatch(d);
    assert.equal(patch.access_disabled, true);
    assert.ok(patch.retention_started_at);
    assert.ok(patch.deletion_eligible_at);
  });
});
