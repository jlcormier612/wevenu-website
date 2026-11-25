import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { buildStripeConnectUrl, resolveStripeClientId } from "@/lib/stripe/oauth";

describe("resolveStripeClientId / buildStripeConnectUrl", () => {
  const keys = ["STRIPE_CLIENT_ID", "NEXT_PUBLIC_STRIPE_CLIENT_ID", "NEXT_PUBLIC_APP_URL"] as const;
  const prior: Partial<Record<(typeof keys)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const key of keys) prior[key] = process.env[key];
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";
  });

  afterEach(() => {
    for (const key of keys) {
      if (prior[key] === undefined) delete process.env[key];
      else process.env[key] = prior[key];
    }
  });

  it("prefers runtime STRIPE_CLIENT_ID over NEXT_PUBLIC_STRIPE_CLIENT_ID", () => {
    process.env.STRIPE_CLIENT_ID = "ca_runtime";
    process.env.NEXT_PUBLIC_STRIPE_CLIENT_ID = "ca_public";
    assert.equal(resolveStripeClientId(), "ca_runtime");
    const url = buildStripeConnectUrl("venue-1");
    assert.ok(url);
    assert.match(url!, /client_id=ca_runtime/);
  });

  it("falls back to NEXT_PUBLIC_STRIPE_CLIENT_ID when runtime unset", () => {
    delete process.env.STRIPE_CLIENT_ID;
    process.env.NEXT_PUBLIC_STRIPE_CLIENT_ID = "ca_public_only";
    assert.equal(resolveStripeClientId(), "ca_public_only");
  });

  it("returns null for CHANGE_ME or missing client id", () => {
    delete process.env.STRIPE_CLIENT_ID;
    process.env.NEXT_PUBLIC_STRIPE_CLIENT_ID = "CHANGE_ME";
    assert.equal(buildStripeConnectUrl("venue-1"), null);
  });
});
