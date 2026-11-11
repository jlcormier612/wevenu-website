/**
 * Offerings page copy — concise description + one HowItWorks; links retained.
 * EXPECTED_SHA=<serving> npx tsx docs/qa/offerings-page-copy-correction/verify-browser.mts
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
const OUT = "docs/qa/offerings-page-copy-correction";
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

function servingShaFromImage(image: string): string {
  return (image.split(":").pop() ?? "").trim();
}

function acceptsServing(image: string): { ok: boolean; detail: string } {
  const tip = servingShaFromImage(image);
  if (tip.startsWith(EXPECTED.slice(0, 12)) || image.includes(EXPECTED.slice(0, 12))) {
    return { ok: true, detail: `exact tip=${tip}` };
  }
  try {
    execSync(`git merge-base --is-ancestor ${EXPECTED} ${tip}`, { stdio: "ignore" });
    return { ok: true, detail: `descendant tip=${tip} contains ancestor=${EXPECTED}` };
  } catch {
    return { ok: false, detail: `tip=${tip} does not contain ${EXPECTED}` };
  }
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
  const body = await page.locator("main").innerText();
  const compact = body.replace(/\s+/g, " ");

  record(`${label}_title`, /Offerings/.test(compact), compact.slice(0, 120));
  record(
    `${label}_description`,
    /Organize the services, packages, and options your venue offers/.test(compact),
    compact.slice(0, 220),
  );
  record(
    `${label}_how_it_works`,
    /How Offerings work/.test(compact)
      && /Event Order Templates use these offerings/.test(compact),
    compact.match(/How Offerings work[\s\S]{0,220}/)?.[0] ?? "missing",
  );
  record(`${label}_how_once`, (compact.match(/How Offerings work/g) ?? []).length === 1, "once");
  record(`${label}_no_duplicating_records`, !/without duplicating records/i.test(compact), "dup");
  record(`${label}_no_included_lines`, !/included lines/i.test(compact), "included");
  record(`${label}_no_finalization_blurb`, !/Client selection and Event Order finalization/i.test(compact), "final");
  record(`${label}_eo_link`, /Open Event Order Templates/.test(compact), "eo");
  record(`${label}_inventory_link`, /Manage Available Inventory/.test(compact), "inv");
  record(`${label}_new_offering`, /\+ New Offering|New Offering/.test(compact), "new");
  record(`${label}_archive_control`, /Show archived|Hide archived/.test(compact), "archive");
  record(`${label}_list_present`, await page.locator('[data-testid="offerings-library"]').count() > 0, "list");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  record(`${label}_no_h_overflow`, !overflow, `overflow=${overflow}`);
}

async function main() {
  const image = await servingImage();
  const accept = acceptsServing(image);
  record("serving_sha", accept.ok, `expected=${EXPECTED} ecs=${image} ${accept.detail}`);
  if (!accept.ok) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ at: new Date().toISOString(), checks, image }, null, 2));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(await staffCookies());
  const page = await ctx.newPage();

  try {
    await page.goto(`${APP}/library/offerings`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/shots/desktop.png`, fullPage: true });
    await assertCopy(page, "desktop");

    const eo = page.locator("main a").filter({ hasText: /Open Event Order Templates/i }).first();
    record("eo_link_href", (await eo.getAttribute("href")) === "/library/event-order-templates", await eo.getAttribute("href") ?? "none");
    await eo.click();
    await page.waitForTimeout(2500);
    record("eo_nav_works", page.url().includes("/library/event-order-templates"), page.url());

    await page.goto(`${APP}/library/offerings`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    const inv = page.locator("main a").filter({ hasText: /Manage Available Inventory/i }).first();
    record("inv_link_href", (await inv.getAttribute("href")) === "/library/inventory", await inv.getAttribute("href") ?? "none");
    await inv.click();
    await page.waitForTimeout(2500);
    record("inv_nav_works", page.url().includes("/library/inventory"), page.url());

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP}/library/offerings`, { waitUntil: "domcontentloaded", timeout: 90_000 });
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
