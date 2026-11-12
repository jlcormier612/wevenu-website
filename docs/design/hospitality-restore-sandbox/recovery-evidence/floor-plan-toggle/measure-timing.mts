/**
 * Floor Plan Working Layout toggle latency — before (Sandbox) vs after (local).
 * Uses Fancy venue demo: multi-offer client Floor Plans tab.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire(resolve("marketing/package.json"));
const { chromium } = require("playwright") as typeof import("playwright");
type Page = import("playwright").Page;
const ssrUtils = require(resolve("node_modules/@supabase/ssr/dist/main/utils/index.js"));

const WILLOW = "31f38b79-eb99-4ebc-81bc-af85767b42aa";
const EMAIL = "jennifer@hellotocheers.com";
/** Morgan & Taylor Reed — C04 Demo Carriage House Reception (Working Layout). */
const CLIENT = "11ce02ca-3c56-49f9-baf9-115d2fc830e3";
const OUT = resolve("docs/design/hospitality-restore-sandbox/recovery-evidence/floor-plan-toggle");
mkdirSync(OUT, { recursive: true });

const SWITCHES = [
  "floor-plan-switch-couple-view",
  "floor-plan-switch-seating",
  "floor-plan-couple-may-add",
  "floor-plan-switch-vendors",
] as const;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function staffCookies(domain: string, secure: boolean) {
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
  });
  if (linkError || !link?.properties?.hashed_token) throw linkError ?? new Error("magic link");
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain,
      path: "/",
      httpOnly: false,
      secure,
      sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id",
      value: WILLOW,
      domain,
      path: "/",
      httpOnly: false,
      secure,
      sameSite: "Lax" as const,
    },
  ];
}

async function openFloorPlans(page: Page, base: string) {
  await page.goto(`${base}/clients/${CLIENT}#floorplan`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.getByText("Morgan & Taylor Reed Wedding").first().waitFor({ timeout: 45_000 });
  // Hash → tab hydration needs a beat after the workspace shell mounts.
  await page.waitForTimeout(1500);
  const tab = page.locator('[role="tab"]', { hasText: /^Floor Plans$/ });
  await tab.waitFor({ timeout: 45_000 });
  if ((await tab.getAttribute("aria-selected")) !== "true") {
    await tab.click();
    await page.waitForTimeout(500);
  }
  const ws = page.getByTestId("floor-plan-operational-workspace");
  try {
    await ws.waitFor({ timeout: 45_000 });
  } catch {
    await tab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/open-floor-plans-fail.png`, fullPage: true });
    await ws.waitFor({ timeout: 30_000 });
  }
  await page.getByTestId("floor-plan-switch-couple-view").first().waitFor({ timeout: 30_000 });
  const working = page.getByTestId("floor-plan-card-working").first();
  if (await working.count()) {
    await working.scrollIntoViewIfNeeded();
  }
  return page.url();
}

type ToggleTiming = {
  testId: string;
  before: string | null;
  after: string | null;
  visibleMs: number;
  saveStartMs: number;
  confirmMs: number;
  persistMs: number;
  flipped: boolean;
};

async function timeToggle(page: Page, testId: string): Promise<ToggleTiming> {
  const sw = page.getByTestId(testId).first();
  await sw.waitFor({ state: "visible", timeout: 30_000 });
  await sw.scrollIntoViewIfNeeded();
  const before = await sw.getAttribute("aria-checked");
  const t0 = performance.now();
  let visibleMs = -1;
  let saveStartMs = -1;
  let confirmMs = -1;

  const reqPromise = page
    .waitForRequest(
      (r) =>
        r.method() === "POST" &&
        (r.url().includes("_next") || r.url().includes("floor") || r.url().includes(CLIENT)),
      { timeout: 20_000 },
    )
    .then(() => {
      saveStartMs = performance.now() - t0;
    })
    .catch(() => {
      /* action may reuse existing fetch */
    });

  const resPromise = page
    .waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        (r.url().includes("_next") || r.url().includes("floor") || r.url().includes(CLIENT)),
      { timeout: 30_000 },
    )
    .then(() => {
      confirmMs = performance.now() - t0;
    })
    .catch(() => {});

  await sw.click({ force: true });

  // Poll up to ~10s — legacy path waits for server + router.refresh().
  for (let i = 0; i < 600; i++) {
    const now = await sw.getAttribute("aria-checked");
    if (now != null && now !== before) {
      visibleMs = performance.now() - t0;
      break;
    }
    await page.waitForTimeout(16);
  }

  await Promise.all([reqPromise, resPromise]);

  // Wait for pending to clear (optimistic) or for confirmed flip (legacy)
  for (let i = 0; i < 400; i++) {
    const pending = await sw.getAttribute("data-pending");
    const now = await sw.getAttribute("aria-checked");
    if (visibleMs < 0 && now != null && now !== before) {
      visibleMs = performance.now() - t0;
    }
    if (pending === "false" || pending == null) {
      if (now != null && now !== before) break;
      if (i > 30 && visibleMs >= 0) break;
    }
    await page.waitForTimeout(25);
  }
  const persistMs = performance.now() - t0;
  const after = await sw.getAttribute("aria-checked");
  return {
    testId,
    before,
    after,
    visibleMs: Math.round(visibleMs),
    saveStartMs: Math.round(saveStartMs),
    confirmMs: Math.round(confirmMs),
    persistMs: Math.round(persistMs),
    flipped: before !== after && after != null,
  };
}

async function rapidToggle(page: Page, testId: string) {
  const sw = page.getByTestId(testId).first();
  const start = await sw.getAttribute("aria-checked");
  for (let i = 0; i < 3; i++) {
    await sw.click({ force: true });
    await page.waitForTimeout(40);
  }
  // Wait settle
  for (let i = 0; i < 200; i++) {
    const pending = await sw.getAttribute("data-pending");
    if (pending === "false" || pending == null) break;
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(400);
  const end = await sw.getAttribute("aria-checked");
  // 3 toggles → opposite of start if each flip applied; generation should match last click
  return {
    testId,
    start,
    end,
    expectedOpposite: start === "true" ? "false" : "true",
    matchesLastClick: end !== start,
  };
}

async function twoToggleRace(page: Page) {
  const a = page.getByTestId("floor-plan-switch-couple-view").first();
  const b = page.getByTestId("floor-plan-switch-vendors").first();
  const a0 = await a.getAttribute("aria-checked");
  const b0 = await b.getAttribute("aria-checked");
  await Promise.all([a.click({ force: true }), b.click({ force: true })]);
  for (let i = 0; i < 200; i++) {
    const ap = await a.getAttribute("data-pending");
    const bp = await b.getAttribute("data-pending");
    if ((ap === "false" || ap == null) && (bp === "false" || bp == null)) break;
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(500);
  const a1 = await a.getAttribute("aria-checked");
  const b1 = await b.getAttribute("aria-checked");
  return {
    couple: { before: a0, after: a1, flipped: a0 !== a1 },
    vendors: { before: b0, after: b1, flipped: b0 !== b1 },
  };
}

async function runPhase(label: string, base: string, domain: string, secure: boolean) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await ctx.addCookies(await staffCookies(domain, secure));
  const page = await ctx.newPage();
  const landed = await openFloorPlans(page, base);
  await page.screenshot({ path: `${OUT}/${label}-workspace-desktop.png`, fullPage: false });

  // Mobile viewport screenshot of switches
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${OUT}/${label}-workspace-mobile.png`, fullPage: false });
  await page.setViewportSize({ width: 1440, height: 900 });

  const results: ToggleTiming[] = [];
  for (const id of SWITCHES) {
    const count = await page.getByTestId(id).count();
    if (!count) {
      results.push({
        testId: id,
        before: null,
        after: null,
        visibleMs: -1,
        saveStartMs: -1,
        confirmMs: -1,
        persistMs: -1,
        flipped: false,
      });
      continue;
    }
    results.push(await timeToggle(page, id));
    // restore to reduce demo drift
    await timeToggle(page, id);
  }

  const rapid = await rapidToggle(page, "floor-plan-switch-couple-view");
  // restore if left flipped oddly
  const couple = page.getByTestId("floor-plan-switch-couple-view").first();
  if ((await couple.getAttribute("aria-checked")) !== rapid.start) {
    await timeToggle(page, "floor-plan-switch-couple-view");
  }

  const dual = await twoToggleRace(page);
  // restore dual
  for (const id of ["floor-plan-switch-couple-view", "floor-plan-switch-vendors"] as const) {
    const sw = page.getByTestId(id).first();
    const want =
      id === "floor-plan-switch-couple-view" ? dual.couple.before : dual.vendors.before;
    if ((await sw.getAttribute("aria-checked")) !== want) {
      await timeToggle(page, id);
    }
  }

  // Refresh persistence check on couple toggle
  const beforeRefresh = await page.getByTestId("floor-plan-switch-couple-view").first().getAttribute("aria-checked");
  await timeToggle(page, "floor-plan-switch-couple-view");
  const mid = await page.getByTestId("floor-plan-switch-couple-view").first().getAttribute("aria-checked");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Floor Plans" }).click();
  await page.getByTestId("floor-plan-operational-workspace").waitFor({ timeout: 60_000 });
  await page.getByTestId("floor-plan-switch-couple-view").first().waitFor({ timeout: 30_000 });
  const afterRefresh = await page.getByTestId("floor-plan-switch-couple-view").first().getAttribute("aria-checked");
  // restore
  if (afterRefresh !== beforeRefresh) {
    await timeToggle(page, "floor-plan-switch-couple-view");
  }

  await browser.close();

  const visibleOk = results.filter((r) => r.visibleMs >= 0);
  const report = {
    at: new Date().toISOString(),
    label,
    base,
    landed,
    summary: {
      avgVisibleMs: visibleOk.length
        ? Math.round(visibleOk.reduce((s, r) => s + r.visibleMs, 0) / visibleOk.length)
        : null,
      maxVisibleMs: visibleOk.length ? Math.max(...visibleOk.map((r) => r.visibleMs)) : null,
      avgPersistMs: visibleOk.length
        ? Math.round(visibleOk.reduce((s, r) => s + r.persistMs, 0) / visibleOk.length)
        : null,
    },
    results,
    rapid,
    dual,
    refreshPersistence: { beforeRefresh, mid, afterRefresh, persisted: mid === afterRefresh },
  };
  writeFileSync(`${OUT}/${label}-timing.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  return report;
}

const phase = process.argv[2] ?? "both";
if (phase === "before" || phase === "both") {
  await runPhase(
    "before-sandbox",
    "https://app.sandbox.hellotocheers.com",
    "app.sandbox.hellotocheers.com",
    true,
  );
}
if (phase === "after" || phase === "both") {
  await runPhase("after-local", "http://localhost:3000", "localhost", false);
}
