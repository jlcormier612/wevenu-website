/**
 * Phase 11C — Calendar current-state screenshots only (no styling changes).
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

const OUT = `${ORIG}/docs/qa/staff-light-canvas/phase11-cohesive-redesign/11c-reports-corrections-calendar-design`;
const EVID = join(OUT, "evidence", "calendar-current");
const DESKTOP = "/Users/jensmac/Desktop/htc-phase11c-calendar-current";
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
  { label: "month", path: "/calendar?view=month" },
  { label: "week", path: "/calendar?view=week" },
  { label: "day", path: "/calendar?view=day" },
  { label: "agenda", path: "/calendar?view=agenda" },
];

const viewports = [
  { width: 1440, height: 900, tag: "desktop" },
  { width: 390, height: 844, tag: "mobile-390" },
  { width: 375, height: 812, tag: "mobile-375" },
];

const browser = await chromium.launch();
const results: Record<string, unknown>[] = [];

for (const route of routes) {
  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await ctx.addCookies(cookies);
    await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
    const page = await ctx.newPage();
    const res = await page.goto(`${APP}${route.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(2800);

    const probe = await page.evaluate(`(() => {
      const styles = getComputedStyle(document.documentElement);
      const cal = {
        event: styles.getPropertyValue("--cal-event").trim(),
        tour: styles.getPropertyValue("--cal-tour").trim(),
        meeting: styles.getPropertyValue("--cal-meeting").trim(),
        hold: styles.getPropertyValue("--cal-date-hold").trim(),
        blocked: styles.getPropertyValue("--cal-blocked").trim(),
      };
      return {
        h1: document.querySelector("h1")?.textContent?.trim() || null,
        url: location.pathname + location.search,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
        hasHeading: Boolean(document.querySelector(".htc-hospitality-heading")),
        hasIntroAccent: Boolean(document.querySelector(".htc-hospitality-intro-accent")),
        hasViewSwitcher: Boolean(document.querySelector(".htc-calendar-view-switcher")),
        hasFilters: Boolean(document.querySelector(".htc-calendar-filters")),
        hasLegend: Boolean(document.querySelector(".htc-calendar-legend")),
        hasMonthGrid: Boolean(document.querySelector("[data-cal-month-grid]")),
        hasWeek: Boolean(document.querySelector("[data-cal-week]")),
        hasDay: Boolean(document.querySelector("[data-cal-day]")),
        hasAgenda: Boolean(document.querySelector("[data-cal-agenda]")),
        hasShare: Boolean(document.querySelector("[data-cal-share]")),
        taxonomyDots: [...document.querySelectorAll("[data-cal-legend-item] span[style], [data-cal-legend-item] [style*='background']")].length,
        calTokens: cal,
      };
    })()`);

    const file = `${route.label}-${vp.tag}.png`;
    const path = join(EVID, file);
    await page.screenshot({ path, fullPage: false });
    copyFileSync(path, join(DESKTOP, file));

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
writeFileSync(join(OUT, "calendar-current-browser-results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map((r) => ({
  label: (r as { label: string }).label,
  vp: (r as { viewport: string }).viewport,
  status: (r as { status?: number }).status,
  overflowX: (r as { overflowX?: boolean }).overflowX,
  introAccent: (r as { hasIntroAccent?: boolean }).hasIntroAccent,
  heading: (r as { hasHeading?: boolean }).hasHeading,
  views: {
    switcher: (r as { hasViewSwitcher?: boolean }).hasViewSwitcher,
    filters: (r as { hasFilters?: boolean }).hasFilters,
    legend: (r as { hasLegend?: boolean }).hasLegend,
    month: (r as { hasMonthGrid?: boolean }).hasMonthGrid,
    week: (r as { hasWeek?: boolean }).hasWeek,
    day: (r as { hasDay?: boolean }).hasDay,
    agenda: (r as { hasAgenda?: boolean }).hasAgenda,
  },
  cal: (r as { calTokens?: unknown }).calTokens,
})), null, 2));
console.log("Desktop →", DESKTOP);
