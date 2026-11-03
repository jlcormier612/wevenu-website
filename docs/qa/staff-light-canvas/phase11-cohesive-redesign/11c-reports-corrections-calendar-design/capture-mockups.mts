/**
 * Capture DESIGN PROPOSAL ONLY Calendar HTML mockups (not live app styling).
 */
import { createRequire } from "node:module";
import { mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ORIG = "/Users/jensmac/Developer/wevenu-website";
const require = createRequire(`${ORIG}/marketing/package.json`);
const { chromium } = require("playwright");

const MOCK = join(ORIG, "docs/qa/staff-light-canvas/phase11-cohesive-redesign/11c-reports-corrections-calendar-design/mockups");
const EVID = join(ORIG, "docs/qa/staff-light-canvas/phase11-cohesive-redesign/11c-reports-corrections-calendar-design/evidence/calendar-proposal");
const DESKTOP = "/Users/jensmac/Desktop/htc-phase11c-calendar-design-proposal";
mkdirSync(EVID, { recursive: true });
mkdirSync(DESKTOP, { recursive: true });

const shots = [
  { file: "calendar-desktop-proposal.html", out: "calendar-desktop-proposal.png", w: 1440, h: 900 },
  { file: "calendar-mobile-390-proposal.html", out: "calendar-mobile-390-proposal.png", w: 390, h: 844 },
  { file: "calendar-mobile-375-proposal.html", out: "calendar-mobile-375-proposal.png", w: 375, h: 812 },
];

const browser = await chromium.launch();
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h } });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(join(MOCK, s.file)).href, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const path = join(EVID, s.out);
  await page.screenshot({ path, fullPage: false });
  copyFileSync(path, join(DESKTOP, s.out));
  await ctx.close();
}
await browser.close();
console.log("Proposal shots →", EVID, "and", DESKTOP);
