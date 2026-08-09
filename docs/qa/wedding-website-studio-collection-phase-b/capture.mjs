/**
 * Collection Composition Phase B — structural QA screenshots.
 * Run: node docs/qa/wedding-website-studio-collection-phase-b/capture.mjs
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

const PAIRS = [
  ["Midnight", "Velvet", "pair-midnight-velvet"],
  ["Champagne", "European Estate", "pair-champagne-estate"],
  ["Champagne", "Rustic", "pair-champagne-rustic"],
  ["European Estate", "Rustic", "pair-estate-rustic"],
  ["Wildflower", "Garden Party", "pair-wildflower-garden"],
  ["Linen", "Rosé", "pair-linen-rose"],
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

async function openCollections(page) {
  // Prefer Theme Studio Layout Collection picker (Change →) so we get the
  // 2-col CollectionPreview grid used for structural card comparison.
  const layoutLabel = page.getByText("Layout Collection", { exact: true }).first();
  if (await layoutLabel.count()) {
    await layoutLabel.scrollIntoViewIfNeeded();
    const card = layoutLabel.locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
    const change = card.getByText("Change →", { exact: true });
    if (await change.count()) {
      await change.click();
      await page.waitForTimeout(1600);
      // Confirm a full-size preview card is visible (taller than carousel strip).
      if (await page.getByText("Choose a collection", { exact: false }).count() === 0) {
        // DimensionCard children are open when Close is shown.
      }
      return;
    }
  }
  // Fallback: Selected Design Summary "Edit" reopens wizard Collection step.
  const editButtons = page.getByRole("button", { name: /^Edit$/i });
  if (await editButtons.count()) {
    await editButtons.first().click();
    await page.waitForTimeout(1200);
    // Wizard may land on welcome — advance to collection if needed.
    const next = page.getByRole("button", { name: /This is us|Continue|Use this photo|Skip for now|→/i }).first();
    for (let i = 0; i < 4; i++) {
      if (await page.getByText("Choose your Collection", { exact: false }).count()) break;
      if (await next.count()) await next.click().catch(() => {});
      await page.waitForTimeout(800);
    }
  }
}

async function cropCardNearLabel(page, label, outName) {
  // Prefer Theme Studio grid cards (taller) over carousel strips/collapsed chips.
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
  if (best && bestH >= 140) {
    await best.scrollIntoViewIfNeeded();
    await best.screenshot({ path: path.join(OUT, outName) });
    console.log("wrote", outName, `(h=${Math.round(bestH)})`);
    return true;
  }
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

async function capturePair(page, a, b, outName) {
  const elA = page.getByText(a, { exact: true }).first();
  const elB = page.getByText(b, { exact: true }).first();
  if (!(await elA.count()) || !(await elB.count())) return false;
  await elA.scrollIntoViewIfNeeded().catch(() => {});
  await elB.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
  const cardA = elA.locator("xpath=ancestor::button[1]");
  const cardB = elB.locator("xpath=ancestor::button[1]");
  let boxA = null;
  let boxB = null;
  try {
    if (await cardA.count()) boxA = await cardA.boundingBox({ timeout: 4000 });
    if (await cardB.count()) boxB = await cardB.boundingBox({ timeout: 4000 });
  } catch {
    boxA = null;
    boxB = null;
  }
  if (!boxA) boxA = await elA.boundingBox().catch(() => null);
  if (!boxB) boxB = await elB.boundingBox().catch(() => null);
  if (!boxA || !boxB) {
    await shot(page, `${outName}.png`);
    return true;
  }
  const x = Math.min(boxA.x, boxB.x) - 8;
  const y = Math.min(boxA.y, boxB.y) - 8;
  const width = Math.max(boxA.x + boxA.width, boxB.x + boxB.width) - x + 8;
  const height = Math.max(boxA.y + boxA.height, boxB.y + boxB.height) - y + 8;
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
    catalogCollections: [],
    industrialActive: false,
    pairs: {},
    notes: [],
  };

  const catalog = await fetch(`${BASE}/api/portal/website/catalog`).then(r => r.json());
  results.catalogCollections = (catalog.collections || []).map(c => c.name);
  results.industrialActive = results.catalogCollections.includes("Industrial");
  results.notes.push(`Active collections: ${results.catalogCollections.length}`);

  const chromePath =
    process.env.PLAYWRIGHT_CHROME ||
    `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();
  page.setDefaultTimeout(55000);

  await openWebsite(page);
  await openCollections(page);
  await shot(page, "01-collections-grid-top.png");

  for (const name of COLLECTIONS) {
    const el = page.getByText(name, { exact: true }).first();
    if (await el.count()) {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(180);
      await cropCardNearLabel(page, name, `card-${name.toLowerCase().replace(/\s+/g, "-").replace(/é/g, "e")}.png`);
    }
  }

  await page.evaluate(() => {
    const panel = [...document.querySelectorAll("div")].find(d => d.scrollHeight > d.clientHeight + 40 && d.clientHeight > 200);
    if (panel) panel.scrollTop = panel.scrollHeight;
  });
  await page.waitForTimeout(400);
  await shot(page, "02-collections-grid-bottom.png");

  // Grayscale blind structural grid
  await page.addStyleTag({
    content: `html { filter: grayscale(1) !important; }`,
  });
  await page.evaluate(() => {
    document.querySelectorAll("button").forEach(btn => {
      [...btn.querySelectorAll("p")].forEach(p => {
        if (/Wildflower|Midnight|Garden Party|Linen|Rosé|Rose|Champagne|Velvet|Coastal|European Estate|Rustic|Industrial|Organic|Moody|Charming|Quiet|Romantic|Airy|Elegant|Dramatic|Warm|Bold|English|formal|weathered/i.test(p.textContent || "")) {
          p.style.visibility = "hidden";
        }
      });
    });
  });
  await shot(page, "03-collections-grayscale-blind.png");
  await page.evaluate(() => {
    document.querySelectorAll("p").forEach(p => { p.style.visibility = ""; });
    document.documentElement.style.filter = "";
  });
  // Reload collections cleanly for pairs
  await page.getByRole("button", { name: /Close/i }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  await openWebsite(page);
  await openCollections(page);

  for (const [a, b, name] of PAIRS) {
    // Ensure both cards in view as much as possible
    await page.getByText(a, { exact: true }).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(200);
    await page.getByText(b, { exact: true }).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(200);
    results.pairs[name] = await capturePair(page, a, b, name);
  }

  // Selection + Live Preview identity: Coastal (wide DNA)
  const coastal = page.getByText("Coastal", { exact: true }).first();
  if (await coastal.count()) {
    await coastal.click();
    await page.waitForTimeout(1200);
    await shot(page, "04-coastal-selected.png");
  }
  await page.getByRole("button", { name: /Close/i }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  await openWebsite(page);
  await shot(page, "05-live-preview-coastal.png");

  // Estate selection for inset identity
  await openCollections(page);
  const estate = page.getByText("European Estate", { exact: true }).first();
  if (await estate.count()) {
    await estate.click();
    await page.waitForTimeout(1200);
    await shot(page, "06-estate-selected.png");
  }
  await page.getByRole("button", { name: /Close/i }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  await openWebsite(page);
  await shot(page, "07-live-preview-estate.png");

  await writeFile(path.join(OUT, "qa-results.json"), JSON.stringify(results, null, 2));
  console.log("qa-results written", results);
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
