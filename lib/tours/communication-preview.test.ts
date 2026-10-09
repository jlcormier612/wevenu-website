import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  previewTourConfirmation,
  previewTourConfirmationRequest,
  previewTourScheduled,
} from "@/lib/tours/communication";

const params = {
  venueId: "venue",
  leadId: "lead",
  relationshipId: "rel",
  contactEmail: "alex@example.com",
  contactName: "Alex Rivera",
  venueName: "Jen's Fancy",
  primaryColor: "#FF1493",
  scheduledAt: "2027-06-14T18:00:00.000Z",
  durationMinutes: 60,
  timezone: "America/New_York",
};

describe("tour send previews use the real email builders", () => {
  it("scheduled preview uses scheduled language + Confirm CTA, never confirmed", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";
    const preview = previewTourScheduled({ ...params, confirmToken: "tok_sched" });
    assert.equal(preview.who, "alex@example.com");
    assert.equal(preview.channel, "Email");
    assert.match(preview.subject, /Your tour is scheduled/);
    assert.match(preview.subject, /Jen's Fancy/);
    assert.doesNotMatch(preview.subject, /Tour confirmed/);
    assert.match(preview.body, /Hi Alex,/);
    assert.match(preview.body, /You're scheduled for a 60-minute tour at Jen's Fancy/);
    assert.doesNotMatch(preview.body, /You're confirmed/);
    assert.doesNotMatch(preview.body, /is confirmed/);
    assert.match(preview.body, /https:\/\/app\.sandbox\.hellotocheers\.com\/confirm\/tok_sched/);
    assert.match(preview.html, /#FF1493/);
    assert.match(preview.html, /Confirm my tour/);
    assert.doesNotMatch(preview.html, /Add to Calendar/);
    assert.match(preview.htcAfterward, /stays Scheduled/);
  });

  it("reschedule preview is also scheduled-language (not confirmed)", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";
    const preview = previewTourScheduled({ ...params, confirmToken: "tok_re" }, "reschedule");
    assert.match(preview.subject, /Your tour is scheduled/);
    assert.doesNotMatch(preview.subject, /Tour confirmed/);
    assert.match(preview.body, /You're scheduled/);
    assert.match(preview.why, /new scheduled tour time/);
    assert.match(preview.htcAfterward, /tour time changes/);
  });

  it("post-confirmation preview is confirmed language + Add to Calendar", () => {
    const preview = previewTourConfirmation(params);
    assert.match(preview.subject, /Tour confirmed/);
    assert.match(preview.body, /Your 60-minute tour at Jen's Fancy is confirmed/);
    assert.doesNotMatch(preview.body, /You're scheduled/);
    assert.match(preview.body, /Add to Google Calendar:/);
    assert.match(preview.html, /Add to Calendar/);
    assert.doesNotMatch(preview.html, /Confirm my tour/);
    assert.match(preview.htcAfterward, /Confirmed/);
  });

  it("confirmation request preview includes the secure confirm link", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";
    const preview = previewTourConfirmationRequest({
      ...params,
      confirmToken: "tok_abc",
    });
    assert.equal(preview.who, "alex@example.com");
    assert.match(preview.subject, /Please confirm your tour/);
    assert.doesNotMatch(preview.subject, /Tour confirmed/);
    assert.doesNotMatch(preview.body, /You're confirmed/);
    assert.doesNotMatch(preview.body, /is confirmed\./);
    assert.match(preview.body, /https:\/\/app\.sandbox\.hellotocheers\.com\/confirm\/tok_abc/);
    assert.match(preview.html, /#FF1493/);
    assert.match(preview.html, /Confirm my tour/);
    assert.match(preview.why, /confirm the upcoming tour/);
    assert.match(preview.recipientAction, /secure link/);
    assert.match(preview.htcAfterward, /becomes Confirmed/);
  });

  it("send and preview share one content builder each", () => {
    const src = readFileSync(resolve("lib/tours/communication.ts"), "utf8");
    assert.match(src, /function buildScheduledContent/);
    assert.match(src, /function buildConfirmationContent/);
    assert.match(src, /function buildConfirmationRequestContent/);
    assert.match(src, /previewTourScheduled[\s\S]*buildScheduledContent\(params\)/);
    assert.match(src, /sendTourScheduled[\s\S]*buildScheduledContent\(params\)/);
    assert.match(src, /previewTourConfirmation[\s\S]*buildConfirmationContent\(params\)/);
    assert.match(src, /sendTourConfirmation[\s\S]*buildConfirmationContent\(params\)/);
    assert.match(src, /previewTourConfirmationRequest[\s\S]*buildConfirmationRequestContent\(params\)/);
    assert.match(src, /sendTourConfirmationRequest[\s\S]*buildConfirmationRequestContent\(params\)/);
    assert.match(src, /primaryColor/);
  });

  it("wiring: schedule paths send scheduled; confirm paths send confirmed", () => {
    const service = readFileSync(resolve("lib/tours/service.ts"), "utf8");
    const protection = readFileSync(resolve("lib/tours/protection.ts"), "utf8");
    assert.match(service, /sendTourScheduled/);
    assert.match(protection, /sendTourScheduled/);
    // Public book / coordinator schedule / reschedule must not call sendTourConfirmation
    // for the schedule side-effect — only confirmTourByToken / updateTourStatus may.
    const scheduleFn = service.slice(service.indexOf("export async function scheduleTourForLead"));
    const scheduleBody = scheduleFn.slice(0, scheduleFn.indexOf("export async function rescheduleTour"));
    assert.match(scheduleBody, /sendScheduledEmailForAppointment|sendTourScheduled/);
    assert.doesNotMatch(scheduleBody, /sendTourConfirmation\(/);

    const rescheduleFn = service.slice(service.indexOf("export async function rescheduleTour"));
    const rescheduleBody = rescheduleFn.slice(0, rescheduleFn.indexOf("const STATUS_TO_SIGNAL"));
    assert.match(rescheduleBody, /sendScheduledEmailForAppointment|sendTourScheduled/);
    assert.doesNotMatch(rescheduleBody, /sendTourConfirmation\(/);

    const updateFn = service.slice(service.indexOf("export async function updateTourStatus"));
    assert.match(updateFn, /becameConfirmed[\s\S]*sendTourConfirmation/);
    // Confirmation email requires a booked slot — do not pass nullable scheduled_at.
    const confirmEmailBlock = updateFn.slice(
      updateFn.indexOf("// Confirmation email needs a booked slot"),
      updateFn.indexOf("if (status === \"cancelled\" || status === \"no_show\")"),
    );
    assert.match(confirmEmailBlock, /const scheduledAt = appt\.scheduled_at/);
    assert.match(confirmEmailBlock, /if \(scheduledAt\)[\s\S]*sendTourConfirmation/);
    assert.doesNotMatch(confirmEmailBlock, /scheduledAt:\s*appt\.scheduled_at/);

    const confirmFn = service.slice(service.indexOf("export async function confirmTourByToken"));
    assert.match(confirmFn, /alreadyConfirmed[\s\S]*sendTourConfirmation|!alreadyConfirmed[\s\S]*sendTourConfirmation/);
  });

  it("confirmation preview greets with first name only for a full contact name", () => {
    const preview = previewTourConfirmation({
      ...params,
      contactName: "Betty Rubble",
    });
    assert.match(preview.body, /^Hi Betty,/m);
    assert.doesNotMatch(preview.body, /Hi Betty Rubble,/);
  });

  it("confirmation body does not duplicate the venue name as a Warmly owner line", () => {
    const preview = previewTourConfirmation({
      ...params,
      contactName: "Betty Rubble",
      venueName: "Jen's Fancy Venue",
    });
    assert.doesNotMatch(preview.body, /Warmly,\nJen's Fancy Venue\nJen's Fancy Venue/);
    assert.doesNotMatch(preview.body, /Warmly,/);
  });

  it("a missing email does not claim the confirmation was sent", () => {
    const src = readFileSync(resolve("lib/tours/communication.ts"), "utf8");
    assert.match(src, /no confirmation email was sent/);
    assert.match(src, /if \(status !== "accepted"\)/);
  });

  it("tour emails pass threadId so replies hit HTC inbound", () => {
    const src = readFileSync(resolve("lib/tours/communication.ts"), "utf8");
    assert.match(src, /threadId: conversationId/);
    assert.match(src, /findOrCreateVenueCoupleConversation/);
    const deliver = src.slice(src.indexOf("async function deliverTourSystemEmail"));
    assert.ok(
      deliver.indexOf("findOrCreateConversation") < deliver.indexOf("sendEmail({"),
      "conversation must be resolved before sendEmail in deliverTourSystemEmail",
    );
  });
});
