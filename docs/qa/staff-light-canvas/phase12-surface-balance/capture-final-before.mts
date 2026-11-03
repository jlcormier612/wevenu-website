/** Before shots for the three Phase 12 final refinements. */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssr = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = process.env.HTC_CAPTURE_BASE ?? "http://127.0.0.1:3000";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const LEAD = "20e470d8-ab91-4db1-bbae-d75dad943b69";
const OUT =
  "/Users/jensmac/Developer/wevenu-website/docs/qa/staff-light-canvas/phase12-surface-balance/final-acceptance";
const EVID = join(OUT, "before");
const DESK = "/Users/jensmac/Desktop/htc-phase12-final/before";
mkdirSync(EVID, { recursive: true });
mkdirSync(DESK, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: "jennifer@hellotocheers.com" });
const { data: otp } = await anon.auth.verifyOtp({ type: "email", token_hash: link!.properties!.hashed_token! });
const base = { domain: new URL(APP).hostname, path: "/", httpOnly: false, secure: APP.startsWith("https"), sameSite: "Lax" as const };
const cookies = [
  ...ssr.createChunks("sb-wvpsldwwjqdannqasrdf-auth-token", "base64-" + ssr.stringToBase64URL(JSON.stringify(otp!.session))).map((c: { name: string; value: string }) => ({ ...base, ...c })),
  { ...base, name: "htc_active_venue_id", value: FANCY },
];

const shots = [
  { id: "tasks-header", path: "/tasks", vps: ["mobile-375", "mobile-390", "desktop"] },
  { id: "tasks-overdue", path: "/tasks", vps: ["desktop", "mobile-390"] },
  { id: "lead-hold", path: `/leads/${LEAD}`, vps: ["mobile-375", "mobile-390", "desktop"] },
];
const VP = {
  desktop: { width: 1440, height: 1100 },
  "mobile-390": { width: 390, height: 844 },
  "mobile-375": { width: 375, height: 812 },
};

const browser = await chromium.launch({ headless: true });
const results: unknown[] = [];
for (const shot of shots) {
  for (const label of shot.vps) {
    const vp = VP[label as keyof typeof VP];
    const ctx = await browser.newContext({ viewport: vp });
    await ctx.addCookies(cookies);
    await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
    const page = await ctx.newPage();
    await page.goto(`${APP}${shot.path}?cb=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(2500);
    const file = join(EVID, `${shot.id}-${label}.png`);
    await page.screenshot({ path: file, fullPage: false });
    if (existsSync(file)) copyFileSync(file, join(DESK, `${shot.id}-${label}.png`));
    results.push({ id: shot.id, viewport: label, file });
    await ctx.close();
  }
}
writeFileSync(join(OUT, "before-results.json"), JSON.stringify(results, null, 2));
await browser.close();
console.log(JSON.stringify({ ok: true, shots: results.length }, null, 2));
