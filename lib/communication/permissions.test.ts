import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  assertChannelAllowed,
  getCommunicationPermission,
  isHardBlocked,
  isOutboundChannelConsentOk,
  isSmsOutboundAllowed,
  normalizeEmailAddressKey,
  normalizeSmsAddressKey,
  permissionFromTwilioOptOut,
  readCommunicationPermission,
  SMS_ALLOWS_NOT_OPTED_IN,
} from "@/lib/communication/permissions";

function mockPermissionClient(result: {
  status?: string | null;
  error?: { message: string } | null;
}) {
  return {
    from() {
      const api = {
        select: () => api,
        eq: () => api,
        maybeSingle: async () => ({
          data: result.error ? null : result.status ? { status: result.status } : null,
          error: result.error ?? null,
        }),
      };
      return api;
    },
  };
}

describe("communication permissions", () => {
  it("normalizes SMS to digit keys", () => {
    assert.equal(normalizeSmsAddressKey("(615) 555-1234"), "16155551234");
    assert.equal(normalizeSmsAddressKey("+16155551234"), "16155551234");
  });

  it("normalizes email to lowercase", () => {
    assert.equal(normalizeEmailAddressKey("Ada@Example.COM"), "ada@example.com");
  });

  it("requires explicit opt-in before application-originated outbound SMS", () => {
    assert.equal(SMS_ALLOWS_NOT_OPTED_IN, false);
    assert.equal(isHardBlocked("opted_out"), true);
    assert.equal(isHardBlocked("provider_blocked"), true);
    assert.equal(isHardBlocked("opted_in"), false);
    assert.equal(isHardBlocked("not_opted_in"), false);
    assert.equal(isSmsOutboundAllowed("not_opted_in"), false);
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
    assert.equal(permissionFromTwilioOptOut("HELP", "HELP"), null);
    assert.equal(permissionFromTwilioOptOut(null, "help"), null);
    assert.deepEqual(permissionFromTwilioOptOut(null, "stop"), {
      status: "opted_out",
      source: "sms_keyword_stop",
    });
    assert.deepEqual(permissionFromTwilioOptOut(null, "start"), {
      status: "opted_in",
      source: "sms_keyword_start",
    });
  });

  it("documents sms_consent_request as the only not_opted_in send purpose", () => {
    const src = readFileSync(new URL("./permissions.ts", import.meta.url), "utf8");
    assert.match(src, /purpose\?: "outbound" \| "sms_consent_request"/);
    assert.match(src, /sms_consent_request/);
    assert.equal(isSmsOutboundAllowed("not_opted_in"), false);
  });

  it("isOutboundChannelConsentOk mirrors outbound send rules without inventing opt-in", () => {
    assert.equal(isOutboundChannelConsentOk("email", "not_opted_in"), true);
    assert.equal(isOutboundChannelConsentOk("email", "opted_out"), false);
    assert.equal(isOutboundChannelConsentOk("sms", "not_opted_in"), false);
    assert.equal(isOutboundChannelConsentOk("sms", null), false);
    assert.equal(isOutboundChannelConsentOk("sms", "opted_in"), true);
  });

  it("readCommunicationPermission: successful empty row → not_opted_in found=false", async () => {
    const read = await readCommunicationPermission(mockPermissionClient({ status: null }), {
      venueId: "v1",
      channel: "email",
      addressKey: "a@example.com",
    });
    assert.deepEqual(read, { ok: true, status: "not_opted_in", found: false });
  });

  it("readCommunicationPermission: query error does not map to not_opted_in", async () => {
    const read = await readCommunicationPermission(
      mockPermissionClient({ error: { message: "db down" } }),
      { venueId: "v1", channel: "email", addressKey: "opted-out@example.com" },
    );
    assert.equal(read.ok, false);
    if (read.ok) throw new Error("expected failure");
    assert.match(read.message, /Couldn't verify messaging permission/i);
  });

  it("getCommunicationPermission throws on read error (fail closed)", async () => {
    await assert.rejects(
      () =>
        getCommunicationPermission(mockPermissionClient({ error: { message: "db down" } }), {
          venueId: "v1",
          channel: "email",
          addressKey: "x@example.com",
        }),
      /Couldn't verify messaging permission/i,
    );
  });

  it("assertChannelAllowed: email read error fails closed (not treated as sendable not_opted_in)", async () => {
    const check = await assertChannelAllowed(
      mockPermissionClient({ error: { message: "db down" } }),
      { venueId: "v1", channel: "email", rawAddress: "opted-out@example.com" },
    );
    assert.equal(check.ok, false);
    assert.match(check.message, /Couldn't verify messaging permission/i);
  });

  it("assertChannelAllowed: successful email with no row remains allowed", async () => {
    const check = await assertChannelAllowed(mockPermissionClient({ status: null }), {
      venueId: "v1",
      channel: "email",
      rawAddress: "Ada@Example.COM",
    });
    assert.equal(check.ok, true);
    assert.equal(check.status, "not_opted_in");
  });

  it("assertChannelAllowed: email opted_out blocked; SMS missing consent blocked", async () => {
    const email = await assertChannelAllowed(
      mockPermissionClient({ status: "opted_out" }),
      { venueId: "v1", channel: "email", rawAddress: "x@example.com" },
    );
    assert.equal(email.ok, false);
    assert.equal(email.status, "opted_out");

    const sms = await assertChannelAllowed(mockPermissionClient({ status: null }), {
      venueId: "v1",
      channel: "sms",
      rawAddress: "+16155551234",
    });
    assert.equal(sms.ok, false);
    assert.equal(sms.status, "not_opted_in");
  });

  it("assertChannelAllowed: SMS consent-request still allowed while not_opted_in", async () => {
    const check = await assertChannelAllowed(mockPermissionClient({ status: null }), {
      venueId: "v1",
      channel: "sms",
      rawAddress: "+16155551234",
      purpose: "sms_consent_request",
    });
    assert.equal(check.ok, true);
    assert.equal(check.status, "not_opted_in");
  });

  it("assertChannelAllowed: SMS consent-request still blocked on read error", async () => {
    const check = await assertChannelAllowed(
      mockPermissionClient({ error: { message: "db down" } }),
      {
        venueId: "v1",
        channel: "sms",
        rawAddress: "+16155551234",
        purpose: "sms_consent_request",
      },
    );
    assert.equal(check.ok, false);
    assert.match(check.message, /Couldn't verify messaging permission/i);
  });

  it("assertChannelAllowed: valid SMS opted_in allowed", async () => {
    const check = await assertChannelAllowed(
      mockPermissionClient({ status: "opted_in" }),
      { venueId: "v1", channel: "sms", rawAddress: "+16155551234" },
    );
    assert.equal(check.ok, true);
    assert.equal(check.status, "opted_in");
  });
});
