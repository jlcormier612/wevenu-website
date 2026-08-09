/**
 * Photo Style Composition Phase B — visual QA.
 * Run: node docs/qa/wedding-website-studio-photo-style-phase-b/capture.mjs
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

const STYLES = [
  "Editorial", "Magazine", "Film", "Minimal", "Modern",
  "Luxury", "Scrapbook", "Wildflower", "Midnight", "Gallery Wall",
];

const PAIRS = [
  ["Editorial", "Luxury", "pair-editorial-luxury"],
  ["Editorial", "Magazine", "pair-editorial-magazine"],
  ["Film", "Modern", "pair-film-modern"],
  ["Magazine", "Gallery Wall", "pair-magazine-gallery-wall"],
  ["Scrapbook", "Gallery Wall", "pair-scrapbook-gallery-wall"],
  ["Scrapbook", "Wildflower", "pair-scrapbook-wildflower"],
  ["Wildflower", "Gallery Wall", "pair-wildflower-gallery-wall"],
  ["Midnight", "Film", "pair-midnight-film"],
  ["Midnight", "Luxury", "pair-midnight-luxury"],
  ["Minimal", "Luxury", "pair-minimal-luxury"],
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

async function openPhotoStyles(page) {
  const label = page.getByText("Photo Style", { exact: true }).first();
  if (await label.count()) {
    await label.scrollIntoViewIfNeeded();
    const card = label.locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
    const change = card.getByText("Change →", { exact: true });
    if (await change.count()) {
      await change.click();
      await page.waitForTimeout(1600);
      return;
    }
  }
  const changeButtons = page.getByRole("button", { name: /Change →|Change/i });
  const n = await changeButtons.count();
  if (n >= 4) await changeButtons.nth(3).click();
  else if (n) await changeButtons.last().click();
  await page.waitForTimeout(1400);
}

async function tallestCard(page, label) {
  const candidates = page.locator("button").filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) });
  const count = await candidates.count();
  let best = null;
  let bestH = 0;
  for (let i = 0; i < count; i++) {
    const btn = candidates.nth(i);
    const box = await btn.boundingBox().catch(() => null);
    if (box && box.height > bestH) {
      bestH = box.height;
      best = btn;
    }
  }
  return { best, bestH };
}

async function cropCard(page, label, outName) {
  const { best, bestH } = await tallestCard(page, label);
  if (best && bestH >= 140) {
    await best.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await best.screenshot({ path: path.join(OUT, outName) });
    console.log("wrote", outName, `(h=${Math.round(bestH)})`);
    return true;
  }
  return false;
}

async function capturePair(page, a, b, outName) {
  const { best: cardA } = await tallestCard(page, a);
  const { best: cardB } = await tallestCard(page, b);
  if (cardA) await cardA.scrollIntoViewIfNeeded().catch(() => {});
  if (cardB) await cardB.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(280);
  const boxA = cardA ? await cardA.boundingBox().catch(() => null) : null;
  const boxB = cardB ? await cardB.boundingBox().catch(() => null) : null;
  if (!boxA || !boxB) {
    await shot(page, `${outName}.png`);
    return false;
  }
  const x = Math.min(boxA.x, boxB.x) - 8;
  const y = Math.min(boxA.y, boxB.y) - 8;
  const width = Math.max(boxA.x + boxA.width, boxB.x + boxB.width) - x + 8;
  const height = Math.max(boxA.y + boxA.height, boxB.y + boxB.height) - y + 8;
  // If cards are far apart vertically, scroll mid and take viewport shot
  if (height > 720) {
    await shot(page, `${outName}.png`);
    return true;
  }
  await page.screenshot({
    path: path.join(OUT, `${outName}.png`),
    clip: {
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.min(Math.max(width, 40), 1280),
      height: Math.min(Math.max(height, 40), 900),
    },
  });
  console.log("wrote", `${outName}.png`);
  return true;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const results = {
    stylesFound: [],
    arrangements: {},
    pairs: {},
    selectPersist: {},
    livePreview: {},
    labelClipChecks: {},
    notes: [],
  };

  const catalog = await fetch(`${BASE}/api/portal/website/catalog`).then(r => r.json());
  for (const p of catalog.photoStyles || []) {
    results.arrangements[p.key] = p.tokens?.arrangement;
    results.stylesFound.push(p.name);
  }
  results.notes.push(`Catalog photo styles: ${results.stylesFound.length}`);
  results.notes.push(`Minimal arrangement=${results.arrangements.minimal}`);
  results.notes.push(`Gallery Wall arrangement=${results.arrangements.gallery_wall}`);

  const chromePath =
    process.env.PLAYWRIGHT_CHROME ||
    `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();
  page.setDefaultTimeout(55000);

  await openWebsite(page);
  await openPhotoStyles(page);
  await shot(page, "01-photo-styles-grid-top.png");

  for (const name of STYLES) {
    const el = page.getByText(name, { exact: true }).first();
    if (await el.count()) {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(160);
      await cropCard(page, name, `card-${name.toLowerCase().replace(/\s+/g, "-")}.png`);
    }
  }

  // Scroll for bottom of grid
  await page.evaluate(() => {
    const panel = [...document.querySelectorAll("div")].find(d => d.scrollHeight > d.clientHeight + 40 && d.clientHeight > 200);
    if (panel) panel.scrollTop = panel.scrollHeight;
  });
  await page.waitForTimeout(400);
  await shot(page, "02-photo-styles-grid-bottom.png");

  // Blind grid — hide names/descriptions
  await page.addStyleTag({ content: `html { filter: grayscale(1) !important; }` });
  await page.evaluate(() => {
    document.querySelectorAll("button").forEach(btn => {
      [...btn.querySelectorAll("p")].forEach(p => {
        if (/Editorial|Magazine|Film|Minimal|Modern|Luxury|Scrapbook|Wildflower|Midnight|Gallery Wall|Fashion|Designed|Contact|Sparse|Perfect|Singular|Elegant|Organic|Cinematic|Curated|Asymmetrical|Layered|Quiet|Immersive|Overlapping|Moody/i.test(p.textContent || "")) {
          p.style.visibility = "hidden";
        }
      });
    });
  });
  await page.evaluate(() => {
    const panel = [...document.querySelectorAll("div")].find(d => d.scrollHeight > d.clientHeight + 40 && d.clientHeight > 200);
    if (panel) panel.scrollTop = 0;
  });
  await page.waitForTimeout(300);
  await shot(page, "03-photo-styles-blind-grid-top.png");
  await page.evaluate(() => {
    const panel = [...document.querySelectorAll("div")].find(d => d.scrollHeight > d.clientHeight + 40 && d.clientHeight > 200);
    if (panel) panel.scrollTop = panel.scrollHeight;
  });
  await page.waitForTimeout(300);
  await shot(page, "03b-photo-styles-blind-grid-bottom.png");
  await page.evaluate(() => {
    document.querySelectorAll("p").forEach(p => { p.style.visibility = ""; });
    document.documentElement.style.filter = "";
  });

  // Reopen clean for pairs
  await page.getByRole("button", { name: /Close/i }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  await openWebsite(page);
  await openPhotoStyles(page);

  for (const [a, b, name] of PAIRS) {
    await page.getByText(a, { exact: true }).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(150);
    await page.getByText(b, { exact: true }).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(150);
    results.pairs[name] = await capturePair(page, a, b, name);
  }

  // Label clip geometry check on a few cards
  for (const name of ["Editorial", "Minimal", "Gallery Wall", "Scrapbook"]) {
    const { best } = await tallestCard(page, name);
    if (!best) continue;
    const metrics = await best.evaluate((el) => {
      const children = [...el.children];
      const specimen = children[0];
      const label = children[1];
      if (!specimen || !label) return { ok: false, reason: "missing regions" };
      const s = specimen.getBoundingClientRect();
      const l = label.getBoundingClientRect();
      const nameEl = label.querySelector("p");
      const descEl = label.querySelectorAll("p")[1];
      return {
        ok: true,
        specimenH: Math.round(s.height),
        labelTop: Math.round(l.top),
        specimenBottom: Math.round(s.bottom),
        gap: Math.round(l.top - s.bottom),
        nameVisible: nameEl ? getComputedStyle(nameEl).visibility !== "hidden" : false,
        descText: descEl?.textContent?.slice(0, 48) || "",
        overflowHidden: getComputedStyle(specimen).overflow === "hidden",
      };
    });
    results.labelClipChecks[name] = metrics;
  }

  // Select Gallery Wall → persist → Live Preview
  const gw = page.locator("button").filter({ hasText: "Gallery Wall" }).first();
  if (await gw.count()) {
    await gw.scrollIntoViewIfNeeded();
    await gw.click();
    await page.waitForTimeout(900);
    await shot(page, "04-gallery-wall-selected.png");
  }
  await page.getByRole("button", { name: /Close/i }).first().click().catch(() => {});
  await page.waitForTimeout(800);
  await openWebsite(page);
  await shot(page, "05-live-preview-gallery-wall.png");
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  results.livePreview = {
    showsGalleryWall: /Gallery Wall/i.test(body),
    hasLivePreview: /LIVE PREVIEW|Live Preview/i.test(body),
  };

  // Minimal select for sparse identity
  await openPhotoStyles(page);
  const minimal = page.locator("button").filter({ hasText: "Minimal" }).first();
  if (await minimal.count()) {
    await minimal.click();
    await page.waitForTimeout(800);
    await shot(page, "06-minimal-selected.png");
  }
  await page.getByRole("button", { name: /Close/i }).first().click().catch(() => {});
  await page.waitForTimeout(700);
  await openWebsite(page);
  await shot(page, "07-live-preview-minimal.png");

  // Persist reopen
  await openPhotoStyles(page);
  const minCard = page.locator("button").filter({ hasText: "Minimal" }).first();
  results.selectPersist.minimalReload = await minCard.evaluate((el) => {
    const cls = el.className?.toString() || "";
    return { hasRing: /ring/i.test(cls), cls: cls.slice(0, 120) };
  }).catch(() => null);
  await shot(page, "08-minimal-persisted-reopen.png");

  await writeFile(path.join(OUT, "qa-results.json"), JSON.stringify(results, null, 2));
  console.log("qa-results written", JSON.stringify(results, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
