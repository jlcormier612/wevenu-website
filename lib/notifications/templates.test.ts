import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildReminderEmail } from "@/lib/notifications/templates";

describe("task reminder emails — HTC branding only on coordinator shell", () => {
  const base = {
    taskTitle: "Send contract",
    eventName: "The Garden Wedding",
    eventDate: "2026-10-10",
    dueDate: "2026-10-01",
    reminderType: "due_soon",
    venueBaseUrl: "https://app.example.com",
    venueName: "Jen's Fancy Venue",
    venueColor: "#334455",
  };

  it("adds the official HTC logo to coordinator reminders", () => {
    const { html, subject } = buildReminderEmail({ ...base, role: "coordinator" });
    assert.match(html, /alt="Hello to Cheers"/);
    assert.match(html, /hello-to-cheers-logo-primary-transparent\.png/);
    assert.match(html, /View in Hello to Cheers/);
    assert.match(subject, /Send contract/);
  });

  it("does not put the HTC logo on couple reminders (venue-branded)", () => {
    const { html } = buildReminderEmail({
      ...base,
      role: "couple",
      portalToken: "tok_portal",
    });
    assert.doesNotMatch(html, /hello-to-cheers-logo-primary-transparent/);
    assert.doesNotMatch(html, /alt="Hello to Cheers"/);
    assert.match(html, /Jen's Fancy Venue/);
    assert.match(html, /View your planning workspace/);
  });
});
