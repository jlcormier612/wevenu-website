/**
 * Mobile navigation pending acceptance (C1 hardening).
 * Opens sheet → navigates → asserts pending bar + sheet close + no stuck state.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });
config({ path: resolve(process.cwd(), "../../.env.local"), quiet: true });

const require = createRequire(resolve(process.cwd(), "marketing/package.json"));
const { chromium } = require("playwright");
const ssrUtils = require(resolve(process.cwd(), "node_modules/@supabase/ssr/dist/main/utils/index.js"));

const BASE = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3460";
const WILLOW = "31f38b79-eb99-4ebc-81bc-af85767b42aa";
const OUT = resolve("docs/qa/launch-performance/screenshots/c1-hardening");
const RAW = resolve("docs/qa/launch-performance/raw");
mkdirSync(OUT, { recursive: true });
mkdirSync(RAW, { recursive: true });

async function cookies(host: string) {
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
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp!.session));
  return [
    ...ssrUtils.createChunks("sb-wvpsldwwjqdannqasrdf-auth-token", encoded).map((c: { name: string; value: string }) => ({
      ...c,
      domain: host,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id",
      value: WILLOW,
      domain: host,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    },
  ];
}

async function main() {
  const host = new URL(BASE).hostname;
  const browser = await chromium.launch({ headless: true });
  const results: Record<string, unknown> = { at: new Date().toISOString(), base: BASE, checks: [] as unknown[] };

  async function run(emulateReducedMotion: boolean) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: emulateReducedMotion ? "reduce" : "no-preference",
    });
    await ctx.addCookies(await cookies(host));
    const page = await ctx.newPage();
    const tag = emulateReducedMotion ? "reduced-motion" : "normal";

    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(800);
    if (page.url().includes("legal-unavailable")) {
      (results.checks as unknown[]).push({
        tag,
        blocked: true,
        reason: "legal-unavailable gate",
        pass: false,
      });
      await ctx.close();
      return;
    }

    const openNav = page.getByRole("button", { name: /Open navigation/i });
    if ((await openNav.count()) === 0) {
      // Fallback: first header icon button on compact layouts.
      await page.locator("header button").first().click();
    } else {
      await openNav.click();
    }
    await page.waitForTimeout(250);
    await page.screenshot({ path: resolve(OUT, `mobile-nav-sheet-open__${tag}.png`) });

    const t0 = Date.now();
    const pendingWait = page
      .waitForSelector('[data-testid="navigation-pending-bar"][aria-busy="true"]', { timeout: 800 })
      .then(() => Date.now() - t0)
      .catch(() => -1);
    await page.getByRole("link", { name: /^Leads$/i }).click();
    const pendingMs = await pendingWait;

    await page.waitForTimeout(1200);
    const sheetOpen = await page.getByRole("dialog").isVisible().catch(() => false);
    const stuck = (await page.locator('[data-testid="navigation-pending-bar"][aria-busy="true"]').count()) > 0;
    await page.waitForURL(/\/leads/, { timeout: 60000 }).catch(() => {});
    await page.screenshot({ path: resolve(OUT, `mobile-nav-after-leads__${tag}.png`) });

    // Rapid taps: open sheet → Reporting → back
    await page.getByRole("button", { name: /Open navigation/i }).click();
    await page.waitForTimeout(200);
    await page.getByRole("link", { name: /^Reports$/i }).click();
    await page.waitForTimeout(1000);
    const stuck2 = (await page.locator('[data-testid="navigation-pending-bar"][aria-busy="true"]').count()) > 0;
    await page.goBack();
    await page.waitForTimeout(500);
    const stuckBack = (await page.locator('[data-testid="navigation-pending-bar"][aria-busy="true"]').count()) > 0;

    (results.checks as unknown[]).push({
      tag,
      pendingMs,
      sheetClosedAfterNav: !sheetOpen,
      pendingCleared: !stuck,
      rapidReportingCleared: !stuck2,
      backCleared: !stuckBack,
      pass:
        pendingMs >= 0 &&
        pendingMs < 200 &&
        !sheetOpen &&
        !stuck &&
        !stuck2 &&
        !stuckBack,
    });

    await ctx.close();
  }

  await run(false);
  await run(true);

  writeFileSync(resolve(RAW, "mobile-nav-pending-latest.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  const failed = (results.checks as { pass: boolean }[]).filter((c) => !c.pass);
  await browser.close();
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
