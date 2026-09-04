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

  const engine = readFileSync(resolve("lib/notifications/engine.ts"), "utf8");
  it("couple-facing task/tour reminders record into conversation history", () => {
    assert.match(engine, /recordExternalClientOutbound/);
    assert.match(engine, /role === "couple"/);
  });

  it("inbound email and SMS routes write through conversation inbound modules", () => {
    assert.match(inboundEmail, /conversation_messages/);
    assert.match(inboundEmailRoute, /inbound/);
    assert.match(inboundSmsRoute, /conversation_messages|inbound/);
  });
});

describe("messages primary navigation", () => {
  it("labels /messaging as Messages in primary nav", () => {
    const nav = readFileSync(resolve("lib/navigation.ts"), "utf8");
    assert.match(nav, /title: "Messages"/);
    assert.match(nav, /href: "\/messaging"/);
  });
});
