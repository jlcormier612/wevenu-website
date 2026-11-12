/**
 * C1 hardening acceptance measurements (local).
 * Cold Documents (0 dwell), prefetched Documents (700ms dwell), nav pending, deep links.
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
const LABEL = process.env.PERF_LABEL ?? "c1-hardening";
const LEAD_ID = process.env.PERF_LEAD_ID ?? "54db1c0c-4332-4a4b-b5b3-eca9067ecffe";
const WILLOW = "31f38b79-eb99-4ebc-81bc-af85767b42aa";
const RUNS = Number(process.env.PERF_RUNS ?? "10");
const OUT_DIR = resolve("docs/qa/launch-performance/raw");
const SHOT_DIR = resolve("docs/qa/launch-performance/screenshots/c1-hardening");
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
  if (!xs.length) return { n: 0, median: null as number | null, p95: null as number | null, max: null as number | null, samples: [] as number[] };
  return {
    n: xs.length,
    median: Math.round(xs[Math.floor(xs.length / 2)]!),
    p95: Math.round(xs[Math.min(xs.length - 1, Math.ceil(xs.length * 0.95) - 1)]!),
    max: Math.round(xs[xs.length - 1]!),
    samples: xs.map((v) => Math.round(v)),
  };
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

async function waitOverview(page: import("playwright").Page) {
  await Promise.race([
    page.getByTestId("lead-overview-tab").waitFor({ state: "visible", timeout: 90000 }),
    page.getByRole("tab", { name: /Overview/i }).waitFor({ state: "visible", timeout: 90000 }),
  ]);
}

async function waitDocsSettled(page: import("playwright").Page) {
  await page.waitForFunction(() => {
    const pending = document.querySelector('[data-testid="lead-documents-deferred-pending"]');
    const err = document.querySelector('[data-testid="lead-documents-deferred-error"]');
    const workspace = document.body.innerText.includes("Documents");
    return (!pending && workspace) || !!err;
  }, { timeout: 45000 });
}

async function main() {
  const host = new URL(BASE).hostname;
  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await desktop.addCookies(await staffCookies(host));
  const page = await desktop.newPage();

  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(600);

  const overviewUseful: number[] = [];
  const docsCold: number[] = [];
  const docsPrefetched: number[] = [];
  const docsWarm: number[] = [];
  const luvFirst: number[] = [];
  const rapid: number[] = [];
  const deepDocs: number[] = [];
  const navPending: number[] = [];
  const pendingStuck = { seen: false, cleared: true };

  for (let i = 0; i < RUNS; i++) {
    // Overview
    const t0 = Date.now();
    await page.goto(`${BASE}/leads/${LEAD_ID}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await waitOverview(page);
    overviewUseful.push(Date.now() - t0);

    // Cold Documents — click immediately (no dwell)
    const tCold = Date.now();
    await page.getByRole("tab", { name: /Documents/i }).click();
    await waitDocsSettled(page);
    docsCold.push(Date.now() - tCold);

    await page.getByRole("tab", { name: /Overview/i }).click();
    await page.waitForTimeout(50);
    const tWarm = Date.now();
    await page.getByRole("tab", { name: /Documents/i }).click();
    await page.waitForTimeout(40);
    docsWarm.push(Date.now() - tWarm);

    // Prefetched path: reload overview, dwell, then Documents
    await page.goto(`${BASE}/leads/${LEAD_ID}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await waitOverview(page);
    await page.waitForTimeout(700);
    const tPref = Date.now();
    await page.getByRole("tab", { name: /Documents/i }).click();
    await waitDocsSettled(page);
    docsPrefetched.push(Date.now() - tPref);

    // Luv
    const tLuv = Date.now();
    await page.getByRole("tab", { name: /Luv/i }).click();
    await page.waitForFunction(() => !document.querySelector('[data-testid="lead-luv-deferred-pending"]'), {
      timeout: 45000,
    }).catch(() => {});
    luvFirst.push(Date.now() - tLuv);

    for (const name of ["Overview", "Documents", "Luv", "Overview"]) {
      const tr = Date.now();
      await page.getByRole("tab", { name: new RegExp(name, "i") }).click();
      await page.waitForTimeout(30);
      rapid.push(Date.now() - tr);
    }

    // Deep link ?tab=documents
    const tDeep = Date.now();
    await page.goto(`${BASE}/leads/${LEAD_ID}?tab=documents`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.getByRole("tab", { name: /Documents/i }).waitFor({ state: "visible", timeout: 90000 });
    deepDocs.push(Date.now() - tDeep);
  }

  // Nav pending timing + stuck check
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(400);
  for (let i = 0; i < 10; i++) {
    const target = i % 2 === 0 ? "/leads" : "/reporting";
    const t0 = Date.now();
    await page.evaluate((href) => {
      const a = [...document.querySelectorAll("a")].find((el) => {
        const h = el.getAttribute("href") || "";
        return h === href || h.startsWith(`${href}?`);
      }) as HTMLAnchorElement | undefined;
      a?.click();
    }, target);
    const ms = await page
      .waitForSelector('[data-testid="navigation-pending-bar"][aria-busy="true"]', { timeout: 400 })
      .then(() => Date.now() - t0)
      .catch(() => -1);
    navPending.push(ms);
    if (ms >= 0) pendingStuck.seen = true;
    await page.waitForTimeout(1000);
    const still = await page.locator('[data-testid="navigation-pending-bar"][aria-busy="true"]').count();
    if (still > 0) pendingStuck.cleared = false;
  }

  // Screenshots desktop
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(SHOT_DIR, `${LABEL}-dashboard-desktop.png`) });
  await page.goto(`${BASE}/leads`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(SHOT_DIR, `${LABEL}-leads-desktop.png`) });
  await page.goto(`${BASE}/leads/${LEAD_ID}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitOverview(page);
  await page.screenshot({ path: resolve(SHOT_DIR, `${LABEL}-lead-desktop.png`) });

  // Mobile
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mobile.addCookies(await staffCookies(host));
  const m = await mobile.newPage();
  await m.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await m.waitForTimeout(600);
  await m.screenshot({ path: resolve(SHOT_DIR, `${LABEL}-dashboard-mobile.png`) });
  await m.goto(`${BASE}/leads/${LEAD_ID}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitOverview(m);
  await m.screenshot({ path: resolve(SHOT_DIR, `${LABEL}-lead-mobile.png`) });

  // Hash deep link
  await page.goto(`${BASE}/leads/${LEAD_ID}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitOverview(page);
  await page.evaluate(() => {
    window.location.hash = "documents";
  });
  await page.waitForTimeout(300);
  const hashTab = await page.getByRole("tab", { name: /Documents/i }).getAttribute("data-state");

  const report = {
    at: new Date().toISOString(),
    label: LABEL,
    base: BASE,
    environment: "local-standalone",
    leadId: LEAD_ID,
    overviewUseful: stats(overviewUseful),
    documentsColdImmediate: stats(docsCold),
    documentsAfterPrefetchDwell: stats(docsPrefetched),
    documentsWarm: stats(docsWarm),
    luvFirst: stats(luvFirst),
    rapidSwitch: stats(rapid),
    deepLinkTabDocuments: stats(deepDocs),
    navClickToPending: stats(navPending),
    navPendingClears: pendingStuck,
    hashDocumentsTabState: hashTab,
  };
  writeFileSync(resolve(OUT_DIR, `${LABEL}-latest.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
