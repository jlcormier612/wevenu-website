import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const creds = JSON.parse(readFileSync("/tmp/htc-byb-phase-b-creds.json", "utf8"));
const APP = "http://localhost:3040";
const OUT = `${process.env.HOME}/Desktop/HTC-Phase-B-Browser-Acceptance`;
const checks: { name: string; pass: boolean; detail: string }[] = [];
function rec(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 240)}`);
}
async function shot(page: { screenshot: (o: object) => Promise<Buffer> }, name: string) {
  writeFileSync(`${OUT}/${name}.png`, await page.screenshot({ fullPage: true }));
}
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
try {
  await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(creds.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url: URL) => !url.pathname.includes("/login"), { timeout: 20000, waitUntil: "commit" });
  if (page.url().includes("/welcome")) {
    await page.locator('input[type="checkbox"]').check({ force: true });
    await page.getByRole("button", { name: "Continue" }).click();
  }

  await page.goto(`${APP}/leads`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Import Leads" }).or(page.getByRole("link", { name: "Import Leads" })).click();
  await page.getByRole("heading", { name: /Bring your people/i }).waitFor();
  rec("Leads → Import Leads reaches people/leads", /kind=leads/.test(page.url()), page.url());
  await shot(page, "24-nav-leads-import");

  await page.goto(`${APP}/vendors`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Import Vendors" }).or(page.getByRole("link", { name: "Import Vendors" })).click();
  await page.getByRole("heading", { name: /Bring your people/i }).waitFor();
  rec("Vendors → Import Vendors reaches people/vendors", /kind=vendors/.test(page.url()), page.url());
  await shot(page, "25-nav-vendors-import");

  async function gotoCommit(url: string) {
    await page.goto(url, { waitUntil: "commit" }).catch(() => {});
    await page.waitForLoadState("domcontentloaded");
  }

  await gotoCommit(`${APP}/settings/import`);
  await page.getByRole("heading", { name: /Bring your people|Bring your business/i }).waitFor();
  rec("Legacy /settings/import redirects to people", /stage=people/.test(page.url()), page.url());
  await shot(page, "19-nav-legacy-import");

  await gotoCommit(`${APP}/settings/migration`);
  await page.getByRole("heading", { name: /Bring your dates|Bring your business/i }).waitFor();
  rec("Legacy /settings/migration redirects to dates", /stage=dates/.test(page.url()), page.url());
  await shot(page, "20-nav-legacy-migration");

  await gotoCommit(`${APP}/setup-hub/bring-business`);
  await page.getByRole("heading", { name: /Bring your business with you/i }).waitFor();
  rec("Legacy /setup-hub/bring-business reaches unified BYB", page.url().includes("bring-your-business") || await page.getByRole("heading", { name: /Bring your business with you/i }).count() > 0, page.url());
  await shot(page, "26-nav-legacy-bring-business");

  await gotoCommit(`${APP}/setup-hub/bring-your-business?stage=people&kind=couples`);
  await page.reload({ waitUntil: "commit" }).catch(() => {});
  await page.getByRole("heading", { name: "Bring your people" }).waitFor();
  rec("Refresh keeps people stage", page.url().includes("stage=people"), page.url());

  await gotoCommit(`${APP}/calendar?year=2027&month=5`);
  await page.getByRole("heading", { name: "Calendar" }).waitFor();
  await shot(page, "27-calendar-may-2027-preferred-date");
  const mayText = await page.locator("main").innerText();
  rec(
    "May 2027 calendar does not treat Fiona preferred date as a booked event",
    !/Fiona/.test(mayText) && /May|2027/.test(mayText),
    mayText.slice(0, 400),
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await gotoCommit(`${APP}/setup-hub/bring-your-business`);
  await page.getByRole("heading", { name: "Bring your business with you." }).waitFor();
  await shot(page, "21-byb-entry-390");
  await gotoCommit(`${APP}/setup-hub/bring-your-business?stage=prepare&entry=files`);
  await page.getByRole("heading", { name: "Prepare your business" }).waitFor();
  await shot(page, "22-prepare-390");
  await gotoCommit(`${APP}/setup-hub/bring-your-business?stage=people&kind=couples`);
  await page.getByRole("heading", { name: "Bring your people" }).waitFor();
  await shot(page, "23-people-390");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 24);
  rec("390px does not force large horizontal overflow", !overflow, `overflow=${overflow} scrollWidth=${await page.evaluate(() => document.documentElement.scrollWidth)}`);
} catch (err) {
  rec("nav-mobile journey", false, err instanceof Error ? err.stack ?? err.message : String(err));
  await shot(page, "99-nav-failure");
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/nav-mobile-report.json`, JSON.stringify(checks, null, 2));
console.log("DONE", checks.filter(c => !c.pass).length, "failed");
