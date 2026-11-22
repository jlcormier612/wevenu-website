import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractCalendlyInvitee } from "./parse";

describe("extractCalendlyInvitee", () => {
  it("reads opaque handoff from tracking.utm_content", () => {
    const invitee = extractCalendlyInvitee({
      event: "invitee.created",
      payload: {
        email: "pat@example.com",
        name: "Pat Owner",
        uri: "https://api.calendly.com/scheduled_events/E/invitees/I",
        tracking: {
          utm_source: "htc_website",
          utm_medium: "walkthrough_intake",
          utm_content: "htc_bbbbbbbbbbbbbbbbbbbbbbbb",
        },
        scheduled_event: {
          start_time: "2026-12-20T15:00:00.000Z",
        },
      },
    });
    assert.ok(invitee);
    assert.equal(invitee!.handoffToken, "htc_bbbbbbbbbbbbbbbbbbbbbbbb");
    assert.equal(invitee!.email, "pat@example.com");
    assert.equal(invitee!.scheduledAt, "2026-12-20T15:00:00.000Z");
  });

  it("extracts venue from the approved Venue / business name question", () => {
    const invitee = extractCalendlyInvitee({
      event: "invitee.created",
      payload: {
        email: "pat@example.com",
        questions_and_answers: [
          { question: "Venue / business name", answer: "River Hall", position: 0 },
          {
            question: "Please share anything that will help prepare for our meeting.",
            answer: "Looking forward to it",
            position: 1,
          },
        ],
        scheduled_event: { start_time: "2026-12-21T15:00:00.000Z" },
      },
    });
    assert.equal(invitee?.venueName, "River Hall");
  });

  it("treats blank venue answers as missing (review path)", () => {
    const invitee = extractCalendlyInvitee({
      event: "invitee.created",
      payload: {
        email: "pat@example.com",
        questions_and_answers: [
          { question: "Venue / business name", answer: "   ", position: 0 },
        ],
        scheduled_event: { start_time: "2026-12-21T15:00:00.000Z" },
      },
    });
    assert.equal(invitee?.venueName, undefined);
  });
});
