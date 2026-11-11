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

  it("does not put the HTC logo on couple reminders (venue-branded shell + venue logo)", () => {
    const { html, subject, text } = buildReminderEmail({
      ...base,
      role: "couple",
      portalToken: "tok_portal",
      brand: {
        name: "Jen's Fancy Venue",
        logoUrl: "https://cdn.example.test/venues/fancy-logo.png",
        primaryColor: "#334455",
        emailSignature: "Warmly,\nThe Fancy team",
        replyContact: "hello@fancy.test",
      },
    });
    assert.doesNotMatch(html, /hello-to-cheers-logo-primary-transparent/);
    assert.doesNotMatch(html, /alt="Hello to Cheers"/);
    assert.match(html, /Jen's Fancy Venue|Jen&#39;s Fancy Venue/);
    assert.match(html, /cdn\.example\.test\/venues\/fancy-logo\.png/);
    assert.match(html, /border-top:4px solid #334455/);
    assert.match(html, /View your planning workspace/);
    assert.match(html, /Warmly,/);
    assert.match(html, /hello@fancy\.test/);
    assert.match(subject, /Send contract/);
    assert.match(text, /Send contract/);
    assert.doesNotMatch(html, /<img [^>]*src=""/);
  });

  it("omits venue logo image when couple reminder venue has no logo_url", () => {
    const { html } = buildReminderEmail({
      ...base,
      role: "couple",
      portalToken: "tok_portal",
      brand: {
        name: "No Logo Venue",
        logoUrl: null,
        primaryColor: "#5D6F5D",
      },
    });
    assert.match(html, /No Logo Venue/);
    assert.doesNotMatch(html, /<img /);
    assert.doesNotMatch(html, /hello-to-cheers-logo/);
  });
});
