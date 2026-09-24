import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("payment-access online payments readiness", () => {
  it("payments API exposes onlinePaymentsReady from venue Stripe Connect", () => {
    const route = readFileSync(resolve("app/api/portal/payments/route.ts"), "utf8");
    assert.match(route, /onlinePaymentsReady/);
    assert.match(route, /stripe_onboarding_status === "connected"/);
    assert.match(route, /stripe_charges_enabled/);
  });

  it("payment access shell does not show actionable Pay when online payments are not ready", () => {
    const shell = readFileSync(resolve("components/portal/payment-access-shell.tsx"), "utf8");
    assert.match(shell, /onlinePaymentsReady/);
    assert.match(shell, /Online payments unavailable/);
    assert.match(shell, /canPayOnline/);
    assert.doesNotMatch(
      shell,
      /disabled=\{paying \|\| !nextOpen\}/,
    );
  });

  it("portal payment section only renders Pay now when online payments are ready", () => {
    const section = readFileSync(resolve("components/portal/payment-section.tsx"), "utf8");
    assert.match(section, /onlinePaymentsReady/);
    assert.match(section, /onlinePaymentsReady && \(next\.status === "pending"/);
    assert.match(section, /onlinePaymentsReady && \(item\.status === "pending"/);
  });

  it("payment success race only optimistic-marks while paidTotal is still 0", () => {
    const shell = readFileSync(resolve("components/portal/payment-access-shell.tsx"), "utf8");
    assert.match(shell, /webhookPending/);
    assert.match(shell, /paidTotal === 0/);
    assert.doesNotMatch(shell, /l\.status === "paid" \|\| paymentState === "success"/);
  });
});
