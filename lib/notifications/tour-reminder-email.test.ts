/**
 * Tour reminder branding — couple venue shell + coordinator HTC staff shell.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { HTC_EMAIL_CTA_BACKGROUND } from "@/lib/email/htc-cta";
import { emailBrandFromVenue } from "@/lib/email/venue-brand";
import { buildReminderEmail } from "@/lib/notifications/templates";
import {
  buildTourReminderCoordinatorEmail,
  buildTourReminderCoupleEmail,
} from "@/lib/notifications/tour-reminder-email";

const ORIGIN = "https://app.sandbox.hellotocheers.com";
const LEAD_ID = "11111111-1111-1111-1111-111111111111";

describe("buildTourReminderCoupleEmail", () => {
  it("uses the branded shell with venue logo when logo_url exists", () => {
    const brand = emailBrandFromVenue({
      name: "Jen's Fancy Venue",
      logo_url: "https://cdn.example.test/venues/fancy-logo.png",
      primary_color: "#8B4513",
      email_signature: "Warmly,\nJen's Fancy Venue",
      email: "hello@fancy.test",
      phone: "555-0100",
    });
    const out = buildTourReminderCoupleEmail({
      brand,
      dateLabel: "Wednesday, October 7, 2026",
      timeLabel: "10:45 AM",
    });

    assert.equal(
      out.subject,
      "Your tour at Jen's Fancy Venue is tomorrow — Wednesday, October 7, 2026 at 10:45 AM",
    );
    assert.match(out.text, /Just a reminder that your tour at Jen's Fancy Venue is tomorrow at 10:45 AM/);
    assert.match(out.text, /Warmly,/);
    assert.match(out.text, /hello@fancy\.test/);

    assert.match(out.html, /cdn\.example\.test\/venues\/fancy-logo\.png/);
    assert.match(out.html, /alt="Jen&#39;s Fancy Venue"|alt="Jen's Fancy Venue"/);
    assert.match(out.html, /Jen&#39;s Fancy Venue|Jen's Fancy Venue/);
    assert.match(out.html, /border-top:4px solid #8B4513/);
    assert.match(out.html, /look forward to meeting you/);
    assert.match(out.html, /Warmly,/);
    assert.match(out.html, /hello@fancy\.test/);
    assert.doesNotMatch(out.html, /hello-to-cheers-logo/);
    assert.doesNotMatch(out.html, /alt="Hello to Cheers"/);
  });

  it("omits logo image when venue has no logo and never falls back to HTC mark", () => {
    const brand = emailBrandFromVenue({
      name: "No Logo Venue",
      logo_url: null,
      primary_color: "#5D6F5D",
    });
    const out = buildTourReminderCoupleEmail({
      brand,
      dateLabel: "Thursday, October 8, 2026",
      timeLabel: "2:00 PM",
    });

    assert.match(out.html, /No Logo Venue/);
    assert.match(out.html, /border-top:4px solid #5D6F5D/);
    assert.doesNotMatch(out.html, /<img /);
    assert.doesNotMatch(out.html, /hello-to-cheers-logo/);
    assert.doesNotMatch(out.html, /alt="Hello to Cheers"/);
    assert.equal(
      out.subject,
      "Your tour at No Logo Venue is tomorrow — Thursday, October 8, 2026 at 2:00 PM",
    );
  });

  it("escapes logo URL and venue name through the shared branding mechanism", () => {
    const brand = emailBrandFromVenue({
      name: `Test "Venue" & Co`,
      logo_url: `https://cdn.example.test/x.png" onerror="alert(1)`,
      primary_color: "#112233",
    });
    const out = buildTourReminderCoupleEmail({
      brand,
      dateLabel: "Friday, October 9, 2026",
      timeLabel: "9:00 AM",
    });
    assert.match(out.html, /Test &quot;Venue&quot; &amp; Co/);
    assert.match(out.html, /onerror=&quot;alert\(1\)/);
    assert.doesNotMatch(out.html, /onerror="alert/);
  });

  it("does not duplicate the body signature line that the old ad-hoc HTML used", () => {
    const brand = emailBrandFromVenue({ name: "Willow Estate", primary_color: "#5D6F5D" });
    const out = buildTourReminderCoupleEmail({
      brand,
      dateLabel: "Monday, October 12, 2026",
      timeLabel: "11:00 AM",
    });
    // Venue name appears in branded header; body is reminder copy only.
    assert.doesNotMatch(out.html, /<p>— Willow Estate<\/p>/);
    assert.match(out.html, /Just a reminder that your tour at Willow Estate is tomorrow at 11:00 AM/);
  });
});

describe("buildTourReminderCoordinatorEmail", () => {
  it("preserves the screenshot subject and uses the HTC staff shell + Sage CTA", () => {
    const out = buildTourReminderCoordinatorEmail({
      contactName: "Lorelai Gilmore",
      dateLabel: "Friday, October 16, 2026",
      timeLabel: "1:30 PM",
      durationMinutes: 60,
      venueName: "Meadowbrook Valley Venue",
      leadId: LEAD_ID,
      appOrigin: ORIGIN,
    });
    assert.equal(
      out.subject,
      "Tour reminder: Lorelai Gilmore — Friday, October 16, 2026 at 1:30 PM",
    );
    assert.match(out.html, /hello-to-cheers-logo-primary-transparent/);
    assert.match(out.html, /alt="Hello to Cheers"/);
    assert.match(out.html, new RegExp(`background:${HTC_EMAIL_CTA_BACKGROUND}`));
    assert.doesNotMatch(out.html, /background:#1a1a1a/);
    // Date after em dash must not become a weekday CTA name.
    assert.match(out.html, /View this lead/);
    assert.doesNotMatch(out.html, /View Friday/);
    assert.match(out.html, new RegExp(`href="${ORIGIN}/leads/${LEAD_ID}"`));
    assert.match(out.html, /You have a venue tour tomorrow at 1:30 PM with Lorelai Gilmore/);
    assert.match(out.html, /Duration: 60 minutes/);
    assert.match(out.html, /Meadowbrook Valley Venue/);
  });

  it("plain text keeps essential reminder details and the lead destination", () => {
    const out = buildTourReminderCoordinatorEmail({
      contactName: "Lorelai Gilmore",
      dateLabel: "Friday, October 16, 2026",
      timeLabel: "1:30 PM",
      durationMinutes: 60,
      venueName: "Meadowbrook Valley Venue",
      leadId: LEAD_ID,
      appOrigin: ORIGIN,
    });
    assert.match(out.text, /Tour reminder: Lorelai Gilmore/);
    assert.match(out.text, /1:30 PM/);
    assert.match(out.text, /Duration: 60 minutes/);
    assert.match(out.text, /Meadowbrook Valley Venue/);
    assert.match(out.text, /View this lead/);
    assert.match(out.text, new RegExp(`${ORIGIN}/leads/${LEAD_ID}`));
  });

  it("falls back to /tours when the appointment has no lead", () => {
    const out = buildTourReminderCoordinatorEmail({
      contactName: null,
      dateLabel: "Saturday, October 17, 2026",
      timeLabel: "10:00 AM",
      durationMinutes: 45,
      venueName: "Meadowbrook Valley Venue",
      leadId: null,
      appOrigin: ORIGIN,
    });
    assert.equal(
      out.subject,
      "Tour reminder: Upcoming tour — Saturday, October 17, 2026 at 10:00 AM",
    );
    assert.match(out.html, /View tours/);
    assert.match(out.html, new RegExp(`href="${ORIGIN}/tours"`));
    assert.match(out.text, /View tours/);
    assert.match(out.text, new RegExp(`${ORIGIN}/tours`));
  });
});

describe("tour reminder engine seam", () => {
  it("couple uses buildTourReminderCoupleEmail; coordinator uses buildTourReminderCoordinatorEmail", () => {
    const src = readFileSync(resolve("lib/notifications/engine.ts"), "utf8");
    assert.match(src, /buildTourReminderCoupleEmail/);
    assert.match(src, /buildTourReminderCoordinatorEmail/);
    assert.match(src, /coupleHtmlAlreadyBranded/);
    const coupleBranch = src.slice(
      src.indexOf("if (role === \"couple\") {\n            // Customer-facing"),
      src.indexOf("} else {\n            // Staff: shared HTC venue-notification"),
    );
    assert.match(coupleBranch, /buildTourReminderCoupleEmail/);
    assert.doesNotMatch(coupleBranch, /buildTourReminderCoordinatorEmail/);
    assert.doesNotMatch(src, /<p>\$\{escapeHtml\(body\)\}<\/p><p>— \$\{escapeHtml\(venueName\)\}<\/p>/);
  });

  it("does not change task_reminders insert/schedule semantics in engine", () => {
    const src = readFileSync(resolve("lib/notifications/engine.ts"), "utf8");
    assert.match(src, /status=.pending/);
    assert.match(src, /scheduled_for/);
    // Branding helper must not schedule or insert reminders.
    const helper = readFileSync(resolve("lib/notifications/tour-reminder-email.ts"), "utf8");
    assert.doesNotMatch(helper, /task_reminders/);
    assert.doesNotMatch(helper, /\.insert\(/);
    assert.doesNotMatch(helper, /fetch\(/);
  });

  it("coordinator task reminders still use buildReminderEmail unchanged", () => {
    const src = readFileSync(resolve("lib/notifications/engine.ts"), "utf8");
    assert.match(src, /buildReminderEmail\(/);
    const out = buildReminderEmail({
      taskTitle: "Send welcome packet",
      eventName: "Sam & Alex — Wedding",
      eventDate: "2027-06-12",
      dueDate: "2026-10-20",
      role: "coordinator",
      reminderType: "upcoming",
      venueBaseUrl: ORIGIN,
      venueName: "Meadowbrook Valley Venue",
    });
    assert.match(out.subject, /Send welcome packet/);
    assert.match(out.html, /hello-to-cheers-logo-primary-transparent/);
    assert.match(out.html, /View in Hello to Cheers/);
    assert.match(out.html, new RegExp(`href="${ORIGIN}/events"`));
  });
});
