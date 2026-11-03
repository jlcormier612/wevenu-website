import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssr = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = "http://127.0.0.1:3000";
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
  {
    ...base,
    name: "htc_active_venue_id",
    value: "a415ac52-cd74-42a6-8df7-7a8f6e71d080",
  },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await ctx.addCookies(cookies);
await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
const page = await ctx.newPage();
await page.goto(`${APP}/communication/series?cb=${Date.now()}`, {
  waitUntil: "networkidle",
  timeout: 120000,
});
const info = await page.evaluate(`(() => {
  const shell = document.querySelector(".htc-group-shell");
  const badge = document.querySelector(".htc-badge-active");
  const help = document.querySelector("section.htc-automations-help");
  const intro = document.querySelector(".htc-hospitality-intro");
  const staff = document.querySelector(".htc-staff");
  const cs = (el) => (el ? getComputedStyle(el).backgroundColor : null);
  let cssHasGroup = false;
  let cssHasBadge = false;
  for (const ss of document.styleSheets) {
    try {
      for (const r of ss.cssRules) {
        const t = r.cssText || "";
        if (t.includes("htc-group-shell")) cssHasGroup = true;
        if (t.includes("htc-badge-active")) cssHasBadge = true;
      }
    } catch {}
  }
  return {
    hasStaff: !!staff,
    introBg: cs(intro),
    helpBg: cs(help),
    shellBg: cs(shell),
    shellExists: !!shell,
    badgeBg: cs(badge),
    badgeClass: badge && badge.className,
    cssHasGroup,
    cssHasBadge,
  };
})()`);
console.log(JSON.stringify(info, null, 2));
await browser.close();
