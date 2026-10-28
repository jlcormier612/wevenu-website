/**
 * Verify Saved Reports CollectionBackLink → /library (Templates).
 * EXPECTED_SHA=<serving> npx tsx docs/qa/saved-reports-back-nav/verify-browser.mts
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
const OUT = "docs/qa/saved-reports-back-nav";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 1500) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 300)}`);
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

async function assertSavedPage(page: import("playwright").Page, label: string) {
  const positions = await page.evaluate(() => {
    const link = document.querySelector('a[href="/library"]');
    const headings = Array.from(document.querySelectorAll("h1, h2"));
    const reports = headings.find((h) => /Reports/i.test(h.textContent ?? ""));
    if (!link || !reports) return null;
    const lr = link.getBoundingClientRect();
    const hr = reports.getBoundingClientRect();
    return {
      linkTop: lr.top,
      reportsTop: hr.top,
      linkText: (link.textContent ?? "").trim(),
      reportsText: (reports.textContent ?? "").trim(),
    };
  });
  record(
    `${label}_back_above_reports`,
    !!positions && positions.linkTop < positions.reportsTop && /Templates/i.test(positions.linkText),
    JSON.stringify(positions),
  );

  const body = await page.locator("body").innerText();
  record(`${label}_reports_heading`, /\bReports\b/.test(body), body.slice(0, 180).replace(/\s+/g, " "));
  record(`${label}_tabs_present`, /Overview/.test(body) && /Saved/.test(body) && /Sales/.test(body), "tabs");
  record(`${label}_saved_heading`, /Saved Reports/.test(body), "saved heading");
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
    await page.goto(`${APP}/reporting/saved`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/shots/saved-desktop.png`, fullPage: true });

    const back = page.locator('a[href="/library"]').filter({ hasText: /Templates/i }).first();
    const backCount = await back.count();
    record("back_link_present", backCount > 0, `count=${backCount}`);
    const href = backCount ? await back.getAttribute("href") : null;
    record("back_link_href", href === "/library", `href=${href}`);

    await assertSavedPage(page, "desktop");

    // Other report tabs must NOT show Templates back
    await page.goto(`${APP}/reporting`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    const overviewBack = await page.locator('a[href="/library"]').filter({ hasText: /Templates/i }).count();
    record("overview_no_templates_back", overviewBack === 0, `count=${overviewBack}`);

    await page.goto(`${APP}/reporting/sales`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    const salesBack = await page.locator('a[href="/library"]').filter({ hasText: /Templates/i }).count();
    record("sales_no_templates_back", salesBack === 0, `count=${salesBack}`);

    // Click back from Saved → Library/Templates
    await page.goto(`${APP}/reporting/saved`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);
    await page.locator('a[href="/library"]').filter({ hasText: /Templates/i }).first().click();
    await page.waitForTimeout(3000);
    const onLibrary = page.url().includes("/library") && !page.url().includes("/reporting");
    record("click_returns_to_library", onLibrary, page.url());
    await page.screenshot({ path: `${OUT}/shots/after-back.png`, fullPage: true });
    const libraryBody = await page.locator("body").innerText();
    record("library_page_content", /Templates|Library|Saved Reports|Brochures/i.test(libraryBody), libraryBody.slice(0, 220).replace(/\s+/g, " "));

    // Narrow viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP}/reporting/saved`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/shots/saved-390.png`, fullPage: true });
    const narrowBack = await page.locator('a[href="/library"]').filter({ hasText: /Templates/i }).count();
    record("narrow_back_present", narrowBack > 0, "390px");
    await assertSavedPage(page, "narrow");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    record("no_horizontal_overflow", !overflow, `overflow=${overflow}`);

    // Tabs still switch
    await page.getByRole("link", { name: /^Overview$/i }).first().click();
    await page.waitForTimeout(2000);
    record("tab_overview_works", page.url().includes("/reporting") && !page.url().includes("/saved"), page.url());
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
