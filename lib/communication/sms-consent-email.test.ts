import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { buildSmsConsentEmailBodies } from "@/lib/communication/sms-consent-email";
import {
  SMS_EMAIL_CONSENT_LANGUAGE_VERSION,
  SMS_PERMISSION_SOURCE_EMAIL_CONSENT,
  SMS_PERMISSION_SOURCE_EMAIL_CONSENT_REQUEST,
  smsPermissionSourceLabel,
} from "@/lib/communication/sms-consent";
import { isSmsOutboundAllowed } from "@/lib/communication/permissions";

describe("email SMS consent solicitation", () => {
  it("does not grant opted_in by email send — outbound stays blocked until redeem", () => {
    assert.equal(isSmsOutboundAllowed("not_opted_in"), false);
  });

  it("email body requires affirmative link opt-in; opening alone is not consent", () => {
    const bodies = buildSmsConsentEmailBodies({
      venueName: "Jen's Fancy Venue",
      firstName: "Alex",
      consentUrl: "https://example.test/sms-consent/abc",
    });
    assert.match(bodies.subject, /text message permission/i);
    assert.match(bodies.text, /not opted in yet/i);
    assert.match(bodies.text, /https:\/\/example\.test\/sms-consent\/abc/);
    assert.match(bodies.html, /Review text permission/);
    assert.doesNotMatch(bodies.text, /you are now opted in/i);
  });

  it("source constants distinguish request vs completed email opt-in", () => {
    assert.equal(SMS_PERMISSION_SOURCE_EMAIL_CONSENT_REQUEST, "email_sms_consent_request");
    assert.equal(SMS_PERMISSION_SOURCE_EMAIL_CONSENT, "email_sms_consent");
    assert.match(smsPermissionSourceLabel(SMS_PERMISSION_SOURCE_EMAIL_CONSENT_REQUEST), /email/i);
    assert.match(smsPermissionSourceLabel(SMS_PERMISSION_SOURCE_EMAIL_CONSENT), /email opt-in/i);
  });

  it("manual-lead CTA requests text permission via email — not unsolicited SMS", () => {
    const button = readFileSync(
      resolve("components/leads/request-sms-consent-button.tsx"),
      "utf8",
    );
    assert.match(button, /Request text permission/);
    assert.match(button, /requestSmsConsentEmailAction/);
    assert.doesNotMatch(button, /requestSmsConsentAction/);
    assert.match(button, /unsolicited text/i);
    assert.match(button, /Opening the email is not consent/i);
  });

  it("token migration + public redeem route exist", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20261406000000_sms_consent_email_tokens.sql"),
      "utf8",
    );
    assert.match(sql, /sms_consent_email_tokens/);
    assert.match(sql, /token_hash/);
    const redeem = readFileSync(resolve("app/api/sms-consent/redeem/route.ts"), "utf8");
    assert.match(redeem, /redeemSmsConsentEmailToken/);
    const service = readFileSync(resolve("lib/communication/sms-consent-email.ts"), "utf8");
    assert.match(service, /status:\s*"not_opted_in"/);
    assert.match(service, /SMS_PERMISSION_SOURCE_EMAIL_CONSENT_REQUEST/);
    assert.match(service, /status:\s*"opted_in"/);
    assert.match(service, /SMS_PERMISSION_SOURCE_EMAIL_CONSENT/);
    assert.equal(SMS_EMAIL_CONSENT_LANGUAGE_VERSION, "htc_sms_email_consent_v1");
  });

  it("venue Lead UX uses locked Text messaging copy and request≠consent", () => {
    const summary = readFileSync(
      resolve("components/leads/relationship-communication-summary.tsx"),
      "utf8",
    );
    assert.match(summary, /Text messaging/);
    assert.match(summary, /hasn(?:&apos;|')t opted in to receive text messages from your venue/);
    assert.match(summary, /requires the person(?:&apos;|')s permission before you can send them text/);
    assert.match(summary, /This person gave permission to receive text messages/);
    assert.doesNotMatch(summary, /status:\s*"opted_in"/);
  });

  it("customer consent page requires affirmative Yes + Allow", () => {
    const page = readFileSync(resolve("app/sms-consent/[token]/page.tsx"), "utf8");
    const form = readFileSync(resolve("app/sms-consent/[token]/opt-in-form.tsx"), "utf8");
    assert.match(page, /Would you like to receive text messages from/);
    assert.match(form, /Yes, I(?:&apos;|')d like to receive text messages/);
    assert.match(form, /Allow text messages/);
    assert.match(form, /Opening this page is not consent/);
    assert.match(form, /optedIn:\s*checked/);
  });

  it("portal Account surfaces the same canonical SMS permission", () => {
    const actions = readFileSync(
      resolve("app/(portal)/p/[token]/account-actions.ts"),
      "utf8",
    );
    assert.match(actions, /getPortalSmsPermissionAction/);
    assert.match(actions, /communication_permissions/);
    assert.match(actions, /smsPermissionDisplayLabel/);
    const shell = readFileSync(resolve("components/portal/portal-shell.tsx"), "utf8");
    assert.match(shell, /getPortalSmsPermissionAction/);
    assert.match(shell, /Text messaging/);
  });
});
