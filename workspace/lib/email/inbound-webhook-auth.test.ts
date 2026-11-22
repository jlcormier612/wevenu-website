import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  authorizeInboundWebhook,
  parseInboundWebhookSecrets,
  signInboundWebhookForTest,
  verifyInboundSvixSignature,
} from "./inbound-webhook-auth";

const TEST_SECRET = `whsec_${Buffer.from("r0-inbound-test-secret-key!!").toString("base64")}`;
const BODY = JSON.stringify({
  from: "prospect@example.com",
  to: ["relationship+rel_test@replies.example.com"],
  subject: "Re: Hello",
  text: "Thanks — interested.",
  dryRun: true,
});

function headerBag(init: Record<string, string>) {
  const map = new Map(
    Object.entries(init).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    get(name: string) {
      return map.get(name.toLowerCase()) ?? null;
    },
  };
}

describe("workspace inbound webhook auth (fail-closed)", () => {
  it("parses comma-separated secrets for rotation", () => {
    assert.deepEqual(parseInboundWebhookSecrets(" a , b "), ["a", "b"]);
    assert.deepEqual(parseInboundWebhookSecrets("  "), []);
    assert.deepEqual(parseInboundWebhookSecrets(null), []);
  });

  it("rejects when RESEND_WEBHOOK_SECRET is missing or empty", () => {
    const signed = signInboundWebhookForTest(BODY, TEST_SECRET);
    const headers = headerBag({
      "svix-id": signed.id,
      "svix-timestamp": signed.timestamp,
      "svix-signature": signed.signature,
    });
    assert.equal(authorizeInboundWebhook(BODY, headers, ""), false);
    assert.equal(authorizeInboundWebhook(BODY, headers, null), false);
    assert.equal(authorizeInboundWebhook(BODY, headers, undefined), false);
  });

  it("rejects unsigned requests even when a secret is configured", () => {
    assert.equal(
      authorizeInboundWebhook(BODY, headerBag({}), TEST_SECRET),
      false,
    );
    assert.equal(
      authorizeInboundWebhook(
        BODY,
        headerBag({ "x-wevenu-inbound-test": "1" }),
        TEST_SECRET,
      ),
      false,
    );
  });

  it("rejects query-secret style auth (no longer accepted)", () => {
    // Simulate legacy ?secret= usage: no Svix headers → deny.
    assert.equal(
      authorizeInboundWebhook(BODY, headerBag({}), TEST_SECRET),
      false,
    );
  });

  it("accepts a correctly signed Svix webhook", () => {
    const signed = signInboundWebhookForTest(BODY, TEST_SECRET);
    const headers = headerBag({
      "svix-id": signed.id,
      "svix-timestamp": signed.timestamp,
      "svix-signature": signed.signature,
    });
    assert.equal(authorizeInboundWebhook(BODY, headers, TEST_SECRET), true);
  });

  it("accepts any secret in a rotation list", () => {
    const signed = signInboundWebhookForTest(BODY, TEST_SECRET);
    const headers = headerBag({
      "svix-id": signed.id,
      "svix-timestamp": signed.timestamp,
      "svix-signature": signed.signature,
    });
    const rotated = `whsec_other,${TEST_SECRET}`;
    assert.equal(authorizeInboundWebhook(BODY, headers, rotated), true);
  });

  it("rejects invalid signatures", () => {
    const signed = signInboundWebhookForTest(BODY, TEST_SECRET);
    const headers = headerBag({
      "svix-id": signed.id,
      "svix-timestamp": signed.timestamp,
      "svix-signature": "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    });
    assert.equal(authorizeInboundWebhook(BODY, headers, TEST_SECRET), false);
  });

  it("rejects expired signatures", () => {
    const oldTs = Math.floor(Date.now() / 1000) - 601;
    const signed = signInboundWebhookForTest(BODY, TEST_SECRET, {
      timestamp: oldTs,
    });
    const headers = headerBag({
      "svix-id": signed.id,
      "svix-timestamp": signed.timestamp,
      "svix-signature": signed.signature,
    });
    assert.equal(
      verifyInboundSvixSignature(BODY, headers, TEST_SECRET),
      false,
    );
    assert.equal(authorizeInboundWebhook(BODY, headers, TEST_SECRET), false);
  });

  it("route module uses authorizeInboundWebhook (no open-when-unset)", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const src = readFileSync(
      join(process.cwd(), "workspace/app/api/email/inbound/route.ts"),
      "utf8",
    );
    assert.match(src, /authorizeInboundWebhook/);
    assert.equal(src.includes("secrets.length === 0) return true"), false);
    assert.equal(src.includes("x-wevenu-inbound-test"), false);
    assert.equal(src.includes("verifyQuerySecret"), false);
  });
});

