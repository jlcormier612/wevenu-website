/**
 * NAV-PERF Wave 7A — Sandbox booking usefulness remasure (read-only).
 * Compare against Wave 6 Sandbox baseline using the same Fancy fixture.
 * No mutations / OpenAI / Production.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: process.env.DOTENV_CONFIG_PATH ?? ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = process.env.HTC_MEASURE_BASE ?? "https://app.sandbox.hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const CLIENT_ID = process.env.NAV_CLIENT_ID ?? "49aba826-0bd3-4891-ac9f-02a18b2b6962";
const EVENT_ID = process.env.NAV_EVENT_ID ?? "74a2487d-40fc-418f-a6bc-54abef28b6e1";
const EXPECTED_SHA = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const N = Number(process.env.NAV_PERF_SAMPLES ?? 8);
const OUT = resolve("docs/qa/launch-performance/nav-perf-wave7a");
const DESK = join(homedir(), "Desktop/HTC-NAV-PERF-WAVE7A-SANDBOX");
mkdirSync(OUT, { recursive: true });
mkdirSync(DESK, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("non-sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function median(vals: number[]) {
  const s = [...vals].filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return null;
  return s[Math.floor(s.length / 2)]!;
}
function p90(vals: number[]) {
  const s = [...vals].filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return null;
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.9) - 1)]!;
}

async function authCookies(hostname: string, secure: boolean) {
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const authed = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${otpData.session.access_token}` } },
  });
  const { data: setRes, error: setErr } = await authed.rpc("set_active_venue", { p_venue_id: FANCY });
  if (setErr) throw setErr;
  if (!(setRes as { ok?: boolean } | null)?.ok) throw new Error("set_active_venue failed");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name, value: c.value, domain: hostname, path: "/", httpOnly: false, secure, sameSite: "Lax" as const,
    })),
    { name: "htc_active_venue_id", value: FANCY, domain: hostname, path: "/", httpOnly: false, secure, sameSite: "Lax" as const },
  ];
}

type Sample = {
  mode: "cold" | "warm";
  sample: number;
  ttfbMs: number | null;
  identityMs: number | null;
  primaryActionParityMs: number | null;
  detailReadyMs: number | null;
  fallbackDurationMs: number | null;
  sawFallback: boolean;
  dpl: string | null;
  openai: number;
  consoleErrors: string[];
  error?: string;
};

async function measure(context: import("playwright").BrowserContext, mode: "cold" | "warm", sample: number): Promise<Sample> {
  const page = await context.newPage();
  let openai = 0;
  const consoleErrors: string[] = [];
  page.on("request", (req) => {
    if (/api\.openai\.com|luv-ask/i.test(req.url())) openai += 1;
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 240));
  });
  const path = `/clients/${CLIENT_ID}?eventId=${EVENT_ID}`;
  const wall0 = Date.now();
  let ttfbMs: number | null = null;
  let identityMs: number | null = null;
  let primaryActionParityMs: number | null = null;
  let detailReadyMs: number | null = null;
  let fallbackDurationMs: number | null = null;
  let sawFallback = false;
  let dpl: string | null = null;
  try {
    // Short fallback probe only — production responses often never paint the
    // Suspense fallback; do not block each sample for a 120s miss timeout.
    let fallbackSeenAt: number | null = null;
    const fallbackProbe = page
      .waitForSelector('[data-testid="booking-identity-fallback"]', { timeout: 8000, state: "attached" })
      .then(() => {
        fallbackSeenAt = Date.now();
        return true;
      })
      .catch(() => false);

    const res = await page.goto(`${APP}${path}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    dpl = res?.headers()?.["x-vercel-id"] ?? res?.headers()?.["x-deployment-id"] ?? null;
    const metaDpl = await page.locator('meta[name="htc-deployment-id"], meta[name="deployment-id"]').first()
      .getAttribute("content")
      .catch(() => null);
    if (metaDpl) dpl = metaDpl;
    const bodyDpl = await page.evaluate(() => {
      const el = document.querySelector("[data-deployment-id], [data-htc-deployment-id]");
      return el?.getAttribute("data-deployment-id") || el?.getAttribute("data-htc-deployment-id") || null;
    }).catch(() => null);
    if (bodyDpl) dpl = bodyDpl;

    ttfbMs = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      return nav ? Math.round(nav.responseStart) : null;
    });

    await page.locator('[data-testid="event-header-actions"], [data-testid="booking-identity-fallback"]').first()
      .waitFor({ state: "visible", timeout: 120000 });
    identityMs = Date.now() - wall0;
    sawFallback = (await fallbackProbe) || (await page.locator('[data-testid="booking-identity-fallback"]').count()) > 0;
    if (sawFallback && fallbackSeenAt == null) fallbackSeenAt = Date.now();

    await page.locator(
      '[data-testid="event-action-cancel"], [data-testid="event-action-cancel-menu"]',
    ).first().waitFor({ state: "attached", timeout: 120000 });
    primaryActionParityMs = Date.now() - wall0;

    const detailLocator = page.locator('[data-testid="booking-workspace-detail-ready"]');
    if ((await detailLocator.count()) > 0 || sawFallback) {
      await detailLocator.waitFor({ state: "visible", timeout: 180000 });
    } else {
      await page.locator('[data-testid="event-booking-summary"]').first().waitFor({ state: "visible", timeout: 180000 });
    }
    detailReadyMs = Date.now() - wall0;
    if (fallbackSeenAt != null) fallbackDurationMs = detailReadyMs - (fallbackSeenAt - wall0);

    return {
      mode, sample, ttfbMs, identityMs, primaryActionParityMs, detailReadyMs,
      fallbackDurationMs, sawFallback, dpl, openai, consoleErrors: consoleErrors.slice(0, 5),
    };
  } catch (e) {
    return {
      mode, sample, ttfbMs, identityMs, primaryActionParityMs, detailReadyMs,
      fallbackDurationMs, sawFallback, dpl, openai, consoleErrors: consoleErrors.slice(0, 5),
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

const host = new URL(APP).hostname;
const secure = APP.startsWith("https");
const cookies = await authCookies(host, secure);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addCookies(cookies);

const samples: Sample[] = [];
samples.push(await measure(context, "cold", 1));
for (let i = 1; i <= N; i++) samples.push(await measure(context, "warm", i));
await browser.close();

function pack(key: keyof Sample) {
  const vals = samples.map((s) => s[key]).filter((v): v is number => typeof v === "number");
  return { n: vals.length, median: median(vals), p90: p90(vals), min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null, values: vals };
}

const warm = samples.filter((s) => s.mode === "warm");
function packWarm(key: keyof Sample) {
  const vals = warm.map((s) => s[key]).filter((v): v is number => typeof v === "number");
  return { n: vals.length, median: median(vals), p90: p90(vals), min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null, values: vals };
}

const dpls = [...new Set(samples.map((s) => s.dpl).filter(Boolean))];
const report = {
  measuredAt: new Date().toISOString(),
  app: APP,
  expectedSha: EXPECTED_SHA || null,
  samples,
  summary: {
    all: {
      ttfb: pack("ttfbMs"),
      identity: pack("identityMs"),
      primaryActionParity: pack("primaryActionParityMs"),
      detailReady: pack("detailReadyMs"),
      fallbackDuration: pack("fallbackDurationMs"),
    },
    warm: {
      ttfb: packWarm("ttfbMs"),
      identity: packWarm("identityMs"),
      primaryActionParity: packWarm("primaryActionParityMs"),
      detailReady: packWarm("detailReadyMs"),
      fallbackDuration: packWarm("fallbackDurationMs"),
    },
    sawFallbackAny: samples.some((s) => s.sawFallback),
    openaiTotal: samples.reduce((a, s) => a + s.openai, 0),
    consoleErrorSamples: samples.filter((s) => s.consoleErrors.length).length,
    dpls,
    errors: samples.filter((s) => s.error).map((s) => s.error),
  },
};

writeFileSync(join(OUT, "sandbox-after.json"), JSON.stringify(report, null, 2));
writeFileSync(join(DESK, "sandbox-after.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report.summary, expectedSha: EXPECTED_SHA || null }, null, 2));
// Deployment id headers are optional; ECS image SHA is authoritative.
if (EXPECTED_SHA && dpls.length && !dpls.every((d) => String(d).includes(EXPECTED_SHA.slice(0, 7)))) {
  console.warn("optional DPL header mismatch (non-fatal)", { dpls, EXPECTED_SHA });
}
process.exit(report.summary.errors.length ? 1 : 0);
