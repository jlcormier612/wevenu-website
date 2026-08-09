/**
 * Visual QA for Wedding Website Studio Collection + Photo Style previews.
 * Run from marketing/: node ../docs/qa/wedding-website-studio-preview/capture.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const TOKEN = "seedcoupleportal00000000000000000000000000000001";
const BASE = process.env.PORTAL_BASE ?? "http://localhost:3000";
const PORTAL = `${BASE}/p/${TOKEN}`;

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", name);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();
  page.setDefaultTimeout(45000);

  await page.goto(PORTAL, { waitUntil: "networkidle" });
  // Open Website section
  const websiteNav = page.getByRole("button", { name: /website/i }).or(page.getByText(/^Website$/i)).first();
  if (await websiteNav.count()) {
    await websiteNav.click();
  } else {
    // try sidebar link / tab
    const alt = page.locator('[data-section="website"], button:has-text("Website"), a:has-text("Website")').first();
    await alt.click({ timeout: 10000 });
  }
  await page.waitForTimeout(1500);
  await shot(page, "01-studio-desktop.png");

  // Theme Studio — open Collection dimension
  const collectionChange = page.getByRole("button", { name: /Change/i }).first();
  await collectionChange.click();
  await page.waitForTimeout(1200);
  await shot(page, "02-theme-studio-collections.png");

  // Scroll collection grid
  const wildflower = page.getByText("Wildflower", { exact: true }).first();
  if (await wildflower.count()) await wildflower.scrollIntoViewIfNeeded();
  await shot(page, "03-collections-grid.png");

  // Close collection, open Photo Style
  const closeBtn = page.getByRole("button", { name: /Close/i }).first();
  if (await closeBtn.count()) await closeBtn.click();
  await page.waitForTimeout(400);

  // Find Photo Style Change button — DimensionCards in order
  const changeButtons = page.getByRole("button", { name: /Change →|Change/i });
  const n = await changeButtons.count();
  // Layout Collection, Color Story, Typography, Photo Style — 4th Change
  if (n >= 4) await changeButtons.nth(3).click();
  else await changeButtons.last().click();
  await page.waitForTimeout(1200);
  await shot(page, "04-theme-studio-photo-styles.png");

  // Setup guide → wizard Collection step via Selected Design Summary or Setup guide
  const setupGuide = page.getByRole("button", { name: /Setup guide/i });
  if (await setupGuide.count()) {
    await setupGuide.click();
    await page.waitForTimeout(800);
    // Welcome → skip/advance to collection
    // Click through welcome
    const getStarted = page.getByRole("button", { name: /Get started|Begin|Start|Let's|Continue|Next/i }).first();
    if (await getStarted.count()) await getStarted.click();
    await page.waitForTimeout(600);
    // Photo step skip
    const skipOrNext = page.getByRole("button", { name: /Skip|Use this photo|Next|→/i }).first();
    if (await skipOrNext.count()) await skipOrNext.click();
    await page.waitForTimeout(1000);
    await shot(page, "05-wizard-collections.png");

    // Advance to photo style: This is us → Love it → Beautiful → photo style
    const thisIsUs = page.getByRole("button", { name: /This is us/i });
    if (await thisIsUs.count()) await thisIsUs.click();
    await page.waitForTimeout(700);
    const loveIt = page.getByRole("button", { name: /Love it/i });
    if (await loveIt.count()) await loveIt.click();
    await page.waitForTimeout(700);
    const beautiful = page.getByRole("button", { name: /Beautiful/i });
    if (await beautiful.count()) await beautiful.click();
    await page.waitForTimeout(1000);
    await shot(page, "06-wizard-photo-styles.png");
  }

  // Live preview still present in studio
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // Mobile viewport
  await desktop.close();
  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mpage = await mobileCtx.newPage();
  mpage.setDefaultTimeout(45000);
  await mpage.goto(PORTAL, { waitUntil: "networkidle" });
  const mNav = mpage.getByRole("button", { name: /website/i }).or(mpage.getByText(/^Website$/i)).first();
  if (await mNav.count()) await mNav.click();
  else await mpage.locator('button:has-text("Website"), a:has-text("Website")').first().click();
  await mpage.waitForTimeout(1500);
  await shot(mpage, "07-studio-mobile.png");

  // Mobile Theme Studio Collection
  const mChange = mpage.getByRole("button", { name: /Change/i }).first();
  if (await mChange.count()) {
    await mChange.click();
    await mpage.waitForTimeout(1000);
    await shot(mpage, "08-mobile-collections.png");
  }

  await browser.close();
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
