import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { isSmsOutboundAllowed } from "@/lib/communication/permissions";
import {
  SMS_PERMISSION_SOURCE_CONSENT_REQUEST,
  buildSmsConsentRequestText,
} from "@/lib/communication/sms-consent";

describe("venue request SMS consent (manual Lead path)", () => {
  it("keeps ordinary outbound blocked while consent request is pending", () => {
    assert.equal(isSmsOutboundAllowed("not_opted_in"), false);
  });

  it("wires Lead UI + send purpose without skipPermissionCheck for consent request", () => {
    const summary = readFileSync(
      resolve("components/leads/relationship-communication-summary.tsx"),
      "utf8",
    );
    const button = readFileSync(
      resolve("components/leads/request-sms-consent-button.tsx"),
      "utf8",
    );
    const service = readFileSync(
      resolve("lib/communication/request-sms-consent.ts"),
      "utf8",
    );
    const send = readFileSync(resolve("lib/sms/send.ts"), "utf8");
    const permissions = readFileSync(
      resolve("lib/communication/permissions.ts"),
      "utf8",
    );

    assert.match(summary, /RequestSmsConsentButton/);
    assert.match(summary, /SMS_PERMISSION_SOURCE_CONSENT_REQUEST/);
    assert.match(button, /requestSmsConsentAction/);
    assert.match(button, /Request text permission/);
    assert.match(service, /purpose:\s*"sms_consent_request"/);
    assert.match(service, /status:\s*"not_opted_in"/);
    assert.match(service, /SMS_PERMISSION_SOURCE_CONSENT_REQUEST/);
    assert.doesNotMatch(service, /skipPermissionCheck:\s*true/);
    assert.doesNotMatch(service, /status:\s*"opted_in"/);
    assert.match(send, /purpose\?:/);
    assert.match(permissions, /purpose\?: "outbound" \| "sms_consent_request"/);
    assert.match(permissions, /sms_consent_request/);
  });

  it("consent request source constant matches pending label", () => {
    assert.equal(SMS_PERMISSION_SOURCE_CONSENT_REQUEST, "sms_consent_request");
    assert.match(buildSmsConsentRequestText("Acme"), /Reply START/);
  });
});
