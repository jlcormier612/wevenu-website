import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  SMS_ALLOWS_NOT_OPTED_IN,
  isSmsOutboundAllowed,
} from "@/lib/communication/permissions";
import {
  SMS_INQUIRY_CONSENT_LANGUAGE_VERSION,
  SMS_PUBLIC_CONSENT_DISCLOSURES,
  SMS_CONSENT_REQUEST_LANGUAGE_VERSION,
  buildInquirySmsConsentText,
  buildSmsConsentRequestText,
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
    const marketing = readFileSync(resolve("marketing/lib/sms-public-consent-copy.ts"), "utf8");
    for (const line of SMS_PUBLIC_CONSENT_DISCLOSURES) {
      assert.ok(marketing.includes(line), line);
    }
    assert.ok(SMS_PUBLIC_CONSENT_DISCLOSURES.some((line) => /START/.test(line)));
    assert.ok(SMS_PUBLIC_CONSENT_DISCLOSURES.some((line) => /not required to inquire/i.test(line)));
    assert.ok(SMS_PUBLIC_CONSENT_DISCLOSURES.some((line) => /preferred contact method is not SMS consent/i.test(line)));
  });

  it("shows Text and the optional SMS permission when the venue left them on", () => {
    const raw = parseInquiryCommunicationSettings({
      askPreferences: true,
      offerEmail: true,
      offerSms: true,
      offerPhoneCall: true,
      requestSmsPermission: true,
    });
    const on = effectivePublicCommunicationSettings(raw);
    assert.equal(on.offerSms, true);
    assert.equal(on.showSmsPermission, true);
    assert.deepEqual(on.offeredChannels, ["email", "sms", "phone_call"]);
    assert.equal(on.showPreferences, true);
  });

  it("hides Text and the permission checkbox only when the venue turned them off", () => {
    const off = effectivePublicCommunicationSettings(parseInquiryCommunicationSettings({
      askPreferences: true,
      offerEmail: true,
      offerSms: false,
      offerPhoneCall: true,
      requestSmsPermission: false,
    }));
    assert.equal(off.offerSms, false);
    assert.equal(off.showSmsPermission, false);
    assert.deepEqual(off.offeredChannels, ["email", "phone_call"]);
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
    assert.match(smsPermissionSourceLabel("sms_consent_request"), /waiting for them to reply START/i);
    assert.match(smsPermissionSourceLabel("twilio_stop"), /opted out via text/i);
  });

  it("builds consent-request solicitation that requires START and does not grant opt-in by wording alone", () => {
    assert.match(SMS_CONSENT_REQUEST_LANGUAGE_VERSION, /^htc_sms_consent_request_v/);
    const text = buildSmsConsentRequestText("Jen's Fancy Venue");
    assert.match(text, /Jen's Fancy Venue/);
    assert.match(text, /Reply START to agree/);
    assert.match(text, /Reply STOP to opt out/);
    assert.doesNotMatch(text, /you are now opted in/i);
  });
});
