/**
 * Group B — deterministic render verification (no sends).
 * Tour protection (D4) + saved-report schedule (D6).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

import { buildSavedReportReadyEmail } from "../../../lib/saved-reports/schedule-engine.ts";
import { buildTourProtectionAlertEmail } from "../../../lib/tours/booked-side-effects.ts";

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");

const OUT = "docs/qa/email-consistency-audit";
const ORIGIN = "https://app.sandbox.hellotocheers.com";
const LEAD_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

mkdirSync(OUT, { recursive: true });

const protection = buildTourProtectionAlertEmail({
  venueName: "Jen's Fancy Venue",
  contactName: "Nicole Bethune",
  contactEmail: "nicole@example.com",
  slotStart: "2026-10-15T20:00:00.000Z",
  leadId: LEAD_ID,
  appOrigin: ORIGIN,
});

const savedReport = buildSavedReportReadyEmail({
  reportName: "Weekly sales",
  reportLabel: "Sales",
  rangeLabel: "Last 7 days",
  reportPath: "/reporting/sales",
  datePreset: "last_7_days",
  appOrigin: ORIGIN,
});

const artifacts = {
  protectionHtml: `${OUT}/group-b-tour-protection.html`,
  protectionTxt: `${OUT}/group-b-tour-protection.txt`,
  savedHtml: `${OUT}/group-b-saved-report.html`,
  savedTxt: `${OUT}/group-b-saved-report.txt`,
};

writeFileSync(artifacts.protectionHtml, protection.html);
writeFileSync(artifacts.protectionTxt, protection.text);
writeFileSync(artifacts.savedHtml, savedReport.html);
writeFileSync(artifacts.savedTxt, savedReport.text);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

async function shot(htmlPath: string, pngPath: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`file://${process.cwd()}/${htmlPath}`);
  await page.screenshot({ path: pngPath, fullPage: true });
}

await shot(artifacts.protectionHtml, `${OUT}/group-b-tour-protection-1280.png`, 1280);
await shot(artifacts.protectionHtml, `${OUT}/group-b-tour-protection-390.png`, 390);
await shot(artifacts.savedHtml, `${OUT}/group-b-saved-report-1280.png`, 1280);
await shot(artifacts.savedHtml, `${OUT}/group-b-saved-report-390.png`, 390);

await browser.close();

const checks = {
  protectionHasLogo: /hello-to-cheers-logo-primary-transparent/.test(protection.html),
  protectionHasViewTours: /View tours/.test(protection.html) && /\/tours"/.test(protection.html),
  protectionHasViewLead:
    /View this lead/.test(protection.html) &&
    new RegExp(`/leads/${LEAD_ID}"`).test(protection.html),
  protectionTextParity:
    /Requested time:/.test(protection.text) &&
    /Contact: Nicole Bethune/.test(protection.text) &&
    /View tours\n/.test(protection.text) &&
    new RegExp(`View this lead\\n${ORIGIN}/leads/${LEAD_ID}`).test(protection.text),
  protectionNoRawUrlAsSoleBody: !/^https?:\/\//m.test(protection.text.split("\n")[0] ?? ""),
  savedHasLogo: /hello-to-cheers-logo-primary-transparent/.test(savedReport.html),
  savedHasCta: /Open in Hello to Cheers/.test(savedReport.html),
  savedHref: savedReport.href === `${ORIGIN}/reporting/sales?range=last_7_days`,
};

const results = {
  at: new Date().toISOString(),
  subjectProtection: protection.subject,
  subjectSaved: savedReport.subject,
  artifacts,
  checks,
  allPass: Object.values(checks).every(Boolean),
};

writeFileSync(`${OUT}/group-b-render-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (!results.allPass) process.exit(1);
