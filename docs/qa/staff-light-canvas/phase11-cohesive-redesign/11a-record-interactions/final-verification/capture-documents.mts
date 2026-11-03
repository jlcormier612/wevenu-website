/**
 * Phase 11A final verification — populated /documents workspace.
 * Read-only auth OTP; no document mutations.
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

const OUT = `${ORIG}/docs/qa/staff-light-canvas/phase11-cohesive-redesign/11a-record-interactions/final-verification`;
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

const browser = await chromium.launch();
const results: Record<string, unknown>[] = [];

async function styleOfFirst(page: import("playwright").Page) {
  const loc = page.locator(".htc-record-link").locator("visible=true").first();
  if ((await loc.count()) === 0) return null;
  return loc.evaluate((el: Element) => {
    const cs = getComputedStyle(el);
    return {
      text: (el.textContent || "").trim().slice(0, 80),
      tag: el.tagName,
      color: cs.color,
      decoration: cs.textDecorationLine,
      outline: cs.outline,
      outlineOffset: cs.outlineOffset,
      testId: el.getAttribute("data-testid"),
    };
  });
}

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
  const res = await page.goto(`${APP}/documents`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(2500);

  const probe = await page.evaluate(`(() => {
    const titles = Array.from(document.querySelectorAll('[data-testid="workspace-doc-title"]'));
    const links = Array.from(document.querySelectorAll(".htc-record-link"));
    return {
      h1: document.querySelector("h1")?.textContent?.trim() || null,
      url: location.pathname,
      titleCount: titles.length,
      recordLinkCount: links.length,
      mobileActions: document.querySelectorAll('[data-htc-doc-actions="mobile"]').length,
      desktopActions: document.querySelectorAll('[data-htc-doc-actions="desktop"]').length,
      sampleTitles: titles.slice(0, 5).map((el) => (el.textContent || "").trim().slice(0, 80)),
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
    };
  })()`);

  const shot = join(EVID, `documents-${vp.tag}.png`);
  await page.screenshot({ path: shot, fullPage: false });

  const entry: Record<string, unknown> = {
    viewport: vp.tag,
    status: res?.status() ?? null,
    ...probe,
    screenshot: shot,
  };

  const title = page.locator('[data-testid="workspace-doc-title"]').locator("visible=true").first();
  const titleCount = await page.locator('[data-testid="workspace-doc-title"]').count();
  if (titleCount > 0) {
    await title.scrollIntoViewIfNeeded().catch(() => undefined);
    entry.defaultStyle = await styleOfFirst(page);
    await title.hover({ force: true });
    await page.waitForTimeout(200);
    entry.hoverStyle = await styleOfFirst(page);
    const hoverShot = join(EVID, `documents-${vp.tag}-hover.png`);
    await page.screenshot({ path: hoverShot, fullPage: false });
    entry.hoverScreenshot = hoverShot;
    await page.mouse.move(0, 0);
    await title.focus({ force: true });
    await page.waitForTimeout(150);
    entry.focusStyle = await styleOfFirst(page);
    const focusShot = join(EVID, `documents-${vp.tag}-focus.png`);
    await page.screenshot({ path: focusShot, fullPage: false });
    entry.focusScreenshot = focusShot;

    if (vp.tag === "mobile") {
      const more = page.locator('[data-htc-doc-actions="mobile"] button[aria-label="More"]').first();
      if ((await more.count()) > 0) {
        await more.click({ force: true });
        await page.waitForTimeout(400);
        const menuShot = join(EVID, `documents-mobile-overflow-open.png`);
        await page.screenshot({ path: menuShot, fullPage: false });
        entry.overflowMenuScreenshot = menuShot;
        entry.overflowMenuVisible = await page.evaluate(
          `Boolean(document.querySelector('[data-slot="dropdown-menu-content"], [role="menu"]'))`,
        );
        await page.keyboard.press("Escape");
      }
    }

    const hs = entry.hoverStyle as { color?: string; decoration?: string } | null;
    const ds = entry.defaultStyle as { color?: string; decoration?: string } | null;
    const fs = entry.focusStyle as { outline?: string } | null;
    entry.charcoalOk = String(ds?.color || "").includes("36, 51, 43");
    entry.hoverUnderline = String(hs?.decoration || "").includes("underline");
    entry.hoverStaysCharcoal =
      String(hs?.color || "").includes("36, 51, 43") || hs?.color === ds?.color;
    entry.focusHasOutline = String(fs?.outline || "").includes("2px");
  }

  results.push(entry);
  await ctx.close();
}

// Also prove /events redirect (routing evidence)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addCookies(cookies);
  await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
  const page = await ctx.newPage();
  await page.goto(`${APP}/events`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  const eventsShot = join(EVID, `events-route-redirect-clients.png`);
  await page.screenshot({ path: eventsShot, fullPage: false });
  results.push({
    label: "events-route",
    finalUrl: page.url(),
    h1: await page.evaluate(`document.querySelector("h1")?.textContent?.trim() || null`),
    screenshot: eventsShot,
  });
  await ctx.close();
}

await browser.close();
writeFileSync(join(OUT, "browser-results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
