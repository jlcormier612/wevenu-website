/** Sandbox before for overdue + lead hold refinements. */
import { createRequire } from "node:module";
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssr = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const LEAD = "20e470d8-ab91-4db1-bbae-d75dad943b69";
const EVID =
  "/Users/jensmac/Developer/wevenu-website/docs/qa/staff-light-canvas/phase12-surface-balance/final-acceptance/before";
const DESK = "/Users/jensmac/Desktop/htc-phase12-final/before";
mkdirSync(EVID, { recursive: true });
mkdirSync(DESK, { recursive: true });

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

const browser = await chromium.launch();
const jobs = [
  { id: "tasks-overdue", path: "/tasks", vps: [[1440, 1100, "desktop"], [390, 844, "mobile-390"]] as const },
  {
    id: "lead-hold",
    path: `/leads/${LEAD}`,
    vps: [[375, 812, "mobile-375"], [390, 844, "mobile-390"], [1440, 1100, "desktop"]] as const,
  },
];
for (const job of jobs) {
  for (const [w, h, label] of job.vps) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addCookies(cookies);
    await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
    const page = await ctx.newPage();
    await page.goto(`${APP}${job.path}?cb=${Date.now()}`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(2500);
    const file = join(EVID, `${job.id}-${label}.png`);
    await page.screenshot({ path: file, fullPage: false });
    if (existsSync(file)) copyFileSync(file, join(DESK, `${job.id}-${label}.png`));
    console.log("ok", job.id, label);
    await ctx.close();
  }
}
await browser.close();
