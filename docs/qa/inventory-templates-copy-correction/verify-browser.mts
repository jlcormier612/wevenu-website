/**
 * Inventory Templates page copy — approved language, no redundant Use/Send blocks.
 * EXPECTED_SHA=<serving> npx tsx docs/qa/inventory-templates-copy-correction/verify-browser.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/inventory-templates-copy-correction";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
}

async function servingImage() {
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function staffCookies() {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45_000);
      const res = await fetch(`${url}/auth/v1/admin/generate_link`, {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "magiclink", email: EMAIL }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`generate_link HTTP ${res.status}`);
      const body = await res.json() as { hashed_token?: string; properties?: { hashed_token?: string } };
      const hash = body.hashed_token ?? body.properties?.hashed_token;
      if (!hash) throw new Error("missing hashed_token");
      const { data: otp, error } = await anon.auth.verifyOtp({ type: "email", token_hash: hash });
      if (!error && otp?.session) {
        const projectRef = new URL(url).hostname.split(".")[0];
        const cookieName = `sb-${projectRef}-auth-token`;
        const chunked = ssrUtils.createChunks(cookieName, JSON.stringify(otp.session));
        return (Array.isArray(chunked) ? chunked : [{ name: cookieName, value: chunked }]).map(
          (c: { name: string; value: string }) => ({
            name: c.name,
            value: c.value,
            domain: "app.sandbox.hellotocheers.com",
            path: "/",
            httpOnly: false,
            secure: true,
            sameSite: "Lax" as const,
          }),
        );
      }
      lastErr = error ?? new Error("no session");
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw lastErr ?? new Error("staff session failed");
}

async function assertCopy(page: import("playwright").Page, label: string) {
  const body = await page.locator("main, body").first().innerText();
  const compact = body.replace(/\s+/g, " ");

  record(`${label}_title`, /Inventory Templates/.test(compact), compact.slice(0, 120));
  record(
    `${label}_description`,
    /Reusable starting lists for the inventory you typically provide at an event/.test(compact),
    compact.slice(0, 220),
  );
  record(
    `${label}_use_send_explanation`,
    /Use applies the list to an event without sharing it/.test(compact)
      && /Send to client applies it if needed and shares the event inventory for the couple to review/.test(compact),
    compact.match(/Use applies[\s\S]{0,220}review/)?.[0] ?? "missing",
  );
  record(`${label}_no_handoff`, !/Event Order handoff/i.test(compact), "handoff");
  record(`${label}_no_parallel_payment`, !/parallel payment/i.test(compact), "parallel");
  record(`${label}_no_draft_snapshot`, !/draft snapshot/i.test(compact), "snapshot");

  // Use/Send explanation should appear once (not repeated in a third list blurb).
  const useSendHits = (compact.match(/applies the list to an event without sharing it/g) ?? []).length;
  record(`${label}_use_send_once`, useSendHits === 1, `hits=${useSendHits}`);

  record(`${label}_catalog_note`, /Built from your Available Inventory catalog/.test(compact), "catalog");
  record(`${label}_has_use_action`, /\bUse\b/.test(compact), "Use present");
  record(`${label}_has_send_action`, /Send to client/.test(compact), "Send to client present");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  record(`${label}_no_h_overflow`, !overflow, `overflow=${overflow}`);
}

async function main() {
  const image = await servingImage();
  record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
  if (!image.includes(EXPECTED.slice(0, 12))) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ at: new Date().toISOString(), checks, image }, null, 2));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(await staffCookies());
  const page = await ctx.newPage();

  try {
    await page.goto(`${APP}/library/inventory-templates`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/shots/desktop.png`, fullPage: true });
    await assertCopy(page, "desktop");

    // Open Use sheet — confirm workflow still opens (distinct from Send).
    const useBtn = page.getByRole("button", { name: /^Use$/i }).first();
    if ((await useBtn.count()) > 0) {
      await useBtn.click();
      await page.waitForTimeout(1500);
      const sheet = await page.locator("[role='dialog'], [data-state='open']").first().innerText().catch(() => "");
      record("use_sheet_opens", /Use Template|Choose a client/i.test(sheet) || /inventory draft|without sharing/i.test(sheet), sheet.slice(0, 200));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    } else {
      record("use_sheet_opens", false, "no Use button");
    }

    const sendBtn = page.getByRole("button", { name: /Send to client/i }).first();
    if ((await sendBtn.count()) > 0) {
      await sendBtn.click();
      await page.waitForTimeout(1500);
      const sheet = await page.locator("[role='dialog'], [data-state='open']").first().innerText().catch(() => "");
      record("send_sheet_opens", /Send to client|share for portal|portal review/i.test(sheet), sheet.slice(0, 200));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    } else {
      record("send_sheet_opens", false, "no Send to client button");
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP}/library/inventory-templates`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/shots/390.png`, fullPage: true });
    await assertCopy(page, "narrow");
  } finally {
    await browser.close();
  }

  const ok = checks.every((c) => c.pass);
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify({ at: new Date().toISOString(), expectedSha: EXPECTED, image, checks, ok }, null, 2),
  );
  console.log(ok ? "VERDICT=GREEN" : "VERDICT=OPEN");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
