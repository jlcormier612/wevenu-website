import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssr = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = "http://127.0.0.1:3000";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
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
const base = { domain: "127.0.0.1", path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const };
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addCookies(cookies);
await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
const page = await ctx.newPage();
await page.goto(`${APP}/reporting/saved?cb=${Date.now()}`, {
  waitUntil: "domcontentloaded",
  timeout: 90000,
});
await page.waitForTimeout(2500);
const info = await page.evaluate(`(() => {
  const el = document.querySelector("[data-htc-report-tabs='scroller']");
  if (!el) return null;
  const cs = getComputedStyle(el);
  return {
    maskImage: cs.maskImage,
    webkitMaskImage: cs.webkitMaskImage,
    attr: el.getAttribute("data-htc-report-tabs-mask"),
    styleAttr: el.getAttribute("style"),
    scrollLeft: el.scrollLeft,
    clientWidth: el.clientWidth,
    scrollWidth: el.scrollWidth,
  };
})()`);
console.log(JSON.stringify(info, null, 2));
await browser.close();
