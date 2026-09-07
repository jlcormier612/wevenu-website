import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isHardBlocked,
  isSmsOutboundAllowed,
  normalizeEmailAddressKey,
  normalizeSmsAddressKey,
  permissionFromTwilioOptOut,
  SMS_ALLOWS_NOT_OPTED_IN,
} from "@/lib/communication/permissions";

describe("communication permissions", () => {
  it("normalizes SMS to digit keys", () => {
    assert.equal(normalizeSmsAddressKey("(615) 555-1234"), "16155551234");
    assert.equal(normalizeSmsAddressKey("+16155551234"), "16155551234");
  });

  it("normalizes email to lowercase", () => {
    assert.equal(normalizeEmailAddressKey("Ada@Example.COM"), "ada@example.com");
  });

  it("locks SMS release rule: not_opted_in allowed; only hard blocks refuse", () => {
    assert.equal(SMS_ALLOWS_NOT_OPTED_IN, true);
    assert.equal(isHardBlocked("opted_out"), true);
    assert.equal(isHardBlocked("provider_blocked"), true);
    assert.equal(isHardBlocked("opted_in"), false);
    assert.equal(isHardBlocked("not_opted_in"), false);
    assert.equal(isSmsOutboundAllowed("not_opted_in"), true);
    assert.equal(isSmsOutboundAllowed("opted_in"), true);
    assert.equal(isSmsOutboundAllowed("opted_out"), false);
    assert.equal(isSmsOutboundAllowed("provider_blocked"), false);
  });

  it("maps Twilio STOP/START without treating casual inbound as opt-in", () => {
    assert.deepEqual(permissionFromTwilioOptOut("STOP", "STOP"), {
      status: "opted_out",
      source: "twilio_stop",
    });
    assert.deepEqual(permissionFromTwilioOptOut("START", "START"), {
      status: "opted_in",
      source: "twilio_start",
    });
    assert.equal(permissionFromTwilioOptOut(null, "Thanks for the tour!"), null);
    assert.equal(permissionFromTwilioOptOut(null, "yes"), null);
    assert.deepEqual(permissionFromTwilioOptOut(null, "stop"), {
      status: "opted_out",
      source: "sms_keyword_stop",
    });
    assert.deepEqual(permissionFromTwilioOptOut(null, "start"), {
      status: "opted_in",
      source: "sms_keyword_start",
    });
  });
});
