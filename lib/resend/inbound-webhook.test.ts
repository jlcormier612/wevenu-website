import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findHeaderValue,
  htmlToText,
  verifySvixSignature,
  type SvixHeaders,
} from "@/lib/resend/inbound-webhook";

const SECRET = "whsec_dGVzdC1zZWNyZXQta2V5LWZvci1zdml4"; // base64("test-secret-key-for-svix") with whsec_ prefix

function sign(id: string, timestamp: string, body: string, secret = SECRET): string {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${id}.${timestamp}.${body}`;
  const digest = createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  return `v1,${digest}`;
}

describe("verifySvixSignature", () => {
  const id = "msg_2abc123";
  const timestamp = "1755000000";
  const body = JSON.stringify({ type: "email.received", data: { email_id: "e1" } });

  it("accepts a correctly computed signature", () => {
    const headers: SvixHeaders = { id, timestamp, signature: sign(id, timestamp, body) };
    assert.equal(verifySvixSignature(body, headers, SECRET), true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const headers: SvixHeaders = { id, timestamp, signature: sign(id, timestamp, body, "whsec_d3Jvbmctc2VjcmV0") };
    assert.equal(verifySvixSignature(body, headers, SECRET), false);
  });

  it("rejects when the body has been tampered with after signing", () => {
    const headers: SvixHeaders = { id, timestamp, signature: sign(id, timestamp, body) };
    assert.equal(verifySvixSignature(body + "tampered", headers, SECRET), false);
  });

  it("rejects when any of the three Svix headers is missing", () => {
    const signature = sign(id, timestamp, body);
    assert.equal(verifySvixSignature(body, { id: null, timestamp, signature }, SECRET), false);
    assert.equal(verifySvixSignature(body, { id, timestamp: null, signature }, SECRET), false);
    assert.equal(verifySvixSignature(body, { id, timestamp, signature: null }, SECRET), false);
  });

  it("accepts a match among multiple space-separated signature candidates (key rotation)", () => {
    const good = sign(id, timestamp, body);
    const decoy = "v1,not-a-real-signature";
    const headers: SvixHeaders = { id, timestamp, signature: `${decoy} ${good}` };
    assert.equal(verifySvixSignature(body, headers, SECRET), true);
  });

  it("rejects when no candidate in a multi-signature header matches", () => {
    const headers: SvixHeaders = { id, timestamp, signature: "v1,bad-one v1,bad-two" };
    assert.equal(verifySvixSignature(body, headers, SECRET), false);
  });

  it("does not throw on a malformed signature header", () => {
    const headers: SvixHeaders = { id, timestamp, signature: "garbage-with-no-comma" };
    assert.doesNotThrow(() => verifySvixSignature(body, headers, SECRET));
    assert.equal(verifySvixSignature(body, headers, SECRET), false);
  });
});

describe("findHeaderValue", () => {
  it("looks up by the lowercase key Resend's Retrieve API actually returns", () => {
    const headers = { "in-reply-to": "<abc@resend.dev>", "mime-version": "1.0" };
    assert.equal(findHeaderValue(headers, "in-reply-to"), "<abc@resend.dev>");
  });

  it("is case-insensitive on the lookup name", () => {
    const headers = { "in-reply-to": "<abc@resend.dev>" };
    assert.equal(findHeaderValue(headers, "In-Reply-To"), "<abc@resend.dev>");
  });

  it("returns null when the header is absent", () => {
    assert.equal(findHeaderValue({}, "in-reply-to"), null);
  });
});

describe("htmlToText", () => {
  it("strips tags for the no-text-part fallback", () => {
    assert.equal(htmlToText("<p>Hello <strong>world</strong></p>"), "Hello world");
  });
});
