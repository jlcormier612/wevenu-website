/**
 * Render inquiry + duplicate notification HTML at 1280 and 390 (no send).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { buildPublicIntakeVenueDetailBody } from "../../lib/lead-intake/public-intake-emails.ts";
import { buildVenueNotificationEmail } from "../../lib/notifications/venue-notification-email.ts";

const OUT = "docs/qa/inquiry-email-formatting";
const ORIGIN = "https://app.sandbox.hellotocheers.com";
const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");

mkdirSync(OUT, { recursive: true });

const inquiryBody = buildPublicIntakeVenueDetailBody({
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

const inquiry = buildVenueNotificationEmail({
  title: "New inquiry from Alice Gate",
  body: inquiryBody,
  link: "/leads/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  appOrigin: ORIGIN,
});

const summary = buildVenueNotificationEmail({
  title: "New inquiry from Alice Gate",
  body: "wedding · May 09, 2027",
  link: "/leads/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  appOrigin: ORIGIN,
});

const duplicate = buildVenueNotificationEmail({
  title: "Possible duplicate inquiry",
  body: [
    "Possible match: Alice Gate",
    "Email: alice@example.com",
    "Status: New Inquiry",
    "Matched by: email",
  ].join("\n"),
  link: "/leads/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  appOrigin: ORIGIN,
});

writeFileSync(`${OUT}/after-inquiry.html`, inquiry.html);
writeFileSync(`${OUT}/after-summary.html`, summary.html);
writeFileSync(`${OUT}/after-duplicate.html`, duplicate.html);
writeFileSync(`${OUT}/after-inquiry.txt`, inquiry.text);
writeFileSync(`${OUT}/after-summary.txt`, summary.text);
writeFileSync(`${OUT}/after-duplicate.txt`, duplicate.text);

const browser = await chromium.launch({ headless: true });
const results: Record<string, unknown> = {
  ok: true,
  checks: [] as { name: string; pass: boolean; detail: string }[],
};

function record(name: string, pass: boolean, detail: string) {
  (results.checks as { name: string; pass: boolean; detail: string }[]).push({
    name,
    pass,
    detail,
  });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

for (const [name, html] of [
  ["inquiry", inquiry.html],
  ["summary", summary.html],
  ["duplicate", duplicate.html],
] as const) {
  for (const width of [1280, 390] as const) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.setContent(html, { waitUntil: "load" });
    const shot = `${OUT}/after-${name}-${width}.png`;
    await page.screenshot({ path: shot, fullPage: true });
    const text = await page.locator("p").first().innerText();
    if (name === "inquiry") {
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      record(
        `inquiry_${width}_field_rows`,
        lines.includes("Name: Alice Gate") &&
          lines.includes("Email: alice@example.com") &&
          lines.includes("Event type: Wedding") &&
          lines.length >= 8,
        `lines=${lines.length}`,
      );
    }
    if (name === "summary") {
      record(
        `summary_${width}_wedding_cap`,
        text.includes("Wedding ·") && !/\bwedding ·/.test(text),
        text.slice(0, 80),
      );
    }
    if (name === "duplicate") {
      record(
        `duplicate_${width}_field_rows`,
        text.includes("Possible match:") &&
          text.includes("\n") &&
          text.includes("Matched by:") &&
          !text.includes(" · "),
        `lines=${text.split("\n").length}`,
      );
    }
    await page.close();
  }
}

await browser.close();
results.ok = (results.checks as { pass: boolean }[]).every((c) => c.pass);
writeFileSync(`${OUT}/render-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ ok: results.ok }, null, 2));
process.exit(results.ok ? 0 : 1);
