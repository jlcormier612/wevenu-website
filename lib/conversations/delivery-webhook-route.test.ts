import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("messaging delivery webhook signature verification", () => {
  const source = readFileSync(resolve("app/api/messaging/webhook/route.ts"), "utf8");

  it("uses the shared Svix verifier (whsec_ base64 decode), not a raw-string HMAC", () => {
    assert.match(source, /verifyResendWebhookSecrets/);
    assert.doesNotMatch(source, /createHmac\("sha256", secret\)/);
  });
});
