import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { describe, it } from "node:test";

import {
  verifyEventStreamsBasicAuth,
  verifyTwilioEventStreamsSignature,
} from "@/lib/sms/event-streams-verify";

function sign(url: string, body: string, authToken: string): string {
  const bodySha256 = createHash("sha256").update(Buffer.from(body, "utf8")).digest("hex");
  const joiner = url.includes("?") ? "&" : "?";
  const urlForSig = `${url}${joiner}bodySHA256=${bodySha256}`;
  return createHmac("sha1", authToken).update(urlForSig, "utf8").digest("base64");
}

describe("verifyTwilioEventStreamsSignature", () => {
  const url = "https://app.example.com/api/messaging/a2p-events";
  const body = JSON.stringify([{ type: "com.twilio.messaging.compliance.number-registration.pending", id: "CE1", data: {} }]);
  const token = "auth_token_test_value";

  it("accepts a valid Event Streams body signature", () => {
    const signature = sign(url, body, token);
    assert.equal(verifyTwilioEventStreamsSignature(url, body, signature, token), true);
  });

  it("rejects missing or wrong signatures", () => {
    assert.equal(verifyTwilioEventStreamsSignature(url, body, null, token), false);
    assert.equal(verifyTwilioEventStreamsSignature(url, body, "nope", token), false);
    assert.equal(verifyTwilioEventStreamsSignature(url, body, sign(url, body, "other"), token), false);
  });

  it("rejects when auth token is missing", () => {
    const signature = sign(url, body, token);
    assert.equal(verifyTwilioEventStreamsSignature(url, body, signature, null), false);
  });
});

describe("verifyEventStreamsBasicAuth", () => {
  it("passes when basic auth is not configured", () => {
    assert.equal(verifyEventStreamsBasicAuth(null, null, null), true);
  });

  it("requires matching basic credentials when configured", () => {
    const header = `Basic ${Buffer.from("user:pass").toString("base64")}`;
    assert.equal(verifyEventStreamsBasicAuth(header, "user", "pass"), true);
    assert.equal(verifyEventStreamsBasicAuth(header, "user", "wrong"), false);
    assert.equal(verifyEventStreamsBasicAuth(null, "user", "pass"), false);
  });
});
