/**
 * Wave 7A Final Safety — focused action-parity + permission spot (read-only).
 * Fancy venue. No mutations.
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
const BOOKED_CLIENT = process.env.NAV_CLIENT_ID ?? "49aba826-0bd3-4891-ac9f-02a18b2b6962";
const BOOKED_EVENT = process.env.NAV_EVENT_ID ?? "74a2487d-40fc-418f-a6bc-54abef28b6e1";
const OUT = resolve("docs/qa/launch-performance/nav-perf-wave7a");
const DESK = join(homedir(), "Desktop/HTC-NAV-PERF-WAVE7A");
mkdirSync(OUT, { recursive: true });
mkdirSync(DESK, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("non-sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

type CaseResult = {
  name: string;
  path: string;
  ok: boolean;
  sawFallback: boolean;
  cancel: boolean;
  returnBooked: boolean;
  edit: boolean;
  daySheet: boolean;
  detailReady: boolean;
  detailError: boolean;
  httpStatus: number | null;
  notes: string[];
};

async function probeBookedActions(
  context: import("playwright").BrowserContext,
  name: string,
  path: string,
  expect: { cancel: boolean; returnBooked: boolean },
): Promise<CaseResult> {
  const page = await context.newPage();
  const notes: string[] = [];
  try {
    const fallbackWatch = page
      .waitForSelector('[data-testid="booking-identity-fallback"]', { timeout: 120000, state: "attached" })
      .then(() => true)
      .catch(() => false);
    const res = await page.goto(`${APP}${path}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    const httpStatus = res?.status() ?? null;
    await page.locator('[data-testid="event-header-actions"], [data-testid="booking-identity-fallback"]').first()
      .waitFor({ state: "visible", timeout: 120000 });
    const sawFallback = (await fallbackWatch) || (await page.locator('[data-testid="booking-identity-fallback"]').count()) > 0;
    const edit = (await page.locator('[data-testid="event-action-edit"]').count()) > 0;
    const daySheet = (await page.locator('[data-testid="event-action-day-sheet"]').count()) > 0;
    const cancel =
      (await page.locator('[data-testid="event-action-cancel"]').count()) > 0 ||
      (await page.locator('[data-testid="event-action-cancel-menu"]').count()) > 0;
    const returnBooked =
      (await page.locator('[data-testid="event-action-return-booked"]').count()) > 0 ||
      (await page.locator('[data-testid="event-action-return-booked-menu"]').count()) > 0;

    const detail = page.locator('[data-testid="booking-workspace-detail-ready"]');
    const detailErr = page.locator('[data-testid="booking-workspace-detail-error"]');
    try {
      await Promise.race([
        detail.waitFor({ state: "visible", timeout: 120000 }),
        detailErr.waitFor({ state: "visible", timeout: 120000 }),
      ]);
    } catch {
      notes.push("detail-timeout");
    }
    const detailReady = (await detail.count()) > 0;
    const detailError = (await detailErr.count()) > 0;

    const ok =
      edit &&
      daySheet &&
      !detailError &&
      cancel === expect.cancel &&
      returnBooked === expect.returnBooked;
    if (sawFallback) notes.push("saw-fallback");
    if (detailReady) notes.push("detail-ready");
    notes.push(`cancel=${cancel}`, `return=${returnBooked}`);

    return { name, path, ok, sawFallback, cancel, returnBooked, edit, daySheet, detailReady, detailError, httpStatus, notes };
  } catch (e) {
    return {
      name, path, ok: false, sawFallback: false, cancel: false, returnBooked: false,
      edit: false, daySheet: false, detailReady: false, detailError: false, httpStatus: null,
      notes: [e instanceof Error ? e.message : String(e)],
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function probeDenied(
  context: import("playwright").BrowserContext,
  name: string,
  path: string,
): Promise<CaseResult> {
  const page = await context.newPage();
  try {
    const res = await page.goto(`${APP}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    const httpStatus = res?.status() ?? null;
    const cancel = (await page.locator('[data-testid="event-action-cancel"]').count()) > 0;
    const edit = (await page.locator('[data-testid="event-action-edit"]').count()) > 0;
    const denied = httpStatus === 404 || (!edit && !cancel);
    return {
      name, path, ok: denied && !cancel,
      sawFallback: false, cancel, returnBooked: false, edit, daySheet: false,
      detailReady: false, detailError: false, httpStatus,
      notes: [denied ? "denied-as-expected" : "UNEXPECTED-ACCESS"],
    };
  } catch (e) {
    return {
      name, path, ok: false, sawFallback: false, cancel: false, returnBooked: false,
      edit: false, daySheet: false, detailReady: false, detailError: false, httpStatus: null,
      notes: [e instanceof Error ? e.message : String(e)],
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function probePreparing(
  context: import("playwright").BrowserContext,
  clientId: string,
): Promise<CaseResult> {
  const page = await context.newPage();
  const path = `/clients/${clientId}`;
  try {
    const res = await page.goto(`${APP}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    const httpStatus = res?.status() ?? null;
    await page.locator("h1, [data-testid='event-header-actions'], main").first().waitFor({ state: "visible", timeout: 60000 });
    const cancel = (await page.locator('[data-testid="event-action-cancel"]').count()) > 0;
    const returnBooked = (await page.locator('[data-testid="event-action-return-booked"]').count()) > 0;
    return {
      name: "preparing-no-event",
      path,
      ok: !cancel && !returnBooked,
      sawFallback: false,
      cancel,
      returnBooked,
      edit: false,
      daySheet: false,
      detailReady: false,
      detailError: false,
      httpStatus,
      notes: [cancel ? "UNEXPECTED-cancel" : "no-booked-cancel-chrome"],
    };
  } catch (e) {
    return {
      name: "preparing-no-event", path, ok: false, sawFallback: false, cancel: false, returnBooked: false,
      edit: false, daySheet: false, detailReady: false, detailError: false, httpStatus: null,
      notes: [e instanceof Error ? e.message : String(e)],
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

const host = new URL(APP).hostname;
const secure = APP.startsWith("https");

const { data: cancelledRows } = await admin
  .from("events")
  .select("id, client_id, status, booked_at")
  .eq("venue_id", FANCY)
  .eq("status", "cancelled")
  .not("booked_at", "is", null)
  .not("client_id", "is", null)
  .limit(3);
const cancelled = (cancelledRows ?? [])[0] as { id: string; client_id: string } | undefined;

// Preparing / unbooked: planning clients with zero events (no booked EventDetail shell).
const { data: preparingRows } = await admin
  .from("clients")
  .select("id, status")
  .eq("venue_id", FANCY)
  .eq("status", "planning")
  .limit(20);
let preparing: { id: string } | undefined;
for (const row of preparingRows ?? []) {
  const { count } = await admin
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("client_id", (row as { id: string }).id);
  if ((count ?? 0) === 0) {
    preparing = { id: (row as { id: string }).id };
    break;
  }
}

const { data: foreignClients } = await admin
  .from("clients")
  .select("id")
  .neq("venue_id", FANCY)
  .limit(1);
const foreignClientId = (foreignClients ?? [])[0]?.id as string | undefined;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
await ctx.addCookies(await authCookies(host, secure));

const results: CaseResult[] = [];
results.push(await probeBookedActions(ctx, "booked-owner", `/clients/${BOOKED_CLIENT}?eventId=${BOOKED_EVENT}`, {
  cancel: true,
  returnBooked: false,
}));

if (cancelled) {
  results.push(await probeBookedActions(ctx, "cancelled-return", `/clients/${cancelled.client_id}?eventId=${cancelled.id}`, {
    cancel: false,
    returnBooked: true,
  }));
} else {
  results.push({
    name: "cancelled-return",
    path: "(none)",
    ok: false,
    sawFallback: false,
    cancel: false,
    returnBooked: false,
    edit: false,
    daySheet: false,
    detailReady: false,
    detailError: false,
    httpStatus: null,
    notes: ["no-cancelled-booked-fixture"],
  });
}

if (preparing) {
  results.push(await probePreparing(ctx, preparing.id));
} else {
  results.push({
    name: "preparing-no-event",
    path: "(none)",
    ok: false,
    sawFallback: false,
    cancel: false,
    returnBooked: false,
    edit: false,
    daySheet: false,
    detailReady: false,
    detailError: false,
    httpStatus: null,
    notes: ["no-preparing-fixture"],
  });
}

results.push(await probeDenied(ctx, "unknown-client", `/clients/00000000-0000-4000-8000-000000000099`));
if (foreignClientId) {
  results.push(await probeDenied(ctx, "cross-venue-client", `/clients/${foreignClientId}`));
}

await ctx.close();
await browser.close();

const report = {
  measuredAt: new Date().toISOString(),
  app: APP,
  results,
  allOk: results.every((r) => r.ok),
};
writeFileSync(join(OUT, "action-parity-spot.json"), JSON.stringify(report, null, 2));
writeFileSync(join(DESK, "action-parity-spot.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.allOk ? 0 : 1);
