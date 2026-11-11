/**
 * Phase 10 polish evidence — mobile Documents rows + Reporting tab nav.
 * Preserves prior Phase 10 evidence; writes under polish/.
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
  "/Users/jensmac/Developer/wevenu-website/docs/qa/staff-light-canvas/color-distribution-phase10/polish";
const EVID = join(OUT, "evidence");
const DESK = "/Users/jensmac/Desktop/htc-color-distribution-phase10-polish";
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

function rgbToHex(rgb: string | null | undefined): string | null {
  if (!rgb) return null;
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/i);
  if (!m) return null;
  if (m[4] !== undefined && Number(m[4]) === 0) return "transparent";
  return (
    "#" +
    [m[1], m[2], m[3]]
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

const browser = await chromium.launch();
const results: Record<string, unknown>[] = [];

async function withPage(
  vp: { width: number; height: number; label: string },
  fn: (page: any) => Promise<Record<string, unknown>>,
) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  await ctx.addCookies(cookies);
  await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
  const page = await ctx.newPage();
  const out = await fn(page);
  results.push({ ...out, viewport: vp.label, evidenceKind: "live-local" });
  await ctx.close();
}

function overflowX(page: any) {
  return page.evaluate(
    `() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2`,
  );
}

function colorProbe(page: any) {
  return page.evaluate(`(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, borderLeft: cs.borderLeftWidth + " " + cs.borderLeftColor };
    };
    const row = document.querySelector("[data-htc-doc-row='workspace']");
    return {
      intro: pick(".htc-hospitality-intro"),
      filter: pick(".htc-hospitality-filter"),
      toolbar: pick(".htc-hospitality-toolbar"),
      section: pick(".htc-hospitality-section-label"),
      rowBg: row ? getComputedStyle(row).backgroundColor : null,
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  })()`);
}

const desktop = { width: 1440, height: 900, label: "desktop" };
const mobile = { width: 390, height: 844, label: "mobile" };
const tablet = { width: 768, height: 1024, label: "tablet" };

// --- Documents ---
await withPage(mobile, async (page) => {
  await page.goto(`${APP}/documents?cb=${Date.now()}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1800);
  const probe = await colorProbe(page);
  const title = await page.locator('[data-testid="workspace-doc-title"]').first().textContent();
  const file = join(EVID, "documents-mobile.png");
  await page.screenshot({ path: file, fullPage: true });
  publish(file);
  console.log("documents-mobile", {
    title: title?.slice(0, 60),
    intro: rgbToHex(probe.intro?.bg),
    row: rgbToHex(probe.rowBg),
    overflow: await overflowX(page),
  });
  return {
    label: "documents-mobile",
    file: "evidence/documents-mobile.png",
    title,
    probe: {
      introBg: rgbToHex(probe.intro?.bg),
      introBorder: probe.intro?.borderLeft,
      toolbarBg: rgbToHex(probe.toolbar?.bg),
      sectionBg: rgbToHex(probe.section?.bg),
      rowBg: rgbToHex(probe.rowBg),
      overflow: await overflowX(page),
    },
  };
});

await withPage(mobile, async (page) => {
  await page.goto(`${APP}/documents?cb=${Date.now()}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1800);
  await page.locator('[data-testid="workspace-doc-more-mobile"]').first().click();
  await page.waitForTimeout(500);
  const menuText = await page.evaluate(`(() => {
    const items = [...document.querySelectorAll("[data-slot='dropdown-menu-content'] [role='menuitem'], [data-slot='dropdown-menu-content'] *")];
    const root = document.querySelector("[data-slot='dropdown-menu-content']");
    return root ? (root.textContent || "").replace(/\\s+/g, " ").trim() : null;
  })()`);
  const file = join(EVID, "documents-mobile-overflow-open.png");
  await page.screenshot({ path: file, fullPage: false });
  publish(file);
  console.log("documents-mobile-overflow", menuText?.slice(0, 120));
  return {
    label: "documents-mobile-overflow-open",
    file: "evidence/documents-mobile-overflow-open.png",
    menuText,
    overflow: await overflowX(page),
  };
});

await withPage(desktop, async (page) => {
  await page.goto(`${APP}/documents?cb=${Date.now()}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1800);
  const probe = await colorProbe(page);
  const file = join(EVID, "documents-desktop.png");
  await page.screenshot({ path: file, fullPage: false });
  publish(file);
  return {
    label: "documents-desktop",
    file: "evidence/documents-desktop.png",
    probe: {
      introBg: rgbToHex(probe.intro?.bg),
      rowBg: rgbToHex(probe.rowBg),
      desktopActions: await page.locator('[data-htc-doc-actions="desktop"]').first().isVisible(),
      mobileActions: await page.locator('[data-htc-doc-actions="mobile"]').first().isVisible().catch(() => false),
    },
  };
});

await withPage(tablet, async (page) => {
  await page.goto(`${APP}/documents?cb=${Date.now()}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1500);
  const file = join(EVID, "documents-tablet.png");
  await page.screenshot({ path: file, fullPage: false });
  publish(file);
  return {
    label: "documents-tablet",
    file: "evidence/documents-tablet.png",
    desktopActions: await page.locator('[data-htc-doc-actions="desktop"]').first().isVisible(),
    overflow: await overflowX(page),
  };
});

// --- Reporting tabs ---
for (const [slug, path] of [
  ["overview", "/reporting"],
  ["revenue", "/reporting/revenue"],
  ["events", "/reporting/events"],
  ["saved", "/reporting/saved"],
] as const) {
  await withPage(mobile, async (page) => {
    await page.goto(`${APP}${path}?cb=${Date.now()}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(2000);
    const tabState = await page.evaluate(`(() => {
      const scroller = document.querySelector("[data-htc-report-tabs='scroller']");
      const active = document.querySelector("[data-report-tab-active='true']");
      if (!scroller || !active) return null;
      const s = scroller.getBoundingClientRect();
      const a = active.getBoundingClientRect();
      const fullyVisible = a.left >= s.left - 1 && a.right <= s.right + 1;
      return {
        activeLabel: (active.textContent || "").trim(),
        fullyVisible,
        canScrollLeft: scroller.scrollLeft > 2,
        canScrollRight: scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2,
        fadeLeft: !!document.querySelector("[data-htc-report-tabs-fade='left']"),
        fadeRight: !!document.querySelector("[data-htc-report-tabs-fade='right']"),
        moreBtn: !!document.querySelector("[aria-label='Show more report tabs']"),
        prevBtn: !!document.querySelector("[aria-label='Show previous report tabs']"),
      };
    })()`);
    const probe = await colorProbe(page);
    const file = join(EVID, `reporting-${slug}-mobile.png`);
    await page.screenshot({ path: file, fullPage: false });
    publish(file);
    console.log(`reporting-${slug}-mobile`, tabState);
    return {
      label: `reporting-${slug}-mobile`,
      file: `evidence/reporting-${slug}-mobile.png`,
      tabState,
      probe: {
        introBg: rgbToHex(probe.intro?.bg),
        introBorder: probe.intro?.borderLeft,
        filterBg: rgbToHex(probe.filter?.bg),
        overflow: await overflowX(page),
      },
    };
  });
}

await withPage(desktop, async (page) => {
  await page.goto(`${APP}/reporting?cb=${Date.now()}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1500);
  const tabs = await page.evaluate(`(() =>
    [...document.querySelectorAll("[data-report-tab]")].map((el) => ({
      label: (el.textContent || "").trim(),
      href: el.getAttribute("href"),
      active: el.getAttribute("data-report-tab-active"),
    }))
  )()`);
  const file = join(EVID, "reporting-desktop.png");
  await page.screenshot({ path: file, fullPage: false });
  publish(file);
  return { label: "reporting-desktop", file: "evidence/reporting-desktop.png", tabs };
});

// Interaction: Overview → Revenue → Saved on mobile
await withPage(mobile, async (page) => {
  await page.goto(`${APP}/reporting`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1200);
  await page.click('[data-report-tab="revenue"]');
  await page.waitForTimeout(1800);
  const afterRevenue = await page.evaluate(`(() => {
    const active = document.querySelector("[data-report-tab-active='true']");
    const scroller = document.querySelector("[data-htc-report-tabs='scroller']");
    if (!active || !scroller) return null;
    const s = scroller.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    return {
      url: location.pathname,
      label: (active.textContent || "").trim(),
      fullyVisible: a.left >= s.left - 1 && a.right <= s.right + 1,
      fadeRight: !!document.querySelector("[data-htc-report-tabs-fade='right']"),
      fadeLeft: !!document.querySelector("[data-htc-report-tabs-fade='left']"),
    };
  })()`);
  await page.click('[data-report-tab="saved"]');
  await page.waitForTimeout(1800);
  const afterSaved = await page.evaluate(`(() => {
    const active = document.querySelector("[data-report-tab-active='true']");
    const scroller = document.querySelector("[data-htc-report-tabs='scroller']");
    if (!active || !scroller) return null;
    const s = scroller.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    return {
      url: location.pathname,
      label: (active.textContent || "").trim(),
      fullyVisible: a.left >= s.left - 1 && a.right <= s.right + 1,
      fadeRight: !!document.querySelector("[data-htc-report-tabs-fade='right']"),
      fadeLeft: !!document.querySelector("[data-htc-report-tabs-fade='left']"),
    };
  })()`);
  const file = join(EVID, "reporting-nav-interaction-saved-mobile.png");
  await page.screenshot({ path: file, fullPage: false });
  publish(file);
  console.log("nav-interaction", { afterRevenue, afterSaved });
  return {
    label: "reporting-nav-interaction",
    file: "evidence/reporting-nav-interaction-saved-mobile.png",
    afterRevenue,
    afterSaved,
  };
});

// Color regression sample across Phase 10 routes (mobile + desktop intros)
for (const [label, path] of [
  ["library-documents", "/library/documents"],
  ["reporting-bookings", "/reporting/bookings"],
] as const) {
  for (const vp of [desktop, mobile]) {
    await withPage(vp, async (page) => {
      await page.goto(`${APP}${path}?cb=${Date.now()}`, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      await page.waitForTimeout(1500);
      const probe = await colorProbe(page);
      const file = join(EVID, `${label}-color-${vp.label}.png`);
      await page.screenshot({ path: file, fullPage: false });
      publish(file);
      return {
        label: `${label}-color-${vp.label}`,
        file: `evidence/${label}-color-${vp.label}.png`,
        introBg: rgbToHex(probe.intro?.bg),
        introBorder: probe.intro?.borderLeft,
        filterBg: rgbToHex(probe.filter?.bg),
      };
    });
  }
}

writeFileSync(join(OUT, "browser-results.json"), JSON.stringify(results, null, 2));
copyFileSync(join(OUT, "browser-results.json"), join(DESK, "browser-results.json"));
try {
  cpSync(EVID, join(DESK, "evidence"), { recursive: true });
} catch {
  /* ignore */
}

await browser.close();
console.log(`Wrote ${results.length} polish evidence entries`);
