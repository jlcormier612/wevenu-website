/**
 * Local Wave F review — Automations edit / new deeper workspace chrome.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssr = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = process.env.HTC_CAPTURE_BASE ?? "http://127.0.0.1:3000";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT =
  "/Users/jensmac/Developer/wevenu-website/docs/qa/staff-light-canvas/wave-f-deeper-editors";
const EVID = join(OUT, "evidence");
const DESK = "/Users/jensmac/Desktop/htc-rule-k-review";
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

const browser = await chromium.launch({ headless: true });
const results: unknown[] = [];
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
});
await context.addCookies(cookies);
const page = await context.newPage();

async function shot(name: string, path: string, wait: string) {
  try {
    await page.goto(`${APP}${path}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector(wait, { timeout: 30000 });
    await page.waitForTimeout(400);
    const file = `${name}.png`;
    const full = join(EVID, file);
    await page.screenshot({ path: full, fullPage: false });
    copyFileSync(full, join(DESK, file));
    results.push({ name, ok: true, file, path });
    console.log("ok", name, path);
  } catch (err) {
    results.push({
      name,
      ok: false,
      path,
      error: err instanceof Error ? err.message : String(err),
    });
    console.error("fail", name, err);
  }
}

await shot("automations-new-desktop", "/communication/series/new", ".htc-working-card");

await page.goto(`${APP}/communication/series`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("main", { timeout: 30000 });
const editHref = await page.locator('a[href*="/communication/series/"][href$="/edit"]').first().getAttribute("href");
if (editHref) {
  await shot("automations-edit-desktop", editHref, ".htc-working-card");
} else {
  results.push({ name: "automations-edit-desktop", ok: false, error: "no edit link on list" });
  console.error("fail automations-edit-desktop — no edit link");
}

await context.close();
await browser.close();
writeFileSync(join(OUT, "results.json"), JSON.stringify({ results }, null, 2));
console.log("Desktop folder:", DESK);
