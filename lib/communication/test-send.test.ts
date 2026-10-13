import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

import {
  SMS_TEST_NOT_CONFIGURED_MESSAGE,
  formatTestEmailSuccessMessage,
  isEmailTestActionAvailable,
  isSmsTestActionAvailable,
} from "@/lib/communication/test-send";
import {
  buildChannelTestReadinessItems,
  readinessItemCountsTowardAllReady,
} from "@/lib/communication/readiness-channel-tests";

describe("test-send availability and messaging", () => {
  it("email test requires platform email config and a venue email", () => {
    assert.equal(
      isEmailTestActionAvailable({ emailConfigured: true, venueEmail: "a@b.com" }),
      true,
    );
    assert.equal(
      isEmailTestActionAvailable({ emailConfigured: false, venueEmail: "a@b.com" }),
      false,
    );
    assert.equal(
      isEmailTestActionAvailable({ emailConfigured: true, venueEmail: null }),
      false,
    );
  });

  it("SMS test requires venue texting config and a phone — not phone alone", () => {
    assert.equal(
      isSmsTestActionAvailable({ smsConfigured: false, venuePhone: "603-555-0100" }),
      false,
    );
    assert.equal(
      isSmsTestActionAvailable({ smsConfigured: true, venuePhone: null }),
      false,
    );
    assert.equal(
      isSmsTestActionAvailable({ smsConfigured: true, venuePhone: "603-555-0100" }),
      true,
    );
  });

  it("success copy distinguishes provider acceptance from Delivered and surfaces sandbox redirect", () => {
    const real = formatTestEmailSuccessMessage({
      venueEmail: "venue@example.com",
      sandboxRedirected: false,
      sandboxInbox: null,
    });
    assert.match(real, /accepted by the email provider/i);
    assert.match(real, /not the same as Delivered/i);
    assert.doesNotMatch(real, /delivered successfully/i);

    const sandboxed = formatTestEmailSuccessMessage({
      venueEmail: "venue@example.com",
      sandboxRedirected: true,
      sandboxInbox: "qa@hellotocheers-test.invalid",
    });
    assert.match(sandboxed, /Sandbox test inbox/i);
    assert.match(sandboxed, /qa@hellotocheers-test\.invalid/);
  });

  it("readiness SMS path short-circuits before sendSms when unconfigured", () => {
    const src = readFileSync("lib/communication/readiness.ts", "utf8");
    assert.match(src, /SMS_TEST_NOT_CONFIGURED_MESSAGE/);
    assert.match(src, /isSmsConfigured\(venue\.id\)/);
    // Guard must appear before sendSms call in sendTestSms.
    const fnStart = src.indexOf("export async function sendTestSms");
    const sendSmsCall = src.indexOf("sendSms(", fnStart);
    const guard = src.indexOf("if (!smsConfigured)", fnStart);
    assert.ok(fnStart >= 0 && guard >= 0 && sendSmsCall >= 0);
    assert.ok(guard < sendSmsCall, "unconfigured guard must run before sendSms");
    assert.equal(SMS_TEST_NOT_CONFIGURED_MESSAGE.includes("Settings → Communications"), true);
  });

  it("checklist disables SMS test when texting is not configured", () => {
    const src = readFileSync("components/communication/readiness-checklist.tsx", "utf8");
    assert.match(src, /isSmsTestActionAvailable/);
    assert.match(src, /will not call the texting provider/i);
    assert.match(src, /MESSAGE_STATUS_DEFINITIONS/);
    assert.match(src, /md:grid-cols-2/);
  });
});

describe("sendTestEmail honesty vs provider accept", () => {
  it("requires a provider id before marking the venue test timestamp", () => {
    const src = readFileSync("lib/communication/readiness.ts", "utf8");
    const emailFn = src.slice(src.indexOf("export async function sendTestEmail"));
    assert.match(emailFn, /acceptOutboundEmail/);
    assert.match(emailFn, /providerId/);
    assert.match(emailFn, /did not return a send id/);
    assert.match(emailFn, /communication_test_email_at/);
  });
});

describe("channel-specific readiness test results", () => {
  it("email-only success never shows SMS test as ready when texting is unconfigured", () => {
    const items = buildChannelTestReadinessItems({
      emailTested: true,
      smsTested: false,
      smsConfigured: false,
    });
    const email = items.find((i) => i.key === "test_email")!;
    const sms = items.find((i) => i.key === "test_sms")!;
    assert.equal(email.state, "ready");
    assert.match(email.label, /Test email successful/);
    assert.match(email.detail, /email provider/i);
    assert.equal(sms.state, "untested");
    assert.match(sms.detail, /Not applicable/i);
    assert.doesNotMatch(sms.detail, /accepted by the texting provider/i);
    assert.equal(readinessItemCountsTowardAllReady(sms, false), false);
  });

  it("SMS success is independent and only ready when configured and tested", () => {
    const untested = buildChannelTestReadinessItems({
      emailTested: false,
      smsTested: false,
      smsConfigured: true,
    });
    assert.equal(untested.find((i) => i.key === "test_sms")!.state, "untested");

    const ready = buildChannelTestReadinessItems({
      emailTested: false,
      smsTested: true,
      smsConfigured: true,
    });
    const sms = ready.find((i) => i.key === "test_sms")!;
    assert.equal(sms.state, "ready");
    assert.match(sms.detail, /texting provider/i);
    assert.equal(readinessItemCountsTowardAllReady(sms, true), true);
  });

  it("getCommunicationReadiness no longer ORs email and SMS into one test_message item", () => {
    const src = readFileSync("lib/communication/readiness.ts", "utf8");
    assert.doesNotMatch(src, /key:\s*"test_message"/);
    assert.match(src, /buildChannelTestReadinessItems/);
    assert.doesNotMatch(
      src,
      /communication_test_email_at\s*\|\|\s*.*communication_test_sms_at/,
    );
  });
});
