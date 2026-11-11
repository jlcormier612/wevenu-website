/**
 * Phase 11A — local visual acceptance for record-link interactions.
 * Auth OTP only; no record mutations. No app edits.
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

const OUT = `${ORIG}/docs/qa/staff-light-canvas/phase11-cohesive-redesign/11a-record-interactions`;
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
  { label: "clients", path: "/clients" },
  { label: "leads", path: "/leads" },
  { label: "contracts", path: "/contracts" },
  { label: "vendors", path: "/vendors" },
  { label: "requests", path: "/requests" },
  { label: "tours", path: "/tours" },
  { label: "documents", path: "/library/documents" },
  { label: "payments", path: "/payments" },
  { label: "events", path: "/events" },
];

const hoverFocusLabels = new Set(["clients", "leads", "contracts"]);

async function waitReady(page: import("playwright").Page) {
  for (let i = 0; i < 30; i++) {
    const st = await page.evaluate(`document.readyState`);
    const h1 = await page.evaluate(`document.querySelector("h1")?.textContent || ""`);
    const body = await page.evaluate(`(document.body?.innerText || "").slice(0, 80)`);
    if (st === "complete" && (h1 || !String(body).includes("404"))) return;
    await page.waitForTimeout(1000);
  }
}

async function probeLinks(page: import("playwright").Page) {
  return page.evaluate(`(() => {
    const links = Array.from(document.querySelectorAll(".htc-record-link")).slice(0, 5);
    return links.map((el) => {
      const cs = getComputedStyle(el);
      return {
        text: (el.textContent || "").trim().slice(0, 48),
        tag: el.tagName,
        href: el.getAttribute("href"),
        color: cs.color,
        decoration: cs.textDecorationLine,
        cursor: cs.cursor,
        className: el.className,
      };
    });
  })()`);
}

async function styleOf(page: import("playwright").Page, selector: string) {
  return page.evaluate(`((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      text: (el.textContent || "").trim().slice(0, 48),
      color: cs.color,
      decoration: cs.textDecorationLine,
      outline: cs.outline,
      outlineOffset: cs.outlineOffset,
    };
  })(${JSON.stringify(selector)})`);
}

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
    await waitReady(page);
    await page.waitForTimeout(1500);

    const file = join(EVID, `${route.label}-${vp.tag}.png`);
    await page.screenshot({ path: file, fullPage: false });

    const entry: Record<string, unknown> = {
      label: route.label,
      viewport: vp.tag,
      status: res?.status() ?? null,
      url: page.url(),
      h1: await page.evaluate(`document.querySelector("h1")?.textContent?.trim() || null`),
      recordLinks: await probeLinks(page),
      overflowX: await page.evaluate(
        `document.documentElement.scrollWidth > window.innerWidth + 2`,
      ),
      attentionRows: await page.evaluate(
        `document.querySelectorAll('[data-attention="true"]').length`,
      ),
      hospitalityTable: await page.evaluate(
        `Boolean(document.querySelector(".htc-hospitality-table"))`,
      ),
      screenshot: file,
    };

    if (hoverFocusLabels.has(route.label) && vp.tag === "desktop") {
      const visible = page.locator(".htc-record-link").locator("visible=true");
      const count = await visible.count();
      if (count > 0) {
        const first = visible.first();
        await first.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(() => undefined);
        const defaultStyle = await first.evaluate((el: Element) => {
          const cs = getComputedStyle(el);
          return {
            text: (el.textContent || "").trim().slice(0, 48),
            color: cs.color,
            decoration: cs.textDecorationLine,
            outline: cs.outline,
            outlineOffset: cs.outlineOffset,
          };
        });
        await first.hover({ force: true });
        await page.waitForTimeout(250);
        const hoverStyle = await first.evaluate((el: Element) => {
          const cs = getComputedStyle(el);
          return {
            text: (el.textContent || "").trim().slice(0, 48),
            color: cs.color,
            decoration: cs.textDecorationLine,
            outline: cs.outline,
            outlineOffset: cs.outlineOffset,
          };
        });
        const hoverFile = join(EVID, `${route.label}-desktop-hover.png`);
        await page.screenshot({ path: hoverFile, fullPage: false });
        await page.mouse.move(0, 0);
        await first.focus({ force: true });
        await page.waitForTimeout(200);
        const focusStyle = await first.evaluate((el: Element) => {
          const cs = getComputedStyle(el);
          return {
            text: (el.textContent || "").trim().slice(0, 48),
            color: cs.color,
            decoration: cs.textDecorationLine,
            outline: cs.outline,
            outlineOffset: cs.outlineOffset,
          };
        });
        const focusFile = join(EVID, `${route.label}-desktop-focus.png`);
        await page.screenshot({ path: focusFile, fullPage: false });
        entry.defaultStyle = defaultStyle;
        entry.hoverStyle = hoverStyle;
        entry.focusStyle = focusStyle;
        entry.hoverScreenshot = hoverFile;
        entry.focusScreenshot = focusFile;
        const charcoal = (c: string) =>
          c.includes("36, 51, 43") || c.includes("24332b") || c === "rgb(36, 51, 43)";
        entry.charcoalOk = charcoal(String(defaultStyle.color));
        entry.hoverUnderline = String(hoverStyle.decoration).includes("underline");
        entry.hoverStaysCharcoal =
          charcoal(String(hoverStyle.color)) || hoverStyle.color === defaultStyle.color;
        entry.focusHasOutline =
          String(focusStyle.outline || "").includes("rgb") ||
          String(focusStyle.outline || "").includes("2px");
      } else {
        entry.hoverFocusSkipped = "no visible .htc-record-link on page";
      }
    }

    results.push(entry);
    await ctx.close();
  }
}

await browser.close();
writeFileSync(join(OUT, "browser-results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
