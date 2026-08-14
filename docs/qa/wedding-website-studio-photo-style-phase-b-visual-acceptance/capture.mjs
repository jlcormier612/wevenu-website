/**
 * Photo Style Composition Phase B — Visual Acceptance capture (read-only).
 * Run: node docs/qa/wedding-website-studio-photo-style-phase-b-visual-acceptance/capture.mjs
 * Zero product mutations beyond selecting Photo Styles in UI for Live Preview fidelity.
 */
import { createRequire } from "node:module";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(__dirname, "../../../marketing/package.json"));
const { chromium } = require("playwright");

const OUT = __dirname;
const PHASE_B = path.resolve(__dirname, "../wedding-website-studio-photo-style-phase-b");
const TOKEN = "seedcoupleportal00000000000000000000000000000001";
const BASE = process.env.PORTAL_BASE ?? "http://localhost:3000";
const PORTAL = `${BASE}/p/${TOKEN}`;

const STYLES = [
  "Editorial", "Magazine", "Film", "Minimal", "Modern",
  "Luxury", "Scrapbook", "Wildflower", "Midnight", "Gallery Wall",
];

/** WP critical pairs for visual acceptance (user ask). */
const PAIRS = [
  ["Editorial", "Luxury", "pair-editorial-luxury"],
  ["Film", "Modern", "pair-film-modern"],
  ["Minimal", "Modern", "pair-minimal-modern"],
  ["Magazine", "Scrapbook", "pair-magazine-scrapbook"],
  ["Scrapbook", "Gallery Wall", "pair-scrapbook-gallery-wall"],
  ["Editorial", "Wildflower", "pair-editorial-wildflower"],
  ["Luxury", "Gallery Wall", "pair-luxury-gallery-wall"],
];

function slug(name) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false });
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

async function openThemeStudioPhotoStyles(page) {
  const label = page.getByText("Photo Style", { exact: true }).first();
  if (await label.count()) {
    await label.scrollIntoViewIfNeeded();
    const card = label.locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
    const change = card.getByText("Change →", { exact: true });
    if (await change.count()) {
      await change.click();
      await page.waitForTimeout(1800);
      return "theme-studio";
    }
  }
  const changeButtons = page.getByRole("button", { name: /Change →|Change/i });
  const n = await changeButtons.count();
  if (n >= 4) {
    await changeButtons.nth(3).click();
    await page.waitForTimeout(1600);
    return "theme-studio";
  }
  return null;
}

async function openWizardPhotoStyles(page) {
  const editButtons = page.getByRole("button", { name: /^Edit$/i });
  const count = await editButtons.count();
  for (let i = 0; i < count; i++) {
    const btn = editButtons.nth(i);
    const near = await btn.evaluate((el) => {
      const text = (el.closest("section,div")?.textContent || "").slice(0, 500);
      return /Photo Style|Selected Design/i.test(text);
    }).catch(() => false);
    if (near) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(1200);
      break;
    }
  }
  // If already in wizard, advance until Photo Style
  for (let i = 0; i < 10; i++) {
    if (await page.getByText("Choose your Photo Style", { exact: false }).count()) return "wizard";
    const next = page.getByRole("button", {
      name: /This is us|Continue|Use this photo|Skip for now|Beautiful|Next|→/i,
    }).first();
    if (await next.count()) await next.click().catch(() => {});
    else {
      const skip = page.getByText(/Skip for now|Continue|Beautiful/i).first();
      if (await skip.count()) await skip.click().catch(() => {});
    }
    await page.waitForTimeout(900);
  }
  return (await page.getByText("Choose your Photo Style", { exact: false }).count())
    ? "wizard"
    : null;
}

async function tallestCard(page, label) {
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
  return { best, bestH };
}

async function cropCard(page, label, outName) {
  const { best, bestH } = await tallestCard(page, label);
  if (best && bestH >= 120) {
    await best.scrollIntoViewIfNeeded();
    await page.waitForTimeout(180);
    await best.screenshot({ path: path.join(OUT, outName) });
    console.log("wrote", outName, `(h=${Math.round(bestH)})`);
    return true;
  }
  console.warn("missing card", label, outName);
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
  if (height > 920 || Math.abs(boxA.y - boxB.y) > 420) {
    await cardA.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await shot(page, `${outName}-a.png`);
    await cardB.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await shot(page, `${outName}-b.png`);
    await page.screenshot({ path: path.join(OUT, `${outName}.png`), fullPage: false });
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
          if (/Editorial|Magazine|Film|Minimal|Modern|Luxury|Scrapbook|Wildflower|Midnight|Gallery Wall|Fashion|Designed|Contact|Sparse|Perfect|Singular|Elegant|Organic|Cinematic|Curated/i.test(p.textContent || "")) {
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

async function selectStyle(page, name) {
  const { best } = await tallestCard(page, name);
  if (!best) return false;
  await best.scrollIntoViewIfNeeded();
  await best.click();
  await page.waitForTimeout(1200);
  return true;
}

async function closePicker(page) {
  const close = page.getByRole("button", { name: /Close/i }).first();
  if (await close.count()) await close.click().catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(800);
}

async function scrollLiveToGallery(page) {
  // Prefer clicking Photo Gallery section card / scrolling preview iframe-like area
  const galleryNav = page.getByText(/Photo Gallery|Our Photos|Gallery/i).first();
  if (await galleryNav.count()) {
    await galleryNav.click().catch(() => {});
    await page.waitForTimeout(900);
  }
  await page.evaluate(() => {
    const preview = [...document.querySelectorAll("div,section,main")].find((el) =>
      /LIVE PREVIEW|Live Preview|yourwedding\.com/i.test(el.textContent || "") && el.scrollHeight > el.clientHeight + 80
    );
    if (preview) {
      // Find gallery section inside preview
      const gallery = [...preview.querySelectorAll("section,div,h2,h3")].find((n) =>
        /Photo|Gallery|Our photos|Memories/i.test(n.textContent || "") && (n.textContent || "").length < 80
      );
      if (gallery) gallery.scrollIntoView({ block: "center" });
      else preview.scrollTop = Math.min(preview.scrollHeight * 0.45, preview.scrollHeight);
    } else {
      window.scrollTo(0, Math.min(document.body.scrollHeight * 0.4, 2400));
    }
  });
  await page.waitForTimeout(700);
}

async function labelMetrics(page, name) {
  const { best } = await tallestCard(page, name);
  if (!best) return null;
  return best.evaluate((el) => {
    const children = [...el.children];
    const specimen = children[0];
    const label = children[1];
    if (!specimen || !label) return { ok: false, reason: "missing regions" };
    const s = specimen.getBoundingClientRect();
    const l = label.getBoundingClientRect();
    const nameEl = label.querySelector("p");
    const descEl = label.querySelectorAll("p")[1];
    const imgs = [...specimen.querySelectorAll("img")].map((img) => ({
      src: (img.currentSrc || img.src || "").slice(0, 120),
      w: Math.round(img.getBoundingClientRect().width),
      h: Math.round(img.getBoundingClientRect().height),
      alt: img.alt || "",
    }));
    return {
      ok: true,
      specimenH: Math.round(s.height),
      labelTop: Math.round(l.top),
      specimenBottom: Math.round(s.bottom),
      gap: Math.round(l.top - s.bottom),
      nameVisible: nameEl ? getComputedStyle(nameEl).visibility !== "hidden" : false,
      nameText: nameEl?.textContent || "",
      descText: descEl?.textContent?.slice(0, 80) || "",
      overflowHidden: getComputedStyle(specimen).overflow === "hidden",
      imgCount: imgs.length,
      imgs,
    };
  });
}

async function copyPhaseBIfMissing(name) {
  try {
    await copyFile(path.join(PHASE_B, name), path.join(OUT, `phase-b-${name}`));
    console.log("copied phase-b", name);
  } catch {
    /* optional */
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const results = {
    commit: "6f6fed5",
    stylesFound: [],
    arrangements: {},
    surfaces: {},
    pairs: {},
    labelClip: { wizard: {}, studio: {} },
    photoContent: {},
    livePreview: {},
    notes: [],
  };

  const catalog = await fetch(`${BASE}/api/portal/website/catalog`).then((r) => r.json());
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

  // ── Theme Studio Photo Styles ────────────────────────────────────────
  await openWebsite(page);
  const studioMode = await openThemeStudioPhotoStyles(page);
  results.surfaces.themeStudio = studioMode;
  if (studioMode) {
    await shot(page, "studio-01-grid-top.png");
    for (const name of STYLES) {
      await cropCard(page, name, `studio-card-${slug(name)}.png`);
      results.labelClip.studio[name] = await labelMetrics(page, name);
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
    await page.evaluate(() => {
      const panel = [...document.querySelectorAll("div")].find(
        (d) => d.scrollHeight > d.clientHeight + 40 && d.clientHeight > 200,
      );
      if (panel) panel.scrollTop = 0;
    });
    await page.waitForTimeout(300);
    await shot(page, "studio-03-grayscale-blind-top.png");
    await page.evaluate(() => {
      const panel = [...document.querySelectorAll("div")].find(
        (d) => d.scrollHeight > d.clientHeight + 40 && d.clientHeight > 200,
      );
      if (panel) panel.scrollTop = panel.scrollHeight;
    });
    await page.waitForTimeout(300);
    await shot(page, "studio-03b-grayscale-blind-bottom.png");
    await clearGrayscale(page);

    for (const [a, b, name] of PAIRS) {
      results.pairs[`studio-${name}`] = await capturePair(page, a, b, `studio-${name}`);
      await applyGrayscale(page, true);
      await capturePair(page, a, b, `studio-${name}-grayscale`);
      await clearGrayscale(page);
    }

    // Photo URL uniqueness across card imgs
    const urls = new Set();
    for (const name of STYLES) {
      const m = results.labelClip.studio[name];
      for (const img of m?.imgs || []) {
        if (img.src) urls.add(img.src.split("?")[0]);
      }
    }
    results.photoContent.studioDistinctSrcs = [...urls];
    results.photoContent.studioDistinctCount = urls.size;
  } else {
    results.notes.push("Theme Studio Photo Style picker failed to open");
  }

  // Live Preview after Gallery Wall select
  if (studioMode && (await selectStyle(page, "Gallery Wall"))) {
    await shot(page, "studio-selected-gallery-wall.png");
    await closePicker(page);
    await openWebsite(page);
    await shot(page, "live-preview-gallery-wall-hero.png");
    await scrollLiveToGallery(page);
    await shot(page, "live-preview-gallery-wall-gallery.png");
    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    results.livePreview.galleryWall = {
      summaryShows: /Photo Style[\s\S]{0,40}Gallery Wall|Gallery Wall/i.test(body),
      hasLivePreview: /LIVE PREVIEW|Live Preview/i.test(body),
    };
  }

  // Live Preview Minimal
  let opened = await openThemeStudioPhotoStyles(page);
  if (opened && (await selectStyle(page, "Minimal"))) {
    await shot(page, "studio-selected-minimal.png");
    await closePicker(page);
    await openWebsite(page);
    await scrollLiveToGallery(page);
    await shot(page, "live-preview-minimal-gallery.png");
    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    results.livePreview.minimal = {
      summaryShows: /Minimal/i.test(body),
    };
  }

  // Luxury select + live gallery
  opened = await openThemeStudioPhotoStyles(page);
  if (opened && (await selectStyle(page, "Luxury"))) {
    await shot(page, "studio-selected-luxury.png");
    await closePicker(page);
    await openWebsite(page);
    await scrollLiveToGallery(page);
    await shot(page, "live-preview-luxury-gallery.png");
  }

  // ── Wizard Photo Styles ──────────────────────────────────────────────
  await closePicker(page);
  await openWebsite(page);
  const wizardMode = await openWizardPhotoStyles(page);
  results.surfaces.wizard = wizardMode;
  if (wizardMode) {
    await shot(page, "wizard-01-grid-top.png");
    for (const name of STYLES) {
      await cropCard(page, name, `wizard-card-${slug(name)}.png`);
      results.labelClip.wizard[name] = await labelMetrics(page, name);
    }
    await page.evaluate(() => {
      const panel = [...document.querySelectorAll("div")].find(
        (d) => d.scrollHeight > d.clientHeight + 40 && d.clientHeight > 200,
      );
      if (panel) panel.scrollTop = panel.scrollHeight;
      else window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(400);
    await shot(page, "wizard-02-grid-bottom.png");

    await applyGrayscale(page, true);
    await page.evaluate(() => {
      const panel = [...document.querySelectorAll("div")].find(
        (d) => d.scrollHeight > d.clientHeight + 40 && d.clientHeight > 200,
      );
      if (panel) panel.scrollTop = 0;
      else window.scrollTo(0, 0);
    });
    await page.waitForTimeout(300);
    await shot(page, "wizard-03-grayscale-blind-top.png");
    await clearGrayscale(page);

    for (const [a, b, name] of PAIRS) {
      results.pairs[`wizard-${name}`] = await capturePair(page, a, b, `wizard-${name}`);
      await applyGrayscale(page, true);
      await capturePair(page, a, b, `wizard-${name}-grayscale`);
      await clearGrayscale(page);
    }

    const wurls = new Set();
    for (const name of STYLES) {
      const m = results.labelClip.wizard[name];
      for (const img of m?.imgs || []) {
        if (img.src) wurls.add(img.src.split("?")[0]);
      }
    }
    results.photoContent.wizardDistinctSrcs = [...wurls];
    results.photoContent.wizardDistinctCount = wurls.size;
  } else {
    results.notes.push("Wizard Photo Style step failed to open");
  }

  // Optional Phase B reference copies for audit trail
  for (const f of [
    "card-editorial.png", "card-luxury.png", "card-magazine.png", "card-scrapbook.png",
    "card-gallery-wall.png", "card-film.png", "card-modern.png", "card-minimal.png",
    "card-wildflower.png", "card-midnight.png",
    "pair-editorial-luxury.png", "pair-film-modern.png", "pair-scrapbook-gallery-wall.png",
  ]) {
    await copyPhaseBIfMissing(f);
  }

  await writeFile(path.join(OUT, "qa-results.json"), JSON.stringify(results, null, 2));
  console.log("qa-results written");
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
