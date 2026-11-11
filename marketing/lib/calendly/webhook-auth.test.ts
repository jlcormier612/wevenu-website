import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import { assertCalendlyWebhookAuth } from "@/lib/calendly/webhook-auth";
import { verifyCalendlySignature, verifySharedSecretHeader } from "@/lib/calendly/verify";

function signedHeaders(
  rawBody: string,
  signingKey: string,
  t: number = Math.floor(Date.now() / 1000),
): string {
  const v1 = createHmac("sha256", signingKey)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  return `t=${t},v1=${v1}`;
}

describe("verifyCalendlySignature", () => {
  it("accepts a fresh valid signature", () => {
    const rawBody = '{"event":"invitee.created"}';
    const key = "test-signing-key";
    const now = 1_700_000_000;
    const header = signedHeaders(rawBody, key, now);
    assert.equal(verifyCalendlySignature(header, rawBody, key, 180, now), true);
  });

  it("rejects stale timestamps outside tolerance", () => {
    const rawBody = "{}";
    const key = "test-signing-key";
    const now = 1_700_000_000;
    const header = signedHeaders(rawBody, key, now - 181);
    assert.equal(verifyCalendlySignature(header, rawBody, key, 180, now), false);
  });

  it("rejects missing, malformed, or wrong signatures", () => {
    const rawBody = "{}";
    const key = "test-signing-key";
    const now = 1_700_000_000;
    assert.equal(verifyCalendlySignature(null, rawBody, key, 180, now), false);
    assert.equal(verifyCalendlySignature("v1=abc", rawBody, key, 180, now), false);
    assert.equal(
      verifyCalendlySignature(`t=${now},v1=deadbeef`, rawBody, key, 180, now),
      false,
    );
    assert.equal(
      verifyCalendlySignature(signedHeaders(rawBody, "other-key", now), rawBody, key, 180, now),
      false,
    );
  });
});

describe("verifySharedSecretHeader", () => {
  it("fails closed when secret is empty", () => {
    const request = new Request("https://example.com/api/calendly/webhook", {
      method: "POST",
      headers: { "x-calendly-webhook-secret": "anything" },
    });
    assert.equal(verifySharedSecretHeader(request, ""), false);
    assert.equal(verifySharedSecretHeader(request, undefined), false);
  });
});

describe("assertCalendlyWebhookAuth", () => {
  it("fails closed when no signing key or shared secret is configured", () => {
    const result = assertCalendlyWebhookAuth({
      signingKey: "",
      sharedSecret: "",
      signatureHeader: null,
      rawBody: "{}",
      request: new Request("https://example.com/api/calendly/webhook", {
        method: "POST",
      }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 503);
      assert.match(result.error, /not configured/i);
    }
  });

  it("rejects invalid Calendly signatures before any CRM work", () => {
    const result = assertCalendlyWebhookAuth({
      signingKey: "test-signing-key",
      sharedSecret: "",
      signatureHeader: "t=1,v1=deadbeef",
      rawBody: '{"event":"invitee.created"}',
      request: new Request("https://example.com/api/calendly/webhook", {
        method: "POST",
      }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });

  it("rejects missing signature when signing key is configured", () => {
    const result = assertCalendlyWebhookAuth({
      signingKey: "test-signing-key",
      sharedSecret: "ignored-when-signing-key-set",
      signatureHeader: null,
      rawBody: "{}",
      request: new Request("https://example.com/api/calendly/webhook", {
        method: "POST",
        headers: { "x-calendly-webhook-secret": "ignored-when-signing-key-set" },
      }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });

  it("rejects stale signatures", () => {
    const rawBody = "{}";
    const signingKey = "test-signing-key";
    const now = 1_700_000_000;
    const result = assertCalendlyWebhookAuth({
      signingKey,
      sharedSecret: "",
      signatureHeader: signedHeaders(rawBody, signingKey, now - 400),
      rawBody,
      request: new Request("https://example.com/api/calendly/webhook", {
        method: "POST",
      }),
      nowSeconds: now,
      toleranceSeconds: 180,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });

  it("accepts a valid Calendly signature", () => {
    const rawBody = '{"event":"invitee.created"}';
    const signingKey = "test-signing-key";
    const result = assertCalendlyWebhookAuth({
      signingKey,
      sharedSecret: "",
      signatureHeader: signedHeaders(rawBody, signingKey),
      rawBody,
      request: new Request("https://example.com/api/calendly/webhook", {
        method: "POST",
      }),
    });
    assert.equal(result.ok, true);
  });

  it("accepts the shared-secret header fallback only when signing key unset", () => {
    const result = assertCalendlyWebhookAuth({
      signingKey: "",
      sharedSecret: "shared-dev-secret",
      signatureHeader: null,
      rawBody: "{}",
      request: new Request("https://example.com/api/calendly/webhook", {
        method: "POST",
        headers: { "x-calendly-webhook-secret": "shared-dev-secret" },
      }),
    });
    assert.equal(result.ok, true);
  });

  it("rejects wrong shared secret", () => {
    const result = assertCalendlyWebhookAuth({
      signingKey: "",
      sharedSecret: "shared-dev-secret",
      signatureHeader: null,
      rawBody: "{}",
      request: new Request("https://example.com/api/calendly/webhook", {
        method: "POST",
        headers: { "x-calendly-webhook-secret": "nope" },
      }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });
});
