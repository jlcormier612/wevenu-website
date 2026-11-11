/**
 * Phase 11B — live application screenshots (not HTML mockups).
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

const OUT = `${ORIG}/docs/qa/staff-light-canvas/phase11-cohesive-redesign/11b-reports-implementation`;
const EVID = join(OUT, "evidence");
const DESKTOP = "/Users/jensmac/Desktop/htc-phase11b-reports-implementation";
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

const browser = await chromium.launch();
const results: Record<string, unknown>[] = [];

for (const route of routes) {
  for (const vp of [
    { width: 1440, height: 900, tag: "desktop" },
    { width: 390, height: 844, tag: "mobile" },
  ]) {
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
    await page.waitForTimeout(2500);

    const probe = await page.evaluate(`(() => {
      const kpis = Array.from(document.querySelectorAll("[data-report-kpi]")).map((el) => ({
        tone: el.getAttribute("data-tone"),
        label: (el.querySelector(".htc-report-kpi-label, p")?.textContent || "").trim().slice(0, 40),
        bg: getComputedStyle(el).backgroundColor,
      }));
      const tiles = Array.from(document.querySelectorAll("[data-report-metric-tile]")).slice(0, 12).map((el) => ({
        tone: el.getAttribute("data-tone"),
        bg: getComputedStyle(el).backgroundColor,
        text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 48),
      }));
      const outstanding = kpis.find((k) => (k.label || "").toLowerCase().includes("outstanding"));
      const contracted = kpis.find((k) => (k.label || "").toLowerCase().includes("contracted"));
      const collected = kpis.find((k) => /collected/i.test(k.label || ""));
      return {
        h1: document.querySelector("h1")?.textContent?.trim() || null,
        url: location.pathname,
        introAccent: Boolean(document.querySelector(".htc-hospitality-intro-accent")),
        linenFilter: Boolean(document.querySelector(".htc-hospitality-filter")),
        savedShell: Boolean(document.querySelector("[data-report-saved-shell]")),
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
        kpis,
        tiles,
        outstandingBg: outstanding?.bg || null,
        contractedBg: contracted?.bg || null,
        collectedBg: collected?.bg || null,
      };
    })()`);

    const file = `${route.label}-${vp.tag}.png`;
    const path = join(EVID, file);
    await page.screenshot({ path, fullPage: false });
    copyFileSync(path, join(DESKTOP, file));

    // Below-fold metric section for overview/revenue desktop
    if (vp.tag === "desktop" && (route.label === "overview" || route.label === "revenue" || route.label === "sales")) {
      await page.evaluate(`window.scrollBy(0, 520)`);
      await page.waitForTimeout(300);
      const below = `${route.label}-desktop-below.png`;
      const belowPath = join(EVID, below);
      await page.screenshot({ path: belowPath, fullPage: false });
      copyFileSync(belowPath, join(DESKTOP, below));
      results.push({ label: route.label, viewport: "desktop-below", screenshot: belowPath });
    }

    results.push({
      label: route.label,
      viewport: vp.tag,
      status: res?.status() ?? null,
      screenshot: path,
      ...probe,
    });
    await ctx.close();
  }
}

await browser.close();
writeFileSync(join(OUT, "browser-results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map((r) => ({
  label: (r as { label: string }).label,
  vp: (r as { viewport: string }).viewport,
  status: (r as { status?: number }).status,
  intro: (r as { introAccent?: boolean }).introAccent,
  filter: (r as { linenFilter?: boolean }).linenFilter,
  outstandingBg: (r as { outstandingBg?: string }).outstandingBg,
  contractedBg: (r as { contractedBg?: string }).contractedBg,
  collectedBg: (r as { collectedBg?: string }).collectedBg,
  overflowX: (r as { overflowX?: boolean }).overflowX,
  kpiCount: ((r as { kpis?: unknown[] }).kpis || []).length,
})), null, 2));
console.log("Desktop copies →", DESKTOP);
