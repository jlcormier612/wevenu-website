/**
 * NAV-PERF Wave 6 — local before/after layout bootstrap comparison.
 * before = HTC_LAYOUT_BOOTSTRAP_SERIAL=1
 * after  = parallel reads (default)
 *
 * Captures layout_first_byte_timing log lines from the Next process log when
 * WAVE6_SERVER_LOG is set; always captures browser TTFB/Focus.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = (process.env.APP_ORIGIN ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const VARIANT = (process.env.VARIANT ?? "after") as "before" | "after";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const CLIENT_ID = process.env.NAV_CLIENT_ID ?? "49aba826-0bd3-4891-ac9f-02a18b2b6962";
const EVENT_ID = process.env.NAV_EVENT_ID ?? "74a2487d-40fc-418f-a6bc-54abef28b6e1";
const DASH_N = Number(process.env.NAV_PERF_DASH_SAMPLES ?? 5);
const OUT = resolve("docs/qa/launch-performance/nav-perf-wave6");
const DESKTOP = join(homedir(), "Desktop/HTC-NAV-PERF-WAVE6");
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
  const host = new URL(APP).hostname;
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name, value: c.value, domain: host, path: "/", httpOnly: false, secure: APP.startsWith("https"), sameSite: "Lax" as const,
    })),
    { name: "htc_active_venue_id", value: FANCY, domain: host, path: "/", httpOnly: false, secure: APP.startsWith("https"), sameSite: "Lax" as const },
  ];
}

type Sample = {
  route: string;
  mode: "cold" | "warm";
  sample: number;
  ttfbMs: number | null;
  greetingMs: number | null;
  focusMs: number | null;
  usefulMs: number | null;
  venueOk: boolean | null;
  openai: number;
  error?: string;
};

async function measure(
  context: import("playwright").BrowserContext,
  path: string,
  route: string,
  mode: "cold" | "warm",
  sample: number,
  useful: "dashboard" | "leads" | "booking",
): Promise<Sample> {
  const page = await context.newPage();
  let openai = 0;
  page.on("request", (req) => {
    if (/api\.openai\.com|luv-ask/i.test(req.url())) openai += 1;
  });
  const out: Sample = {
    route, mode, sample,
    ttfbMs: null, greetingMs: null, focusMs: null, usefulMs: null, venueOk: null, openai: 0,
  };
  const t0 = Date.now();
  try {
    await page.goto(`${APP}${path}`, { waitUntil: "commit", timeout: 180000 });
    if (useful === "dashboard") {
      await page.locator("h1.font-heading").filter({ hasText: /Good (morning|afternoon|evening)/i }).first()
        .waitFor({ state: "visible", timeout: 120000 });
      out.greetingMs = Date.now() - t0;
      await page.getByText("Today's Focus", { exact: true }).first().waitFor({ state: "visible", timeout: 120000 });
      await page.locator('[data-testid="dashboard-focus-fallback"]').waitFor({ state: "detached", timeout: 90000 }).catch(() => undefined);
      out.focusMs = Date.now() - t0;
      out.usefulMs = out.focusMs;
      const venueLine = await page.locator("p").filter({ hasText: /Here's what's happening at/ }).first().innerText().catch(() => "");
      out.venueOk = /Jen's Fancy Venue/.test(venueLine);
    } else if (useful === "leads") {
      await page.locator('main a[href*="/leads/"]').first().waitFor({ state: "visible", timeout: 120000 });
      out.usefulMs = Date.now() - t0;
    } else {
      await page.locator("main").first().waitFor({ state: "visible", timeout: 180000 });
      await page.locator("h1, [data-testid='client-date-state'], #documents").first().waitFor({ state: "visible", timeout: 180000 });
      out.usefulMs = Date.now() - t0;
    }
    await page.waitForTimeout(300);
    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      return nav ? Math.round(nav.responseStart) : null;
    });
    out.ttfbMs = perf;
    out.openai = openai;
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
    return { n: vals.length, median: median(vals), p90: p90(vals), values: vals };
  };
  return {
    ttfb: pick((s) => s.ttfbMs),
    greeting: pick((s) => s.greetingMs),
    focus: pick((s) => s.focusMs),
    useful: pick((s) => s.usefulMs),
    openai: samples.reduce((a, s) => a + s.openai, 0),
    errors: samples.filter((s) => s.error).map((s) => `${s.route}/${s.mode}#${s.sample}: ${s.error}`),
  };
}

async function main() {
  const health = await fetch(`${APP}/login`).catch(() => null);
  if (!health || !health.ok) throw new Error(`Local app not reachable at ${APP}/login`);

  const cookies = await authCookies();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies(cookies);

  const warm = await context.newPage();
  await warm.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await warm.waitForTimeout(1500);
  await warm.close();

  const samples: Sample[] = [];
  samples.push(await measure(context, "/dashboard", "dashboard", "cold", 1, "dashboard"));
  for (let i = 1; i <= DASH_N; i++) {
    samples.push(await measure(context, "/dashboard", "dashboard", "warm", i, "dashboard"));
  }
  samples.push(await measure(context, "/leads", "leads_list", "warm", 1, "leads"));
  samples.push(await measure(context, `/clients/${CLIENT_ID}?eventId=${EVENT_ID}`, "booking_workspace", "warm", 1, "booking"));

  // Isolation / membership smoke via page content (Fancy venue greeting)
  const isolationPage = await context.newPage();
  await isolationPage.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await isolationPage.waitForTimeout(2000);
  const fancyOk = await isolationPage.locator("p").filter({ hasText: /Jen's Fancy Venue/ }).first().isVisible().catch(() => false);
  // Unauthenticated: clear cookies → login redirect
  await context.clearCookies();
  const unauth = await isolationPage.goto(`${APP}/dashboard`, { waitUntil: "commit", timeout: 60000 });
  const unauthUrl = isolationPage.url();
  await isolationPage.close();
  await browser.close();

  const dashWarm = samples.filter((s) => s.route === "dashboard" && s.mode === "warm");
  const report = {
    variant: VARIANT,
    app: APP,
    measuredAt: new Date().toISOString(),
    note: "LOCAL only — do not claim Sandbox improvement. before=HTC_LAYOUT_BOOTSTRAP_SERIAL=1.",
    serialEnv: process.env.HTC_LAYOUT_BOOTSTRAP_SERIAL ?? "(unset)",
    dashboardWarm: summarize(dashWarm),
    leads: summarize(samples.filter((s) => s.route === "leads_list")),
    booking: summarize(samples.filter((s) => s.route === "booking_workspace")),
    regression: {
      fancyVenueGreeting: fancyOk,
      unauthRedirectsToLogin: /login/i.test(unauthUrl) || (unauth?.status() ?? 0) >= 300,
      unauthUrl,
    },
    samples,
  };

  writeFileSync(join(OUT, `local-${VARIANT}.json`), JSON.stringify(report, null, 2));
  writeFileSync(join(DESKTOP, `local-${VARIANT}.json`), JSON.stringify(report, null, 2));

  const beforePath = join(OUT, "local-before.json");
  const afterPath = join(OUT, "local-after.json");
  if (existsSync(beforePath) && existsSync(afterPath)) {
    const cmp = {
      measuredAt: new Date().toISOString(),
      before: JSON.parse(readFileSync(beforePath, "utf8")).dashboardWarm,
      after: JSON.parse(readFileSync(afterPath, "utf8")).dashboardWarm,
      note: "Local A/B only",
    };
    writeFileSync(join(OUT, "local-compare.json"), JSON.stringify(cmp, null, 2));
    writeFileSync(join(DESKTOP, "local-compare.json"), JSON.stringify(cmp, null, 2));
  }

  console.log(JSON.stringify({
    wrote: join(OUT, `local-${VARIANT}.json`),
    variant: VARIANT,
    dashWarm: report.dashboardWarm,
    regression: report.regression,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
