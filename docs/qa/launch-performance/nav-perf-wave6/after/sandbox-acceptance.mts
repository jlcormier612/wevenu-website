/**
 * NAV-PERF Wave 6 — Sandbox acceptance remasure after deploy.
 * Read-only. Fancy fixture. Captures TTFB/Focus + layout_first_byte logs window.
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

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED_SHA = (process.env.EXPECTED_SHA ?? "c1b993f6c6842bbda0f3c71ae6162eca53f9aa32").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const LEAD_ID = process.env.NAV_LEAD_ID ?? "ab37d13c-5802-4b51-b4b8-31972da26393";
const EVENT_ID = process.env.NAV_EVENT_ID ?? "74a2487d-40fc-418f-a6bc-54abef28b6e1";
const CLIENT_ID = process.env.NAV_CLIENT_ID ?? "49aba826-0bd3-4891-ac9f-02a18b2b6962";
const DASH_N = Number(process.env.NAV_PERF_DASH_SAMPLES ?? 8);
const ROUTE_N = Number(process.env.NAV_PERF_ROUTE_SAMPLES ?? 3);
const OUT = resolve("docs/qa/launch-performance/nav-perf-wave6/after");
const DESKTOP = join(homedir(), "Desktop/HTC-NAV-PERF-WAVE6-AFTER");
mkdirSync(OUT, { recursive: true });
mkdirSync(DESKTOP, { recursive: true });

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

async function authCookies() {
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
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    { name: "htc_active_venue_id", value: FANCY, domain: "app.sandbox.hellotocheers.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const },
  ];
}

type Sample = {
  route: string;
  mode: "cold" | "warm";
  sample: number;
  wallStartIso: string;
  ttfbMs: number | null;
  greetingMs: number | null;
  kpiMs: number | null;
  focusMs: number | null;
  usefulMs: number | null;
  dpl: string | null;
  venueOk: boolean | null;
  openaiOrLuvAsk: number;
  error?: string;
};

async function measure(
  context: import("playwright").BrowserContext,
  path: string,
  route: string,
  mode: "cold" | "warm",
  sample: number,
  useful: "dashboard" | "leads" | "events" | "lead" | "booking",
): Promise<Sample> {
  const page = await context.newPage();
  let openaiOrLuvAsk = 0;
  page.on("request", (req) => {
    if (/api\.openai\.com|luv-ask/i.test(req.url())) openaiOrLuvAsk += 1;
  });
  const out: Sample = {
    route, mode, sample, wallStartIso: new Date().toISOString(),
    ttfbMs: null, greetingMs: null, kpiMs: null, focusMs: null, usefulMs: null,
    dpl: null, venueOk: null, openaiOrLuvAsk: 0,
  };
  const t0 = Date.now();
  try {
    await page.goto(`${APP}${path}`, { waitUntil: "commit", timeout: 180000 });
    if (useful === "dashboard") {
      await page.locator('[data-testid="dashboard-streaming-root"]').waitFor({ state: "attached", timeout: 120000 });
      await page.locator("h1.font-heading").filter({ hasText: /Good (morning|afternoon|evening)/i }).first()
        .waitFor({ state: "visible", timeout: 120000 });
      out.greetingMs = Date.now() - t0;
      await page.getByText("Lead Flow", { exact: true }).first().waitFor({ state: "visible", timeout: 90000 });
      await page.locator('[data-testid="dashboard-snapshot-fallback"]').waitFor({ state: "detached", timeout: 30000 }).catch(() => undefined);
      out.kpiMs = Date.now() - t0;
      await page.getByText("Today's Focus", { exact: true }).first().waitFor({ state: "visible", timeout: 120000 });
      await page.locator('[data-testid="dashboard-focus-fallback"]').waitFor({ state: "detached", timeout: 90000 }).catch(() => undefined);
      out.focusMs = Date.now() - t0;
      out.usefulMs = out.focusMs;
      const venueLine = await page.locator("p").filter({ hasText: /Here's what's happening at/ }).first().innerText().catch(() => "");
      out.venueOk = /Jen's Fancy Venue/.test(venueLine);
    } else if (useful === "leads") {
      await page.locator('main a[href*="/leads/"]').first().waitFor({ state: "visible", timeout: 120000 });
      out.usefulMs = Date.now() - t0;
    } else if (useful === "events") {
      await page.locator("main").first().waitFor({ state: "visible", timeout: 120000 });
      out.usefulMs = Date.now() - t0;
    } else if (useful === "lead") {
      await page.locator("main").first().waitFor({ state: "visible", timeout: 120000 });
      out.usefulMs = Date.now() - t0;
    } else {
      await page.locator("main").first().waitFor({ state: "visible", timeout: 180000 });
      await page.locator("h1, [data-testid='client-date-state'], #documents").first().waitFor({ state: "visible", timeout: 180000 });
      out.usefulMs = Date.now() - t0;
    }
    await page.waitForTimeout(400);
    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      return nav ? Math.round(nav.responseStart) : null;
    });
    out.ttfbMs = perf;
    out.openaiOrLuvAsk = openaiOrLuvAsk;
    out.dpl = await page.evaluate(() => {
      for (const n of Array.from(document.querySelectorAll("script[src],link[href]"))) {
        const src = (n as HTMLScriptElement).src || (n as HTMLLinkElement).href || "";
        const m = src.match(/dpl=([a-f0-9]{7,40})/);
        if (m) return m[1];
      }
      return null;
    });
  } catch (e) {
    out.error = (e as Error).message;
  } finally {
    await page.close();
  }
  return out;
}

function summarize(samples: Sample[]) {
  const pick = (fn: (s: Sample) => number | null) => {
    const vals = samples.map(fn).filter((v): v is number => v != null && Number.isFinite(v));
    return { n: vals.length, median: median(vals), p90: p90(vals), min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null, values: vals };
  };
  return {
    ttfb: pick((s) => s.ttfbMs),
    greeting: pick((s) => s.greetingMs),
    kpi: pick((s) => s.kpiMs),
    focus: pick((s) => s.focusMs),
    useful: pick((s) => s.usefulMs),
    openai: samples.reduce((a, s) => a + s.openaiOrLuvAsk, 0),
    errors: samples.filter((s) => s.error).map((s) => `${s.route}/${s.mode}#${s.sample}: ${s.error}`),
    dpls: [...new Set(samples.map((s) => s.dpl).filter(Boolean))],
  };
}

async function main() {
  const cookies = await authCookies();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies(cookies);

  const warm = await context.newPage();
  await warm.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await warm.waitForTimeout(2000);
  await warm.close();

  const samples: Sample[] = [];
  samples.push(await measure(context, "/dashboard", "dashboard", "cold", 1, "dashboard"));
  for (let i = 1; i <= DASH_N; i++) samples.push(await measure(context, "/dashboard", "dashboard", "warm", i, "dashboard"));
  samples.push(await measure(context, "/leads", "leads_list", "cold", 1, "leads"));
  for (let i = 1; i <= ROUTE_N; i++) samples.push(await measure(context, "/leads", "leads_list", "warm", i, "leads"));
  samples.push(await measure(context, "/events", "events_list", "cold", 1, "events"));
  for (let i = 1; i <= ROUTE_N; i++) samples.push(await measure(context, "/events", "events_list", "warm", i, "events"));
  samples.push(await measure(context, `/leads/${LEAD_ID}`, "lead_workspace", "cold", 1, "lead"));
  for (let i = 1; i <= ROUTE_N; i++) samples.push(await measure(context, `/leads/${LEAD_ID}`, "lead_workspace", "warm", i, "lead"));
  samples.push(await measure(context, `/clients/${CLIENT_ID}?eventId=${EVENT_ID}`, "booking_workspace", "cold", 1, "booking"));
  for (let i = 1; i <= ROUTE_N; i++) samples.push(await measure(context, `/clients/${CLIENT_ID}?eventId=${EVENT_ID}`, "booking_workspace", "warm", i, "booking"));

  // Functional: unauth
  await context.clearCookies();
  const bare = await context.newPage();
  await bare.goto(`${APP}/dashboard`, { waitUntil: "commit", timeout: 60000 });
  const unauthUrl = bare.url();
  await bare.close();
  await browser.close();

  const dashWarm = samples.filter((s) => s.route === "dashboard" && s.mode === "warm");
  const slow = dashWarm.filter((s) => (s.ttfbMs ?? 0) >= 3000);
  const healthy = dashWarm.filter((s) => s.ttfbMs != null && s.ttfbMs >= 400 && s.ttfbMs <= 1100);

  const report = {
    measuredAt: new Date().toISOString(),
    expectedSha: EXPECTED_SHA,
    app: APP,
    wallWindow: {
      start: samples[0]?.wallStartIso ?? null,
      end: samples[samples.length - 1]?.wallStartIso ?? null,
    },
    dashboardWarm: summarize(dashWarm),
    healthyDashWarm: summarize(healthy),
    slowDashWarm: summarize(slow),
    byRoute: Object.fromEntries(
      ["dashboard", "leads_list", "events_list", "lead_workspace", "booking_workspace"].map((r) => [
        r,
        summarize(samples.filter((s) => s.route === r)),
      ]),
    ),
    functional: {
      fancyVenueOkCount: samples.filter((s) => s.venueOk === true).length,
      unauthRedirectsToLogin: /login/i.test(unauthUrl),
      unauthUrl,
      openaiTotal: samples.reduce((a, s) => a + s.openaiOrLuvAsk, 0),
      dplMatchesExpected: samples.every((s) => !s.dpl || s.dpl.startsWith(EXPECTED_SHA.slice(0, 7))),
    },
    samples,
  };

  writeFileSync(join(OUT, "remeasure.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(DESKTOP, "remeasure.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    wrote: join(OUT, "remeasure.json"),
    dashboardWarm: report.dashboardWarm,
    slowN: slow.length,
    healthyN: healthy.length,
    functional: report.functional,
    booking: report.byRoute.booking_workspace,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
