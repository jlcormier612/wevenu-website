import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  previewTourConfirmation,
  previewTourConfirmationRequest,
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
  it("confirmation preview is the confirmation email, including venue branding", () => {
    const preview = previewTourConfirmation(params);
    assert.equal(preview.who, "alex@example.com");
    assert.equal(preview.channel, "Email");
    assert.match(preview.subject, /Tour confirmed/);
    assert.match(preview.subject, /Jen's Fancy/);
    assert.match(preview.body, /Hi Alex,/);
    assert.match(preview.body, /60-minute tour at Jen's Fancy/);
    assert.match(preview.body, /Add to Google Calendar:/);
    assert.match(preview.html, /#FF1493/);
    assert.match(preview.html, /Add to Calendar/);
    assert.match(preview.why, /tour time/);
    assert.match(preview.recipientAction, /calendar/);
    assert.match(preview.htcAfterward, /conversation/);
  });

  it("reschedule preview uses the same confirmation email for the new time", () => {
    const preview = previewTourConfirmation(params, "reschedule");
    assert.match(preview.subject, /Tour confirmed/);
    assert.match(preview.body, /Jen's Fancy/);
    assert.match(preview.why, /new tour time/);
    assert.match(preview.htcAfterward, /tour time changes/);
  });

  it("confirmation request preview includes the secure confirm link", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";
    const preview = previewTourConfirmationRequest({
      ...params,
      confirmToken: "tok_abc",
    });
    assert.equal(preview.who, "alex@example.com");
    assert.match(preview.subject, /Please confirm your tour/);
    assert.match(preview.body, /https:\/\/app\.sandbox\.hellotocheers\.com\/confirm\/tok_abc/);
    assert.match(preview.html, /#FF1493/);
    assert.match(preview.html, /Confirm my tour/);
    assert.match(preview.why, /confirm the upcoming tour/);
    assert.match(preview.recipientAction, /secure link/);
    assert.match(preview.htcAfterward, /becomes Confirmed/);
  });

  it("send and preview share one content builder each", () => {
    const src = readFileSync(resolve("lib/tours/communication.ts"), "utf8");
    assert.match(src, /function buildConfirmationContent/);
    assert.match(src, /function buildConfirmationRequestContent/);
    assert.match(src, /previewTourConfirmation[\s\S]*buildConfirmationContent\(params\)/);
    assert.match(src, /sendTourConfirmation[\s\S]*buildConfirmationContent\(params\)/);
    assert.match(src, /previewTourConfirmationRequest[\s\S]*buildConfirmationRequestContent\(params\)/);
    assert.match(src, /sendTourConfirmationRequest[\s\S]*buildConfirmationRequestContent\(params\)/);
    assert.match(src, /primaryColor/);
  });

  it("a missing email does not claim the confirmation was sent", () => {
    const src = readFileSync(resolve("lib/tours/communication.ts"), "utf8");
    assert.match(src, /no confirmation email was sent/);
    assert.match(src, /if \(status !== "accepted"\)/);
  });
});
