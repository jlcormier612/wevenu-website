/**
 * NAV-PERF discovery — read-only Sandbox navigation baseline.
 * No mutations, no OpenAI, no outbound sends, no Production.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED_SHA = (process.env.EXPECTED_SHA ?? "4787fbaba2b4da14d447e4e220f8a16923fab5a2").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const LEAD_ID = process.env.NAV_LEAD_ID ?? "ab37d13c-5802-4b51-b4b8-31972da26393";
const EVENT_ID = process.env.NAV_EVENT_ID ?? "74a2487d-40fc-418f-a6bc-54abef28b6e1";

const OUT = resolve("docs/qa/launch-performance/nav-perf-baseline");
const DESKTOP = join(homedir(), "Desktop/HTC-NAV-PERF-BASELINE");
mkdirSync(OUT, { recursive: true });
mkdirSync(DESKTOP, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type NavSample = {
  route: string;
  mode: "cold" | "warm";
  url: string;
  usefulSelector: string;
  clickOrGotoStartMs: number;
  domContentLoadedMs: number | null;
  usefulVisibleMs: number | null;
  interactiveMs: number | null;
  documentResponseMs: number | null;
  transferSizeApprox: number | null;
  requestCount: number;
  supabaseRequestCount: number;
  nextDataOrRscCount: number;
  openaiOrLuvAskCount: number;
  longestRequests: Array<{ url: string; durationMs: number; resourceType: string }>;
  timedOut: boolean;
  error?: string;
};

type RouteDef = {
  route: string;
  path: string;
  usefulSelector: string;
  interactiveSelector?: string;
};

const ROUTES: RouteDef[] = [
  {
    route: "dashboard",
    path: "/dashboard",
    usefulSelector: '[data-testid="dashboard-streaming-root"]',
  },
  {
    route: "leads_list",
    path: "/leads",
    usefulSelector: 'main a[href*="/leads/"]',
  },
  {
    route: "lead_workspace",
    path: `/leads/${LEAD_ID}`,
    usefulSelector: 'main [role="tablist"]',
  },
  {
    route: "events_list",
    path: "/events",
    usefulSelector: 'main a[href*="/events/"], main a[href*="/clients/"]',
  },
  {
    // /events/[id] redirects into the booking (/clients/[id]) workspace.
    route: "event_workspace",
    path: `/events/${EVENT_ID}`,
    usefulSelector: "main",
  },
  {
    route: "settings",
    path: "/settings",
    usefulSelector: "main",
  },
  {
    route: "setup_hub",
    path: "/setup-hub",
    usefulSelector: "main",
  },
];

async function authCookies() {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map(
      (c: { name: string; value: string }) => ({
        name: c.name,
        value: c.value,
        domain: "app.sandbox.hellotocheers.com",
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "Lax" as const,
      }),
    ),
    {
      name: "htc_active_venue_id",
      value: FANCY,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];
}

function classifyUrl(u: string) {
  const lower = u.toLowerCase();
  const supabase = lower.includes("supabase.co") || lower.includes("wvpsldwwjqdannqasrdf");
  const rsc =
    lower.includes("/_next/") ||
    lower.includes("?_rsc") ||
    lower.includes("text/x-component") ||
    u.includes("_next/data");
  const ai =
    lower.includes("api.openai.com") ||
    lower.includes("/api/portal/luv-ask") ||
    lower.includes("luv-ask");
  return { supabase, rsc, ai };
}

async function measureNav(
  page: import("playwright").Page,
  def: RouteDef,
  mode: "cold" | "warm",
): Promise<NavSample> {
  const target = `${APP}${def.path}`;
  const requests: Array<{ url: string; start: number; end?: number; resourceType: string }> = [];
  let documentResponseMs: number | null = null;
  let transfer = 0;

  const onRequest = (req: import("playwright").Request) => {
    requests.push({
      url: req.url(),
      start: Date.now(),
      resourceType: req.resourceType(),
    });
  };
  const onResponse = async (res: import("playwright").Response) => {
    const req = res.request();
    const row = requests.find((r) => r.url === req.url() && r.end == null);
    if (row) row.end = Date.now();
    if (req.resourceType() === "document" && res.url().startsWith(APP)) {
      try {
        const timing = res.timing();
        documentResponseMs = Math.round(timing.responseEnd);
      } catch {
        /* ignore */
      }
    }
    try {
      const headers = res.headers();
      const len = Number(headers["content-length"] || 0);
      if (len > 0) transfer += len;
    } catch {
      /* ignore */
    }
  };

  page.on("request", onRequest);
  page.on("response", onResponse);

  let timedOut = false;
  let error: string | undefined;
  let usefulVisibleMs: number | null = null;
  let interactiveMs: number | null = null;
  let domContentLoadedMs: number | null = null;
  let navStart = Date.now();

  try {
    if (mode === "cold") {
      navStart = Date.now();
      const resp = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 90000 });
      domContentLoadedMs = Date.now() - navStart;
      if (resp) {
        try {
          documentResponseMs = Math.round(resp.timing().responseEnd);
        } catch {
          /* ignore */
        }
      }
    } else {
      // Warm: full navigation after prior pages (browser HTTP cache may help).
      navStart = Date.now();
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 90000 });
      domContentLoadedMs = Date.now() - navStart;
    }

    const usefulLocator = page.locator(def.usefulSelector).first();
    await usefulLocator.waitFor({ state: "visible", timeout: 60000 });
    usefulVisibleMs = Date.now() - navStart;

    if (def.interactiveSelector) {
      const iLoc = page.locator(def.interactiveSelector).first();
      await iLoc.waitFor({ state: "visible", timeout: 30000 });
      interactiveMs = Date.now() - navStart;
    } else {
      interactiveMs = usefulVisibleMs;
    }

    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (!nav) return null;
      return {
        responseEnd: Math.round(nav.responseEnd),
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
        loadEvent: Math.round(nav.loadEventEnd),
      };
    });
    if (perf) {
      documentResponseMs = perf.responseEnd;
      // Keep wall-clock usefulVisibleMs (includes client work after DCL).
      domContentLoadedMs = Math.min(domContentLoadedMs ?? perf.domContentLoaded, perf.domContentLoaded);
    }
  } catch (e) {
    timedOut = true;
    error = (e as Error).message;
  } finally {
    page.off("request", onRequest);
    page.off("response", onResponse);
  }

  // Settle briefly to catch late RSC/data fetches without waiting forever
  await page.waitForTimeout(1500);

  const durations = requests
    .filter((r) => r.end != null)
    .map((r) => ({
      url: r.url.slice(0, 180),
      durationMs: (r.end as number) - r.start,
      resourceType: r.resourceType,
    }))
    .sort((a, b) => b.durationMs - a.durationMs);

  let supabaseRequestCount = 0;
  let nextDataOrRscCount = 0;
  let openaiOrLuvAskCount = 0;
  for (const r of requests) {
    const c = classifyUrl(r.url);
    if (c.supabase) supabaseRequestCount += 1;
    if (c.rsc) nextDataOrRscCount += 1;
    if (c.ai) openaiOrLuvAskCount += 1;
  }

  const shot = join(OUT, `${mode}-${def.route}.png`);
  await page.screenshot({ path: shot, fullPage: false }).catch(() => undefined);
  try {
    copyFileSync(shot, join(DESKTOP, `${mode}-${def.route}.png`));
  } catch {
    /* ignore */
  }

  return {
    route: def.route,
    mode,
    url: target,
    usefulSelector: def.usefulSelector,
    clickOrGotoStartMs: 0,
    domContentLoadedMs,
    usefulVisibleMs,
    interactiveMs,
    documentResponseMs,
    transferSizeApprox: transfer || null,
    requestCount: requests.length,
    supabaseRequestCount,
    nextDataOrRscCount,
    openaiOrLuvAskCount,
    longestRequests: durations.slice(0, 8),
    timedOut,
    error,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addCookies(await authCookies());
  const page = await context.newPage();

  // Confirm app is reachable / not legal-unavailable for staff
  await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const body = await page.locator("body").innerText();
  if (/legal-unavailable|Application error/i.test(body) && body.length < 200) {
    throw new Error(`Sandbox staff shell blocked: ${body.slice(0, 120)}`);
  }

  const samples: NavSample[] = [];

  // Cold: each route in a fresh page to avoid soft-cache from prior route
  for (const def of ROUTES) {
    const coldPage = await context.newPage();
    console.log(`COLD ${def.route}…`);
    const sample = await measureNav(coldPage, def, "cold");
    samples.push(sample);
    console.log(
      `  useful=${sample.usefulVisibleMs}ms dcl=${sample.domContentLoadedMs}ms req=${sample.requestCount} sb=${sample.supabaseRequestCount} ai=${sample.openaiOrLuvAskCount} timeout=${sample.timedOut}`,
    );
    await coldPage.close();
  }

  // Warm: reuse one page, visit dashboard then each route
  const warmPage = await context.newPage();
  await warmPage.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await warmPage.waitForTimeout(1000);
  for (const def of ROUTES) {
    console.log(`WARM ${def.route}…`);
    const sample = await measureNav(warmPage, def, "warm");
    samples.push(sample);
    console.log(
      `  useful=${sample.usefulVisibleMs}ms dcl=${sample.domContentLoadedMs}ms req=${sample.requestCount} sb=${sample.supabaseRequestCount} ai=${sample.openaiOrLuvAskCount} timeout=${sample.timedOut}`,
    );
  }
  await warmPage.close();

  const summary = {
    measuredAt: new Date().toISOString(),
    expectedSha: EXPECTED_SHA,
    venue: "Jen's Fancy Venue",
    leadId: LEAD_ID,
    eventId: EVENT_ID,
    samples,
    slowestCold: [...samples]
      .filter((s) => s.mode === "cold" && s.usefulVisibleMs != null)
      .sort((a, b) => (b.usefulVisibleMs ?? 0) - (a.usefulVisibleMs ?? 0))
      .slice(0, 5)
      .map((s) => ({ route: s.route, usefulVisibleMs: s.usefulVisibleMs, requestCount: s.requestCount })),
  };

  writeFileSync(join(OUT, "baseline.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(DESKTOP, "baseline.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ slowestCold: summary.slowestCold }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
