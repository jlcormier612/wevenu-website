/**
 * Phase 10 implementation evidence — live local browser only.
 * No DB writes.
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
  "/Users/jensmac/Developer/wevenu-website/docs/qa/staff-light-canvas/color-distribution-phase10";
const EVID = join(OUT, "evidence");
const DESK = "/Users/jensmac/Desktop/htc-color-distribution-phase10";
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

async function shot(
  label: string,
  path: string,
  vp: { width: number; height: number; label: string },
) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  await ctx.addCookies(cookies);
  await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
  const page = await ctx.newPage();
  await page.goto(`${APP}${path}?cb=${Date.now()}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1800);

  const probe = await page.evaluate(`(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        borderLeft: cs.borderLeftWidth + " " + cs.borderLeftColor,
        borderTop: cs.borderTopColor,
        color: cs.color,
        text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 100),
      };
    };
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    return {
      h1: document.querySelector("h1")?.textContent?.trim() || null,
      path: location.pathname,
      intro: pick(".htc-hospitality-intro"),
      filter: pick(".htc-hospitality-filter"),
      toolbar: pick(".htc-hospitality-toolbar"),
      sectionLabels: Array.from(document.querySelectorAll(".htc-hospitality-section-label")).map((el) => ({
        text: (el.textContent || "").trim().slice(0, 80),
        bg: getComputedStyle(el).backgroundColor,
      })),
      cardBg: (() => {
        const c = document.querySelector("[data-slot='card']");
        return c ? getComputedStyle(c).backgroundColor : null;
      })(),
      hasDateToolbar: !!document.querySelector("[data-htc-phase10='reporting-date-toolbar']"),
      overflowX: overflow,
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  })()`);

  const measured = {
    ...probe,
    bodyBgHex: rgbToHex(probe.bodyBg),
    introBgHex: rgbToHex(probe.intro?.bg),
    introBorderLeft: probe.intro?.borderLeft ?? null,
    filterBgHex: rgbToHex(probe.filter?.bg),
    toolbarBgHex: rgbToHex(probe.toolbar?.bg),
    sectionLabelHex: (probe.sectionLabels || []).map((s: { text: string; bg: string }) => ({
      text: s.text,
      bg: rgbToHex(s.bg),
    })),
    cardBgHex: rgbToHex(probe.cardBg),
  };

  const file = join(EVID, `${label}-${vp.label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  publish(file);
  results.push({
    label,
    route: path,
    viewport: vp.label,
    file: `evidence/${label}-${vp.label}.png`,
    evidenceKind: "live-local",
    probe: measured,
  });
  console.log(
    JSON.stringify({
      label,
      vp: vp.label,
      intro: measured.introBgHex,
      border: measured.introBorderLeft,
      filter: measured.filterBgHex,
      toolbar: measured.toolbarBgHex,
      overflow: measured.overflowX,
    }),
  );
  await ctx.close();
}

const desktop = { width: 1440, height: 900, label: "desktop" };
const mobile = { width: 390, height: 844, label: "mobile" };

const routes: Array<[string, string]> = [
  ["reporting-overview", "/reporting"],
  ["reporting-sales", "/reporting/sales"],
  ["reporting-bookings", "/reporting/bookings"],
  ["reporting-revenue", "/reporting/revenue"],
  ["reporting-events", "/reporting/events"],
  ["reporting-saved", "/reporting/saved"],
  ["documents-workspace", "/documents"],
  ["library-documents", "/library/documents"],
];

for (const [label, path] of routes) {
  await shot(label, path, desktop);
  await shot(label, path, mobile);
}

// Interaction checks
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(cookies);
  await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
  const page = await ctx.newPage();
  await page.goto(`${APP}/reporting`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1200);
  await page.click('a[href^="/reporting/bookings"]');
  await page.waitForTimeout(1500);
  const bookingsUrl = page.url();
  await page.goto(`${APP}/documents`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1200);
  const cat = page.locator('button:has-text("Contracts")').first();
  const catCount = await cat.count();
  if (catCount) await cat.click();
  await page.waitForTimeout(800);
  results.push({
    label: "interactions",
    evidenceKind: "live-interaction",
    bookingsUrl,
    contractsFilterClicked: catCount > 0,
    documentsUrl: page.url(),
  });
  console.log("interactions", { bookingsUrl, catCount });
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
console.log(`Wrote ${results.length} evidence entries`);
