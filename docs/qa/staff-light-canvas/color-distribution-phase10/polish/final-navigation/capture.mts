/**
 * Phase 10 final nav polish — reserved-edge chevrons, no label overlay.
 * Live-local only. No DB writes.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, copyFileSync, existsSync, cpSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssr = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const OUT =
  "/Users/jensmac/Developer/wevenu-website/docs/qa/staff-light-canvas/color-distribution-phase10/polish/final-navigation";
const EVID = join(OUT, "evidence");
const DESK = "/Users/jensmac/Desktop/htc-color-distribution-phase10-final-nav";
mkdirSync(EVID, { recursive: true });
mkdirSync(DESK, { recursive: true });

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

function publish(file: string) {
  const name = file.split("/").pop()!;
  if (existsSync(file)) copyFileSync(file, join(DESK, name));
}

const browser = await chromium.launch();
const results: Record<string, unknown>[] = [];

async function probeTabs(page: any) {
  return page.evaluate(`(() => {
    const shell = document.querySelector("[data-htc-report-tabs='shell']");
    const scroller = document.querySelector("[data-htc-report-tabs='scroller']");
    const active = document.querySelector("[data-report-tab-active='true']");
    const leftEdge = document.querySelector("[data-htc-report-tabs-edge='left']");
    const rightEdge = document.querySelector("[data-htc-report-tabs-edge='right']");
    const prevBtn = document.querySelector("[aria-label='Show previous report tabs']");
    const moreBtn = document.querySelector("[aria-label='Show more report tabs']");
    if (!shell || !scroller || !active) return { ok: false };

    const sRect = scroller.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    const tabs = [...scroller.querySelectorAll("[data-report-tab]")].map((el) => {
      const r = el.getBoundingClientRect();
      const visible = r.right > sRect.left + 1 && r.left < sRect.right - 1;
      return {
        label: (el.textContent || "").trim(),
        active: el.getAttribute("data-report-tab-active") === "true",
        visibleInScroller: visible,
        left: Math.round(r.left),
        right: Math.round(r.right),
      };
    });

    function visibleTabRect(tabEl) {
      const t = tabEl.getBoundingClientRect();
      const left = Math.max(t.left, sRect.left);
      const right = Math.min(t.right, sRect.right);
      const top = Math.max(t.top, sRect.top);
      const bottom = Math.min(t.bottom, sRect.bottom);
      if (right - left < 2 || bottom - top < 2) return null;
      return { left, right, top, bottom };
    }

    function overlapsBtn(btn, vis) {
      if (!btn || !vis) return false;
      const b = btn.getBoundingClientRect();
      return b.left < vis.right - 1 && b.right > vis.left + 1 && b.top < vis.bottom - 1 && b.bottom > vis.top + 1;
    }

    const tabEls = [...scroller.querySelectorAll("[data-report-tab]")];
    const overlayHits = tabEls
      .filter((el) => {
        const vis = visibleTabRect(el);
        return overlapsBtn(prevBtn, vis) || overlapsBtn(moreBtn, vis);
      })
      .map((el) => (el.textContent || "").trim());

    const leftEdgeRect = leftEdge?.getBoundingClientRect();
    const rightEdgeRect = rightEdge?.getBoundingClientRect();
    const leftEdgeActive = leftEdge?.getAttribute("data-htc-report-tabs-edge-active") === "true";
    const rightEdgeActive = rightEdge?.getAttribute("data-htc-report-tabs-edge-active") === "true";

    // Visible label pixels must stay inside the scroller, not under reserved edges
    const edgeCollisions = tabEls
      .filter((el) => {
        const vis = visibleTabRect(el);
        if (!vis) return false;
        if (leftEdgeActive && leftEdgeRect) {
          if (vis.left < leftEdgeRect.right - 1 && vis.right > leftEdgeRect.left + 1) return true;
        }
        if (rightEdgeActive && rightEdgeRect) {
          if (vis.left < rightEdgeRect.right - 1 && vis.right > rightEdgeRect.left + 1) return true;
        }
        return false;
      })
      .map((el) => (el.textContent || "").trim());

    return {
      ok: true,
      activeLabel: (active.textContent || "").trim(),
      activeFullyVisible: aRect.left >= sRect.left - 1 && aRect.right <= sRect.right + 1,
      canScrollLeft: scroller.scrollLeft > 2,
      canScrollRight: scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2,
      leftEdgeActive,
      rightEdgeActive,
      prevBtn: !!prevBtn,
      moreBtn: !!moreBtn,
      overlayHits,
      edgeCollisions,
      pageOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      scrollerLeft: Math.round(sRect.left),
      scrollerRight: Math.round(sRect.right),
      leftEdgeRight: leftEdgeActive && leftEdgeRect ? Math.round(leftEdgeRect.right) : null,
      rightEdgeLeft: rightEdgeActive && rightEdgeRect ? Math.round(rightEdgeRect.left) : null,
      tabs,
    };
  })()`);
}

async function shot(label: string, path: string, vp: { width: number; height: number; label: string }) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await ctx.addCookies(cookies);
  await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
  const page = await ctx.newPage();
  await page.goto(`${APP}${path}?cb=${Date.now()}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(2000);
  const probe = await probeTabs(page);
  const file = join(EVID, `${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  publish(file);
  results.push({ label, route: path, viewport: vp.label, file: `evidence/${label}.png`, probe });
  console.log(JSON.stringify({ label, active: probe.activeLabel, overlayHits: probe.overlayHits, edgeCollisions: probe.edgeCollisions, left: probe.leftEdgeActive, right: probe.rightEdgeActive, overflow: probe.pageOverflowX, visible: probe.activeFullyVisible }));
  await ctx.close();
}

const mobile = { width: 390, height: 844, label: "mobile" };
const desktop = { width: 1440, height: 900, label: "desktop" };

await shot("reporting-overview-mobile", "/reporting", mobile);
await shot("reporting-bookings-mobile", "/reporting/bookings", mobile);
await shot("reporting-revenue-mobile", "/reporting/revenue", mobile);
await shot("reporting-events-mobile", "/reporting/events", mobile);
await shot("reporting-saved-mobile", "/reporting/saved", mobile);
await shot("reporting-desktop", "/reporting", desktop);

// Interactions: chevron + tab click
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies(cookies);
  await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
  const page = await ctx.newPage();
  await page.goto(`${APP}/reporting`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
  const before = await probeTabs(page);
  await page.click("[aria-label='Show more report tabs']");
  await page.waitForTimeout(600);
  const afterChevron = await probeTabs(page);
  await page.click('[data-report-tab="events"]');
  await page.waitForTimeout(1800);
  const afterClick = await probeTabs(page);
  // swipe/scroll
  await page.evaluate(`(() => {
    const el = document.querySelector("[data-htc-report-tabs='scroller']");
    if (el) el.scrollBy({ left: -120, behavior: "instant" });
  })()`);
  await page.waitForTimeout(400);
  const afterSwipe = await probeTabs(page);
  const file = join(EVID, "reporting-nav-interaction-mobile.png");
  await page.screenshot({ path: file, fullPage: false });
  publish(file);
  results.push({
    label: "reporting-nav-interaction-mobile",
    evidenceKind: "live-interaction",
    file: "evidence/reporting-nav-interaction-mobile.png",
    before,
    afterChevron,
    afterClick,
    afterSwipe,
  });
  console.log(
    JSON.stringify({
      interaction: true,
      afterChevronOverlay: afterChevron.overlayHits,
      afterClick: { label: afterClick.activeLabel, overlay: afterClick.overlayHits, collisions: afterClick.edgeCollisions },
      afterSwipeOverlay: afterSwipe.overlayHits,
    }),
  );
  await ctx.close();
}

writeFileSync(join(OUT, "browser-results.json"), JSON.stringify(results, null, 2));
copyFileSync(join(OUT, "browser-results.json"), join(DESK, "browser-results.json"));
try {
  cpSync(EVID, join(DESK, "evidence"), { recursive: true });
} catch {
  /* ignore */
}

await browser.close();
console.log(`Wrote ${results.length} final-nav evidence entries`);
