/**
 * Communications & Automation settings — customer-facing copy + status logic.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { resolveTextingDisplayPhase } from "@/lib/texting-registration/account-sync";
import { buildTextingStatusPanel } from "@/lib/texting-registration/status-panel";
import { classifyPendingReminder } from "@/lib/notifications/stats";
import type { VenueTwilioAccount } from "@/lib/sms/venue-twilio-config";

const notifSection = readFileSync(
  resolve("components/settings/notifications-section.tsx"),
  "utf8",
);
const identitySection = readFileSync(
  resolve("components/settings/communication-identity-section.tsx"),
  "utf8",
);

function account(partial: Partial<VenueTwilioAccount>): VenueTwilioAccount {
  return {
    venueId: "v1",
    twilioAccountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    messagingServiceSid: "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    defaultFromE164: null,
    phoneNumberSid: null,
    secondaryProfileSid: null,
    a2pBrandSid: null,
    a2pCampaignSid: null,
    status: "pending_compliance",
    statusDetail: null,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("texting status reflects real readiness", () => {
  it("keeps under_review when account is pending_compliance and not send-ready", () => {
    const phase = resolveTextingDisplayPhase(
      "information_saved",
      account({ status: "pending_compliance", defaultFromE164: null, phoneNumberSid: null }),
      false,
    );
    assert.equal(phase, "under_review");
    const panel = buildTextingStatusPanel({
      registration: null,
      phase,
      smsReady: false,
      textingNumberE164: null,
    });
    assert.equal(panel.smsReady, false);
    assert.equal(panel.phase, "under_review");
    assert.notEqual(panel.texting.label, "Ready");
  });

  it("reports ready only when smsReady / send-ready account has a number", () => {
    const readyAccount = account({
      status: "ready",
      defaultFromE164: "+15551234567",
      phoneNumberSid: "PNaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    const phase = resolveTextingDisplayPhase("under_review", readyAccount, true);
    assert.equal(phase, "ready");
    const panel = buildTextingStatusPanel({
      registration: null,
      phase,
      smsReady: true,
      textingNumberE164: "+15551234567",
    });
    assert.equal(panel.smsReady, true);
    assert.equal(panel.texting.label, "Ready");
    assert.match(panel.textingNumber.label, /555/);
  });
});

describe("reminder scheduled vs due semantics", () => {
  const now = Date.parse("2026-09-21T18:00:00.000Z");

  it("classifies future pending rows as waiting_future (UI: scheduled)", () => {
    assert.equal(classifyPendingReminder("2026-11-18T08:00:00.000Z", now), "waiting_future");
  });

  it("classifies past/equal pending rows as due_now", () => {
    assert.equal(classifyPendingReminder("2026-09-21T18:00:00.000Z", now), "due_now");
  });

  it("Settings UI labels future count as scheduled, not waiting to send", () => {
    assert.match(notifSection, /label="scheduled"/);
    assert.doesNotMatch(notifSection, /waiting to send/);
    assert.match(
      notifSection,
      /Scheduled reminders are sent automatically at their scheduled time/,
    );
    assert.match(notifSection, /Processes reminders that are due now \(not future ones\)/);
  });
});

describe("SMS message body copy", () => {
  it("uses the approved customer-facing wording", () => {
    assert.match(
      identitySection,
      /The message you write — exactly what the client receives/,
    );
    assert.match(
      identitySection,
      /Keep SMS concise\. Include your venue name when it helps the client know who.s messaging them\./,
    );
    assert.doesNotMatch(identitySection, /no email-style footer/);
  });
});

describe("brand color swatch", () => {
  it("renders a swatch from the configured primaryColor value", () => {
    assert.match(identitySection, /backgroundColor: primaryColor/);
    assert.match(identitySection, /h-4 w-4/);
    assert.match(identitySection, /\{primaryColor\}/);
    assert.doesNotMatch(identitySection, /#FF1493/);
  });
});
