import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { isSmsOutboundAllowed } from "@/lib/communication/permissions";
import {
  SMS_PERMISSION_SOURCE_CONSENT_REQUEST,
  buildSmsConsentRequestText,
} from "@/lib/communication/sms-consent";
import { requestSmsConsentForLead } from "@/lib/communication/request-sms-consent";

describe("venue request SMS consent (manual Lead path)", () => {
  it("keeps ordinary outbound blocked while consent is not opted_in", () => {
    assert.equal(isSmsOutboundAllowed("not_opted_in"), false);
  });

  it("does not offer unsolicited SMS as the consent-acquisition CTA", () => {
    const button = readFileSync(
      resolve("components/leads/request-sms-consent-button.tsx"),
      "utf8",
    );
    assert.doesNotMatch(button, /requestSmsConsentAction/);
    assert.match(button, /Request permission by email/);
    assert.match(button, /unsolicited text/i);
    assert.match(button, /START/);
  });

  it("service fails closed — refuses to send unsolicited SMS for consent", async () => {
    const result = await requestSmsConsentForLead("any-lead");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /does not send an unsolicited text/i);
    }
    const service = readFileSync(
      resolve("lib/communication/request-sms-consent.ts"),
      "utf8",
    );
    assert.doesNotMatch(service, /sendSms\(/);
    assert.doesNotMatch(service, /skipPermissionCheck:\s*true/);
    assert.doesNotMatch(service, /status:\s*"opted_in"/);
  });

  it("consent request source constant matches pending label", () => {
    assert.equal(SMS_PERMISSION_SOURCE_CONSENT_REQUEST, "sms_consent_request");
    assert.match(buildSmsConsentRequestText("Sweet Daisy"), /START/);
  });
});
