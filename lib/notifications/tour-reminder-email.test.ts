/**
 * Couple-facing tour reminder branding — shared venue shell + logo.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { emailBrandFromVenue } from "@/lib/email/venue-brand";
import { buildTourReminderCoupleEmail } from "@/lib/notifications/tour-reminder-email";

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

describe("tour reminder engine seam", () => {
  it("couple tour reminders use buildTourReminderCoupleEmail; coordinator stays internal", () => {
    const src = readFileSync(resolve("lib/notifications/engine.ts"), "utf8");
    assert.match(src, /buildTourReminderCoupleEmail/);
    assert.match(src, /coupleHtmlAlreadyBranded/);
    // Old ad-hoc couple HTML must not remain for the couple branch.
    const coupleBranch = src.slice(
      src.indexOf("if (role === \"couple\") {\n            // Customer-facing"),
      src.indexOf("} else {\n            const subj = `Tour reminder:"),
    );
    assert.match(coupleBranch, /buildTourReminderCoupleEmail/);
    assert.doesNotMatch(coupleBranch, /<p>\$\{body\}<\/p><p>— \$\{venueName\}<\/p>/);
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
});
