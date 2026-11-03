/**
 * Phase 11 discovery — current-state screenshots only.
 * Local dirty tree (includes Phase 10). No DB writes beyond auth OTP. No app edits.
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

const OUT = `${ORIG}/docs/qa/staff-light-canvas/phase11-cohesive-redesign/discovery`;
const EVID = join(OUT, "evidence");
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
  { label: "calendar", path: "/calendar" },
  { label: "reporting", path: "/reporting" },
  { label: "tours", path: "/tours" },
  { label: "requests", path: "/requests" },
  { label: "automations", path: "/communication/series" },
  { label: "setup-hub", path: "/setup-hub" },
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
      timeout: 90000,
    });
    await page.waitForTimeout(2000);
    const probe = await page.evaluate(`(() => {
      const main = document.querySelector("main[data-workspace-main]") || document.querySelector("main");
      const cards = document.querySelectorAll("[data-slot='card'], .rounded-md.border, .htc-hospitality-intro");
      const badges = Array.from(document.querySelectorAll('[class*="badge"], [data-slot="badge"]')).slice(0, 8).map((el) => ({
        text: (el.textContent || "").trim().slice(0, 40),
        bg: getComputedStyle(el).backgroundColor,
        color: getComputedStyle(el).color,
      }));
      const selected = document.querySelector(".border-primary\\\\/30, [class*='bg-primary/5']");
      return {
        h1: document.querySelector("h1")?.textContent?.trim() || null,
        url: location.pathname,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        mainBg: main ? getComputedStyle(main).backgroundColor : null,
        hospitalityPage: Boolean(document.querySelector(".htc-hospitality-page")),
        hospitalityIntro: Boolean(document.querySelector(".htc-hospitality-intro")),
        introAccent: Boolean(document.querySelector(".htc-hospitality-intro-accent")),
        filterToolbar: Boolean(document.querySelector(".htc-hospitality-filter")),
        calendarGrid: Boolean(document.querySelector(".htc-calendar-month-grid, [data-cal-day-grid]")),
        automationsHelp: Boolean(document.querySelector("section.htc-automations-help")),
        setupStageLabel: Boolean(document.querySelector(".htc-setup-stage-section-label")),
        bybSelectedPanel: selected ? {
          bg: getComputedStyle(selected).backgroundColor,
          border: getComputedStyle(selected).borderColor,
          text: (selected.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 120),
        } : null,
        cardCount: cards.length,
        badges,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      };
    })()`);
    const file = join(EVID, `${route.label}-${vp.tag}.png`);
    await page.screenshot({ path: file, fullPage: false });
    results.push({
      label: route.label,
      viewport: vp.tag,
      status: res?.status() ?? null,
      file,
      ...(probe as object),
    });
    console.log(JSON.stringify(results[results.length - 1]));
    await ctx.close();
  }
}

await browser.close();
writeFileSync(join(OUT, "browser-results.json"), JSON.stringify(results, null, 2));
console.log(`Wrote ${results.length} shots`);
