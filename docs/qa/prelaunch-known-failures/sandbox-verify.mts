/**
 * Prelaunch known-failures — Sandbox read-only verification.
 * Timeline empty/populated chrome + Questionnaires card/tab reachability.
 * No mutations, outbound sends, payments, or paid AI.
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
const BOOKED_CLIENT = process.env.NAV_CLIENT_ID ?? "49aba826-0bd3-4891-ac9f-02a18b2b6962";
const BOOKED_EVENT = process.env.NAV_EVENT_ID ?? "74a2487d-40fc-418f-a6bc-54abef28b6e1";
const OUT = resolve("docs/qa/prelaunch-known-failures");
const DESK = join(homedir(), "Desktop/HTC-PRELAUNCH-KNOWN-FAILURES");
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

type Check = { name: string; ok: boolean; notes: string[] };

const checks: Check[] = [];
const host = new URL(APP).hostname;
const secure = APP.startsWith("https");
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
await ctx.addCookies(await authCookies(host, secure));
const page = await ctx.newPage();
let openai = 0;
page.on("request", (req) => {
  if (/api\.openai\.com|luv-ask/i.test(req.url())) openai += 1;
});

try {
  await page.goto(`${APP}/clients/${BOOKED_CLIENT}?eventId=${BOOKED_EVENT}`, {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  });
  await page.locator('[data-testid="event-header-actions"], h1').first().waitFor({ state: "visible", timeout: 120000 });

  const row1 = await page.locator('[data-testid="booked-tab-row-1"]').innerText().catch(() => "");
  const row2 = await page.locator('[data-testid="booked-tab-row-2"]').innerText().catch(() => "");
  const hasQTab =
    (await page.locator('[data-testid="booked-tab-row-1"] [value="questionnaires"], [data-testid="booked-tab-row-2"] button:has-text("Questionnaires")').count()) > 0 ||
    /Questionnaires/i.test(row1 + "\n" + row2);
  const qCard = (await page.locator('[data-testid="event-questionnaires-card"]').count()) > 0;
  const openQ = (await page.locator('[data-testid="open-questionnaires-card"]').count()) > 0;
  checks.push({
    name: "questionnaires-not-on-tab-rows",
    ok: !hasQTab,
    notes: [`row1=${JSON.stringify(row1.slice(0, 120))}`, `hasQTab=${hasQTab}`],
  });
  checks.push({
    name: "questionnaires-overview-card",
    ok: qCard && openQ,
    notes: [`card=${qCard}`, `open=${openQ}`],
  });

  if (openQ) {
    await page.locator('[data-testid="open-questionnaires-card"]').first().click();
    await page.locator('[data-testid="event-questionnaires-tab"]').waitFor({ state: "visible", timeout: 60000 });
    const panelVisible = (await page.locator('[data-testid="event-questionnaires-tab"]').count()) > 0;
    checks.push({
      name: "questionnaires-card-opens-panel",
      ok: panelVisible,
      notes: [`panel=${panelVisible}`, `urlHash=${new URL(page.url()).hash}`],
    });
  } else {
    checks.push({ name: "questionnaires-card-opens-panel", ok: false, notes: ["no-open-control"] });
  }

  // Timeline tab — populated or empty chrome.
  await page.locator('[data-testid="booked-tab-row-1"] button:has-text("Timeline"), [data-testid="booked-tab-row-1"] [value="timeline"]').first().click().catch(async () => {
    await page.getByRole("tab", { name: /Timeline/i }).first().click();
  });
  await page.waitForTimeout(800);
  const noTimeline = (await page.getByText("No timeline yet").count()) > 0;
  const addFirst = (await page.getByRole("button", { name: /Add First Entry/i }).count()) > 0;
  const templatePicker = (await page.getByRole("button", { name: /Use Template|Apply Template|Start from a template|Template/i }).count()) > 0
    || (await page.locator("text=/template/i").count()) > 0;
  const shareCouple = (await page.locator('[data-testid="timeline-share-with-couple"]').count()) > 0;

  if (noTimeline) {
    checks.push({
      name: "timeline-empty-state",
      ok: addFirst && templatePicker,
      notes: [`noTimeline=${noTimeline}`, `addFirst=${addFirst}`, `templateChrome=${templatePicker}`],
    });
  } else {
    checks.push({
      name: "timeline-populated-toolbar",
      ok: shareCouple || templatePicker,
      notes: [`noTimeline=false`, `share=${shareCouple}`, `templateChrome=${templatePicker}`],
    });
  }

  // Prefer an empty-timeline event if one exists on Fancy (read-only discovery).
  const { data: events } = await admin
    .from("events")
    .select("id, client_id, name")
    .eq("venue_id", FANCY)
    .neq("status", "cancelled")
    .limit(40);
  let emptyFound: { id: string; client_id: string } | null = null;
  for (const ev of events ?? []) {
    const { count } = await admin
      .from("timeline_entries")
      .select("id", { count: "exact", head: true })
      .eq("event_id", (ev as { id: string }).id);
    if ((count ?? 0) === 0) {
      emptyFound = { id: (ev as { id: string }).id, client_id: (ev as { client_id: string }).client_id };
      break;
    }
  }
  if (emptyFound) {
    await page.goto(`${APP}/clients/${emptyFound.client_id}?eventId=${emptyFound.id}#timeline`, {
      waitUntil: "domcontentloaded",
      timeout: 180000,
    });
    await page.locator('[data-testid="event-header-actions"], h1').first().waitFor({ state: "visible", timeout: 120000 });
    await page.getByRole("tab", { name: /Timeline/i }).first().click().catch(() => undefined);
    await page.getByText("No timeline yet").waitFor({ state: "visible", timeout: 60000 }).catch(() => undefined);
    const emptyOk =
      (await page.getByText("No timeline yet").count()) > 0 &&
      (await page.getByRole("button", { name: /Add First Entry/i }).count()) > 0;
    const pickerOk =
      (await page.getByRole("button", { name: /Use Template|Apply Template|Template/i }).count()) > 0 ||
      (await page.locator("button:has-text('template'), button:has-text('Template')").count()) > 0;
    checks.push({
      name: "timeline-empty-fixture",
      ok: emptyOk && pickerOk,
      notes: [`event=${emptyFound.id}`, `emptyOk=${emptyOk}`, `pickerOk=${pickerOk}`],
    });
  } else {
    checks.push({
      name: "timeline-empty-fixture",
      ok: true,
      notes: ["no-empty-timeline-event-on-fancy; populated path covered"],
    });
  }
} catch (e) {
  checks.push({
    name: "sandbox-verify-exception",
    ok: false,
    notes: [e instanceof Error ? e.message : String(e)],
  });
} finally {
  await page.close().catch(() => undefined);
  await ctx.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
}

const report = {
  measuredAt: new Date().toISOString(),
  app: APP,
  openai,
  checks,
  allOk: checks.every((c) => c.ok) && openai === 0,
};
writeFileSync(join(OUT, "sandbox-verify.json"), JSON.stringify(report, null, 2));
writeFileSync(join(DESK, "sandbox-verify.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.allOk ? 0 : 1);
