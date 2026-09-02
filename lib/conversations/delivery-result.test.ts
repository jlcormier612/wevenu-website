import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EMAIL_NOT_CONFIGURED_MESSAGE,
  SENDING_DISABLED_MESSAGE,
  acceptOutboundEmail,
  acceptOutboundSms,
} from "@/lib/conversations/delivery-result";

describe("acceptOutboundEmail", () => {
  it("accepts only a Resend send as success", () => {
    const accepted = acceptOutboundEmail({ ok: true, method: "resend", providerId: "re_123" });
    assert.deepEqual(accepted, { ok: true, providerId: "re_123" });
  });

  it("does not treat a mailto fallback as a successful send", () => {
    const accepted = acceptOutboundEmail({ ok: true, method: "mailto", mailtoUrl: "mailto:a@b.com" });
    assert.equal(accepted.ok, false);
    if (!accepted.ok) assert.equal(accepted.message, EMAIL_NOT_CONFIGURED_MESSAGE);
  });

  it("does not treat disabled mode as a successful send", () => {
    const accepted = acceptOutboundEmail({ ok: true, method: "disabled" });
    assert.equal(accepted.ok, false);
    if (!accepted.ok) assert.equal(accepted.message, SENDING_DISABLED_MESSAGE);
  });

  it("preserves translated provider failures", () => {
    const accepted = acceptOutboundEmail({ ok: false, message: "422 invalid `to` field" });
    assert.equal(accepted.ok, false);
    if (!accepted.ok) assert.equal(accepted.message, "This email address appears invalid.");
  });
});

describe("acceptOutboundSms", () => {
  it("accepts a real Twilio provider id", () => {
    const accepted = acceptOutboundSms({ ok: true, providerId: "SM123" });
    assert.deepEqual(accepted, { ok: true, providerId: "SM123" });
  });

  it("never records success when the provider id is the disabled sentinel", () => {
    const accepted = acceptOutboundSms({ ok: true, providerId: "disabled" });
    assert.equal(accepted.ok, false);
    if (!accepted.ok) assert.equal(accepted.message, SENDING_DISABLED_MESSAGE);
  });

  it("does not tell the venue to add Twilio credentials when texting is unconfigured", () => {
    const accepted = acceptOutboundSms({
      ok: false,
      message: "Texting isn't set up yet. Open Communication Health to see why.",
    });
    assert.equal(accepted.ok, false);
    if (!accepted.ok) {
      assert.match(accepted.message, /Communication Health/);
      assert.doesNotMatch(accepted.message, /Twilio|this venue|credentials/i);
    }
  });
});
