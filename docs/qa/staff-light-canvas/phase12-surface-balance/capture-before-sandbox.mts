/**
 * Phase 12 BEFORE evidence from Sandbox serving dea957d2 (approved baseline).
 * Non-destructive.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssr = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const BOOKED = "49aba826-0bd3-4891-ac9f-02a18b2b6962";
const LEAD = "20e470d8-ab91-4db1-bbae-d75dad943b69";
const OUT =
  "/Users/jensmac/Developer/wevenu-website/docs/qa/staff-light-canvas/phase12-surface-balance";
const EVID = join(OUT, "evidence-before");
const DESK = "/Users/jensmac/Desktop/htc-phase12-before";
mkdirSync(EVID, { recursive: true });
mkdirSync(DESK, { recursive: true });

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
  domain: "app.sandbox.hellotocheers.com",
  path: "/",
  httpOnly: false,
  secure: true,
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
  { id: "dashboard", path: "/dashboard" },
  { id: "automations", path: "/communication/series" },
  { id: "tours", path: "/tours" },
  { id: "requests", path: "/requests" },
  { id: "tasks", path: "/tasks" },
  { id: "setup-hub", path: "/setup-hub" },
  { id: "settings", path: "/settings" },
  { id: "library", path: "/library" },
  { id: "inventory", path: "/library/inventory" },
  { id: "lead-detail", path: `/leads/${LEAD}` },
  { id: "booking-detail", path: `/clients/${BOOKED}` },
  { id: "reporting", path: "/reporting" },
  { id: "contracts", path: "/contracts" },
  { id: "payments", path: "/payments" },
  { id: "vendors", path: "/vendors" },
];

const viewports = [
  { width: 1440, height: 1100, label: "desktop" },
  { width: 390, height: 844, label: "mobile-390" },
];

const browser = await chromium.launch({ headless: true });
const results: unknown[] = [];

for (const route of routes) {
  for (const vp of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    await ctx.addCookies(cookies);
    await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
    const page = await ctx.newPage();
    await page.goto(`${APP}${route.path}?cb=${Date.now()}`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(2500);
    const file = join(EVID, `${route.id}-${vp.label}.png`);
    await page.screenshot({ path: file, fullPage: false });
    if (existsSync(file)) copyFileSync(file, join(DESK, `${route.id}-${vp.label}.png`));
    results.push({ id: route.id, viewport: vp.label, file, url: page.url() });
    await ctx.close();
  }
}

writeFileSync(join(OUT, "before-results.json"), JSON.stringify(results, null, 2));
await browser.close();
console.log(JSON.stringify({ ok: true, shots: results.length }, null, 2));
