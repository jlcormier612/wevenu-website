/**
 * Route wiring locks for Phase 1 email-intake source attribution.
 * Does not claim provider parsers are verified — only that the shared path
 * uses the attribution module and keeps marketplace vs method distinct.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("email-intake route attribution wiring", () => {
  const route = readFileSync(resolve("app/api/leads/email-intake/route.ts"), "utf8");

  it("classifies marketplace attribution separately from generic parse", () => {
    assert.match(route, /classifyMarketplaceAttribution/);
    assert.match(route, /emailIntakeLeadSourceKey/);
    assert.match(route, /buildEmailIntakeSourceData/);
  });

  it("keeps Resend email_id as the idempotency externalRef", () => {
    assert.match(route, /externalRef:\s*email_id/);
  });

  it("still verifies Svix signatures before parsing", () => {
    assert.match(route, /verifyResendWebhookSecrets/);
    assert.ok(route.indexOf("verifyResendWebhookSecrets") < route.indexOf("JSON.parse"));
  });

  it("does not hard-code the_knot as the default email source", () => {
    assert.doesNotMatch(route, /source:\s*"the_knot"/);
    assert.match(route, /source:\s*leadSource/);
  });
});
