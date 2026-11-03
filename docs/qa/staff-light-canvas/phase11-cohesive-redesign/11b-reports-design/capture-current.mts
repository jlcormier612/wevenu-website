/**
 * Phase 11B — current-state screenshots for all reporting views.
 * Read-only. No app mutations beyond auth OTP.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const ORIG = "/Users/jensmac/Developer/wevenu-website";
config({ path: `${ORIG}/.env.local`, quiet: true });
const require = createRequire(`${ORIG}/marketing/package.json`);
const { chromium } = require("playwright");
const ssr = require(`${ORIG}/node_modules/@supabase/ssr/dist/main/utils/index.js`);

const OUT = `${ORIG}/docs/qa/staff-light-canvas/phase11-cohesive-redesign/11b-reports-design`;
const EVID = join(OUT, "evidence/current");
mkdirSync(EVID, { recursive: true });

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
  { label: "dashboard", path: "/dashboard" },
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
    await page.waitForTimeout(2200);
    const probe = await page.evaluate(`(() => {
      const cards = document.querySelectorAll('[data-slot="card"]');
      const comparison = Array.from(document.querySelectorAll('[data-slot="card"]')).slice(0, 12).map((el) => ({
        text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80),
        bg: getComputedStyle(el).backgroundColor,
      }));
      return {
        h1: document.querySelector("h1")?.textContent?.trim() || null,
        url: location.pathname,
        introAccent: Boolean(document.querySelector(".htc-hospitality-intro-accent")),
        linenFilter: Boolean(document.querySelector(".htc-hospitality-filter")),
        cardCount: cards.length,
        comparisonSample: comparison,
        tabs: Array.from(document.querySelectorAll('[data-htc-report-tabs] a, nav a')).slice(0, 8).map((a) => (a.textContent || "").trim()),
      };
    })()`);
    const file = join(EVID, `${route.label}-${vp.tag}.png`);
    await page.screenshot({ path: file, fullPage: false });
    results.push({ ...route, viewport: vp.tag, status: res?.status() ?? null, ...probe, screenshot: file });
    await ctx.close();
  }
}

await browser.close();
writeFileSync(join(OUT, "browser-results-current.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map((r) => ({
  label: (r as { label: string }).label,
  vp: (r as { viewport: string }).viewport,
  status: (r as { status: number }).status,
  h1: (r as { h1: string }).h1,
  cards: (r as { cardCount: number }).cardCount,
  intro: (r as { introAccent: boolean }).introAccent,
  filter: (r as { linenFilter: boolean }).linenFilter,
})), null, 2));
