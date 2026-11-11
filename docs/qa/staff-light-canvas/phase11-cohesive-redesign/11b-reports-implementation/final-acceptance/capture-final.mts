/**
 * Phase 11B final visual acceptance — live local screenshots (not mockups).
 * Captures all six Reports views at desktop + mobile 390/375, plus tab-edge probes.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const ORIG = "/Users/jensmac/Developer/wevenu-website";
config({ path: `${ORIG}/.env.local`, quiet: true });
const require = createRequire(`${ORIG}/marketing/package.json`);
const { chromium } = require("playwright");
const ssr = require(`${ORIG}/node_modules/@supabase/ssr/dist/main/utils/index.js`);

const OUT = `${ORIG}/docs/qa/staff-light-canvas/phase11-cohesive-redesign/11b-reports-implementation/final-acceptance`;
const EVID = join(OUT, "evidence");
const DESKTOP = "/Users/jensmac/Desktop/htc-phase11b-reports-final-acceptance";
mkdirSync(EVID, { recursive: true });
mkdirSync(DESKTOP, { recursive: true });

const APP = process.env.HTC_CAPTURE_BASE ?? "http://127.0.0.1:3000";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});
const { data: link } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: "jennifer@hellotocheers.com",
});
const { data: otp } = await anon.auth.verifyOtp({
  type: "email",
  token_hash: link!.properties!.hashed_token!,
});
const base = {
  domain: new URL(APP).hostname,
  path: "/",
  httpOnly: false,
  secure: APP.startsWith("https"),
  sameSite: "Lax" as const,
};
const cookies = [
  ...ssr
    .createChunks(
      "sb-wvpsldwwjqdannqasrdf-auth-token",
      "base64-" + ssr.stringToBase64URL(JSON.stringify(otp!.session)),
    )
    .map((c: { name: string; value: string }) => ({ ...base, ...c })),
  { ...base, name: "htc_active_venue_id", value: FANCY },
];

const routes = [
  { label: "overview", path: "/reporting" },
  { label: "sales", path: "/reporting/sales" },
  { label: "bookings", path: "/reporting/bookings" },
  { label: "revenue", path: "/reporting/revenue" },
  { label: "events", path: "/reporting/events" },
  { label: "saved", path: "/reporting/saved" },
];

const viewports = [
  { width: 1440, height: 900, tag: "desktop" },
  { width: 390, height: 844, tag: "mobile-390" },
  { width: 375, height: 812, tag: "mobile-375" },
];

const browser = await chromium.launch();
const results: Record<string, unknown>[] = [];

async function probeTabs(page: import("playwright").Page) {
  return page.evaluate(`(() => {
    const scroller = document.querySelector('[data-htc-report-tabs="scroller"]');
    const active = document.querySelector('[data-report-tab-active="true"]');
    const leftEdge = document.querySelector('[data-htc-report-tabs-edge="left"]');
    const rightEdge = document.querySelector('[data-htc-report-tabs-edge="right"]');
    const leftFade = document.querySelector('[data-htc-report-tabs-fade="left"]');
    const rightFade = document.querySelector('[data-htc-report-tabs-fade="right"]');
    const ar = active?.getBoundingClientRect();
    const sr = scroller?.getBoundingClientRect();
    const activeFullyVisible = !!(ar && sr && ar.left >= sr.left - 1 && ar.right <= sr.right + 1);
    const kpiHeights = Array.from(document.querySelectorAll("[data-report-kpi]")).map((el) => {
      const r = el.getBoundingClientRect();
      const value = el.querySelector(".htc-report-kpi-value");
      const vs = value ? getComputedStyle(value) : null;
      return {
        h: Math.round(r.height),
        tone: el.getAttribute("data-tone"),
        valueFs: vs?.fontSize || null,
        valueText: (value?.textContent || "").trim().slice(0, 32),
      };
    });
    return {
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      scrollLeft: scroller ? Math.round(scroller.scrollLeft) : null,
      scrollWidth: scroller ? scroller.scrollWidth : null,
      clientWidth: scroller ? scroller.clientWidth : null,
      canScrollLeft: leftEdge?.getAttribute("data-htc-report-tabs-edge-active") === "true",
      canScrollRight: rightEdge?.getAttribute("data-htc-report-tabs-edge-active") === "true",
      leftFade: Boolean(leftFade),
      rightFade: Boolean(rightFade),
      activeTab: active?.getAttribute("data-report-tab") || null,
      activeFullyVisible,
      leftChevron: Boolean(document.querySelector('[aria-label="Show previous report tabs"]')),
      rightChevron: Boolean(document.querySelector('[aria-label="Show more report tabs"]')),
      kpiHeights,
      savedShell: Boolean(document.querySelector("[data-report-saved-shell]")),
      introAccent: Boolean(document.querySelector(".htc-hospitality-intro-accent")),
      linenFilter: Boolean(document.querySelector(".htc-hospitality-filter")),
    };
  })()`);
}

for (const route of routes) {
  for (const vp of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    await ctx.addCookies(cookies);
    await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
    const page = await ctx.newPage();
    const res = await page.goto(`${APP}${route.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(2800);

    const tabProbe = await probeTabs(page);

    const file = `${route.label}-${vp.tag}.png`;
    const path = join(EVID, file);
    await page.screenshot({ path, fullPage: false });
    copyFileSync(path, join(DESKTOP, file));

    results.push({
      label: route.label,
      viewport: vp.tag,
      status: res?.status() ?? null,
      screenshot: path,
      ...tabProbe,
    });

    // Mobile tab interaction probes on Revenue (middle) and Overview/Saved (ends)
    if (vp.tag === "mobile-390" && (route.label === "revenue" || route.label === "sales" || route.label === "events")) {
      const before = await probeTabs(page);
      const rightBtn = page.locator('[aria-label="Show more report tabs"]');
      if (await rightBtn.count()) {
        await rightBtn.click();
        await page.waitForTimeout(500);
      }
      const afterRight = await probeTabs(page);
      const leftBtn = page.locator('[aria-label="Show previous report tabs"]');
      if (await leftBtn.count()) {
        await leftBtn.click();
        await page.waitForTimeout(500);
      }
      const afterLeft = await probeTabs(page);
      const navFile = `${route.label}-mobile-390-tabs-after-arrows.png`;
      const navPath = join(EVID, navFile);
      await page.screenshot({ path: navPath, fullPage: false });
      copyFileSync(navPath, join(DESKTOP, navFile));
      results.push({
        label: route.label,
        viewport: "mobile-390-tab-nav",
        screenshot: navPath,
        before,
        afterRight,
        afterLeft,
      });
    }

    if (vp.tag === "desktop" && (route.label === "overview" || route.label === "revenue" || route.label === "sales")) {
      await page.evaluate(`window.scrollBy(0, 520)`);
      await page.waitForTimeout(300);
      const below = `${route.label}-desktop-below.png`;
      const belowPath = join(EVID, below);
      await page.screenshot({ path: belowPath, fullPage: false });
      copyFileSync(belowPath, join(DESKTOP, below));
      results.push({ label: route.label, viewport: "desktop-below", screenshot: belowPath });
    }

    await ctx.close();
  }
}

await browser.close();
writeFileSync(join(OUT, "browser-results.json"), JSON.stringify(results, null, 2));

const summary = results
  .filter((r) => typeof (r as { status?: number }).status === "number" || (r as { viewport?: string }).viewport?.startsWith("mobile"))
  .map((r) => ({
    label: (r as { label: string }).label,
    vp: (r as { viewport: string }).viewport,
    status: (r as { status?: number }).status,
    overflowX: (r as { overflowX?: boolean }).overflowX,
    activeTab: (r as { activeTab?: string }).activeTab,
    activeFullyVisible: (r as { activeFullyVisible?: boolean }).activeFullyVisible,
    leftFade: (r as { leftFade?: boolean }).leftFade,
    rightFade: (r as { rightFade?: boolean }).rightFade,
    leftChevron: (r as { leftChevron?: boolean }).leftChevron,
    rightChevron: (r as { rightChevron?: boolean }).rightChevron,
    kpiCount: ((r as { kpiHeights?: unknown[] }).kpiHeights || []).length,
    maxKpiH: Math.max(0, ...(((r as { kpiHeights?: { h: number }[] }).kpiHeights || []).map((k) => k.h))),
    valueFs: ((r as { kpiHeights?: { valueFs?: string }[] }).kpiHeights || [])[0]?.valueFs,
  }));

console.log(JSON.stringify(summary, null, 2));
console.log("Desktop copies →", DESKTOP);
