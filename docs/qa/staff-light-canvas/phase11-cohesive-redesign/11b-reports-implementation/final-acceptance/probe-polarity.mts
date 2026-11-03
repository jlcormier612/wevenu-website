import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const ORIG = "/Users/jensmac/Developer/wevenu-website";
config({ path: `${ORIG}/.env.local`, quiet: true });
const require = createRequire(`${ORIG}/marketing/package.json`);
const { chromium } = require("playwright");
const ssr = require(`${ORIG}/node_modules/@supabase/ssr/dist/main/utils/index.js`);

const APP = "http://127.0.0.1:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
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
  domain: "127.0.0.1",
  path: "/",
  httpOnly: false,
  secure: false,
  sameSite: "Lax" as const,
};
const cookies = [
  ...ssr
    .createChunks(
      "sb-wvpsldwwjqdannqasrdf-auth-token",
      "base64-" + ssr.stringToBase64URL(JSON.stringify(otp!.session)),
    )
    .map((c: { name: string; value: string }) => ({ ...base, ...c })),
  { ...base, name: "htc_active_venue_id", value: "a415ac52-cd74-42a6-8df7-7a8f6e71d080" },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addCookies(cookies);
await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
const page = await ctx.newPage();
await page.goto(`${APP}/reporting/revenue`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2500);

const probe = await page.evaluate(`(() => {
  const kpis = [...document.querySelectorAll("[data-report-kpi]")].map((el) => {
    const valueEl = el.querySelector(".htc-report-kpi-value");
    const cmpEl = valueEl?.nextElementSibling;
    const cs = cmpEl ? getComputedStyle(cmpEl) : null;
    return {
      tone: el.getAttribute("data-tone"),
      label: (el.querySelector(".htc-report-kpi-label")?.textContent || "").trim(),
      value: (valueEl?.textContent || "").trim(),
      cmpText: (cmpEl?.textContent || "").replace(/\\s+/g, " ").trim(),
      cmpColor: cs?.color || null,
      cmpClass: cmpEl?.className || null,
      h: Math.round(el.getBoundingClientRect().height),
      bg: getComputedStyle(el).backgroundColor,
    };
  });
  const scroller = document.querySelector("[data-htc-report-tabs=scroller]");
  const fadeL = document.querySelector("[data-htc-report-tabs-fade=left]");
  const capL = document.querySelector("[data-htc-report-tabs-fade-cap=left]");
  const sr = scroller.getBoundingClientRect();
  const tabs = [...document.querySelectorAll("[data-report-tab]")].map((t) => {
    const r = t.getBoundingClientRect();
    return {
      name: t.getAttribute("data-report-tab"),
      left: Math.round(r.left - sr.left),
      right: Math.round(r.right - sr.left),
      active: t.getAttribute("data-report-tab-active"),
      clippedLeft: r.left < sr.left + 2,
      clippedRight: r.right > sr.right - 2,
      visibleWidth: Math.round(Math.min(r.right, sr.right) - Math.max(r.left, sr.left)),
      fullWidth: Math.round(r.width),
    };
  });
  return {
    kpis,
    tabs,
    fadeLW: fadeL?.getBoundingClientRect().width,
    capLW: capL?.getBoundingClientRect().width,
    scrollerW: Math.round(sr.width),
  };
})()`);

console.log(JSON.stringify(probe, null, 2));
await browser.close();
