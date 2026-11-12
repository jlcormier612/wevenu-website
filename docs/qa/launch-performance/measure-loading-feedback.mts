/**
 * Measure click → hospitality loading feedback on the local perf candidate.
 * Delays the document response so loading.tsx remains visible long enough to capture.
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

const BASE = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3456";
const WILLOW = "31f38b79-eb99-4ebc-81bc-af85767b42aa";
const OUT = resolve("docs/qa/launch-performance/screenshots/wave-b");
mkdirSync(OUT, { recursive: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

async function staffCookies(originHost: string) {
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
      domain: originHost,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id",
      value: WILLOW,
      domain: originHost,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    },
  ];
}

type Sample = { route: string; clickToFeedbackMs: number; sawLoading: boolean };

async function main() {
  const host = new URL(BASE).hostname;
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(await staffCookies(host));
  const page = await ctx.newPage();

  // Warm session on dashboard first (no delay).
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(1500);

  const routes = [
    { path: "/leads", name: "leads" },
    { path: "/clients", name: "clients" },
    { path: "/payments", name: "payments" },
    { path: "/reporting", name: "reporting" },
    { path: "/calendar", name: "calendar" },
    { path: "/dashboard", name: "dashboard" },
  ];

  const samples: Sample[] = [];

  for (const route of routes) {
    // Next navigation: intercept HTML document to hold loading UI.
    let release: (() => void) | null = null;
    const gate = new Promise<void>((r) => {
      release = r;
    });

    await page.route("**/*", async (proxy) => {
      const req = proxy.request();
      const isDoc = req.resourceType() === "document" && req.url().includes(route.path);
      if (isDoc) {
        await gate;
      }
      await proxy.continue();
    });

    const started = Date.now();
    const nav = page.goto(`${BASE}${route.path}`, { waitUntil: "commit", timeout: 120000 });
    // Poll for loading testid while document is held.
    let feedbackMs = -1;
    let saw = false;
    for (let i = 0; i < 40; i++) {
      const count = await page.locator('[data-testid="hospitality-route-loading"]').count();
      if (count > 0) {
        feedbackMs = Date.now() - started;
        saw = true;
        await page.screenshot({ path: `${OUT}/${route.name}-loading__desktop.png` });
        break;
      }
      await page.waitForTimeout(25);
    }
    release?.();
    await nav.catch(() => null);
    await page.unroute("**/*");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${route.name}-loaded__desktop.png` });
    samples.push({ route: route.path, clickToFeedbackMs: feedbackMs, sawLoading: saw });
  }

  // Mobile sample for leads
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/leads`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/leads-loaded__mobile.png` });

  await browser.close();
  const report = {
    at: new Date().toISOString(),
    base: BASE,
    note: "clickToFeedbackMs measured while holding the document response so loading.tsx can paint",
    samples,
  };
  writeFileSync(resolve("docs/qa/launch-performance/raw/wave-b-feedback-latest.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
