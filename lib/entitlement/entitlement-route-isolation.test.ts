import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("entitlement route — multi-venue isolation", () => {
  const route = readFileSync(
    resolve("app/api/internal/product-access/entitlement/route.ts"),
    "utf8",
  );
  const webhook = readFileSync(
    resolve("marketing/app/api/stripe/webhook/route.ts"),
    "utf8",
  );

  it("resolves venues via resolveVenueFromCandidates — no email .limit(1)", () => {
    assert.match(route, /resolveVenueFromCandidates/);
    assert.match(route, /saas_stripe_subscription_id/);
    assert.match(route, /ownerEmail is intentionally ignored/);
    assert.doesNotMatch(route, /\.ilike\("email"/);
    assert.doesNotMatch(route, /from\("venue_staff"\)/);
    // Must not blindly take the first customer match without ambiguity handling.
    assert.match(route, /reason === "ambiguous"/);
    assert.match(route, /recoverable/);
  });

  it("webhook uses resolveRelationshipForSubscription and omits ownerEmail from entitlement sync", () => {
    assert.match(webhook, /resolveRelationshipForSubscription/);
    const syncBlocks = webhook.split("syncStripeEntitlementToProduct");
    assert.ok(syncBlocks.length >= 3, "expected subscription + invoice entitlement syncs");
    for (const block of syncBlocks.slice(1)) {
      const call = block.slice(0, 500);
      assert.doesNotMatch(call, /ownerEmail:/);
      assert.match(call, /stripeSubscriptionId:/);
    }
  });

  it("reactivation never falls back to email match", () => {
    const idx = webhook.indexOf("async function maybeReactivateFromPayment");
    assert.ok(idx > 0);
    const fn = webhook.slice(idx, idx + 1200);
    assert.match(fn, /resolveRelationshipForSubscription/);
    assert.doesNotMatch(fn, /owner\.email/);
  });
});
