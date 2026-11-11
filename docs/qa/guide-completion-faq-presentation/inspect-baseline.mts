/**
 * 2C baseline — Guide Completion cards + FAQ pill on Sandbox /guide.
 * Read-only. Light + dark. No mutations.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = "docs/qa/guide-completion-faq-presentation";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

async function cookiesFor() {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: FANCY_EMAIL });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({ type: "email", token_hash: linkData.properties!.hashed_token! });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    { name: "htc_active_venue_id", value: FANCY, domain: "app.sandbox.hellotocheers.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const },
  ];
}

async function measure(page: any) {
  return page.evaluate(`(() => {
    const text = (el) => (el?.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 80);
    // Find Guide Completion heading
    const headings = Array.from(document.querySelectorAll("p,h1,h2,h3,h4,span")).filter((el) => /Guide Completion/i.test(el.textContent || ""));
    const completionHeading = headings[0] || null;
    const completionCard = completionHeading ? completionHeading.closest('[data-slot="card"], .rounded-xl, .rounded-lg, div') : null;
    // Walk up to find card-ish container
    let cardRoot = completionHeading;
    for (let i = 0; i < 8 && cardRoot; i++) {
      cardRoot = cardRoot.parentElement;
      if (!cardRoot) break;
      const cls = cardRoot.className || "";
      if (/card|rounded|border/i.test(cls) && cardRoot.getBoundingClientRect().height > 80) break;
    }
    const pills = Array.from(document.querySelectorAll("span,button,a")).filter((el) => {
      const t = (el.textContent || "").trim();
      return /FAQs?$/i.test(t) || /FAQ/.test(t) && t.length < 40;
    }).slice(0, 20).map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        text: text(el),
        tag: el.tagName.toLowerCase(),
        w: Math.round(r.width), h: Math.round(r.height),
        color: cs.color, bg: cs.backgroundColor, border: cs.borderColor,
        radius: cs.borderRadius, padding: cs.padding,
        className: (el.className || "").toString().slice(0, 120),
      };
    });
    // Sibling cards near Guide Completion — look for grid of cards on page
    const allCards = Array.from(document.querySelectorAll('[data-slot="card"]')).map((el, i) => {
      const r = el.getBoundingClientRect();
      return { i, top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), text: text(el).slice(0, 60) };
    });
    // Equal-height candidates: cards sharing similar top within 20px
    const groups = {};
    for (const c of allCards) {
      const key = Math.round(c.top / 20) * 20;
      (groups[key] ||= []).push(c);
    }
    const equalHeightRows = Object.entries(groups).filter(([, arr]) => arr.length >= 2).map(([k, arr]) => ({
      topBand: k,
      heights: arr.map((a) => a.h),
      equal: arr.every((a) => a.h === arr[0].h),
      cards: arr,
    }));
    return {
      htmlDark: document.documentElement.classList.contains("dark"),
      hasCompletion: Boolean(completionHeading),
      completionText: text(completionHeading),
      cardHeights: cardRoot ? (() => { const r = cardRoot.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width) }; })() : null,
      pills,
      equalHeightRows: equalHeightRows.slice(0, 8),
      cardCount: allCards.length,
      sampleCards: allCards.slice(0, 12),
      bodySnippet: text(document.body).slice(0, 200),
    };
  })()`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor());
  const page = await context.newPage();
  await page.goto(`${APP}/guide`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1000);

  await page.evaluate(`(() => document.documentElement.classList.remove("dark"))()`);
  await page.waitForTimeout(300);
  const light = await measure(page);
  await page.screenshot({ path: `${OUT}/baseline-guide-light-1280.png`, fullPage: false });
  // Scroll to completion if present
  await page.evaluate(`(() => {
    const el = Array.from(document.querySelectorAll("p,h1,h2,h3")).find((e) => /Guide Completion/i.test(e.textContent||""));
    el?.scrollIntoView({ block: "center" });
  })()`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/baseline-completion-light-1280.png`, fullPage: false });

  await page.evaluate(`(() => document.documentElement.classList.add("dark"))()`);
  await page.waitForTimeout(400);
  const dark = await measure(page);
  await page.screenshot({ path: `${OUT}/baseline-completion-dark-1280.png`, fullPage: false });

  // Also check help guides page
  await page.goto(`${APP}/help`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => null);
  await page.waitForTimeout(800);
  const helpUrl = page.url();
  await page.screenshot({ path: `${OUT}/baseline-help-light-1280.png`, fullPage: false });

  writeFileSync(`${OUT}/baseline-inspect.json`, JSON.stringify({ at: new Date().toISOString(), light, dark, helpUrl }, null, 2));
  console.log(JSON.stringify({ lightPills: light.pills?.slice(0,8), lightRows: light.equalHeightRows, darkPills: dark.pills?.filter(p=>/FAQ/i.test(p.text)).slice(0,5), hasCompletion: light.hasCompletion }, null, 2));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
