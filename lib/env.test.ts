import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { publicAppOrigin } from "@/lib/env";

describe("publicAppOrigin", () => {
  let prior: string | undefined;

  beforeEach(() => {
    prior = process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    if (prior === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prior;
  });

  it("returns the configured public origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";
    assert.equal(publicAppOrigin(), "https://app.sandbox.hellotocheers.com");
  });

  it("strips a trailing slash so URL joining cannot double up", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com/";
    assert.equal(publicAppOrigin(), "https://app.sandbox.hellotocheers.com");
  });

  it("falls back to localhost when unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    assert.equal(publicAppOrigin(), "http://localhost:3000");
  });

  // The regression this helper exists to prevent: behind the ALB,
  // request.nextUrl.origin resolves to the ECS task's private address, which
  // a browser cannot resolve (observed as ip-10-20-0-34.ec2.internal:3000
  // after a real Stripe Connect handshake). The helper must always yield the
  // public origin regardless of what the request looked like.
  it("builds a browser-routable settings URL for OAuth callbacks", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";
    const url = new URL("/settings/integrations", publicAppOrigin());
    url.searchParams.set("stripe_success", "1");
    assert.equal(
      url.toString(),
      "https://app.sandbox.hellotocheers.com/settings/integrations?stripe_success=1",
    );
    assert.ok(!url.hostname.endsWith(".ec2.internal"));
  });
});
