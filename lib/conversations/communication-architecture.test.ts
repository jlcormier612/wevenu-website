import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

/**
 * Static architecture locks for the communication system of record.
 * Proves intended wiring from source — not live delivery.
 */
describe("communication architecture locks", () => {
  const conversationService = readFileSync(resolve("lib/conversations/service.ts"), "utf8");
  const scheduledProcessor = readFileSync(resolve("lib/scheduled-messages/processor.ts"), "utf8");
  const obligationEngine = readFileSync(resolve("lib/notifications/obligation-engine.ts"), "utf8");
  const inboundEmail = readFileSync(resolve("lib/conversations/inbound-email.ts"), "utf8");
  const inboundEmailRoute = readFileSync(resolve("app/api/messaging/inbound/route.ts"), "utf8");
  const inboundSmsRoute = readFileSync(resolve("app/api/messaging/sms-inbound/route.ts"), "utf8");

  it("manual email/SMS send before record into conversation_messages", () => {
    assert.match(conversationService, /channel === "sms"/);
    assert.match(conversationService, /channel === "email"/);
    assert.match(conversationService, /sendSms\(/);
    assert.match(conversationService, /sendEmail\(/);
    assert.match(conversationService, /repo\.sendConversationMessage/);
    // Send path appears before the repository record call for external channels.
    const smsAt = conversationService.indexOf('channel === "sms"');
    const emailAt = conversationService.indexOf('channel === "email"');
    const recordAt = conversationService.indexOf("repo.sendConversationMessage");
    assert.ok(smsAt > 0 && emailAt > 0 && recordAt > emailAt);
  });

  it("outbound SMS/email enforce communication permissions server-side", () => {
    assert.match(conversationService, /assertChannelAllowed/);
    assert.match(scheduledProcessor, /assertChannelAllowed/);
    assert.match(inboundSmsRoute, /permissionFromTwilioOptOut|OptOutType/);
    assert.match(inboundSmsRoute, /opted_out/);
    assert.match(inboundSmsRoute, /exitActiveEnrollmentsForRelationship/);
    const smsStatus = readFileSync(resolve("app/api/messaging/sms-status/route.ts"), "utf8");
    assert.match(smsStatus, /upsertCommunicationPermission/);
    const emailWebhook = readFileSync(resolve("app/api/messaging/webhook/route.ts"), "utf8");
    assert.match(emailWebhook, /email\.bounced|email\.complained|email\.unsubscribed/);
    assert.match(emailWebhook, /upsertCommunicationPermission/);
    const sendSmsSrc = readFileSync(resolve("lib/sms/send.ts"), "utf8");
    assert.match(sendSmsSrc, /assertChannelAllowed/);
    assert.match(sendSmsSrc, /skipPermissionCheck/);
    assert.match(sendSmsSrc, /venueId/);
  });

  it("portal messages are record-only and do not call sendEmail/sendSms in sendConversationMessage", () => {
    assert.match(conversationService, /channel === "portal"/);
    assert.match(conversationService, /notifyCoupleOfVenuePortalMessage/);
  });

  it("scheduled messages record into conversation_messages when sent", () => {
    assert.match(scheduledProcessor, /conversation_messages/);
    assert.match(scheduledProcessor, /\.insert\(/);
  });

  it("obligation (payment/contract) reminders log to notification_log and record conversation_messages", () => {
    assert.match(obligationEngine, /notification_log/);
    assert.match(obligationEngine, /recordExternalClientOutbound/);
  });

  it("invoice email send records into conversation history when Resend delivers", () => {
    const invoiceActions = readFileSync(resolve("app/(app)/invoices/actions.ts"), "utf8");
    assert.match(invoiceActions, /recordExternalClientOutbound/);
    assert.match(invoiceActions, /sourceType: "invoice_email"/);
    assert.match(invoiceActions, /method === "resend"/);
  });

  const engine = readFileSync(resolve("lib/notifications/engine.ts"), "utf8");
  it("couple-facing task/tour reminders record into conversation history", () => {
    assert.match(engine, /recordExternalClientOutbound/);
    assert.match(engine, /role === "couple"/);
  });

  it("inbound SMS persists MessageSid and supports MMS media ingest", () => {
    assert.match(inboundSmsRoute, /MessageSid/);
    assert.match(inboundSmsRoute, /provider_id/);
    assert.match(inboundSmsRoute, /parseInboundTwilioMedia|NumMedia|persistTwilioMedia/);
    assert.match(inboundSmsRoute, /registerMessageAttachmentAsDocument/);
  });

  it("inbound SMS routes by AccountSid → venue and attaches venue_couple only", () => {
    assert.match(inboundSmsRoute, /AccountSid/);
    assert.match(inboundSmsRoute, /resolveVenueTwilioForWebhookAccountSid/);
    assert.match(inboundSmsRoute, /find_relationship_by_phone_for_venue/);
    assert.match(inboundSmsRoute, /findOrCreateVenueCoupleConversation/);
    assert.doesNotMatch(inboundSmsRoute, /find_relationship_by_phone[^_]/);
    const smsStatus = readFileSync(resolve("app/api/messaging/sms-status/route.ts"), "utf8");
    assert.match(smsStatus, /AccountSid/);
    assert.match(smsStatus, /resolveVenueTwilioForWebhookAccountSid/);
    assert.match(scheduledProcessor, /findOrCreateVenueCoupleConversation/);
  });

  it("outbound SMS resolves venue Twilio and does not use global Messaging Service SID", () => {
    const sendSms = readFileSync(resolve("lib/sms/send.ts"), "utf8");
    assert.match(sendSms, /resolveVenueTwilioForSend/);
    assert.match(sendSms, /twilioRestBasicAuth/);
    assert.doesNotMatch(sendSms, /process\.env\.TWILIO_MESSAGING_SERVICE_SID/);
    assert.doesNotMatch(sendSms, /process\.env\.TWILIO_ACCOUNT_SID/);
  });

  it("outbound SMS/email send paths accept media or attachments", () => {
    assert.match(conversationService, /mediaUrls/);
    assert.match(conversationService, /attachments:/);
    const sendSms = readFileSync(resolve("lib/sms/send.ts"), "utf8");
    assert.match(sendSms, /MediaUrl/);
    const sendEmail = readFileSync(resolve("lib/email/send.ts"), "utf8");
    assert.match(sendEmail, /attachments/);
  });
});

describe("inbox primary navigation", () => {
  it("labels /messaging as Inbox in primary nav", () => {
    const nav = readFileSync(resolve("lib/navigation.ts"), "utf8");
    assert.match(nav, /title: "Inbox"/);
    assert.match(nav, /href: "\/messaging"/);
  });
});
