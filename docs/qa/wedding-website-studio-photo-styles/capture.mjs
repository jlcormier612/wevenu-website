/**
 * Visual QA — Wedding Website Studio Photo Style catalog (10 styles).
 * Run from marketing/: node ../docs/qa/wedding-website-studio-photo-styles/capture.mjs
 */
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(__dirname, "../../../marketing/package.json"));
const { chromium } = require("playwright");

const OUT = __dirname;
const TOKEN = "seedcoupleportal00000000000000000000000000000001";
const BASE = process.env.PORTAL_BASE ?? "http://localhost:3000";
const PORTAL = `${BASE}/p/${TOKEN}`;

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", name);
}

async function openWebsite(page) {
  await page.goto(PORTAL, { waitUntil: "networkidle" });
  const websiteNav = page.getByRole("button", { name: /website/i }).or(page.getByText(/^Website$/i)).first();
  if (await websiteNav.count()) await websiteNav.click();
  else {
    const alt = page.locator('[data-section="website"], button:has-text("Website"), a:has-text("Website")').first();
    await alt.click({ timeout: 10000 });
  }
  await page.waitForTimeout(1500);
}

async function openPhotoStyleDimension(page) {
  const changeButtons = page.getByRole("button", { name: /Change →|Change/i });
  const n = await changeButtons.count();
  // Layout Collection, Color Story, Typography, Photo Style — 4th Change
  if (n >= 4) await changeButtons.nth(3).click();
  else await changeButtons.last().click();
  await page.waitForTimeout(1400);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  // ── Desktop Theme Studio ──
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();
  page.setDefaultTimeout(50000);

  await openWebsite(page);
  await shot(page, "01-studio-desktop.png");

  await openPhotoStyleDimension(page);
  await shot(page, "02-theme-studio-photo-styles-top.png");

  // Mid styles — Film / Modern / Luxury (blind-ID critical pairs)
  const filmLabel = page.getByText("Film", { exact: true }).first();
  if (await filmLabel.count()) {
    await filmLabel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
  }
  await shot(page, "02b-theme-studio-film-modern-luxury.png");

  // Scroll to lower half (Gallery Wall / Midnight)
  const galleryWall = page.getByText("Gallery Wall", { exact: true }).first();
  if (await galleryWall.count()) {
    await galleryWall.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
  }
  await shot(page, "03-theme-studio-photo-styles-bottom.png");

  // Select Gallery Wall
  const gwCard = page.locator("button").filter({ hasText: "Gallery Wall" }).first();
  if (await gwCard.count()) {
    await gwCard.click();
    await page.waitForTimeout(800);
    await shot(page, "04-gallery-wall-selected.png");
  }

  // Close dimension → Live Preview
  const closeBtn = page.getByRole("button", { name: /Close/i }).first();
  if (await closeBtn.count()) await closeBtn.click();
  await page.waitForTimeout(600);
  await shot(page, "05-live-preview-after-gallery-wall.png");

  // Setup guide → wizard Photo Style step
  const setupGuide = page.getByRole("button", { name: /Setup guide/i });
  if (await setupGuide.count()) {
    await setupGuide.click();
    await page.waitForTimeout(800);
    const getStarted = page.getByRole("button", { name: /Get started|Begin|Start|Let's|Continue|Next/i }).first();
    if (await getStarted.count()) await getStarted.click();
    await page.waitForTimeout(600);
    // Do NOT click header "Skip →" — that jumps past Photo Style.
    for (const label of [
      /^(Use this photo|Skip for now)/i,
      /^This is us/i,
      /^Love it/i,
      /^Beautiful/i,
    ]) {
      if (await page.getByText("Choose your Photo Style", { exact: true }).count()) break;
      const btn = page.getByRole("button", { name: label }).first();
      if (await btn.count()) {
        console.log("wizard_click", await btn.textContent());
        await btn.click();
        await page.waitForTimeout(900);
      } else {
        console.log("wizard_missing", label);
      }
    }

    const onPhoto = await page.getByText("Choose your Photo Style", { exact: true }).count();
    console.log("on_photo_style_step", !!onPhoto);
    await shot(page, "06-wizard-photo-styles-top.png");
    const wizardGw = page.getByText("Gallery Wall", { exact: true }).first();
    if (await wizardGw.count()) {
      await wizardGw.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    }
    await shot(page, "07-wizard-photo-styles-bottom.png");
    const names = ["Editorial", "Magazine", "Film", "Minimal", "Modern", "Luxury", "Scrapbook", "Wildflower", "Midnight", "Gallery Wall"];
    let found = 0;
    for (const n of names) {
      if (await page.getByText(n, { exact: true }).count()) found++;
    }
    console.log("wizard_style_names_found", found, "/", names.length);
  }

  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await desktop.close();

  // ── Mobile Theme Studio ──
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mpage = await mobile.newPage();
  mpage.setDefaultTimeout(50000);
  await openWebsite(mpage);
  await shot(mpage, "08-studio-mobile.png");
  await openPhotoStyleDimension(mpage);
  await shot(mpage, "09-mobile-photo-styles-top.png");
  const mGw = mpage.getByText("Gallery Wall", { exact: true }).first();
  if (await mGw.count()) {
    await mGw.scrollIntoViewIfNeeded();
    await mpage.waitForTimeout(400);
  }
  await shot(mpage, "10-mobile-photo-styles-bottom.png");

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
