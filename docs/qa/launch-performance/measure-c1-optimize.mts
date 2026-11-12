/**
 * Lead Overview + Documents workflow timings (n=10) + nav click→pending bar.
 * Local only — not a Sandbox SLI.
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

const BASE = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3459";
const LABEL = process.env.PERF_LABEL ?? "c1-optimize";
const LEAD_ID = process.env.PERF_LEAD_ID ?? "54db1c0c-4332-4a4b-b5b3-eca9067ecffe";
const AVERY_ID = process.env.PERF_AVERY_ID ?? "24b2d6d7-c2df-40ae-8bd4-dacd670649a1";
const WILLOW = "31f38b79-eb99-4ebc-81bc-af85767b42aa";
const RUNS = Number(process.env.PERF_RUNS ?? "10");
const OUT_DIR = resolve("docs/qa/launch-performance/raw");
const SHOT_DIR = resolve("docs/qa/launch-performance/screenshots/c1-optimize");
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(SHOT_DIR, { recursive: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

function stats(values: number[]) {
  const xs = values.filter((v) => v >= 0).sort((a, b) => a - b);
  if (!xs.length) return { n: 0, median: null, p95: null, max: null, samples: [] as number[] };
  const median = xs[Math.floor(xs.length / 2)]!;
  const p95 = xs[Math.min(xs.length - 1, Math.ceil(xs.length * 0.95) - 1)]!;
  return { n: xs.length, median: Math.round(median), p95: Math.round(p95), max: Math.round(xs[xs.length - 1]!), samples: xs.map((v) => Math.round(v)) };
}

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

async function main() {
  const host = new URL(BASE).hostname;
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(await staffCookies(host));
  const page = await ctx.newPage();

  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("text=Good", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(800);

  const overviewUseful: number[] = [];
  const docsFirst: number[] = [];
  const docsPendingSeen: boolean[] = [];
  const docsWarm: number[] = [];
  const workflowOverviewToDocs: number[] = [];
  const rapidSwitch: number[] = [];
  const navPendingMs: number[] = [];
  const averyOverview: number[] = [];

  for (let i = 0; i < RUNS; i++) {
    // Cold-ish lead open from leads list
    await page.goto(`${BASE}/leads`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(400);
    const t0 = Date.now();
    await page.goto(`${BASE}/leads/${LEAD_ID}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await Promise.race([
      page.getByTestId("lead-overview-tab").waitFor({ state: "visible", timeout: 90000 }),
      page.getByRole("tab", { name: /Overview/i }).waitFor({ state: "visible", timeout: 90000 }),
      page.getByText(/Booking journey|Packages|Claire|Nguyen/i).first().waitFor({ state: "visible", timeout: 90000 }),
    ]);
    const useful = Date.now() - t0;
    overviewUseful.push(useful);

    // Wait briefly so idle prefetch can start (realistic dwell on Overview)
    await page.waitForTimeout(700);

    const tDoc = Date.now();
    await page.getByRole("tab", { name: /Documents/i }).click();
    const pending = await page
      .waitForSelector('[data-testid="lead-documents-deferred-pending"]', { timeout: 250 })
      .then(() => true)
      .catch(() => false);
    docsPendingSeen.push(pending);
    await page.waitForFunction(() => {
      const pendingEl = document.querySelector('[data-testid="lead-documents-deferred-pending"]');
      return !pendingEl;
    }, { timeout: 30000 }).catch(() => {});
    const firstDocs = Date.now() - tDoc;
    docsFirst.push(firstDocs);
    workflowOverviewToDocs.push(useful + 700 + firstDocs);

    await page.getByRole("tab", { name: /Overview/i }).click();
    await page.waitForTimeout(80);
    const tWarm = Date.now();
    await page.getByRole("tab", { name: /Documents/i }).click();
    await page.waitForTimeout(40);
    docsWarm.push(Date.now() - tWarm);

    // Rapid switches
    for (const name of ["Overview", "Documents", "Luv", "Overview", "Documents"]) {
      const tr = Date.now();
      await page.getByRole("tab", { name: new RegExp(name, "i") }).click();
      await page.waitForTimeout(30);
      rapidSwitch.push(Date.now() - tr);
    }

    if (i === 0) {
      await page.screenshot({ path: resolve(SHOT_DIR, `${LABEL}-documents.png`), fullPage: false });
    }
  }

  // Avery proposal lead (demo path opener)
  for (let i = 0; i < Math.min(5, RUNS); i++) {
    const t0 = Date.now();
    await page.goto(`${BASE}/leads/${AVERY_ID}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await Promise.race([
      page.getByTestId("lead-overview-tab").waitFor({ state: "visible", timeout: 90000 }),
      page.getByRole("tab", { name: /Overview/i }).waitFor({ state: "visible", timeout: 90000 }),
      page.getByText(/Booking journey|Avery|Blake/i).first().waitFor({ state: "visible", timeout: 90000 }),
    ]);
    averyOverview.push(Date.now() - t0);
  }

  // Soft-nav click → pending bar (no artificial RSC hold)
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(500);
  for (let i = 0; i < 10; i++) {
    const target = i % 2 === 0 ? "/leads" : "/calendar";
    const t0 = Date.now();
    await page.evaluate((href) => {
      const a = document.querySelector(`a[href="${href}"], a[href^="${href}?"]`) as HTMLAnchorElement | null;
      a?.click();
    }, target);
    const seen = await page
      .waitForSelector('[data-testid="navigation-pending-bar"][aria-busy="true"]', { timeout: 500 })
      .then(() => Date.now() - t0)
      .catch(() => -1);
    navPendingMs.push(seen);
    await page.waitForTimeout(900);
  }

  await page.screenshot({ path: resolve(SHOT_DIR, `${LABEL}-dashboard.png`), fullPage: false });

  const report = {
    at: new Date().toISOString(),
    label: LABEL,
    base: BASE,
    leadId: LEAD_ID,
    averyId: AVERY_ID,
    environment: "local-next-start",
    overviewUseful: stats(overviewUseful),
    documentsFirst: stats(docsFirst),
    documentsPendingSeenRate: docsPendingSeen.filter(Boolean).length / Math.max(1, docsPendingSeen.length),
    documentsWarm: stats(docsWarm),
    workflowOverviewPlusDocs: stats(workflowOverviewToDocs),
    rapidSwitch: stats(rapidSwitch),
    navClickToPendingBar: stats(navPendingMs),
    averyOverviewUseful: stats(averyOverview),
  };

  const outPath = resolve(OUT_DIR, `${LABEL}-latest.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
