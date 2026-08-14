import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "docs/qa/automation-p0-browser-evidence");
const require = createRequire(path.resolve(ROOT, "marketing/package.json"));
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const result = { errors: [] };
page.on("pageerror", (e) => result.errors.push(e.message));

async function bodyText() {
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

// Session already exists from prior run via storage? Re-login anyway
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(500);
if (page.url().includes("/login")) {
  await page.locator('input[type="email"], input[name="email"]').first().fill("owner@example.com");
  await page.locator('input[type="password"]').first().fill("devpassword123");
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2500);
}

// 1) Enrollment progress with Next
await page.goto(`${BASE}/communication/series/fd5d172e-a457-4231-8238-849f4a91dc6c/edit`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(2500);
let text = await bodyText();
const progressMatches = [...text.matchAll(/Step \d+ of \d+(?: · Next [^·]{3,40})?/g)].map((m) => m[0]);
result.progress = {
  matches: progressMatches,
  hasNext: progressMatches.some((m) => /Next /.test(m)),
  hasP0Prog: /P0Prog/i.test(text),
  editNote: /new enrollments only/i.test(text),
};
await page.screenshot({ path: path.join(OUT, "06-progress-next.png") });

// 2) SEQ-01 starter edit
await page.goto(`${BASE}/communication/series/ba5e6d50-5ca1-4ce1-9432-9527f4ede6ca/edit`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(2000);
text = await bodyText();
result.starterEdit = {
  titleHasWelcome: /New Inquiry Welcome/i.test(text),
  triggerLeadCreated: /new inquiry comes in/i.test(text),
  editNote: /new enrollments only/i.test(text),
  forbidden: {
    sequenceEnrollment: /sequence enrollment/i.test(text),
    materialized: /materialized/i.test(text),
    cron: /\bcron\b/i.test(text),
    scheduler: /\bscheduler\b/i.test(text),
  },
};
await page.screenshot({ path: path.join(OUT, "07-seq01-edit.png") });

// 3) Activity on P0Lost lead
await page.goto(`${BASE}/leads/394af794-00a3-4cb4-bd2f-19fb3079b9c2`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(2500);
const activityTab = page.getByRole("tab", { name: /activity/i }).or(page.getByText(/^Activity$/)).first();
if (await activityTab.count()) {
  await activityTab.click();
  await page.waitForTimeout(2000);
}
text = await bodyText();
result.activity = {
  url: page.url(),
  hasEnrolled: /Enrolled in automation/i.test(text),
  hasStoppedLost: /Automation stopped \(lost\)|Automation stopped — lost|stopped \(lost\)/i.test(text),
  automationLines: [...text.matchAll(/Automation[^\n]{0,80}|Enrolled in automation[^\n]{0,80}/gi)].map((m) => m[0]).slice(0, 10),
  sample: text.slice(0, 1200),
};
await page.screenshot({ path: path.join(OUT, "08-activity-p0lost.png") });

// 4) Also check conversation for Priya (booked exit) activity if link works
await page.goto(`${BASE}/leads`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1500);
const priya = page.getByText(/Priya Natarajan/i).first();
if (await priya.count()) {
  await priya.click();
  await page.waitForTimeout(2000);
  const tab2 = page.getByRole("tab", { name: /activity/i }).or(page.getByText(/^Activity$/)).first();
  if (await tab2.count()) await tab2.click();
  await page.waitForTimeout(1500);
  text = await bodyText();
  result.priyaActivity = {
    url: page.url(),
    hasAutomation: /Automation|Enrolled in automation/i.test(text),
    sample: text.slice(0, 800),
  };
  await page.screenshot({ path: path.join(OUT, "09-activity-priya.png") });
}

await writeFile(path.join(OUT, "results-followup.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
