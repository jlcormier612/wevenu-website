/**
 * Visual QA — Wedding Website Studio Photo Style final refinement (10 styles).
 * Run from marketing/: node ../docs/qa/wedding-website-studio-photo-styles-final/capture.mjs
 */
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(__dirname, "../../../marketing/package.json"));
const { chromium } = require("playwright");

const OUT = __dirname;
const TOKEN = "seedcoupleportal00000000000000000000000000000001";
const BASE = process.env.PORTAL_BASE ?? "http://localhost:3000";
const PORTAL = `${BASE}/p/${TOKEN}`;
const STYLE_NAMES = [
  "Editorial", "Magazine", "Film", "Minimal", "Modern",
  "Luxury", "Scrapbook", "Wildflower", "Midnight", "Gallery Wall",
];

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", name);
}

async function dismissOverlays(page) {
  for (const sel of ['[data-nextjs-dialog-overlay]', '[data-nextjs-toast]', 'button[aria-label="Close"]']) {
    const el = page.locator(sel).first();
    if (await el.count()) await el.click({ force: true }).catch(() => {});
  }
  await page.keyboard.press("Escape").catch(() => {});
}

async function openWebsite(page) {
  await page.goto(PORTAL, { waitUntil: "networkidle" });
  await dismissOverlays(page);
  const websiteNav = page.getByRole("button", { name: /website/i }).or(page.getByText(/^Website$/i)).first();
  if (await websiteNav.count()) await websiteNav.click();
  else {
    const alt = page.locator('[data-section="website"], button:has-text("Website"), a:has-text("Website")').first();
    await alt.click({ timeout: 10000 });
  }
  await page.waitForTimeout(1500);
  await dismissOverlays(page);
}

async function openPhotoStyleDimension(page) {
  const changeButtons = page.getByRole("button", { name: /Change →|Change/i });
  const n = await changeButtons.count();
  if (n >= 4) await changeButtons.nth(3).click();
  else await changeButtons.last().click();
  await page.waitForTimeout(1400);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const results = { stylesFound: [], selectPersist: {}, livePreview: {}, wizardCount: null };
  const browser = await chromium.launch({ headless: true });

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();
  page.setDefaultTimeout(50000);

  await openWebsite(page);
  await shot(page, "01-studio-desktop.png");

  await openPhotoStyleDimension(page);
  await shot(page, "02-theme-studio-photo-styles-top.png");

  for (const name of STYLE_NAMES) {
    const found = await page.getByText(name, { exact: true }).count();
    if (found) results.stylesFound.push(name);
  }
  console.log("styles_found", results.stylesFound.length, results.stylesFound.join(","));

  const filmLabel = page.getByText("Film", { exact: true }).first();
  if (await filmLabel.count()) {
    await filmLabel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
  }
  await shot(page, "02b-theme-studio-film-modern-luxury.png");

  // Critical pair crops: Editorial / Magazine / Luxury mid-band
  const editorial = page.getByText("Editorial", { exact: true }).first();
  if (await editorial.count()) {
    await editorial.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  }
  await shot(page, "02c-editorial-magazine-pair.png");

  const galleryWall = page.getByText("Gallery Wall", { exact: true }).first();
  if (await galleryWall.count()) {
    await galleryWall.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
  }
  await shot(page, "03-theme-studio-photo-styles-bottom.png");

  // Select each style and confirm selected ring + summary path for a few critical ones
  for (const name of ["Editorial", "Film", "Luxury", "Midnight", "Gallery Wall", "Modern", "Wildflower", "Scrapbook", "Minimal", "Magazine"]) {
    const card = page.locator("button").filter({ hasText: name }).first();
    if (!(await card.count())) {
      results.selectPersist[name] = "MISSING_CARD";
      continue;
    }
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await page.waitForTimeout(700);
    const ring = await card.evaluate((el) => {
      const cls = el.className?.toString() || "";
      const style = getComputedStyle(el);
      return { cls: cls.slice(0, 120), outline: style.outline, borderColor: style.borderColor, boxShadow: style.boxShadow.slice(0, 80) };
    });
    results.selectPersist[name] = { selectedClick: true, ring };
    if (name === "Editorial") await shot(page, "04-editorial-selected.png");
    if (name === "Film") await shot(page, "04b-film-selected.png");
    if (name === "Luxury") await shot(page, "04c-luxury-selected.png");
    if (name === "Midnight") await shot(page, "04d-midnight-selected.png");
    if (name === "Gallery Wall") await shot(page, "04e-gallery-wall-selected.png");
  }

  // Close dimension → Live Preview should reflect last selection (Gallery Wall)
  const closeBtn = page.getByRole("button", { name: /Close/i }).first();
  if (await closeBtn.count()) await closeBtn.click();
  await page.waitForTimeout(800);
  await shot(page, "05-live-preview-after-gallery-wall.png");
  const summary = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  results.livePreview.afterClose = {
    showsGalleryWall: /Gallery Wall/i.test(summary),
    hasLivePreview: /LIVE PREVIEW|Live Preview/i.test(summary),
  };

  // Persist check — reopen Photo Style and confirm Gallery Wall still selected ring
  await openPhotoStyleDimension(page);
  const gwCard = page.locator("button").filter({ hasText: "Gallery Wall" }).first();
  const gwSelected = await gwCard.evaluate((el) => {
    const aria = el.getAttribute("aria-pressed") || el.getAttribute("data-selected");
    const cls = el.className?.toString() || "";
    return { aria, hasRing: /ring|selected|border-primary|border-foreground/i.test(cls), cls: cls.slice(0, 160) };
  }).catch(() => null);
  results.selectPersist.galleryWallReload = gwSelected;
  await shot(page, "05b-gallery-wall-persisted-reopen.png");
  if (await closeBtn.count()) await closeBtn.click().catch(() => {});
  await page.waitForTimeout(400);

  // Wizard
  const setupGuide = page.getByRole("button", { name: /Setup guide/i });
  if (await setupGuide.count()) {
    await setupGuide.click();
    await page.waitForTimeout(800);
    const getStarted = page.getByRole("button", { name: /Get started|Begin|Start|Let's|Continue|Next/i }).first();
    if (await getStarted.count()) await getStarted.click();
    await page.waitForTimeout(600);
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
    let wizardFound = 0;
    for (const name of STYLE_NAMES) {
      if (await page.getByText(name, { exact: true }).count()) wizardFound++;
    }
    results.wizardCount = wizardFound;
    console.log("wizard_style_names_found", wizardFound, "/", STYLE_NAMES.length);
    const wizardGw = page.getByText("Gallery Wall", { exact: true }).first();
    if (await wizardGw.count()) {
      await wizardGw.scrollIntoViewIfNeeded();
      await page.locator("button").filter({ hasText: "Gallery Wall" }).first().click();
      await page.waitForTimeout(500);
    }
    await shot(page, "07-wizard-photo-styles-bottom.png");
  }

  await desktop.close();

  // Mobile
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
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
  await writeFile(path.join(OUT, "qa-results.json"), JSON.stringify(results, null, 2));
  console.log("RESULTS", JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
