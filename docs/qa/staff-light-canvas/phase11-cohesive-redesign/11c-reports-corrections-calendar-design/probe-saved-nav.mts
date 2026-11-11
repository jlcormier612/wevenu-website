import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const ORIG = "/Users/jensmac/Developer/wevenu-website";
config({ path: `${ORIG}/.env.local`, quiet: true });
const require = createRequire(`${ORIG}/marketing/package.json`);
const { chromium } = require("playwright");
const ssr = require(`${ORIG}/node_modules/@supabase/ssr/dist/main/utils/index.js`);

const OUT = join(ORIG, "docs/qa/staff-light-canvas/phase11-cohesive-redesign/11c-reports-corrections-calendar-design/evidence/reports");
mkdirSync(OUT, { recursive: true });

const APP = "http://127.0.0.1:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: "jennifer@hellotocheers.com" });
const { data: otp } = await anon.auth.verifyOtp({ type: "email", token_hash: link!.properties!.hashed_token! });
const base = { domain: "127.0.0.1", path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const };
const cookies = [
  ...ssr.createChunks("sb-wvpsldwwjqdannqasrdf-auth-token", "base64-" + ssr.stringToBase64URL(JSON.stringify(otp!.session))).map((c: { name: string; value: string }) => ({ ...base, ...c })),
  { ...base, name: "htc_active_venue_id", value: "a415ac52-cd74-42a6-8df7-7a8f6e71d080" },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies(cookies);
await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
const page = await ctx.newPage();
await page.goto(`${APP}/reporting/saved`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(3000);

const probe = await page.evaluate(`(() => {
  const phase = document.querySelector("[data-htc-phase10=reporting]");
  const phaseText = (phase?.innerText || "").replace(/\\s+/g, " ").trim();
  const beforeIntro = phaseText.slice(0, phaseText.indexOf("Reports") + 40);
  const links = [...document.querySelectorAll("a")].map((a) => ({
    text: (a.textContent || "").replace(/\\s+/g, " ").trim(),
    href: a.getAttribute("href"),
  }));
  const inPhase = [...(phase?.querySelectorAll("a") || [])].map((a) => ({
    text: (a.textContent || "").replace(/\\s+/g, " ").trim(),
    href: a.getAttribute("href"),
  }));
  return {
    beforeIntro,
    phaseStartsWithArrowTemplates: /^←\\s*Templates/.test(phaseText),
    phaseHasArrowTemplates: /←\\s*Templates/.test(phaseText),
    inPhaseLinks: inPhase.filter((l) => /template|←/i.test(l.text) || l.href === "/library"),
    sidebarTemplates: links.filter((l) => l.text === "Templates"),
    firstChildTag: phase?.firstElementChild?.tagName || null,
    firstChildClass: phase?.firstElementChild?.className || null,
  };
})()`);

const shot = join(OUT, "saved-desktop-nav-verify.png");
await page.screenshot({ path: shot, fullPage: false });
copyFileSync(shot, "/Users/jensmac/Desktop/htc-phase11c-reports-corrections/saved-desktop-nav-verify.png");
writeFileSync(join(OUT, "..", "..", "saved-nav-probe.json"), JSON.stringify(probe, null, 2));
console.log(JSON.stringify(probe, null, 2));
await browser.close();
