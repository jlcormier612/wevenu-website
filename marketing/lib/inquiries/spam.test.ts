import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  INQUIRY_HONEYPOT_FIELD,
  isHoneypotTriggered,
  normalizeInquiryIdempotencyKey,
  sanitizeInquiryFields,
} from "@/lib/inquiries/spam";

describe("inquiry honeypot", () => {
  it("ignores empty or missing honeypot for legitimate visitors", () => {
    assert.equal(isHoneypotTriggered(undefined), false);
    assert.equal(isHoneypotTriggered({}), false);
    assert.equal(isHoneypotTriggered({ [INQUIRY_HONEYPOT_FIELD]: "" }), false);
    assert.equal(isHoneypotTriggered({ [INQUIRY_HONEYPOT_FIELD]: "   " }), false);
    assert.equal(
      isHoneypotTriggered({
        firstName: "Jen",
        email: "jen@example.com",
        [INQUIRY_HONEYPOT_FIELD]: "",
      }),
      false,
    );
  });

  it("flags bot-like payloads that fill the honeypot", () => {
    assert.equal(
      isHoneypotTriggered({ [INQUIRY_HONEYPOT_FIELD]: "https://spam.example" }),
      true,
    );
  });

  it("strips the honeypot before persistence", () => {
    const cleaned = sanitizeInquiryFields({
      firstName: "Jen",
      [INQUIRY_HONEYPOT_FIELD]: "https://spam.example",
      message: "Hello",
    });
    assert.deepEqual(cleaned, { firstName: "Jen", message: "Hello" });
    assert.equal(INQUIRY_HONEYPOT_FIELD in cleaned, false);
  });
});

describe("inquiry idempotency key", () => {
  it("accepts UUID-shaped keys and normalizes case", () => {
    assert.equal(
      normalizeInquiryIdempotencyKey("A0Eebc99-9C0B-4EF8-BB6D-6BB9BD380A11"),
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    );
  });

  it("rejects non-UUID keys so the server mints a fresh id", () => {
    assert.equal(normalizeInquiryIdempotencyKey("local-123"), null);
    assert.equal(normalizeInquiryIdempotencyKey(""), null);
    assert.equal(normalizeInquiryIdempotencyKey("not-a-uuid"), null);
  });
});
