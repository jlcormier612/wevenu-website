/**
 * NAV-PERF Wave 7A — local booking identity vs deferred detail measurement.
 * Read-only. Fancy fixture. No mutations / OpenAI / Production.
 *
 * Usefulness gates (booked fixture):
 * - identity: status/actions chrome visible
 * - primaryActionParity: Cancel (or mobile cancel menu) — not Edit alone
 * - detailReady: booking-workspace-detail-ready
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = process.env.HTC_MEASURE_BASE ?? "http://127.0.0.1:3017";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const CLIENT_ID = process.env.NAV_CLIENT_ID ?? "49aba826-0bd3-4891-ac9f-02a18b2b6962";
const EVENT_ID = process.env.NAV_EVENT_ID ?? "74a2487d-40fc-418f-a6bc-54abef28b6e1";
const N = Number(process.env.NAV_PERF_SAMPLES ?? 5);
const OUT = resolve("docs/qa/launch-performance/nav-perf-wave7a");
const DESK = join(homedir(), "Desktop/HTC-NAV-PERF-WAVE7A");
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
  editActionMs: number | null;
  primaryActionParityMs: number | null;
  detailReadyMs: number | null;
  fallbackDurationMs: number | null;
  sawFallback: boolean;
  layoutShiftScore: number | null;
  openai: number;
  error?: string;
};

async function measure(context: import("playwright").BrowserContext, mode: "cold" | "warm", sample: number): Promise<Sample> {
  const page = await context.newPage();
  let openai = 0;
  page.on("request", (req) => {
    if (/api\.openai\.com|luv-ask/i.test(req.url())) openai += 1;
  });
  const path = `/clients/${CLIENT_ID}?eventId=${EVENT_ID}`;
  const wall0 = Date.now();
  let ttfbMs: number | null = null;
  let identityMs: number | null = null;
  let editActionMs: number | null = null;
  let primaryActionParityMs: number | null = null;
  let detailReadyMs: number | null = null;
  let fallbackDurationMs: number | null = null;
  let sawFallback = false;
  try {
    // Catch a brief Suspense fallback even if detail resolves before identity wait.
    const fallbackWatch = page
      .waitForSelector('[data-testid="booking-identity-fallback"]', { timeout: 120000, state: "attached" })
      .then(() => Date.now())
      .catch(() => null);

    await page.goto(`${APP}${path}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    ttfbMs = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      return nav ? Math.round(nav.responseStart) : null;
    });

    const identityHandle = page.locator('[data-testid="event-header-actions"], [data-testid="booking-identity-fallback"]').first();
    await identityHandle.waitFor({ state: "visible", timeout: 120000 });
    identityMs = Date.now() - wall0;
    const fallbackSeenAt = await fallbackWatch;
    sawFallback = fallbackSeenAt != null || (await page.locator('[data-testid="booking-identity-fallback"]').count()) > 0;

    await page.locator('[data-testid="event-action-edit"]').first().waitFor({ state: "attached", timeout: 120000 });
    editActionMs = Date.now() - wall0;

    // Full primary-action parity for booked fixture = Cancel (desktop or mobile menu).
    // Edit/Day-sheet alone do NOT count as fully usable action bar.
    const cancelParity = page.locator(
      '[data-testid="event-action-cancel"], [data-testid="event-action-cancel-menu"]',
    ).first();
    await cancelParity.waitFor({ state: "attached", timeout: 120000 });
    primaryActionParityMs = Date.now() - wall0;

    const detailLocator = page.locator('[data-testid="booking-workspace-detail-ready"]');
    if ((await detailLocator.count()) > 0 || sawFallback) {
      await detailLocator.waitFor({ state: "visible", timeout: 180000 });
    } else {
      await page.locator('[data-testid="event-booking-summary"]').first().waitFor({ state: "visible", timeout: 180000 });
    }
    detailReadyMs = Date.now() - wall0;
    if (fallbackSeenAt != null) {
      fallbackDurationMs = detailReadyMs - (fallbackSeenAt - wall0);
    }

    const layoutShiftScore = await page.evaluate(() => {
      const entries = performance.getEntriesByType("layout-shift") as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>;
      return entries
        .filter((e) => !e.hadRecentInput)
        .reduce((sum, e) => sum + (typeof e.value === "number" ? e.value : 0), 0);
    });

    return {
      mode,
      sample,
      ttfbMs,
      identityMs,
      editActionMs,
      primaryActionParityMs,
      detailReadyMs,
      fallbackDurationMs,
      sawFallback,
      layoutShiftScore,
      openai,
    };
  } catch (e) {
    return {
      mode,
      sample,
      ttfbMs,
      identityMs,
      editActionMs,
      primaryActionParityMs,
      detailReadyMs,
      fallbackDurationMs,
      sawFallback,
      layoutShiftScore: null,
      openai,
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

const report = {
  measuredAt: new Date().toISOString(),
  app: APP,
  clientIdHash: "fancy-nav-perf-booked-fixture",
  note: "LOCAL only. primaryActionParity requires Cancel for booked fixture (Edit alone does not count).",
  samples,
  summary: {
    ttfb: pack("ttfbMs"),
    identity: pack("identityMs"),
    editAction: pack("editActionMs"),
    primaryActionParity: pack("primaryActionParityMs"),
    detailReady: pack("detailReadyMs"),
    fallbackDuration: pack("fallbackDurationMs"),
    layoutShift: pack("layoutShiftScore"),
    sawFallbackAny: samples.some((s) => s.sawFallback),
    openaiTotal: samples.reduce((a, s) => a + s.openai, 0),
    errors: samples.filter((s) => s.error).map((s) => s.error),
  },
};

writeFileSync(join(OUT, "local-measure.json"), JSON.stringify(report, null, 2));
writeFileSync(join(DESK, "local-measure.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
