/**
 * Attachment constraint unit tests — SMS/MMS vs storage limits.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SMS_MMS_MAX_BYTES,
  validateAttachmentsForChannel,
} from "@/lib/conversations/attachment-constraints";

describe("validateAttachmentsForChannel", () => {
  it("allows a JPEG under 5MB on SMS", () => {
    const result = validateAttachmentsForChannel("sms", [
      { name: "photo.jpg", size: 1_000_000, mimeType: "image/jpeg" },
    ]);
    assert.equal(result.ok, true);
  });

  it("rejects SMS media over the 5MB total", () => {
    const result = validateAttachmentsForChannel("sms", [
      { name: "big.jpg", size: SMS_MMS_MAX_BYTES + 1, mimeType: "image/jpeg" },
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /5 MB|MMS/i);
      assert.doesNotMatch(result.message, /Twilio/i);
    }
  });

  it("rejects Office docs on SMS (not MMS types)", () => {
    const result = validateAttachmentsForChannel("sms", [
      {
        name: "menu.docx",
        size: 1000,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    ]);
    assert.equal(result.ok, false);
  });

  it("allows Office docs on email", () => {
    const result = validateAttachmentsForChannel("email", [
      {
        name: "menu.docx",
        size: 1000,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    ]);
    assert.equal(result.ok, true);
  });

  it("rejects more than 10 SMS media files", () => {
    const files = Array.from({ length: 11 }, (_, i) => ({
      name: `a${i}.jpg`,
      size: 100,
      mimeType: "image/jpeg",
    }));
    const result = validateAttachmentsForChannel("sms", files);
    assert.equal(result.ok, false);
  });
});
