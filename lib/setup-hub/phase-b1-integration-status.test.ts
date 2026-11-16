import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  facebookGuidedStatus,
  quickBooksGuidedStatus,
  stripeGuidedStatus,
  textingGuidedStatus,
  tourSchedulingGuidedStatus,
} from "@/lib/setup-hub/phase-b1-integration-status";

describe("guided integration status", () => {
  it("never marks Stripe Connected without charges enabled", () => {
    assert.equal(
      stripeGuidedStatus({ onboardingStatus: "connected", chargesEnabled: false }),
      "Needs attention",
    );
    assert.equal(
      stripeGuidedStatus({ onboardingStatus: "connected", chargesEnabled: true }),
      "Connected",
    );
    assert.equal(
      stripeGuidedStatus({ onboardingStatus: "not_started", chargesEnabled: false }),
      "Not set up",
    );
  });

  it("marks QuickBooks Needs attention when health check failed", () => {
    assert.equal(quickBooksGuidedStatus("connected", true), "Connected");
    assert.equal(quickBooksGuidedStatus("connected", false), "Needs attention");
    assert.equal(quickBooksGuidedStatus(null), "Not set up");
  });

  it("marks Facebook Connected only when delivering", () => {
    assert.equal(facebookGuidedStatus("delivering"), "Connected");
    assert.equal(facebookGuidedStatus("needs_forms"), "Needs attention");
    assert.equal(facebookGuidedStatus("not_connected"), "Not set up");
  });

  it("never marks texting Connected unless smsReady", () => {
    assert.equal(textingGuidedStatus({ smsReady: false, phase: "ready" }), "In progress");
    assert.equal(textingGuidedStatus({ smsReady: true, phase: "ready" }), "Connected");
    assert.equal(textingGuidedStatus({ smsReady: false, phase: "not_started" }), "Not set up");
    assert.equal(textingGuidedStatus({ smsReady: false }), "Not set up");
    assert.notEqual(textingGuidedStatus({ smsReady: false, phase: null }), "Connected");
    assert.notEqual(textingGuidedStatus({ smsReady: false, phase: "not_started" }), "Ready");
  });

  it("does not treat tour scheduling enabled as Connected", () => {
    assert.equal(tourSchedulingGuidedStatus(true), "In progress");
    assert.equal(tourSchedulingGuidedStatus(false), "Not set up");
  });
});
