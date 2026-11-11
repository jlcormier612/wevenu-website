/**
 * Phase 10 final nav — in-scroller edge fades for clipped tab labels.
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
  "/Users/jensmac/Developer/wevenu-website/docs/qa/staff-light-canvas/color-distribution-phase10/polish/final-navigation/edge-fade";
const EVID = join(OUT, "evidence");
const DESK = "/Users/jensmac/Desktop/htc-color-distribution-phase10-edge-fade";
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

async function probe(page: any) {
  return page.evaluate(`(() => {
    const scroller = document.querySelector("[data-htc-report-tabs='scroller']");
    const active = document.querySelector("[data-report-tab-active='true']");
    const fadeL = document.querySelector("[data-htc-report-tabs-fade='left']");
    const fadeR = document.querySelector("[data-htc-report-tabs-fade='right']");
    const prevBtn = document.querySelector("[aria-label='Show previous report tabs']");
    const moreBtn = document.querySelector("[aria-label='Show more report tabs']");
    const leftEdge = document.querySelector("[data-htc-report-tabs-edge='left']");
    const rightEdge = document.querySelector("[data-htc-report-tabs-edge='right']");
    if (!scroller || !active) return { ok: false };

    const s = scroller.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    const activeFullyVisible = a.left >= s.left - 1 && a.right <= s.right + 1;

    // Active tab should not sit mostly under the fade band (~48px)
    const fadeBand = 48;
    const activeClearOfFades =
      (!fadeL || a.left >= s.left + fadeBand - 2) &&
      (!fadeR || a.right <= s.right - fadeBand + 2);

    function overlaps(aEl, bEl) {
      if (!aEl || !bEl) return false;
      const A = aEl.getBoundingClientRect();
      const B = bEl.getBoundingClientRect();
      return A.left < B.right - 1 && A.right > B.left + 1 && A.top < B.bottom - 1 && A.bottom > B.top + 1;
    }

    return {
      ok: true,
      activeLabel: (active.textContent || "").trim(),
      activeFullyVisible,
      activeClearOfFades,
      canScrollLeft: scroller.scrollLeft > 2,
      canScrollRight: scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2,
      fadeLeft: !!fadeL,
      fadeRight: !!fadeR,
      prevBtn: !!prevBtn,
      moreBtn: !!moreBtn,
      leftSlot: leftEdge?.classList.contains("flex") || leftEdge?.getAttribute("class")?.includes("flex"),
      rightSlot: rightEdge?.classList.contains("flex") || rightEdge?.getAttribute("class")?.includes("flex"),
      fadeOverChevron: overlaps(fadeL, prevBtn) || overlaps(fadeR, moreBtn),
      pageOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      scrollerLeft: Math.round(s.left),
      scrollerRight: Math.round(s.right),
      activeLeft: Math.round(a.left),
      activeRight: Math.round(a.right),
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
  await page.waitForTimeout(2200);
  const p = await probe(page);
  // Crop-friendly full tab strip screenshot + page shot
  const file = join(EVID, `${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  publish(file);

  // Tight crop of the report tabs shell for visual inspection
  const box = await page.locator("[data-htc-report-tabs='shell']").boundingBox();
  if (box) {
    const crop = join(EVID, `${label}-tabs.png`);
    await page.screenshot({
      path: crop,
      clip: {
        x: Math.max(0, box.x - 4),
        y: Math.max(0, box.y - 4),
        width: Math.min(vp.width - 2, box.width + 8),
        height: Math.min(80, box.height + 8),
      },
    });
    publish(crop);
  }

  results.push({ label, route: path, viewport: vp.label, file: `evidence/${label}.png`, probe: p });
  console.log(
    JSON.stringify({
      label,
      active: p.activeLabel,
      visible: p.activeFullyVisible,
      clear: p.activeClearOfFades,
      fadeL: p.fadeLeft,
      fadeR: p.fadeRight,
      fadeOverChevron: p.fadeOverChevron,
      overflow: p.pageOverflowX,
    }),
  );
  await ctx.close();
}

const mobile = { width: 390, height: 844, label: "mobile" };
const desktop = { width: 1440, height: 900, label: "desktop" };

for (const [slug, path] of [
  ["overview", "/reporting"],
  ["sales", "/reporting/sales"],
  ["bookings", "/reporting/bookings"],
  ["revenue", "/reporting/revenue"],
  ["events", "/reporting/events"],
  ["saved", "/reporting/saved"],
] as const) {
  await shot(`reporting-${slug}-mobile`, path, mobile);
}
await shot("reporting-desktop", "/reporting", desktop);

// Interactions
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies(cookies);
  await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
  const page = await ctx.newPage();
  await page.goto(`${APP}/reporting`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
  const start = await probe(page);
  await page.click("[aria-label='Show more report tabs']");
  await page.waitForTimeout(500);
  const afterMore = await probe(page);
  await page.click("[aria-label='Show previous report tabs']");
  await page.waitForTimeout(500);
  const afterPrev = await probe(page);
  await page.click('[data-report-tab="saved"]');
  await page.waitForTimeout(1800);
  const atSaved = await probe(page);
  await page.click('[data-report-tab="overview"]');
  await page.waitForTimeout(1800);
  const backOverview = await probe(page);
  await page.evaluate(`(() => {
    const el = document.querySelector("[data-htc-report-tabs='scroller']");
    if (el) el.scrollBy({ left: 140, behavior: "instant" });
  })()`);
  await page.waitForTimeout(400);
  const afterSwipe = await probe(page);
  // Focus a tab for keyboard visibility
  await page.focus('[data-report-tab="sales"]');
  await page.waitForTimeout(200);
  const file = join(EVID, "reporting-nav-interaction-mobile.png");
  await page.screenshot({ path: file, fullPage: false });
  publish(file);
  results.push({
    label: "reporting-nav-interaction-mobile",
    evidenceKind: "live-interaction",
    file: "evidence/reporting-nav-interaction-mobile.png",
    start,
    afterMore,
    afterPrev,
    atSaved,
    backOverview,
    afterSwipe,
  });
  console.log(
    JSON.stringify({
      interaction: true,
      startFades: [start.fadeLeft, start.fadeRight],
      atSavedFades: [atSaved.fadeLeft, atSaved.fadeRight],
      backOverviewFades: [backOverview.fadeLeft, backOverview.fadeRight],
      afterSwipeFades: [afterSwipe.fadeLeft, afterSwipe.fadeRight],
      fadeOverChevron: [
        start.fadeOverChevron,
        afterMore.fadeOverChevron,
        atSaved.fadeOverChevron,
        afterSwipe.fadeOverChevron,
      ],
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
console.log(`Wrote ${results.length} edge-fade evidence entries`);
