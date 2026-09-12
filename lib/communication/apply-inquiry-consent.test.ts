import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldRecordInquirySmsConsent } from "@/lib/communication/apply-inquiry-consent";

describe("inquiry SMS consent recording", () => {
  it("does not treat a phone number alone as consent", () => {
    assert.equal(shouldRecordInquirySmsConsent(false, "+16155551234"), false);
  });

  it("does not treat a Text preference (checkbox off) as consent", () => {
    assert.equal(shouldRecordInquirySmsConsent(false, "615-555-1234"), false);
  });

  it("records consent only when the explicit checkbox is checked and a number is present", () => {
    assert.equal(shouldRecordInquirySmsConsent(true, "+16155551234"), true);
    assert.equal(shouldRecordInquirySmsConsent(true, "   "), false);
    assert.equal(shouldRecordInquirySmsConsent(true, null), false);
  });
});
