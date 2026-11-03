/**
 * Phase 11C Calendar final polish — live screenshots + layout probes.
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

const OUT = `${ORIG}/docs/qa/staff-light-canvas/phase11-cohesive-redesign/11c-calendar-implementation/final-polish`;
const EVID = join(OUT, "evidence");
const DESKTOP = "/Users/jensmac/Desktop/htc-phase11c-calendar-final-polish";
mkdirSync(EVID, { recursive: true });
mkdirSync(DESKTOP, { recursive: true });

const APP = process.env.HTC_CAPTURE_BASE ?? "http://127.0.0.1:3000";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: "jennifer@hellotocheers.com" });
const { data: otp } = await anon.auth.verifyOtp({ type: "email", token_hash: link!.properties!.hashed_token! });
const base = { domain: new URL(APP).hostname, path: "/", httpOnly: false, secure: APP.startsWith("https"), sameSite: "Lax" as const };
const cookies = [
  ...ssr.createChunks("sb-wvpsldwwjqdannqasrdf-auth-token", "base64-" + ssr.stringToBase64URL(JSON.stringify(otp!.session))).map((c: { name: string; value: string }) => ({ ...base, ...c })),
  { ...base, name: "htc_active_venue_id", value: FANCY },
];

const PROBE = `(() => {
  const toolbars = Array.from(document.querySelectorAll("[data-cal-toolbar]"));
  const viewsRow = document.querySelector('[data-cal-toolbar-row="views"]');
  const dateRow = document.querySelector('[data-cal-toolbar-row="date"]');
  const actions = document.querySelector("[data-cal-intro-actions]");
  const actionButtons = actions ? Array.from(actions.querySelectorAll("button, a")) : [];
  const actionRects = actionButtons.map(function(el) {
    const r = el.getBoundingClientRect();
    return {
      text: (el.textContent || "").replace(/\\s+/g, " ").trim(),
      top: Math.round(r.top),
      left: Math.round(r.left),
      right: Math.round(r.right)
    };
  });
  const sameRow = actionRects.length >= 2 && Math.abs(actionRects[0].top - actionRects[1].top) <= 4;
  var desktopSingleRow = null;
  if (viewsRow && dateRow && window.innerWidth >= 768) {
    var vr = viewsRow.getBoundingClientRect();
    var dr = dateRow.getBoundingClientRect();
    desktopSingleRow = Math.abs(vr.top - dr.top) <= 12 && vr.left < dr.left;
  }
  var active = document.querySelector('[data-cal-view][data-active="true"]');
  return {
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
    toolbarCount: toolbars.length,
    hasViewsRow: Boolean(viewsRow),
    hasDateRow: Boolean(dateRow),
    desktopSingleRow: desktopSingleRow,
    actionsSameRow: sameRow,
    actionRects: actionRects,
    activeView: active ? active.getAttribute("data-cal-view") : null,
    filterCount: document.querySelectorAll("[data-taxonomy-chip]").length,
    hasLegend: Boolean(document.querySelector("[data-cal-legend], .htc-calendar-legend"))
  };
})()`;

const browser = await chromium.launch();
const results = [];

const routes = [
  { label: "month", path: "/calendar?view=month" },
  { label: "week", path: "/calendar?view=week" },
  { label: "day", path: "/calendar?view=day" },
  { label: "agenda", path: "/calendar?view=agenda" },
];

const viewports = [
  { tag: "desktop", width: 1440, height: 900 },
  { tag: "mobile-390", width: 390, height: 844 },
  { tag: "mobile-375", width: 375, height: 812 },
];

for (const route of routes) {
  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await ctx.addCookies(cookies);
    await ctx.addInitScript("window.localStorage.setItem('theme','light')");
    const page = await ctx.newPage();
    const res = await page.goto(`${APP}${route.path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(2600);
    const p = await page.evaluate(PROBE);
    const file = `${route.label}-${vp.tag}.png`;
    const path = join(EVID, file);
    await page.screenshot({ path, fullPage: false });
    copyFileSync(path, join(DESKTOP, file));
    results.push({ label: route.label, viewport: vp.tag, status: res ? res.status() : null, screenshot: file, ...p });

    if (route.label === "month" && vp.tag === "mobile-375") {
      for (const v of ["week", "day", "agenda", "month"]) {
        const btn = page.locator(`[data-cal-view="${v}"]`);
        if ((await btn.count()) > 0) {
          await btn.click();
          await page.waitForTimeout(700);
        }
      }
      const next = page.getByRole("button", { name: /Next month|Next week|Next day/i }).first();
      if ((await next.count()) > 0) {
        await next.click();
        await page.waitForTimeout(900);
        const prev = page.getByRole("button", { name: /Previous month|Previous week|Previous day/i }).first();
        if ((await prev.count()) > 0) await prev.click();
        await page.waitForTimeout(700);
      }
      const add = page.getByRole("button", { name: /Add Schedule Item/i }).first();
      if ((await add.count()) > 0) {
        await add.click();
        await page.waitForTimeout(400);
        const cancel = page.getByRole("button", { name: "Cancel" });
        if ((await cancel.count()) > 0) await cancel.click();
      }
      const smoke = "month-mobile-375-after-smoke.png";
      const smokePath = join(EVID, smoke);
      await page.screenshot({ path: smokePath, fullPage: false });
      copyFileSync(smokePath, join(DESKTOP, smoke));
      results.push({ label: "month", viewport: "mobile-375-smoke", ...(await page.evaluate(PROBE)) });
    }

    await ctx.close();
  }
}

await browser.close();
writeFileSync(join(OUT, "browser-results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map((r) => ({
  label: r.label,
  vp: r.viewport,
  status: r.status,
  overflowX: r.overflowX,
  toolbarCount: r.toolbarCount,
  desktopSingleRow: r.desktopSingleRow,
  actionsSameRow: r.actionsSameRow,
  activeView: r.activeView,
  hasLegend: r.hasLegend,
})), null, 2));
console.log("Desktop →", DESKTOP);
