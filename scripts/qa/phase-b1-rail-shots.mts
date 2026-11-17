import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const creds = JSON.parse(readFileSync("/tmp/htc-byb-phase-b-creds.json", "utf8"));
const APP = "http://localhost:3040";
const OUT = `${process.env.HOME}/Desktop/HTC-Phase-B1-Trust-Usability`;
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.setDefaultTimeout(25000);
await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
await page.locator("#email").fill(creds.email);
await page.locator("#password").fill(creds.password);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL((u: URL) => !u.pathname.includes("/login"), { waitUntil: "commit" });
await page.goto(`${APP}/setup-hub/bring-your-business?stage=people&kind=couples`, { waitUntil: "commit" }).catch(() => {});
await page.waitForLoadState("domcontentloaded");
await page.getByRole("heading", { name: "Bring your people" }).waitFor();
await page.waitForFunction(() => document.querySelector('[data-testid="byb-stage-rail-more"]') || document.querySelector('[data-testid="byb-stage-rail"]')?.getAttribute("data-overflow") === "true");
writeFileSync(`${OUT}/17-stage-rail-390.png`, await page.screenshot({ fullPage: true }));
console.log("people overflow", await page.getByTestId("byb-stage-rail").getAttribute("data-overflow"), "right", await page.getByTestId("byb-stage-rail-more").count(), "left", await page.getByTestId("byb-stage-rail-more-left").count(), "rail", await page.locator('[data-testid="byb-stage-rail"]').innerText());
await page.goto(`${APP}/setup-hub/bring-your-business?stage=review`, { waitUntil: "commit" }).catch(() => {});
await page.waitForLoadState("domcontentloaded");
await page.getByTestId("byb-readiness").waitFor();
await page.waitForFunction(() => {
  const rail = document.querySelector('[data-testid="byb-stage-rail"]') as HTMLElement | null;
  const current = document.querySelector('[aria-current="step"]') as HTMLElement | null;
  if (!rail || !current) return false;
  const s = rail.getBoundingClientRect();
  const c = current.getBoundingClientRect();
  return c.left >= s.left - 2 && c.right <= s.right + 2;
});
writeFileSync(`${OUT}/18-review-390.png`, await page.screenshot({ fullPage: true }));
console.log("review overflow", await page.getByTestId("byb-stage-rail").getAttribute("data-overflow"), "right", await page.getByTestId("byb-stage-rail-more").count(), "left", await page.getByTestId("byb-stage-rail-more-left").count(), "rail", await page.locator('[data-testid="byb-stage-rail"]').innerText());
console.log("review metrics", await page.evaluate(() => {
  const el = document.querySelector('[data-testid="byb-stage-rail"]') as HTMLElement | null;
  const current = document.querySelector('[aria-current="step"]') as HTMLElement | null;
  if (!el) return null;
  return {
    client: el.clientWidth,
    scroll: el.scrollWidth,
    scrollLeft: el.scrollLeft,
    current: current?.textContent,
    currentLeft: current?.getBoundingClientRect().left,
    scrollerRight: el.getBoundingClientRect().right,
  };
}));
await browser.close();
