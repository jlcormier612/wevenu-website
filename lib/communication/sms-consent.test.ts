import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SMS_ALLOWS_NOT_OPTED_IN,
  isSmsOutboundAllowed,
} from "@/lib/communication/permissions";
import {
  SMS_INQUIRY_CONSENT_LANGUAGE_VERSION,
  buildInquirySmsConsentText,
  effectivePublicCommunicationSettings,
  parseInquiryCommunicationSettings,
  preferredChannelLabel,
  smsPermissionDisplayLabel,
  smsPermissionSourceLabel,
} from "@/lib/communication/sms-consent";

describe("first-party SMS consent helpers", () => {
  it("blocks not_opted_in outbound SMS until explicit opt-in", () => {
    assert.equal(SMS_ALLOWS_NOT_OPTED_IN, false);
    assert.equal(isSmsOutboundAllowed("not_opted_in"), false);
    assert.equal(isSmsOutboundAllowed("opted_in"), true);
    assert.equal(isSmsOutboundAllowed("opted_out"), false);
  });

  it("builds venue-named consent language with versioned constant", () => {
    assert.match(SMS_INQUIRY_CONSENT_LANGUAGE_VERSION, /^htc_sms_inquiry_v/);
    const text = buildInquirySmsConsentText("Sweet Daisy Barn");
    assert.match(text, /Sweet Daisy Barn/);
    assert.match(text, /I’d like to receive text messages/);
    assert.match(text, /Reply STOP to opt out/);
    assert.doesNotMatch(text, /Are you okay being texted/);
  });

  it("gates SMS preference and permission when texting is not configured", () => {
    const raw = parseInquiryCommunicationSettings({
      askPreferences: true,
      offerEmail: true,
      offerSms: true,
      offerPhoneCall: true,
      requestSmsPermission: true,
    });
    const off = effectivePublicCommunicationSettings(raw, false);
    assert.equal(off.offerSms, false);
    assert.equal(off.showSmsPermission, false);
    assert.deepEqual(off.offeredChannels, ["email", "phone_call"]);

    const on = effectivePublicCommunicationSettings(raw, true);
    assert.equal(on.offerSms, true);
    assert.equal(on.showSmsPermission, true);
    assert.ok(on.offeredChannels.includes("sms"));
  });

  it("defaults the SMS permission request on unless a venue turned it off", () => {
    assert.equal(parseInquiryCommunicationSettings({}).requestSmsPermission, true);
    assert.equal(
      parseInquiryCommunicationSettings({ requestSmsPermission: false }).requestSmsPermission,
      false,
    );
  });

  it("uses human labels for prefs and permission evidence", () => {
    assert.equal(preferredChannelLabel("sms"), "Text message");
    assert.equal(smsPermissionDisplayLabel("opted_in"), "Allowed");
    assert.equal(smsPermissionDisplayLabel("opted_out"), "Opted out");
    assert.match(smsPermissionSourceLabel("inquiry_form"), /website inquiry/i);
    assert.match(smsPermissionSourceLabel("tour_form"), /tour booking/i);
    assert.match(smsPermissionSourceLabel("twilio_stop"), /opted out via text/i);
  });
});
