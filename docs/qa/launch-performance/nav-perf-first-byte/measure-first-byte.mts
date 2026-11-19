/**
 * NAV-PERF first-byte investigation — Sandbox remasure (read-only).
 * Separates Dashboard / leads / event-redirect / booking-workspace TTFB.
 * Correlates wall clock with ECS task; does not modify app code.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED_SHA = (process.env.EXPECTED_SHA ?? "83569a103d9b4c7ebfc93ef151ed8ab9d28e1f67").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const LEAD_ID = process.env.NAV_LEAD_ID ?? "ab37d13c-5802-4b51-b4b8-31972da26393";
const EVENT_ID = process.env.NAV_EVENT_ID ?? "74a2487d-40fc-418f-a6bc-54abef28b6e1";
const CLIENT_ID = process.env.NAV_CLIENT_ID ?? "49aba826-0bd3-4891-ac9f-02a18b2b6962";
const DASH_N = Number(process.env.NAV_PERF_DASH_SAMPLES ?? 8);
const ROUTE_N = Number(process.env.NAV_PERF_ROUTE_SAMPLES ?? 3);
const OUT = resolve("docs/qa/launch-performance/nav-perf-first-byte");
const DESKTOP = join(homedir(), "Desktop/HTC-NAV-PERF-FIRST-BYTE");
mkdirSync(OUT, { recursive: true });
mkdirSync(DESKTOP, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("non-sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type Sample = {
  route: string;
  mode: "cold" | "warm";
  sample: number;
  wallStartIso: string;
  ttfbMs: number | null;
  responseEndMs: number | null;
  dclMs: number | null;
  usefulMs: number | null;
  greetingMs: number | null;
  focusMs: number | null;
  finalUrl: string | null;
  dpl: string | null;
  openaiOrLuvAsk: number;
  error?: string;
};

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
  return {
    accessToken: otpData.session.access_token,
    cookies: [
      ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
        name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const,
      })),
      { name: "htc_active_venue_id", value: FANCY, domain: "app.sandbox.hellotocheers.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const },
    ],
  };
}

/** Direct Supabase RPC/API probes (network+PostgREST wall), not PG EXPLAIN. */
async function probeSupabase(accessToken: string) {
  const authed = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const probes: Array<{ name: string; samples: number[] }> = [];
  async function time(name: string, fn: () => Promise<unknown>, n = 5) {
    const samples: number[] = [];
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      await fn();
      samples.push(Math.round(performance.now() - t0));
    }
    probes.push({ name, samples });
  }
  await time("auth_getUser", async () => {
    await authed.auth.getUser();
  });
  await time("rpc_current_user_venue_id", async () => {
    await authed.rpc("current_user_venue_id");
  });
  await time("rpc_list_my_venue_memberships", async () => {
    await authed.rpc("list_my_venue_memberships");
  });
  await time("rpc_clear_stale_active_venue_context", async () => {
    await authed.rpc("clear_stale_active_venue_context");
  });
  await time("rpc_current_user_role", async () => {
    await authed.rpc("current_user_role");
  });
  return probes.map((p) => ({
    ...p,
    median: median(p.samples),
    p90: p90(p.samples),
    note: "Client→Supabase API wall time (network + PostgREST). Not PostgreSQL execution time.",
  }));
}

type RouteDef = {
  route: string;
  path: string;
  useful: "dashboard" | "leads" | "lead" | "main" | "booking";
};

const ROUTES: RouteDef[] = [
  { route: "dashboard", path: "/dashboard", useful: "dashboard" },
  { route: "leads_list", path: "/leads", useful: "leads" },
  { route: "lead_workspace", path: `/leads/${LEAD_ID}`, useful: "lead" },
  { route: "event_redirect", path: `/events/${EVENT_ID}`, useful: "main" },
  { route: "booking_workspace", path: `/clients/${CLIENT_ID}?eventId=${EVENT_ID}`, useful: "booking" },
];

async function measureOne(
  context: import("playwright").BrowserContext,
  def: RouteDef,
  mode: "cold" | "warm",
  sample: number,
): Promise<Sample> {
  const page = await context.newPage();
  let openaiOrLuvAsk = 0;
  page.on("request", (req) => {
    if (/api\.openai\.com|luv-ask/i.test(req.url())) openaiOrLuvAsk += 1;
  });
  const out: Sample = {
    route: def.route,
    mode,
    sample,
    wallStartIso: new Date().toISOString(),
    ttfbMs: null,
    responseEndMs: null,
    dclMs: null,
    usefulMs: null,
    greetingMs: null,
    focusMs: null,
    finalUrl: null,
    dpl: null,
    openaiOrLuvAsk: 0,
  };
  const t0 = Date.now();
  try {
    await page.goto(`${APP}${def.path}`, { waitUntil: "commit", timeout: 180000 });

    if (def.useful === "dashboard") {
      await page.locator('[data-testid="dashboard-streaming-root"]').waitFor({ state: "attached", timeout: 120000 });
      await page.locator("h1.font-heading").filter({ hasText: /Good (morning|afternoon|evening)/i }).first()
        .waitFor({ state: "visible", timeout: 120000 });
      out.greetingMs = Date.now() - t0;
      await page.getByText("Today's Focus", { exact: true }).first().waitFor({ state: "visible", timeout: 120000 });
      await page.locator('[data-testid="dashboard-focus-fallback"]').waitFor({ state: "detached", timeout: 90000 }).catch(() => undefined);
      out.focusMs = Date.now() - t0;
      out.usefulMs = out.focusMs;
    } else if (def.useful === "leads") {
      await page.locator('main a[href*="/leads/"]').first().waitFor({ state: "visible", timeout: 120000 });
      out.usefulMs = Date.now() - t0;
    } else if (def.useful === "lead") {
      await page.locator("main").first().waitFor({ state: "visible", timeout: 120000 });
      out.usefulMs = Date.now() - t0;
    } else if (def.useful === "booking") {
      // Booking workspace title / event detail — wait for real content, not redirect stub.
      await page.locator("main").first().waitFor({ state: "visible", timeout: 180000 });
      await page.waitForFunction(() => !location.pathname.startsWith("/events/"), null, { timeout: 60000 }).catch(() => undefined);
      await page.locator("h1, [data-testid='client-date-state'], #documents").first().waitFor({ state: "visible", timeout: 180000 });
      out.usefulMs = Date.now() - t0;
    } else {
      await page.locator("main").first().waitFor({ state: "visible", timeout: 120000 });
      out.usefulMs = Date.now() - t0;
    }

    await page.waitForTimeout(400);
    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      return {
        ttfb: nav ? Math.round(nav.responseStart) : null,
        responseEnd: nav ? Math.round(nav.responseEnd) : null,
        dcl: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      };
    });
    out.ttfbMs = perf.ttfb;
    out.responseEndMs = perf.responseEnd;
    out.dclMs = perf.dcl;
    out.finalUrl = page.url();
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
    useful: pick((s) => s.usefulMs),
    greeting: pick((s) => s.greetingMs),
    focus: pick((s) => s.focusMs),
    errors: samples.filter((s) => s.error).map((s) => `${s.route}/${s.mode}#${s.sample}: ${s.error}`),
  };
}

async function main() {
  const { cookies, accessToken } = await authCookies();
  console.log("Probing Supabase RPCs…");
  const supabaseProbes = await probeSupabase(accessToken);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies(cookies);

  const warm = await context.newPage();
  await warm.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await warm.waitForTimeout(2000);
  await warm.close();

  const samples: Sample[] = [];
  // Dashboard: more samples to catch TTFB variance
  samples.push(await measureOne(context, ROUTES[0]!, "cold", 1));
  for (let i = 1; i <= DASH_N; i++) samples.push(await measureOne(context, ROUTES[0]!, "warm", i));

  for (const def of ROUTES.slice(1)) {
    samples.push(await measureOne(context, def, "cold", 1));
    for (let i = 1; i <= ROUTE_N; i++) samples.push(await measureOne(context, def, "warm", i));
  }

  await browser.close();

  const dashWarm = samples.filter((s) => s.route === "dashboard" && s.mode === "warm");
  const healthy = dashWarm.filter((s) => s.ttfbMs != null && s.ttfbMs >= 400 && s.ttfbMs <= 1100);
  const slow = dashWarm.filter((s) => s.ttfbMs != null && s.ttfbMs >= 3000);

  const report = {
    measuredAt: new Date().toISOString(),
    expectedSha: EXPECTED_SHA,
    app: APP,
    ecsNote: "Correlate wallStartIso with CloudWatch CPU; task :1230 desired/running=1, cpu=512, memory=1024",
    supabaseProbes,
    dashboardWarm: summarize(dashWarm),
    healthyDashWarm: summarize(healthy),
    slowDashWarm: summarize(slow),
    byRoute: Object.fromEntries(ROUTES.map((r) => [r.route, summarize(samples.filter((s) => s.route === r.route))])),
    samples,
    instrumentationGaps: [
      "No Server-Timing on layout — TTFB stages (getUser/bootstrap/getCurrentVenue) not separately visible on Sandbox documents",
      "dashboard_forensic_timing covers Suspense islands AFTER first byte, not layout TTFB",
      "No Node event-loop delay metric exported",
      "Supabase probes are API wall time, not PostgreSQL EXPLAIN",
    ],
  };

  writeFileSync(join(OUT, "first-byte.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(DESKTOP, "first-byte.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    wrote: join(OUT, "first-byte.json"),
    dashboardWarm: report.dashboardWarm,
    booking: report.byRoute.booking_workspace,
    eventRedirect: report.byRoute.event_redirect,
    supabaseProbes: report.supabaseProbes,
    healthyN: healthy.length,
    slowN: slow.length,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
