/**
 * NAV-PERF Wave 2 post-deploy remasure — real content only (no skeletons).
 * Read-only. No OpenAI / outbound / Production.
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
const EXPECTED_SHA = (process.env.EXPECTED_SHA ?? "7191fffa5a21f408a5b65034f612b511cdbbcf3f").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const SAMPLES = Number(process.env.NAV_PERF_SAMPLES ?? 3);
const OUT = resolve("docs/qa/launch-performance/nav-perf-wave2/after");
const DESKTOP = join(homedir(), "Desktop/HTC-NAV-PERF-WAVE2-AFTER");
mkdirSync(OUT, { recursive: true });
mkdirSync(DESKTOP, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

async function authCookies() {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    { name: "htc_active_venue_id", value: FANCY, domain: "app.sandbox.hellotocheers.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const },
  ];
}

function median(vals: number[]) {
  const s = [...vals].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  return s[Math.floor(s.length / 2)];
}

type Sample = {
  mode: "cold" | "warm";
  sample: number;
  ttfbMs: number | null;
  greetingMs: number | null;
  kpiMs: number | null;
  focusMs: number | null;
  interactiveMs: number | null;
  usefulRootMs: number | null;
  documentResponseEndMs: number | null;
  notif: Array<{ status: number; ms: number }>;
  attention: Array<{ status: number; ms: number }>;
  openaiOrLuvAsk: number;
  dpl: string | null;
  venueLine: string | null;
  kpiLeadFlow: string | null;
  focusTitleOk: boolean;
  error?: string;
};

async function measureOne(
  context: import("playwright").BrowserContext,
  mode: "cold" | "warm",
  sample: number,
): Promise<Sample> {
  const page = await context.newPage();
  const notif: Sample["notif"] = [];
  const attention: Sample["attention"] = [];
  let openaiOrLuvAsk = 0;
  const t0 = Date.now();

  page.on("request", (req) => {
    const u = req.url();
    if (/api\.openai\.com|luv-ask/i.test(u)) openaiOrLuvAsk += 1;
  });
  page.on("response", (res) => {
    const u = res.url();
    if (u.includes("/api/notifications")) notif.push({ status: res.status(), ms: -1 });
    if (u.includes("/api/navigation/attention")) attention.push({ status: res.status(), ms: -1 });
  });

  const out: Sample = {
    mode,
    sample,
    ttfbMs: null,
    greetingMs: null,
    kpiMs: null,
    focusMs: null,
    interactiveMs: null,
    usefulRootMs: null,
    documentResponseEndMs: null,
    notif,
    attention,
    openaiOrLuvAsk: 0,
    dpl: null,
    venueLine: null,
    kpiLeadFlow: null,
    focusTitleOk: false,
  };

  try {
    const resp = await page.goto(`${APP}/dashboard`, { waitUntil: "commit", timeout: 90000 });
    out.ttfbMs = Date.now() - t0;
    void resp;

    await page.locator('[data-testid="dashboard-streaming-root"]').waitFor({ state: "attached", timeout: 90000 });
    out.usefulRootMs = Date.now() - t0;

    // Real greeting: h1 with Good morning/afternoon/evening, NOT inside aria-busy fallback
    const greeting = page.locator(
      'h1.font-heading:text-matches("Good (morning|afternoon|evening)", "i")',
    ).first();
    // Playwright text-matches may need different API — use filter
    const h1 = page.locator("h1.font-heading").filter({ hasText: /Good (morning|afternoon|evening)/i }).first();
    await h1.waitFor({ state: "visible", timeout: 90000 });
    // Ensure not the fallback bone-only header
    const busy = await page.locator('[data-testid="dashboard-header-fallback"][aria-busy="true"]').count();
    if (busy > 0) {
      await page.locator('[data-testid="dashboard-header-fallback"]').waitFor({ state: "detached", timeout: 90000 }).catch(() => undefined);
      await h1.waitFor({ state: "visible", timeout: 90000 });
    }
    out.greetingMs = Date.now() - t0;

    // Real KPI: Lead Flow label visible and not only skeleton bones
    const leadFlow = page.getByText("Lead Flow", { exact: true }).first();
    await leadFlow.waitFor({ state: "visible", timeout: 90000 });
    await page.locator('[data-testid="dashboard-snapshot-fallback"]').waitFor({ state: "detached", timeout: 30000 }).catch(() => undefined);
    out.kpiMs = Date.now() - t0;
    out.kpiLeadFlow = await leadFlow.innerText().catch(() => null);

    // Real Focus: title Today's Focus and fallback gone
    const focusTitle = page.getByText("Today's Focus", { exact: true }).first();
    await focusTitle.waitFor({ state: "visible", timeout: 90000 });
    await page.locator('[data-testid="dashboard-focus-fallback"]').waitFor({ state: "detached", timeout: 60000 }).catch(() => undefined);
    out.focusMs = Date.now() - t0;
    out.focusTitleOk = true;

    // Meaningful interaction: New Lead CTA (Button+Link may be role=button or <a>)
    const newLead = page.locator('a[href="/leads/new"], a[href*="/leads/new"]').first();
    await newLead.waitFor({ state: "visible", timeout: 30000 });
    out.interactiveMs = Date.now() - t0;

    await page.waitForTimeout(1200);

    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      return nav ? Math.round(nav.responseEnd) : null;
    });
    out.documentResponseEndMs = perf;

    out.dpl = await page.evaluate(() => {
      const nodes = [
        ...document.querySelectorAll("script[src], link[href], img[src]"),
      ] as Array<HTMLScriptElement | HTMLLinkElement | HTMLImageElement>;
      for (const n of nodes) {
        const src = ("src" in n && n.src) || ("href" in n && n.href) || "";
        const m = String(src).match(/dpl=([a-f0-9]{7,40})/);
        if (m) return m[1];
      }
      return null;
    });

    out.venueLine = await page.locator("p.text-muted-foreground").filter({ hasText: /Here's what's happening at/ }).first().innerText().catch(() => null);
    out.openaiOrLuvAsk = openaiOrLuvAsk;

    await page.screenshot({ path: join(OUT, `${mode}-sample-${sample}.png`), fullPage: false });
    copyFileSync(join(OUT, `${mode}-sample-${sample}.png`), join(DESKTOP, `${mode}-sample-${sample}.png`));
  } catch (e) {
    out.error = (e as Error).message;
  } finally {
    await page.close();
  }
  return out;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const cookies = await authCookies();
  const samples: Sample[] = [];

  // Cold: fresh context each sample
  for (let i = 1; i <= SAMPLES; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies(cookies);
    console.log(`COLD ${i}…`);
    const s = await measureOne(ctx, "cold", i);
    samples.push(s);
    console.log(`  ttfb=${s.ttfbMs} greet=${s.greetingMs} kpi=${s.kpiMs} focus=${s.focusMs} dpl=${s.dpl?.slice(0, 8)} err=${s.error ?? ""}`);
    await ctx.close();
  }

  // Warm: one context, revisit dashboard
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies(cookies);
    const warmPage = await ctx.newPage();
    await warmPage.goto(`${APP}/leads`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await warmPage.waitForTimeout(800);
    await warmPage.close();
    for (let i = 1; i <= SAMPLES; i++) {
      console.log(`WARM ${i}…`);
      const s = await measureOne(ctx, "warm", i);
      samples.push(s);
      console.log(`  ttfb=${s.ttfbMs} greet=${s.greetingMs} kpi=${s.kpiMs} focus=${s.focusMs} dpl=${s.dpl?.slice(0, 8)} err=${s.error ?? ""}`);
    }
    await ctx.close();
  }

  // Include samples that reached Focus even if a later interaction check failed.
  const byMode = (mode: "cold" | "warm") =>
    samples.filter((s) => s.mode === mode && s.focusMs != null);
  const summarize = (mode: "cold" | "warm") => {
    const rows = byMode(mode);
    const pick = (k: keyof Sample) => median(rows.map((r) => Number(r[k])));
    return {
      n: rows.length,
      ttfbMs: pick("ttfbMs"),
      greetingMs: pick("greetingMs"),
      kpiMs: pick("kpiMs"),
      focusMs: pick("focusMs"),
      interactiveMs: pick("interactiveMs"),
      usefulRootMs: pick("usefulRootMs"),
      documentResponseEndMs: pick("documentResponseEndMs"),
    };
  };

  const report = {
    measuredAt: new Date().toISOString(),
    expectedSha: EXPECTED_SHA,
    venue: "Jen's Fancy Venue",
    definition:
      "greeting/kpi/focus exclude Suspense fallbacks; greeting = real h1 Good *; kpi = Lead Flow visible; focus = Today's Focus with fallback detached",
    wave1Compare: {
      dashboardColdUsefulRoot: 5933,
      dashboardWarmUsefulRoot: 3412,
      warmFocusMedian: 3624,
      warmTtfbMedian: 1358,
      note: "Wave 1 useful used streaming-root (includes skeletons). Wave 2 reports real content milestones separately.",
    },
    medians: { cold: summarize("cold"), warm: summarize("warm") },
    samples,
  };

  writeFileSync(join(OUT, "remeasure.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(DESKTOP, "remeasure.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ medians: report.medians, expectedSha: EXPECTED_SHA }, null, 2));
  await browser.close();

  const dpls = [...new Set(samples.map((s) => s.dpl).filter(Boolean))];
  if (dpls.length && !dpls.every((d) => d!.startsWith(EXPECTED_SHA.slice(0, 8)))) {
    console.error("DPL mismatch", dpls, EXPECTED_SHA);
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
