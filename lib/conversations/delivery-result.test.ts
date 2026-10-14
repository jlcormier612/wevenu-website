import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EMAIL_NOT_CONFIGURED_MESSAGE,
  SMS_NOT_CONFIGURED_MESSAGE,
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
    if (!accepted.ok) {
      assert.match(accepted.message, /not valid|rejected/i);
      assert.doesNotMatch(accepted.message, /couldn't be delivered/i);
    }
  });

  it("does not re-translate already-classified SendResult codes", () => {
    const accepted = acceptOutboundEmail({
      ok: false,
      message: "The email provider rejected this send because a sending quota was reached. The message was not accepted for delivery.",
      code: "quota",
      retryUnsafe: true,
    });
    assert.equal(accepted.ok, false);
    if (!accepted.ok) assert.match(accepted.message, /quota/i);
  });
});

describe("acceptOutboundSms", () => {
  it("accepts a real Twilio provider id", () => {
    const accepted = acceptOutboundSms({
      ok: true,
      providerId: "SM123",
      providerAccountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    assert.deepEqual(accepted, { ok: true, providerId: "SM123" });
  });

  it("never records success when the provider id is the disabled sentinel", () => {
    const accepted = acceptOutboundSms({
      ok: true,
      providerId: "disabled",
      providerAccountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    assert.equal(accepted.ok, false);
    if (!accepted.ok) assert.equal(accepted.message, SENDING_DISABLED_MESSAGE);
  });

  it("does not tell the venue to add Twilio credentials when texting is unconfigured", () => {
    const accepted = acceptOutboundSms({
      ok: false,
      message: SMS_NOT_CONFIGURED_MESSAGE,
    });
    assert.equal(accepted.ok, false);
    if (!accepted.ok) {
      assert.match(accepted.message, /Settings → Communications|texting/i);
      assert.doesNotMatch(accepted.message, /Twilio|credentials/i);
    }
  });
});
