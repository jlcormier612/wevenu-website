import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  activationBaseUrl,
  activationUrlFromToken,
  productPostActivationLoginUrl,
} from "@/shared/email/templates/helpers";

const ENV_KEYS = [
  "WORKSPACE_URL",
  "NEXT_PUBLIC_WORKSPACE_URL",
  "NEXT_PUBLIC_PRODUCT_APP_URL",
  "NEXT_PUBLIC_APP_URL",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

// Regression coverage for the bug where the marketing app's runtime env
// never had WORKSPACE_URL set, so activation links pointed at whatever
// NEXT_PUBLIC_PRODUCT_APP_URL/NEXT_PUBLIC_APP_URL resolved to — the venue
// app's own host, which has no /activate/[token] route at all (that route
// only exists in the workspace app). A real signup completed payment and
// then handed the customer a 404. If this priority order silently
// reverts, activation links break again with no visible error at send
// time — Resend still returns 200 for a link to a page that 404s.
describe("productPostActivationLoginUrl — must land on product login then Setup Hub", () => {
  it("uses the product-app host, not the workspace activate host", () => {
    process.env.NEXT_PUBLIC_PRODUCT_APP_URL = "https://app.sandbox.hellotocheers.com";
    process.env.WORKSPACE_URL = "https://workspace.sandbox.hellotocheers.com";
    const url = productPostActivationLoginUrl();
    assert.equal(
      url,
      "https://app.sandbox.hellotocheers.com/login?activated=1&next=%2Fsetup-hub",
    );
    assert.doesNotMatch(url, /workspace\.sandbox/);
  });
});

describe("activationBaseUrl / activationUrlFromToken — must resolve to the workspace app", () => {
  it("prefers WORKSPACE_URL over every other candidate", () => {
    process.env.WORKSPACE_URL = "https://workspace.sandbox.hellotocheers.com";
    process.env.NEXT_PUBLIC_PRODUCT_APP_URL = "https://app.sandbox.hellotocheers.com";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";
    assert.equal(activationBaseUrl(), "https://workspace.sandbox.hellotocheers.com");
  });

  it("falls back to NEXT_PUBLIC_WORKSPACE_URL when WORKSPACE_URL is unset", () => {
    process.env.NEXT_PUBLIC_WORKSPACE_URL = "https://workspace.sandbox.hellotocheers.com";
    process.env.NEXT_PUBLIC_PRODUCT_APP_URL = "https://app.sandbox.hellotocheers.com";
    assert.equal(activationBaseUrl(), "https://workspace.sandbox.hellotocheers.com");
  });

  it("never resolves to the venue/product-app host when a workspace URL is configured", () => {
    process.env.WORKSPACE_URL = "https://workspace.sandbox.hellotocheers.com";
    process.env.NEXT_PUBLIC_PRODUCT_APP_URL = "https://app.sandbox.hellotocheers.com";
    const url = activationUrlFromToken("tok_abc123");
    assert.equal(url, "https://workspace.sandbox.hellotocheers.com/activate/tok_abc123");
    assert.doesNotMatch(url, /app\.sandbox\.hellotocheers\.com/);
  });

  it("strips a trailing slash from the configured base", () => {
    process.env.WORKSPACE_URL = "https://workspace.sandbox.hellotocheers.com/";
    assert.equal(activationBaseUrl(), "https://workspace.sandbox.hellotocheers.com");
  });

  it("only falls back to the product-app URL when no workspace URL is configured at all", () => {
    process.env.NEXT_PUBLIC_PRODUCT_APP_URL = "https://app.sandbox.hellotocheers.com";
    assert.equal(activationBaseUrl(), "https://app.sandbox.hellotocheers.com");
  });

  it("encodes the token in the final URL", () => {
    process.env.WORKSPACE_URL = "https://workspace.sandbox.hellotocheers.com";
    assert.equal(
      activationUrlFromToken(" tok with space "),
      "https://workspace.sandbox.hellotocheers.com/activate/tok%20with%20space",
    );
  });
});
