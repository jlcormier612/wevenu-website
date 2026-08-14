/**
 * Collection Composition Phase B — Visual Acceptance capture (read-only).
 * Run: node docs/qa/wedding-website-studio-collection-phase-b-visual-acceptance/capture.mjs
 * Zero product mutations beyond selecting Collections in UI to verify Live Preview.
 */
import { createRequire } from "node:module";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(__dirname, "../../../marketing/package.json"));
const { chromium } = require("playwright");

const OUT = __dirname;
const PHASE_B = path.resolve(__dirname, "../wedding-website-studio-collection-phase-b");
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
  ["Coastal", "Midnight", "pair-coastal-midnight"],
  ["Linen", "Rosé", "pair-linen-rose"],
];

function slug(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/é/g, "e");
}

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
  await page.waitForTimeout(1800);
  await dismissOverlays(page);
}

async function openThemeStudioCollections(page) {
  const layoutLabel = page.getByText("Layout Collection", { exact: true }).first();
  if (await layoutLabel.count()) {
    await layoutLabel.scrollIntoViewIfNeeded();
    const card = layoutLabel.locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
    const change = card.getByText("Change →", { exact: true });
    if (await change.count()) {
      await change.click();
      await page.waitForTimeout(1800);
      return "theme-studio";
    }
  }
  return null;
}

async function openWizardCollections(page) {
  // Selected Design Summary "Edit" reopens wizard Collection step.
  const editButtons = page.getByRole("button", { name: /^Edit$/i });
  const count = await editButtons.count();
  for (let i = 0; i < count; i++) {
    const btn = editButtons.nth(i);
    const near = await btn.evaluate((el) => {
      const text = (el.closest("section,div")?.textContent || "").slice(0, 400);
      return /Collection|Selected Design|Layout/i.test(text);
    }).catch(() => false);
    if (near || i === 0) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(1200);
      break;
    }
  }
  // Advance wizard until Collection step
  for (let i = 0; i < 6; i++) {
    if (await page.getByText("Choose your Collection", { exact: false }).count()) return "wizard";
    const next = page.getByRole("button", {
      name: /This is us|Continue|Use this photo|Skip for now|Next|→/i,
    }).first();
    if (await next.count()) await next.click().catch(() => {});
    else {
      // click any primary-looking skip / continue
      const skip = page.getByText(/Skip for now|Continue/i).first();
      if (await skip.count()) await skip.click().catch(() => {});
    }
    await page.waitForTimeout(900);
  }
  return (await page.getByText("Choose your Collection", { exact: false }).count())
    ? "wizard"
    : null;
}

async function cropCardNearLabel(page, label, outName) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const candidates = page.locator("button").filter({ hasText: new RegExp(`^${escaped}`) });
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
  if (best && bestH >= 120) {
    await best.scrollIntoViewIfNeeded();
    await best.screenshot({ path: path.join(OUT, outName) });
    console.log("wrote", outName, `(h=${Math.round(bestH)})`);
    return true;
  }
  const el = page.getByText(label, { exact: true }).first();
  if (!(await el.count())) {
    console.warn("missing card", label, outName);
    return false;
  }
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
  if (!(await elA.count()) || !(await elB.count())) {
    console.warn("pair missing", a, b);
    return false;
  }
  await elA.scrollIntoViewIfNeeded().catch(() => {});
  await elB.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(350);
  const cardA = elA.locator("xpath=ancestor::button[1]");
  const cardB = elB.locator("xpath=ancestor::button[1]");
  let boxA = (await cardA.count()) ? await cardA.boundingBox().catch(() => null) : null;
  let boxB = (await cardB.count()) ? await cardB.boundingBox().catch(() => null) : null;
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
  // If cards are far apart vertically, capture two sequential scrolls combined by full viewport
  if (height > 920 || Math.abs(boxA.y - boxB.y) > 420) {
    await elA.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await shot(page, `${outName}-a.png`);
    await elB.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await shot(page, `${outName}-b.png`);
    // Also try a grayscale composite of page mid-scroll
    await page.screenshot({
      path: path.join(OUT, `${outName}.png`),
      fullPage: false,
    });
    console.log("wrote", `${outName}.png`, "(viewport; cards distant)");
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

async function applyGrayscale(page, hideNames = true) {
  await page.addStyleTag({ content: `html { filter: grayscale(1) !important; }` });
  if (hideNames) {
    await page.evaluate(() => {
      document.querySelectorAll("button").forEach((btn) => {
        [...btn.querySelectorAll("p")].forEach((p) => {
          if (/Wildflower|Midnight|Garden Party|Linen|Rosé|Rose|Champagne|Velvet|Coastal|European Estate|Rustic|Industrial|Organic|Moody|Charming|Quiet|Romantic|Airy|Elegant|Dramatic|Warm|Bold|English|formal|weathered/i.test(p.textContent || "")) {
            p.style.visibility = "hidden";
          }
        });
      });
    });
  }
}

async function clearGrayscale(page) {
  await page.evaluate(() => {
    document.querySelectorAll("p").forEach((p) => { p.style.visibility = ""; });
    document.documentElement.style.filter = "";
    document.querySelectorAll("style").forEach((s) => {
      if ((s.textContent || "").includes("grayscale(1)")) s.remove();
    });
  });
}

async function selectCollection(page, name) {
  const btn = page.locator("button").filter({ hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).first();
  if (!(await btn.count())) {
    const el = page.getByText(name, { exact: true }).first();
    if (await el.count()) await el.click();
    else return false;
  } else {
    await btn.click();
  }
  await page.waitForTimeout(1400);
  return true;
}

async function closePicker(page) {
  const close = page.getByRole("button", { name: /Close/i }).first();
  if (await close.count()) await close.click().catch(() => {});
  // Wizard footer: This is us advances; or Escape
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(700);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const results = {
    catalogCollections: [],
    industrialActive: false,
    surfaces: {},
    pairs: {},
    livePreview: {},
    notes: [],
  };

  const catalog = await fetch(`${BASE}/api/portal/website/catalog`).then((r) => r.json());
  results.catalogCollections = (catalog.collections || []).map((c) => c.name);
  results.industrialActive = results.catalogCollections.includes("Industrial");
  results.layoutDna = (catalog.collections || []).map((c) => {
    const lc = c.layoutConfig || c.layout_config || {};
    return {
      name: c.name,
      key: c.key,
      heroType: lc.heroType,
      heroAlign: lc.heroAlign,
      heroAspectCap: lc.heroAspectCap,
      story: (lc.sectionRoles || {}).story,
      headerStyle: lc.headerStyle,
      storyStyle: lc.storyStyle,
      divider: lc.divider,
      inset: {
        pad: lc.heroInsetPadding,
        radius: lc.heroInsetRadius,
        border: lc.heroInsetBorderWidth,
        ox: lc.heroInsetOffsetX,
        oy: lc.heroInsetOffsetY,
      },
    };
  });

  const chromePath =
    process.env.PLAYWRIGHT_CHROME ||
    `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();
  page.setDefaultTimeout(55000);

  // ── Theme Studio surface ─────────────────────────────────────────────
  await openWebsite(page);
  const studioMode = await openThemeStudioCollections(page);
  results.surfaces.themeStudio = studioMode;
  if (studioMode) {
    await shot(page, "studio-01-grid-top.png");
    for (const name of COLLECTIONS) {
      await cropCardNearLabel(page, name, `studio-card-${slug(name)}.png`);
    }
    await page.evaluate(() => {
      const panel = [...document.querySelectorAll("div")].find(
        (d) => d.scrollHeight > d.clientHeight + 40 && d.clientHeight > 200,
      );
      if (panel) panel.scrollTop = panel.scrollHeight;
    });
    await page.waitForTimeout(400);
    await shot(page, "studio-02-grid-bottom.png");

    await applyGrayscale(page, true);
    await shot(page, "studio-03-grayscale-blind.png");
    // scroll mid for more cards
    await page.evaluate(() => {
      const panel = [...document.querySelectorAll("div")].find(
        (d) => d.scrollHeight > d.clientHeight + 40 && d.clientHeight > 200,
      );
      if (panel) panel.scrollTop = 0;
    });
    await page.waitForTimeout(300);
    await shot(page, "studio-03b-grayscale-top.png");
    await clearGrayscale(page);

    for (const [a, b, name] of PAIRS) {
      await page.getByText(a, { exact: true }).first().scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(150);
      await page.getByText(b, { exact: true }).first().scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(150);
      results.pairs[name] = await capturePair(page, a, b, name);
      // grayscale pair
      await applyGrayscale(page, true);
      await capturePair(page, a, b, `${name}-grayscale`);
      await clearGrayscale(page);
    }
  } else {
    results.notes.push("Theme Studio collections picker failed to open");
  }

  // Reuse Phase B Coastal/Estate live shots if needed; also capture fresh live preview
  await closePicker(page);
  await openWebsite(page);

  // Live Preview fidelity: select Coastal → close → Live Preview
  let opened = await openThemeStudioCollections(page);
  if (opened && (await selectCollection(page, "Coastal"))) {
    await shot(page, "studio-selected-coastal.png");
    await closePicker(page);
    await openWebsite(page);
    await shot(page, "live-preview-coastal.png");
    results.livePreview.coastal = true;
  }

  opened = await openThemeStudioCollections(page);
  if (opened && (await selectCollection(page, "European Estate"))) {
    await shot(page, "studio-selected-estate.png");
    await closePicker(page);
    await openWebsite(page);
    await shot(page, "live-preview-estate.png");
    results.livePreview.estate = true;
  }

  opened = await openThemeStudioCollections(page);
  if (opened && (await selectCollection(page, "Midnight"))) {
    await shot(page, "studio-selected-midnight.png");
    await closePicker(page);
    await openWebsite(page);
    await shot(page, "live-preview-midnight.png");
    results.livePreview.midnight = true;
  }

  opened = await openThemeStudioCollections(page);
  if (opened && (await selectCollection(page, "Rustic"))) {
    await shot(page, "studio-selected-rustic.png");
    await closePicker(page);
    await openWebsite(page);
    await shot(page, "live-preview-rustic.png");
    results.livePreview.rustic = true;
  }

  // ── Wizard surface ───────────────────────────────────────────────────
  await openWebsite(page);
  const wizardMode = await openWizardCollections(page);
  results.surfaces.wizard = wizardMode;
  if (wizardMode) {
    await shot(page, "wizard-01-grid-top.png");
    for (const name of COLLECTIONS) {
      await cropCardNearLabel(page, name, `wizard-card-${slug(name)}.png`);
    }
    await page.evaluate(() => {
      const panel = [...document.querySelectorAll("div")].find(
        (d) => d.scrollHeight > d.clientHeight + 40 && d.clientHeight > 200,
      );
      if (panel) panel.scrollTop = panel.scrollHeight;
    });
    await page.waitForTimeout(400);
    await shot(page, "wizard-02-grid-bottom.png");
    await applyGrayscale(page, true);
    await shot(page, "wizard-03-grayscale-blind.png");
    await clearGrayscale(page);
  } else {
    results.notes.push("Wizard Collection step failed to open — check Edit path");
    // Copy studio cards as reference only annotated in QA
  }

  // Copy phase-b grayscale/pairs as supplemental if missing
  try {
    await copyFile(
      path.join(PHASE_B, "03-collections-grayscale-blind.png"),
      path.join(OUT, "phase-b-ref-grayscale-blind.png"),
    );
  } catch {
    /* optional */
  }

  await writeFile(path.join(OUT, "qa-results.json"), JSON.stringify(results, null, 2));
  console.log("qa-results written", JSON.stringify(results, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
