/**
 * Group A — public intake thank-you + venue detail rendering (D1/D2/D3).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { HTC_EMAIL_CTA_BACKGROUND } from "@/lib/email/htc-cta";
import { buildVenueNotificationEmail } from "@/lib/notifications/venue-notification-email";
import {
  buildPublicIntakeThankYouEmail,
  buildPublicIntakeVenueDetailBody,
  formatPublicIntakeEventTypeLine,
} from "@/lib/lead-intake/public-intake-emails";

const ORIGIN = "https://app.sandbox.hellotocheers.com";

function visible(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("formatPublicIntakeEventTypeLine (D3)", () => {
  it("renders canonical Wedding for wedding", () => {
    assert.equal(formatPublicIntakeEventTypeLine("wedding"), "Event type: Wedding");
  });

  it("renders other supported labels without changing unknown raw text meaning", () => {
    assert.equal(formatPublicIntakeEventTypeLine("corporate"), "Event type: Corporate Event");
    assert.equal(formatPublicIntakeEventTypeLine("social_event"), "Event type: Social Event");
    assert.equal(formatPublicIntakeEventTypeLine("birthday"), "Event type: Birthday Party");
    assert.equal(formatPublicIntakeEventTypeLine("Elopement"), "Event type: Elopement");
  });

  it("omits empty / null event types", () => {
    assert.equal(formatPublicIntakeEventTypeLine(null), null);
    assert.equal(formatPublicIntakeEventTypeLine(""), null);
    assert.equal(formatPublicIntakeEventTypeLine("   "), null);
  });
});

describe("buildPublicIntakeThankYouEmail (D1)", () => {
  it("inquiry thank-you has branded HTML + matching plain text", () => {
    const out = buildPublicIntakeThankYouEmail({
      kind: "inquiry",
      venueName: "Jen's Fancy Venue",
      firstName: "Alice",
      brandSource: {
        name: "Jen's Fancy Venue",
        logoUrl: "https://cdn.example.test/fancy.png",
        primaryColor: "#8B4513",
      },
    });
    assert.equal(out.subject, "We received your inquiry — Jen's Fancy Venue");
    assert.match(out.text, /Thank you, Alice!/);
    assert.match(out.text, /We've received your inquiry for Jen's Fancy Venue/);
    assert.match(out.text, /We'll be in touch soon/);
    assert.match(out.html, /border-top:4px solid #8B4513/);
    assert.match(out.html, /cdn\.example\.test\/fancy\.png/);
    assert.match(out.html, /Thank you, Alice!/);
    assert.match(out.html, /We've received your inquiry for Jen's Fancy Venue/);
    assert.doesNotMatch(out.html, /internal note|Private to your venue/i);
  });

  it("submission thank-you preserves message wording and escapes special characters", () => {
    const out = buildPublicIntakeThankYouEmail({
      kind: "submission",
      venueName: 'Oak & Ivy <Venue>',
      firstName: 'Bo"b',
    });
    assert.equal(out.subject, "We received your message — Oak & Ivy <Venue>");
    assert.match(out.text, /Thank you, Bo"b!/);
    assert.match(out.text, /We've received your submission for Oak & Ivy <Venue>/);
    assert.match(out.html, /Thank you, Bo&quot;b!/);
    assert.match(out.html, /Oak &amp; Ivy &lt;Venue&gt;/);
    assert.match(out.html, /border-top:4px solid #5D6F5D/);
  });

  it("works without a first name", () => {
    const out = buildPublicIntakeThankYouEmail({
      kind: "inquiry",
      venueName: "Meadowbrook",
      firstName: null,
    });
    assert.match(out.text, /^Thank you!/);
    assert.match(out.html, />Thank you!</);
  });
});

describe("buildPublicIntakeVenueDetailBody + forms venue notify (D2/D3)", () => {
  it("includes available fields, labels Wedding, and omits missing optionals", () => {
    const body = buildPublicIntakeVenueDetailBody({
      intro: "New lead received via a custom public form for Fancy.",
      inquirerName: "Alice Gate",
      inquirerEmail: "alice@example.com",
      phone: "5551001001",
      eventType: "wedding",
      eventDate: "2027-11-11",
      guestCount: 120,
    });
    assert.match(body, /Event type: Wedding/);
    assert.doesNotMatch(body, /Event type: wedding\b/);
    assert.match(body, /Guests: 120/);
    assert.doesNotMatch(body, /Partner:/);
    assert.doesNotMatch(body, /Budget:/);
    assert.doesNotMatch(body, /Message:/);
    assert.doesNotMatch(body, /internal note/i);
  });

  it("includes partner, budget, and message when provided", () => {
    const body = buildPublicIntakeVenueDetailBody({
      intro: "New inquiry received via Fancy's website form.",
      inquirerName: "Alice Gate",
      inquirerEmail: "alice@example.com",
      partnerLine: "Partner: Sam Gate",
      eventType: "corporate",
      estimatedBudget: 25000,
      inquiryMessage: "Looking for a weekend fall date.",
    });
    assert.match(body, /Partner: Sam Gate/);
    assert.match(body, /Event type: Corporate Event/);
    assert.match(body, /Budget: \$25,000/);
    assert.match(body, /Looking for a weekend fall date/);
  });

  it("forms venue email uses lead-specific CTA and branded shell", () => {
    const body = buildPublicIntakeVenueDetailBody({
      intro: "New lead received via a custom public form for Fancy.",
      inquirerName: "Alice Gate",
      inquirerEmail: "alice@example.com",
      eventType: "wedding",
    });
    const email = buildVenueNotificationEmail({
      title: "New public form lead: Alice Gate",
      body,
      link: "/leads/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      appOrigin: ORIGIN,
    });
    assert.equal(email.subject, "New public form lead: Alice Gate");
    assert.equal(email.ctaLabel, "View this lead");
    assert.match(email.html, /hello-to-cheers-logo-primary-transparent/);
    assert.match(email.html, new RegExp(`background:${HTC_EMAIL_CTA_BACKGROUND}`));
    assert.match(email.html, /Event type: Wedding/);
    assert.match(
      email.html,
      new RegExp(`href="${ORIGIN}/leads/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"`),
    );
    assert.doesNotMatch(visible(email.html), /https?:\/\/app\.sandbox/);
    assert.doesNotMatch(email.text, /\/leads$/);
    assert.match(email.text, /\/leads\/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/);
  });
});

describe("public intake routes wire Group A helpers", () => {
  it("inquire uses thank-you HTML, detail helper, and lead CTA", () => {
    const route = readFileSync(resolve("app/api/public/inquire/route.ts"), "utf8");
    assert.match(route, /buildPublicIntakeThankYouEmail/);
    assert.match(route, /buildPublicIntakeVenueDetailBody/);
    assert.match(route, /html:\s*thankYou\.html/);
    assert.match(route, /html:\s*venueEmail\.html/);
    assert.match(route, /\/leads\/\$\{outcome\.leadId\}/);
    assert.doesNotMatch(route, /Event type: \$\{String\(eventType\)\}/);
  });

  it("forms/submit uses branded thank-you + venue notify with lead id CTA", () => {
    const route = readFileSync(resolve("app/api/public/forms/submit/route.ts"), "utf8");
    assert.match(route, /buildPublicIntakeThankYouEmail/);
    assert.match(route, /buildPublicIntakeVenueDetailBody/);
    assert.match(route, /buildVenueNotificationEmail/);
    assert.match(route, /html:\s*thankYou\.html/);
    assert.match(route, /html:\s*venueEmail\.html/);
    assert.match(route, /\/leads\/\$\{outcome\.leadId\}/);
    assert.doesNotMatch(route, /View in Hello to Cheers: \$\{process\.env\.NEXT_PUBLIC_APP_URL/);
    assert.doesNotMatch(route, /\/leads`/);
  });
});
