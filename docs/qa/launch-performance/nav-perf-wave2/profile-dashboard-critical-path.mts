/**
 * NAV-PERF Wave 2 — profile Dashboard critical path on Sandbox.
 * Read-only. No mutations, no OpenAI, no Production.
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
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const OUT = resolve("docs/qa/launch-performance/nav-perf-wave2");
const DESKTOP = join(homedir(), "Desktop/HTC-NAV-PERF-WAVE2");
mkdirSync(OUT, { recursive: true });
mkdirSync(DESKTOP, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

async function authCookies() {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({ type: "email", token_hash: linkData.properties!.hashed_token! });
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

async function timeQuery(label: string, fn: () => Promise<unknown>) {
  const t0 = performance.now();
  let err: string | null = null;
  let meta: Record<string, unknown> = {};
  try {
    const result = await fn();
    if (result && typeof result === "object") {
      const r = result as { data?: unknown; error?: { message?: string }; count?: number };
      if (r.error) err = r.error.message ?? "error";
      if (Array.isArray(r.data)) meta.rows = r.data.length;
      if (typeof r.count === "number") meta.count = r.count;
      if (Array.isArray(result)) meta.rows = result.length;
    }
  } catch (e) {
    err = (e as Error).message;
  }
  return { label, ms: Math.round(performance.now() - t0), err, ...meta };
}

async function profileDb() {
  const supabase = admin;
  const venueId = FANCY;
  const today = new Date().toISOString().slice(0, 10);

  // Mirror briefing loadReadinessInputs pieces
  const briefingPieces = await Promise.all([
    timeQuery("briefing_events_all", () =>
      supabase.from("events").select("id, name, event_date, client_id, status").eq("venue_id", venueId).neq("status", "cancelled"),
    ),
    timeQuery("briefing_contracts_fat", () =>
      supabase.from("contracts").select("*, clients(first_name, last_name), events(event_date)").eq("venue_id", venueId).order("created_at", { ascending: false }),
    ),
    timeQuery("briefing_invoices_all", () =>
      supabase.from("invoices").select("id, status, client_id, event_id, balance_due, due_date, issued_at").eq("venue_id", venueId),
    ),
    timeQuery("briefing_schedules_all", () =>
      supabase.from("payment_schedules").select("id, event_id, client_id, title").eq("venue_id", venueId),
    ),
    timeQuery("briefing_line_items_all", () =>
      supabase.from("payment_line_items").select("id, schedule_id, status, due_date, amount").eq("venue_id", venueId),
    ),
    timeQuery("briefing_requests_all", () =>
      supabase.from("portal_requests").select("id, status, due_date, event_id, client_id").eq("venue_id", venueId).limit(5000),
    ),
  ]);

  // Snapshot RPCs (server uses user JWT; service role may differ — timing still informative)
  const snapshotPieces = await Promise.all([
    timeQuery("snap_open_leads", () =>
      supabase.from("leads").select("sales_stage, estimated_budget, created_at, pipeline_stage_id").eq("venue_id", venueId).not("sales_stage", "in", "(booked,lost,cancelled,archived)"),
    ),
    timeQuery("snap_pipeline_stages", () =>
      supabase.from("pipeline_stages").select("id, canonical_stage").eq("venue_id", venueId),
    ),
    timeQuery("snap_active_events_count", () =>
      supabase.from("events").select("id", { count: "exact", head: true }).eq("venue_id", venueId).in("status", ["confirmed", "in_progress"]).gte("event_date", today),
    ),
    timeQuery("rpc_gross_booked", () => supabase.rpc("canonical_gross_booked_revenue", { p_from: null, p_to: null })),
    timeQuery("rpc_payments_collected", () => supabase.rpc("canonical_payments_collected", { p_from: null, p_to: null })),
    timeQuery("rpc_outstanding", () => supabase.rpc("canonical_outstanding_balance", { p_from: null, p_to: null })),
  ]);

  // Focus population pieces
  const focusPieces = await Promise.all([
    timeQuery("focus_archived_rels", () =>
      supabase.from("venue_customer_relationships").select("id").eq("venue_id", venueId).not("archived_at", "is", null),
    ),
    timeQuery("focus_followup_leads", () =>
      supabase.from("leads").select("id").eq("venue_id", venueId).not("sales_stage", "in", "(booked,lost,cancelled,archived)").or(`follow_up_date.lte.${today},and(sales_stage.eq.new_inquiry,follow_up_date.is.null)`).limit(200),
    ),
    timeQuery("dash_tasks", () =>
      supabase.from("lead_tasks").select("id").eq("venue_id", venueId).eq("completed", false).limit(15),
    ),
    timeQuery("dash_events_30d", () =>
      supabase.from("events").select("id").eq("venue_id", venueId).neq("status", "cancelled").gte("event_date", today).limit(8),
    ),
    timeQuery("dash_payments_pending", () =>
      supabase.from("payment_line_items").select("id").eq("venue_id", venueId).in("status", ["pending", "overdue"]).limit(15),
    ),
  ]);

  // Layout-ish sequential simulation (service role approximations)
  const layoutSeq: Array<{ label: string; ms: number }> = [];
  {
    let t = performance.now();
    await supabase.from("venues").select("id, name").eq("id", venueId).maybeSingle();
    layoutSeq.push({ label: "layout_venue_row", ms: Math.round(performance.now() - t) });
    t = performance.now();
    await supabase.from("venue_enrollments").select("onboarding_type, status").eq("venue_id", venueId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    layoutSeq.push({ label: "layout_enrollment", ms: Math.round(performance.now() - t) });
    t = performance.now();
    await supabase.from("venue_staff").select("id", { count: "exact", head: true }).eq("venue_id", venueId).eq("is_active", true);
    layoutSeq.push({ label: "layout_staff_count", ms: Math.round(performance.now() - t) });
  }

  const briefingWall = Math.max(...briefingPieces.map((p) => p.ms));
  const snapshotWall = Math.max(...snapshotPieces.map((p) => p.ms));

  return {
    note: "DB timings via service role from laptop — network to Supabase, not ECS colocated. Relative ranking is the signal; absolute ms are lower bound vs in-app auth path.",
    briefingWallMs: briefingWall,
    snapshotWallMs: snapshotWall,
    briefingPieces: briefingPieces.sort((a, b) => b.ms - a.ms),
    snapshotPieces: snapshotPieces.sort((a, b) => b.ms - a.ms),
    focusPieces: focusPieces.sort((a, b) => b.ms - a.ms),
    layoutSeq,
  };
}

async function profileHttp(samples = 3) {
  const browser = await chromium.launch({ headless: true });
  const cookies = await authCookies();
  const results = [];

  for (let i = 0; i < samples; i++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addCookies(cookies);
    const page = await context.newPage();

    const marks: Record<string, number> = {};
    const api: Array<{ url: string; ms: number }> = [];
    const tNav = Date.now();

    page.on("response", (res) => {
      const u = res.url();
      if (u.includes("/api/navigation/attention") || u.includes("/api/notifications")) {
        try {
          const t = res.timing();
          api.push({ url: u.replace(APP, ""), ms: Math.round(t.responseEnd) });
        } catch {
          api.push({ url: u.replace(APP, ""), ms: -1 });
        }
      }
    });

    const resp = await page.goto(`${APP}/dashboard`, { waitUntil: "commit", timeout: 90000 });
    marks.ttfb_commit = Date.now() - tNav;

    await page.locator('[data-testid="dashboard-streaming-root"]').waitFor({ state: "attached", timeout: 90000 });
    marks.root_attached = Date.now() - tNav;

    // Header fallback or real greeting
    const headerRace = await Promise.race([
      page.locator("h1, [data-testid='dashboard-greeting'], .htc-hospitality-heading").first().waitFor({ state: "visible", timeout: 90000 }).then(() => "heading"),
      page.waitForTimeout(90000).then(() => "timeout"),
    ]);
    marks.heading_visible = Date.now() - tNav;

    // Snapshot cards (business snapshot)
    await page.locator("text=Lead Flow").first().waitFor({ state: "visible", timeout: 90000 }).catch(() => null);
    marks.snapshot_lead_flow = Date.now() - tNav;

    // Focus section
    await page.locator("text=Today's Focus").first().waitFor({ state: "visible", timeout: 90000 }).catch(() => null);
    marks.focus_visible = Date.now() - tNav;

    // Coming up
    await page.locator('[data-testid="coming-up-section"]').waitFor({ state: "visible", timeout: 90000 }).catch(() => null);
    marks.coming_up_visible = Date.now() - tNav;

    await page.waitForTimeout(1500);

    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return null;
      return {
        responseStart: Math.round(nav.responseStart),
        responseEnd: Math.round(nav.responseEnd),
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
        transferSize: nav.transferSize,
        encodedBodySize: nav.encodedBodySize,
      };
    });

    const bodySample = await page.locator('[data-testid="dashboard-streaming-root"]').innerText().catch(() => "");
    await page.screenshot({ path: join(OUT, `profile-sample-${i + 1}.png`), fullPage: false });
    copyFileSync(join(OUT, `profile-sample-${i + 1}.png`), join(DESKTOP, `profile-sample-${i + 1}.png`));

    results.push({
      sample: i + 1,
      status: resp?.status() ?? null,
      marks,
      headerRace,
      perf,
      api,
      bodyChars: bodySample.length,
      openai: 0,
    });
    await context.close();
  }

  await browser.close();

  const med = (vals: number[]) => {
    const s = [...vals].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };

  return {
    samples: results,
    median: {
      ttfb_commit: med(results.map((r) => r.marks.ttfb_commit)),
      root_attached: med(results.map((r) => r.marks.root_attached)),
      heading_visible: med(results.map((r) => r.marks.heading_visible)),
      snapshot_lead_flow: med(results.map((r) => r.marks.snapshot_lead_flow)),
      focus_visible: med(results.map((r) => r.marks.focus_visible)),
      coming_up_visible: med(results.map((r) => r.marks.coming_up_visible)),
      responseEnd: med(results.map((r) => r.perf?.responseEnd ?? 0)),
    },
  };
}

async function main() {
  console.log("DB profile…");
  const db = await profileDb();
  console.log(JSON.stringify({ briefingWallMs: db.briefingWallMs, topBriefing: db.briefingPieces.slice(0, 3) }, null, 2));

  console.log("HTTP profile (3 samples)…");
  const http = await profileHttp(3);

  const out = {
    measuredAt: new Date().toISOString(),
    servingExpected: "a38250946044e786e894d9d449ee6d5ab1f5e016",
    venue: "Jen's Fancy Venue",
    db,
    http,
  };
  writeFileSync(join(OUT, "critical-path-profile.json"), JSON.stringify(out, null, 2));
  writeFileSync(join(DESKTOP, "critical-path-profile.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ median: http.median, briefingWallMs: db.briefingWallMs }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
