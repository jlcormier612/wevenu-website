import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const APP = "http://localhost:3040";
const OUT = `${process.env.HOME}/Desktop/HTC-Phase-B-Corrected-Acceptance`;
const creds = JSON.parse(readFileSync("/tmp/htc-byb-corrected-creds.json", "utf8"));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
page.setDefaultTimeout(25000);
await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
await page.locator("#email").fill(creds.email);
await page.locator("#password").fill(creds.password);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL((url: URL) => !url.pathname.includes("/login"), { timeout: 20000, waitUntil: "commit" });
if (page.url().includes("/welcome")) {
  const box = page.locator("#welcome-experience-agree");
  if (await box.count()) await box.check({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
}
await page.goto(`${APP}/calendar?year=2027&month=9`, { waitUntil: "domcontentloaded" });
await page.getByText(/September|Bella|Wedding/i).first().waitFor({ timeout: 20000 }).catch(() => {});
writeFileSync(`${OUT}/27-calendar-2027-09.png`, await page.screenshot({ fullPage: true }));
const sept = await page.locator("main").innerText();
await page.goto(`${APP}/calendar?year=2028&month=4`, { waitUntil: "domcontentloaded" });
await page.getByText(/April|Bella|Wedding/i).first().waitFor({ timeout: 20000 }).catch(() => {});
writeFileSync(`${OUT}/28-calendar-2028-04.png`, await page.screenshot({ fullPage: true }));
const april = await page.locator("main").innerText();
await page.goto(`${APP}/setup-hub/bring-your-business?stage=review&entry=files`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "Review and finish" }).waitFor();
writeFileSync(`${OUT}/29-review-after-progress-fix.png`, await page.screenshot({ fullPage: true }));
const review = await page.locator("main").innerText();
writeFileSync(`${OUT}/calendar-followup.json`, JSON.stringify({
  septHasBella: /Bella/i.test(sept),
  aprilHasBella: /Bella/i.test(april),
  reviewHasClientsBroughtOver: /Clients and their events — brought over/.test(review),
  septSlice: sept.slice(0, 800),
  aprilSlice: april.slice(0, 800),
  reviewSlice: review.slice(0, 800),
}, null, 2));
console.log(JSON.stringify({
  septHasBella: /Bella/i.test(sept),
  aprilHasBella: /Bella/i.test(april),
  reviewHasClientsBroughtOver: /Clients and their events — brought over/.test(review),
}, null, 2));
await browser.close();
