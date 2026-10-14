/**
 * Group A — deterministic render verification (no sends).
 * Writes HTML/text fixtures + Playwright screenshots of rendered HTML.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

import { buildVenueNotificationEmail } from "../../../lib/notifications/venue-notification-email.ts";
import {
  buildPublicIntakeThankYouEmail,
  buildPublicIntakeVenueDetailBody,
} from "../../../lib/lead-intake/public-intake-emails.ts";

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");

const OUT = "docs/qa/email-consistency-audit";
const ORIGIN = "https://app.sandbox.hellotocheers.com";
const LEAD_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

mkdirSync(OUT, { recursive: true });

const thankYouInquiry = buildPublicIntakeThankYouEmail({
  kind: "inquiry",
  venueName: "Jen's Fancy Venue",
  firstName: "Alice",
  brandSource: {
    name: "Jen's Fancy Venue",
    logoUrl: "https://sandbox.hellotocheers.com/brand/hello-to-cheers-logo-primary-transparent.png",
    primaryColor: "#5D6F5D",
  },
});
const thankYouForm = buildPublicIntakeThankYouEmail({
  kind: "submission",
  venueName: "Jen's Fancy Venue",
  firstName: "Blake",
  brandSource: {
    name: "Jen's Fancy Venue",
    primaryColor: "#8B4513",
  },
});

const inquireBody = buildPublicIntakeVenueDetailBody({
  intro: "New inquiry received via Jen's Fancy Venue's website form.",
  inquirerName: "Alice Gate",
  inquirerEmail: "alice@example.com",
  phone: "5551001001",
  partnerLine: "Partner: Sam Gate",
  eventType: "wedding",
  eventDate: "2027-11-11",
  guestCount: 120,
  estimatedBudget: 25000,
  inquiryMessage: "Looking for a fall weekend.",
});
const inquireVenue = buildVenueNotificationEmail({
  title: "New inquiry from Alice Gate",
  body: inquireBody,
  link: `/leads/${LEAD_ID}`,
  appOrigin: ORIGIN,
});

const formBody = buildPublicIntakeVenueDetailBody({
  intro: "New lead received via a custom public form for Jen's Fancy Venue.",
  inquirerName: "Blake Reed",
  inquirerEmail: "blake@example.com",
  phone: "5552002002",
  eventType: "wedding",
  eventDate: "2028-06-01",
  guestCount: 80,
});
const formVenue = buildVenueNotificationEmail({
  title: "New public form lead: Blake Reed",
  body: formBody,
  link: `/leads/${LEAD_ID}`,
  appOrigin: ORIGIN,
});

const artifacts = {
  at: new Date().toISOString(),
  noSends: true,
  checks: [] as { name: string; pass: boolean; detail: string }[],
};

function check(name: string, pass: boolean, detail: string) {
  artifacts.checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

check(
  "D1 inquiry thank-you HTML branded",
  /border-top:4px solid/.test(thankYouInquiry.html) && /Thank you, Alice!/.test(thankYouInquiry.html),
  thankYouInquiry.subject,
);
check(
  "D1 form thank-you HTML branded",
  /border-top:4px solid #8B4513/.test(thankYouForm.html) && /submission/.test(thankYouForm.text),
  thankYouForm.subject,
);
check(
  "D3 Wedding label on inquire venue body",
  /Event type: Wedding/.test(inquireVenue.html) && !/Event type: wedding\b/.test(inquireVenue.html),
  "Wedding not wedding",
);
check(
  "D2 form venue lead CTA",
  inquireVenue.href === `${ORIGIN}/leads/${LEAD_ID}`
    && formVenue.href === `${ORIGIN}/leads/${LEAD_ID}`
    && formVenue.ctaLabel === "View this lead",
  `formCta=${formVenue.ctaLabel} href=${formVenue.href}`,
);
check(
  "D2 no generic /leads list link in form venue text",
  /\/leads\/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/.test(formVenue.text)
    && !/\/leads\s*$/m.test(formVenue.text.replace(/\/leads\/[a-f0-9-]+/g, "")),
  "lead-specific only",
);
check(
  "No internal-notes leakage",
  ![thankYouInquiry, thankYouForm, inquireVenue, formVenue].some((e) =>
    /internal note|Private to your venue/i.test(e.html + e.text),
  ),
  "clean",
);

writeFileSync(`${OUT}/group-a-thank-you-inquiry.html`, thankYouInquiry.html);
writeFileSync(`${OUT}/group-a-thank-you-inquiry.txt`, thankYouInquiry.text);
writeFileSync(`${OUT}/group-a-thank-you-form.html`, thankYouForm.html);
writeFileSync(`${OUT}/group-a-thank-you-form.txt`, thankYouForm.text);
writeFileSync(`${OUT}/group-a-venue-inquire.html`, inquireVenue.html);
writeFileSync(`${OUT}/group-a-venue-inquire.txt`, inquireVenue.text);
writeFileSync(`${OUT}/group-a-venue-form.html`, formVenue.html);
writeFileSync(`${OUT}/group-a-venue-form.txt`, formVenue.text);

const browser = await chromium.launch({ headless: true });
for (const [name, html] of [
  ["thank-you-inquiry", thankYouInquiry.html],
  ["thank-you-form", thankYouForm.html],
  ["venue-inquire", inquireVenue.html],
  ["venue-form", formVenue.html],
] as const) {
  for (const [w, h, tag] of [
    [1280, 900, "1280"],
    [390, 844, "390"],
  ] as const) {
    const context = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.screenshot({ path: `${OUT}/group-a-${name}-${tag}.png`, fullPage: true });
    await context.close();
  }
}
await browser.close();

const pass = artifacts.checks.every((c) => c.pass);
writeFileSync(`${OUT}/group-a-render-results.json`, JSON.stringify({ ...artifacts, pass }, null, 2));
console.log(pass ? "GROUP A RENDER PASS" : "GROUP A RENDER FAIL");
process.exit(pass ? 0 : 1);
