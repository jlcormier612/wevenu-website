/**
 * Hello to Cheers Text channel — product locks.
 * Venue-facing language is "Text". Twilio stays an implementation detail.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { translateSmsFailure } from "@/lib/communication/failure-messages";
import {
  isSmsOutboundAllowed,
  permissionFromTwilioOptOut,
  SMS_ALLOWS_NOT_OPTED_IN,
} from "@/lib/communication/permissions";
import { acceptOutboundSms } from "@/lib/conversations/delivery-result";
import { MESSAGE_STATUS_META } from "@/lib/communication/status-labels";
import { shouldAdvanceStatus } from "@/lib/communication/status";
import { verifyTwilioSignature } from "@/lib/sms/verify";
import { toE164 } from "@/lib/sms/phone";
import { validateMessageTemplateInput } from "@/lib/message-templates/validation";

function src(rel: string): string {
  return readFileSync(resolve(rel), "utf8");
}

describe("outbound Text consent and opt-out", () => {
  it("requires explicit opt-in; phone/preference/terms are not consent", () => {
    assert.equal(SMS_ALLOWS_NOT_OPTED_IN, false);
    assert.equal(isSmsOutboundAllowed("opted_in"), true);
    assert.equal(isSmsOutboundAllowed("not_opted_in"), false);
    assert.equal(isSmsOutboundAllowed("opted_out"), false);
    assert.equal(isSmsOutboundAllowed("provider_blocked"), false);
    const apply = src("lib/communication/apply-inquiry-consent.ts");
    assert.match(apply, /shouldRecordInquirySmsConsent/);
    assert.match(apply, /smsPermissionGranted === true/);
    const consentFn = apply.slice(
      apply.indexOf("export function shouldRecordInquirySmsConsent"),
      apply.indexOf("export async function applyInquiryCommunicationCapture"),
    );
    assert.doesNotMatch(consentFn, /preferred/);
  });

  it("blocks with the venue-facing permission copy", () => {
    const permissions = src("lib/communication/permissions.ts");
    assert.match(permissions, /This contact has opted out of text messages\./);
    assert.match(
      permissions,
      /Texting isn’t available for this contact because they haven’t given permission to receive texts\./,
    );
  });

  it("does not treat ordinary inbound replies as consent", () => {
    assert.equal(permissionFromTwilioOptOut(null, "Thanks for the tour!"), null);
    assert.equal(permissionFromTwilioOptOut(null, "yes"), null);
    assert.equal(permissionFromTwilioOptOut("HELP", "HELP"), null);
    assert.deepEqual(permissionFromTwilioOptOut("STOP", "STOP"), {
      status: "opted_out",
      source: "twilio_stop",
    });
    assert.deepEqual(permissionFromTwilioOptOut("START", "START"), {
      status: "opted_in",
      source: "twilio_start",
    });
    assert.deepEqual(permissionFromTwilioOptOut(null, "unstop"), {
      status: "opted_in",
      source: "sms_keyword_start",
    });
  });

  it("rejects invalid numbers before send", () => {
    assert.equal(toE164("not-a-phone"), null);
    assert.equal(toE164(""), null);
    const send = src("lib/sms/send.ts");
    assert.match(send, /No phone number on file to text/);
    const service = src("lib/conversations/service.ts");
    assert.match(service, /no phone number on file/);
    assert.match(service, /assertChannelAllowed/);
    assert.match(service, /isTextingConversationKind/);
    assert.match(service, /TEXTING_KIND_BLOCKED_MESSAGE/);
  });
});

describe("inbound Text routing and identity", () => {
  const inbound = src("app/api/messaging/sms-inbound/route.ts");

  it("verifies Twilio signatures and is idempotent on MessageSid", () => {
    assert.match(inbound, /verifyTwilioSignature/);
    assert.match(inbound, /eq\("provider_id", messageSid\)/);
    assert.match(inbound, /deduped: true/);
    assert.equal(verifyTwilioSignature("https://example.com/hook", { Body: "hi" }, "not-valid", "token"), false);
    assert.equal(verifyTwilioSignature("https://example.com/hook", { Body: "hi" }, null, "token"), false);
  });

  it("routes by AccountSid then venue-scoped phone match — never email", () => {
    assert.match(inbound, /resolveVenueTwilioForWebhookAccountSid/);
    assert.match(inbound, /find_relationship_by_phone_for_venue/);
    assert.match(inbound, /findOrCreateVenueCoupleConversation/);
    assert.doesNotMatch(inbound, /findLeadByEmail|recipientEmail/);
  });

  it("does not silently merge when the phone is ambiguous", () => {
    const sql = src("supabase/migrations/20261400000000_find_relationship_by_phone_unique_only.sql");
    const fn = sql.slice(sql.indexOf("create or replace function public.find_relationship_by_phone_for_venue"));
    assert.match(fn, /array_agg\(distinct x\.relationship_id\)/);
    assert.match(fn, /cardinality\(v_rels\) is distinct from 1/);
    assert.doesNotMatch(fn, /min\(/);
    assert.match(inbound, /inbound_sms_unmatched/);
    assert.match(inbound, /count_relationships_by_phone_for_venue/);
    assert.match(inbound, /persistInboundSmsUnmatched/);
  });

  it("records STOP immediately and does not treat HELP as consent", () => {
    assert.match(inbound, /permissionFromTwilioOptOut/);
    assert.match(inbound, /opted_out/);
    assert.equal(permissionFromTwilioOptOut("HELP", "HELP"), null);
  });
});

describe("delivery status", () => {
  it("maps Twilio lifecycle to sending / sent / delivered / failed for the venue", () => {
    assert.equal(MESSAGE_STATUS_META.sending.label, "Sending");
    assert.equal(MESSAGE_STATUS_META.accepted.label, "Sent");
    assert.equal(MESSAGE_STATUS_META.delivered.label, "Delivered");
    assert.equal(MESSAGE_STATUS_META.failed.label, "Couldn't deliver");
    const statusRoute = src("app/api/messaging/sms-status/route.ts");
    assert.match(statusRoute, /queued:\s+"sending"/);
    assert.match(statusRoute, /sent:\s+"accepted"/);
    assert.match(statusRoute, /delivered:\s+"delivered"/);
    assert.match(statusRoute, /failed:\s+"failed"/);
    assert.equal(shouldAdvanceStatus("sending", "accepted"), true);
    assert.equal(shouldAdvanceStatus("accepted", "delivered"), true);
    assert.equal(shouldAdvanceStatus("accepted", "failed"), true);
    assert.equal(shouldAdvanceStatus("failed", "delivered"), false);
  });

  it("translates provider failures without exposing Twilio details", () => {
    assert.equal(
      translateSmsFailure("21610 Attempt to send to unsubscribed recipient"),
      "This contact has opted out of text messages.",
    );
    assert.equal(
      translateSmsFailure("Your message couldn’t be sent. Please try again."),
      "Your message couldn’t be sent. Please try again.",
    );
    const accepted = acceptOutboundSms({
      ok: false,
      message: "20429 Too many requests. AccountSid ACxxxxxxxx",
    });
    assert.equal(accepted.ok, false);
    if (!accepted.ok) {
      assert.doesNotMatch(accepted.message, /Twilio|AccountSid|20429/i);
    }
  });
});

describe("templates and automations cannot bypass consent", () => {
  it("composer only offers templates that have a Text body", () => {
    const compose = src("components/conversations/conversation-compose.tsx");
    assert.match(compose, /channel === "sms" \? !!t\.smsBody/);
    const errors = validateMessageTemplateInput({
      name: "Tour reminder",
      category: "tour",
      emailSubject: "",
      emailBody: "",
      smsBody: "Hi {{client_name}}, reminder about your tour at {{venue_name}}.",
    });
    assert.equal(errors.smsBody, undefined);
    assert.equal(errors.emailBody, undefined);
  });

  it("scheduled / automation SMS goes through sendSms + assertChannelAllowed", () => {
    const processor = src("lib/scheduled-messages/processor.ts");
    assert.match(processor, /assertChannelAllowed/);
    assert.match(processor, /sendSms\(/);
    assert.match(processor, /rawAddress: e164/);
    assert.match(processor, /conversation_messages/);
    const scheduled = src("lib/scheduled-messages/service.ts");
    assert.match(scheduled, /isTextingConversationKind/);
    assert.match(scheduled, /TEXTING_KIND_BLOCKED_MESSAGE/);
  });
});

describe("Inbox treats Text as an existing conversation channel", () => {
  it("labels the channel Text, not a separate SMS inbox", () => {
    const channels = src("lib/conversations/channels.ts");
    assert.match(channels, /sms: "Text"/);
    const thread = src("components/conversations/conversation-thread.tsx");
    assert.match(thread, /label: "Text"/);
    assert.doesNotMatch(thread, /SMS inbox/i);
    const compose = src("components/conversations/conversation-compose.tsx");
    assert.doesNotMatch(compose, /Twilio|Messaging Service|Campaign SID/i);
  });

  it("inbound SMS uses the same conversation notification trigger as other inbound", () => {
    const notify = src("supabase/migrations/20260913000000_conversation_message_notifications.sql");
    assert.match(notify, /notify_conversation_message/);
    assert.match(notify, /lead_or_client/);
    assert.match(notify, /message_received/);
  });
});
