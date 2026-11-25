#!/usr/bin/env node
/**
 * Permanent marketing image-decode acceptance.
 *
 * Visits every public sitemap path, scrolls to trigger lazy loads, and asserts
 * every <img> decodes (naturalWidth/naturalHeight > 0). HTTP 200 alone fails
 * this gate — empty frames from hung /_next/image responses are caught.
 *
 * Usage:
 *   node marketing/scripts/image-decode-acceptance.mjs
 *   BASE_URL=https://hellotocheers.com node marketing/scripts/image-decode-acceptance.mjs
 *   OUT_JSON=/tmp/decode.json node marketing/scripts/image-decode-acceptance.mjs
 *
 * Requires Playwright + Chrome channel (same as other HTC browser acceptance).
 */

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BASE = (process.env.BASE_URL || "https://hellotocheers.com").replace(
  /\/$/,
  "",
);
const OUT_JSON = process.env.OUT_JSON || "";

/** Must stay aligned with marketing/app/sitemap.ts PUBLIC_PATHS. */
const PUBLIC_PATHS = [
  "/",
  "/our-story",
  "/product",
  "/features",
  "/getting-started",
  "/pricing",
  "/trust",
  "/walkthrough",
  "/contact",
  "/welcome-back",
  "/support",
  "/sms-opt-in",
  "/privacy",
  "/terms",
  "/end-user-terms",
  "/vendor-terms",
  "/cookie-policy",
  "/cookies",
  "/acceptable-use",
];

const VIEWPORTS = [
  {
    id: "desktop-dpr2",
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  },
  {
    id: "mobile-dpr3",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
];

async function dismissConsent(page) {
  try {
    const btn = page.getByRole("button", { name: "Essential only" });
    if (await btn.isVisible({ timeout: 1500 })) await btn.click();
  } catch {
    // already chosen or banner absent
  }
}

async function scrollFullPage(page) {
  await page.evaluate(async () => {
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const h = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
    );
    for (let y = 0; y < h; y += 500) {
      window.scrollTo(0, y);
      await delay(180);
    }
    window.scrollTo(0, h);
    await delay(600);
    window.scrollTo(0, 0);
    await delay(300);
  });
}

async function collectImages(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("img")]
      .map((img) => {
        const src = img.currentSrc || img.src || "";
        return {
          alt: (img.alt || "").slice(0, 160),
          src: src.slice(0, 280),
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          clientWidth: img.clientWidth,
          clientHeight: img.clientHeight,
        };
      })
      .filter(
        (i) =>
          i.src &&
          !i.src.startsWith("data:") &&
          !/google|gtag|facebook|doubleclick/i.test(i.src),
      ),
  );
}

async function auditViewport(browser, vp) {
  const context = await browser.newContext({
    viewport: vp.viewport,
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: !!vp.isMobile,
    hasTouch: !!vp.hasTouch,
  });
  const page = await context.newPage();
  const pages = [];
  const broken = [];

  for (const route of PUBLIC_PATHS) {
    const url = `${BASE}${route === "/" ? "/" : route}`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    } catch (e) {
      pages.push({ route, error: String(e) });
      broken.push({ route, error: String(e) });
      continue;
    }
    await dismissConsent(page);
    await scrollFullPage(page);
    await page.waitForTimeout(2000);

    const imgs = await collectImages(page);
    const fails = imgs.filter(
      (i) => !(i.naturalWidth > 0 && i.naturalHeight > 0),
    );
    pages.push({
      route,
      total: imgs.length,
      ok: imgs.length - fails.length,
      broken: fails.length,
      brokenImgs: fails,
    });
    for (const f of fails) broken.push({ route, ...f });
    const mark = fails.length ? "FAIL" : "ok";
    console.log(
      `[${vp.id}] ${route}: ${mark} (ok=${imgs.length - fails.length} broken=${fails.length})`,
    );
  }

  await context.close();
  return { viewport: vp.id, pages, broken };
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const report = {
    base: BASE,
    scannedAt: new Date().toISOString(),
    viewports: [],
  };

  try {
    for (const vp of VIEWPORTS) {
      report.viewports.push(await auditViewport(browser, vp));
    }
  } finally {
    await browser.close();
  }

  const allBroken = report.viewports.flatMap((v) =>
    v.broken.map((b) => ({ viewport: v.viewport, ...b })),
  );
  report.totalBroken = allBroken.length;
  report.broken = allBroken;

  if (OUT_JSON) {
    mkdirSync(dirname(OUT_JSON), { recursive: true });
    writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
    console.log(`wrote ${OUT_JSON}`);
  }

  if (allBroken.length) {
    console.error("\nIMAGE DECODE ACCEPTANCE FAILED");
    console.error(JSON.stringify(allBroken, null, 2));
    process.exit(1);
  }
  console.log("\nIMAGE DECODE ACCEPTANCE PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
