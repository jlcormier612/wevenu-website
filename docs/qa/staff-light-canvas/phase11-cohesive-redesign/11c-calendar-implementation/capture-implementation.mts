/**
 * Phase 11C Calendar implementation — live-local visual + light functional probes.
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

const OUT = `${ORIG}/docs/qa/staff-light-canvas/phase11-cohesive-redesign/11c-calendar-implementation`;
const EVID = join(OUT, "evidence");
const DESKTOP = "/Users/jensmac/Desktop/htc-phase11c-calendar-implementation";
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

async function shot(page: import("playwright").Page, name: string) {
  const path = join(EVID, name);
  await page.screenshot({ path, fullPage: false });
  copyFileSync(path, join(DESKTOP, name));
  return path;
}

async function probe(page: import("playwright").Page) {
  return page.evaluate(`(() => {
    const styles = getComputedStyle(document.documentElement);
    const intro = document.querySelector("[data-cal-intro]");
    const toolbar = document.querySelector("[data-cal-toolbar]");
    const filters = document.querySelector("[data-cal-filters]");
    const legend = document.querySelector("[data-cal-legend], .htc-calendar-legend");
    const guidance = document.querySelector("[data-cal-guidance]");
    const chips = [...document.querySelectorAll("[data-taxonomy-chip]")].map((el) => ({
      key: el.getAttribute("data-taxonomy-key"),
      label: (el.textContent || "").replace(/\\s+/g, " ").trim(),
      active: el.getAttribute("data-active"),
      top: Math.round(el.getBoundingClientRect().top),
      left: Math.round(el.getBoundingClientRect().left),
      right: Math.round(el.getBoundingClientRect().right),
    }));
    const activeView = document.querySelector('[data-cal-view][data-active="true"]')?.getAttribute("data-cal-view");
    return {
      h1: document.querySelector("h1")?.textContent?.trim() || null,
      url: location.pathname + location.search,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      hasIntro: Boolean(intro),
      introBg: intro ? getComputedStyle(intro).backgroundColor : null,
      hasToolbar: Boolean(toolbar),
      toolbarBg: toolbar ? getComputedStyle(toolbar).backgroundColor : null,
      hasFilters: Boolean(filters),
      filtersBg: filters ? getComputedStyle(filters).backgroundColor : null,
      hasLegend: Boolean(legend),
      hasGuidance: Boolean(guidance),
      guidanceBg: guidance ? getComputedStyle(guidance).backgroundColor : null,
      activeView,
      chipCount: chips.length,
      chips,
      chipKeys: chips.map((c) => c.key),
      hasSchedulePanel: Boolean(document.querySelector("[data-cal-schedule-panel]")),
      hasMonthGrid: Boolean(document.querySelector("[data-cal-month-grid]")),
      hasWeek: Boolean(document.querySelector("[data-cal-week]")),
      hasDay: Boolean(document.querySelector("[data-cal-day]")),
      hasAgenda: Boolean(document.querySelector("[data-cal-agenda]")),
      calTokens: {
        event: styles.getPropertyValue("--cal-event").trim(),
        tour: styles.getPropertyValue("--cal-tour").trim(),
        meeting: styles.getPropertyValue("--cal-meeting").trim(),
        hold: styles.getPropertyValue("--cal-date-hold").trim(),
      },
    };
  })()`);
}

const browser = await chromium.launch();
const results: Record<string, unknown>[] = [];

const routes = [
  { label: "month", path: "/calendar?view=month", views: ["desktop", "mobile-390", "mobile-375"] },
  { label: "week", path: "/calendar?view=week", views: ["desktop", "mobile-390"] },
  { label: "day", path: "/calendar?view=day", views: ["desktop", "mobile-390"] },
  { label: "agenda", path: "/calendar?view=agenda", views: ["desktop", "mobile-390"] },
];

const vpMap: Record<string, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  "mobile-390": { width: 390, height: 844 },
  "mobile-375": { width: 375, height: 812 },
};

for (const route of routes) {
  for (const tag of route.views) {
    const vp = vpMap[tag];
    const ctx = await browser.newContext({ viewport: vp });
    await ctx.addCookies(cookies);
    await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
    const page = await ctx.newPage();
    const res = await page.goto(`${APP}${route.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(2800);
    const p = await probe(page);
    const file = `${route.label}-${tag}.png`;
    await shot(page, file);
    results.push({ label: route.label, viewport: tag, status: res?.status() ?? null, screenshot: file, ...p });

    // Month mobile: filter wrap + navigate + select day + open add form (cancel)
    if (route.label === "month" && tag === "mobile-390") {
      await shot(page, "month-mobile-390-filters.png");
      const nextBtn = page.getByRole("button", { name: "Next month" });
      if (await nextBtn.count()) {
        await nextBtn.click();
        await page.waitForTimeout(1200);
        await shot(page, "month-mobile-390-after-next.png");
        const prevBtn = page.getByRole("button", { name: "Previous month" });
        if (await prevBtn.count()) await prevBtn.click();
        await page.waitForTimeout(1200);
      }
      const dayCell = page.locator("[data-cal-day-cell]").first();
      if (await dayCell.count()) {
        await dayCell.click();
        await page.waitForTimeout(400);
        await shot(page, "month-mobile-390-selected-day.png");
      }
      const addBtn = page.getByRole("button", { name: /Add Schedule Item/i }).first();
      if (await addBtn.count()) {
        await addBtn.click();
        await page.waitForTimeout(500);
        await shot(page, "month-mobile-390-add-form.png");
        const cancel = page.getByRole("button", { name: "Cancel" });
        if (await cancel.count()) await cancel.click();
      }
      // view switch
      for (const v of ["week", "day", "agenda", "month"] as const) {
        const btn = page.locator(`[data-cal-view="${v}"]`);
        if (await btn.count()) {
          await btn.click();
          await page.waitForTimeout(900);
        }
      }
      await shot(page, "month-mobile-390-after-view-cycle.png");
      results.push({ label: "month", viewport: "mobile-390-interactions", ...(await probe(page)) });
    }

    if (route.label === "month" && tag === "desktop") {
      const dayWithItems = page.locator("[data-cal-day-cell]").filter({ has: page.locator(".rounded-full, [style*=background]") }).first();
      const target = (await dayWithItems.count()) ? dayWithItems : page.locator("[data-cal-day-cell]").nth(5);
      if (await target.count()) {
        await target.click();
        await page.waitForTimeout(400);
        await shot(page, "month-desktop-selected-schedule.png");
      }
      // print link present
      const print = page.getByRole("link", { name: /Print \/ Export/i });
      results.push({
        label: "month",
        viewport: "desktop-print-affordance",
        printHref: (await print.count()) ? await print.getAttribute("href") : null,
      });
    }

    await ctx.close();
  }
}

// Dedicated 375 filter wrap capture
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await ctx.addCookies(cookies);
  await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
  const page = await ctx.newPage();
  await page.goto(`${APP}/calendar?view=month`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2500);
  const p = await probe(page);
  await shot(page, "month-mobile-375-filters.png");
  results.push({ label: "month", viewport: "mobile-375-filters", ...p });
  await ctx.close();
}

await browser.close();
writeFileSync(join(OUT, "browser-results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map((r) => ({
  label: (r as { label: string }).label,
  vp: (r as { viewport: string }).viewport,
  status: (r as { status?: number }).status,
  overflowX: (r as { overflowX?: boolean }).overflowX,
  intro: (r as { hasIntro?: boolean }).hasIntro,
  toolbar: (r as { hasToolbar?: boolean }).hasToolbar,
  filters: (r as { hasFilters?: boolean }).hasFilters,
  legend: (r as { hasLegend?: boolean }).hasLegend,
  guidance: (r as { hasGuidance?: boolean }).hasGuidance,
  chips: (r as { chipKeys?: string[] }).chipKeys,
  activeView: (r as { activeView?: string }).activeView,
  cal: (r as { calTokens?: unknown }).calTokens,
  printHref: (r as { printHref?: string | null }).printHref,
})), null, 2));
console.log("Desktop →", DESKTOP);
