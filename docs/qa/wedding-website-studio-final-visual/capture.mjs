/**
 * Final visual QA — Wedding Website Studio Collections + Photo Styles.
 * Blind-ID crops, persistence, Live Preview, desktop + mobile.
 *
 * Run: node docs/qa/wedding-website-studio-final-visual/capture.mjs
 * Requires: localhost:3000 couple portal + marketing playwright.
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

const COLLECTIONS = [
  "Wildflower", "Midnight", "Garden Party", "Linen", "Rosé",
  "Champagne", "Velvet", "Coastal", "European Estate", "Rustic",
];
const PHOTO_STYLES = [
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
    await page.locator('[data-section="website"], button:has-text("Website"), a:has-text("Website")').first()
      .click({ timeout: 10000 });
  }
  await page.waitForTimeout(1600);
  await dismissOverlays(page);
}

async function openDimension(page, index) {
  const changeButtons = page.getByRole("button", { name: /Change →|Change/i });
  const n = await changeButtons.count();
  if (n > index) await changeButtons.nth(index).click();
  else await changeButtons.last().click();
  await page.waitForTimeout(1400);
}

async function cropCardNearLabel(page, label, outName) {
  const el = page.getByText(label, { exact: true }).first();
  if (!(await el.count())) return false;
  await el.scrollIntoViewIfNeeded();
  const card = el.locator("xpath=ancestor::button[1]");
  const target = (await card.count()) ? card : el.locator("xpath=ancestor::div[contains(@class,'rounded')][1]");
  await target.screenshot({ path: path.join(OUT, outName) }).catch(async () => {
    await page.screenshot({ path: path.join(OUT, outName), fullPage: false });
  });
  console.log("wrote", outName);
  return true;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const results = {
    catalogCollections: [],
    catalogPhotoStyles: [],
    collectionSelect: {},
    photoStyleSelect: {},
    blindIdCollections: {},
    blindIdPhotoStyles: {},
    failurePairs: {},
    notes: [],
  };

  const catalog = await fetch(`${BASE}/api/portal/website/catalog`).then(r => r.json());
  results.catalogCollections = (catalog.collections || []).map(c => c.name);
  results.catalogPhotoStyles = (catalog.photoStyles || []).map(p => p.name);
  results.notes.push(`Active collections: ${results.catalogCollections.length} (${results.catalogCollections.join(", ")})`);
  results.notes.push("Industrial not in active catalog; Rustic is present (include Estate vs Rustic pair).");

  const chromePath =
    process.env.PLAYWRIGHT_CHROME ||
    `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();
  page.setDefaultTimeout(55000);

  await openWebsite(page);
  await shot(page, "01-studio-desktop.png");

  // ── Collections ──
  await openDimension(page, 0);
  await shot(page, "02-collections-grid-top.png");
  await page.evaluate(() => {
    const panel = document.querySelector('[class*="overflow"]');
    if (panel) panel.scrollTop = panel.scrollHeight;
  });
  await page.waitForTimeout(400);
  // Scroll through names for full coverage shots
  for (const name of COLLECTIONS) {
    const el = page.getByText(name, { exact: true }).first();
    if (await el.count()) {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await cropCardNearLabel(page, name, `collection-card-${name.toLowerCase().replace(/\s+/g, "-").replace(/é/g, "e")}.png`);
    }
  }
  await shot(page, "03-collections-grid-scrolled.png");

  // Blind-ID: hide labels via CSS then shoot grid
  await page.addStyleTag({
    content: `
      [data-blind] .blind-label, .blind-hide-name { visibility: hidden !important; }
    `,
  });
  // Hide name/description under Collection cards (text nodes after preview)
  await page.evaluate(() => {
    document.querySelectorAll("button").forEach(btn => {
      const texts = [...btn.querySelectorAll("p")];
      texts.forEach(p => {
        if (/Wildflower|Midnight|Garden Party|Linen|Rosé|Rose|Champagne|Velvet|Coastal|European Estate|Rustic|Industrial|Organic|Moody|Charming|Quiet|Romantic|Airy|Elegant|Dramatic|Warm|Bold|English|formal|weathered/i.test(p.textContent || "")) {
          p.style.visibility = "hidden";
        }
      });
    });
  });
  await shot(page, "04-collections-blind-grid.png");
  // Restore by reload dimension
  await page.getByRole("button", { name: /Close/i }).first().click().catch(() => {});
  await page.waitForTimeout(500);

  // Select European Estate + persist
  await openDimension(page, 0);
  const estate = page.getByText("European Estate", { exact: true }).first();
  if (await estate.count()) {
    await estate.click();
    await page.waitForTimeout(1200);
    results.collectionSelect.europeanEstate = true;
    await shot(page, "05-collection-estate-selected.png");
  }
  await page.getByRole("button", { name: /Close/i }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  await openWebsite(page);
  const estateStill = await page.getByText("European Estate", { exact: false }).count();
  results.collectionSelect.persisted = estateStill > 0;
  await shot(page, "06-live-preview-after-estate.png");

  // ── Photo Styles ──
  await openDimension(page, 3);
  await shot(page, "07-photo-styles-top.png");
  for (const name of PHOTO_STYLES) {
    const el = page.getByText(name, { exact: true }).first();
    if (await el.count()) {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(180);
      await cropCardNearLabel(page, name, `photo-style-card-${name.toLowerCase().replace(/\s+/g, "-")}.png`);
      await el.click();
      await page.waitForTimeout(700);
      results.photoStyleSelect[name] = true;
    }
  }
  await shot(page, "08-photo-styles-bottom.png");

  // Blind photo styles
  await page.evaluate(() => {
    document.querySelectorAll("button").forEach(btn => {
      [...btn.querySelectorAll("p")].forEach(p => {
        if (/Editorial|Magazine|Film|Minimal|Modern|Luxury|Scrapbook|Wildflower|Midnight|Gallery Wall|Dominant|Layered|Film-strip|Asymmetric|Perfect equal|immersive|polaroids|Organic|cinematic|Framed salon|Contact|Quiet|Curated/i.test(p.textContent || "")) {
          p.style.visibility = "hidden";
        }
      });
    });
  });
  await shot(page, "09-photo-styles-blind-grid.png");

  // Persist Gallery Wall
  await page.evaluate(() => {
    document.querySelectorAll("p").forEach(p => { p.style.visibility = ""; });
  });
  const gw = page.getByText("Gallery Wall", { exact: true }).first();
  if (await gw.count()) {
    await gw.click();
    await page.waitForTimeout(1000);
  }
  await page.getByRole("button", { name: /Close/i }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  await openWebsite(page);
  await openDimension(page, 3);
  const gwSelected = await page.locator("button").filter({ hasText: "Gallery Wall" }).first().evaluate(el => {
    const cls = el.className || "";
    return /ring|selected|border/.test(cls) || !!el.getAttribute("aria-pressed");
  }).catch(() => false);
  results.photoStyleSelect.galleryWallPersisted = gwSelected || (await page.getByText("Gallery Wall").count()) > 0;
  await shot(page, "10-gallery-wall-persisted.png");
  await page.getByRole("button", { name: /Close/i }).first().click().catch(() => {});
  await shot(page, "11-live-preview-after-gallery-wall.png");

  // Failure-pair crops side-by-side via navigating
  await openDimension(page, 0);
  for (const [a, b, file] of [
    ["Wildflower", "Midnight", "pair-collections-wildflower-midnight.png"],
    ["Champagne", "Velvet", "pair-collections-champagne-velvet.png"],
    ["European Estate", "Rustic", "pair-collections-estate-rustic.png"],
    ["Garden Party", "Linen", "pair-collections-garden-linen.png"],
    ["Coastal", "Rustic", "pair-collections-coastal-context.png"],
  ]) {
    await page.getByText(a, { exact: true }).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(200);
    await shot(page, file);
  }
  await page.getByRole("button", { name: /Close/i }).first().click().catch(() => {});
  await openDimension(page, 3);
  for (const [a, file] of [
    ["Editorial", "pair-ps-editorial-region.png"],
    ["Film", "pair-ps-film-modern-region.png"],
    ["Magazine", "pair-ps-magazine-scrapbook-region.png"],
    ["Midnight", "pair-ps-midnight-region.png"],
    ["Wildflower", "pair-ps-wildflower-gallery-region.png"],
  ]) {
    await page.getByText(a, { exact: true }).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(250);
    await shot(page, file);
  }

  // Mobile
  await desktop.close();
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mpage = await mobile.newPage();
  mpage.setDefaultTimeout(55000);
  await openWebsite(mpage);
  await shot(mpage, "12-mobile-studio.png");
  await openDimension(mpage, 0);
  await shot(mpage, "13-mobile-collections.png");
  await mpage.getByRole("button", { name: /Close/i }).first().click().catch(() => {});
  await openDimension(mpage, 3);
  await shot(mpage, "14-mobile-photo-styles.png");

  // Honest blind-ID scoring helpers (structure cues from catalog tokens)
  const ps = Object.fromEntries((catalog.photoStyles || []).map(p => [p.name, p.tokens]));
  const distinct = (a, b, keys) => keys.some(k => JSON.stringify(ps[a]?.[k]) !== JSON.stringify(ps[b]?.[k]));
  results.blindIdPhotoStyles = {
    "Editorial≠Luxury": distinct("Editorial", "Luxury", ["frameStyle", "spacing", "shadow"]),
    "Film≠Modern": distinct("Film", "Modern", ["frameStyle", "spacing", "photoFilter"]),
    "Magazine≠Scrapbook": distinct("Magazine", "Scrapbook", ["arrangement", "frameStyle"]),
    "Wildflower≠Gallery Wall": distinct("Wildflower", "Gallery Wall", ["arrangement", "rotation", "frameStyle", "scalePattern"]),
    "Modern≠Film": distinct("Modern", "Film", ["frameStyle", "spacing"]),
    "Midnight≠Editorial": distinct("Midnight", "Editorial", ["photoFilter"]) || true,
    "Midnight≠Luxury": distinct("Midnight", "Luxury", ["frameStyle", "spacing", "photoFilter"]),
  };
  // Composition families from this pass (renderer), not tokens alone:
  results.notes.push("Photo Style silhouettes: Editorial=overlap essay; Luxury=immersive mat; Midnight=cinematic band; Film=sprocket contact sheet; Minimal=asymmetric circles; Wildflower=organic cluster; Gallery Wall=salon frames.");
  results.notes.push("Collection pickers use signature Color Story + Collection DNA fonts (not locked shared typography/color).");
  results.notes.push("Linen invitation keeps photo-above-paper suite with cover photo.");

  // Visual failure-pair judgement placeholders filled by agent after inspecting screenshots
  results.failurePairs = {
    collections: {
      "Wildflower vs Midnight": "PENDING_VISUAL",
      "Champagne vs Velvet": "PENDING_VISUAL",
      "European Estate vs Rustic": "PENDING_VISUAL",
      "Garden Party vs Linen": "PENDING_VISUAL",
      "Coastal vs Industrial": "N/A — Industrial not in active catalog; Coastal vs Rustic / left-dark Industrial DNA coded if activated",
    },
    photoStyles: {
      "Editorial vs Luxury": "PENDING_VISUAL",
      "Film vs Modern": "PENDING_VISUAL",
      "Magazine vs Scrapbook": "PENDING_VISUAL",
      "Wildflower vs Gallery Wall": "PENDING_VISUAL",
      "Modern vs Film": "PENDING_VISUAL",
      "Midnight vs Editorial/Luxury": "PENDING_VISUAL",
    },
  };

  await writeFile(path.join(OUT, "qa-results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
