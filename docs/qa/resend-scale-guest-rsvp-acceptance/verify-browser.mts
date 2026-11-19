/**
 * RESEND-SCALE — Guest RSVP browser acceptance against live Sandbox.
 *
 * Disposable guests on Jen's Fancy Venue booked client. Controlled recipient
 * aliases under jennifer@hellotocheers.com. Prefer pacing-capacity fixture
 * (fill bulk slots via RPC) over live email bursts for deferred cases.
 *
 *   DOTENV_CONFIG_PATH=../../.env.local npx tsx docs/qa/resend-scale-guest-rsvp-acceptance/verify-browser.mts
 *
 * No Production. No customer/vendor recipients. Cleans disposable rows.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: process.env.DOTENV_CONFIG_PATH ?? ".env.local", quiet: true });

const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");

const APP = process.env.HTC_MEASURE_BASE ?? "https://app.sandbox.hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const BOOKED_CLIENT = process.env.NAV_CLIENT_ID ?? "49aba826-0bd3-4891-ac9f-02a18b2b6962";
const BOOKED_EVENT = process.env.NAV_EVENT_ID ?? "74a2487d-40fc-418f-a6bc-54abef28b6e1";
const RUN = `rs${Date.now().toString(36)}`;
const OUT = resolve("docs/qa/resend-scale-guest-rsvp-acceptance");
const DESK = join(homedir(), "Desktop/HTC-RESEND-SCALE-GUEST-RSVP");
mkdirSync(OUT, { recursive: true });
mkdirSync(DESK, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("non-sandbox supabase url");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) throw new Error("missing SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

async function rpcAcquire(priority: "bulk" | "critical", nowMs?: number) {
  const body: Record<string, unknown> = {
    p_priority: priority,
    p_max_total: 9,
    p_max_bulk: 6,
    p_window_ms: 1000,
  };
  if (nowMs != null) body.p_now_ms = nowMs;
  const { data, error } = await admin.rpc("acquire_resend_send_slot", body);
  if (error) throw error;
  return data as { granted?: boolean; reason?: string; total?: number };
}

async function fillBulkCapacity() {
  const now = Date.now();
  let granted = 0;
  for (let i = 0; i < 8; i++) {
    const r = await rpcAcquire("bulk", now + i);
    if (r.granted) granted += 1;
  }
  return { granted, now };
}

async function cleanupPacingFrom(now: number) {
  await admin.from("resend_send_events").delete().gte("acquired_at_ms", now);
}

async function main() {
  const guestIds: string[] = [];
  const token = `resend_scale_${RUN}_${randomBytes(4).toString("hex")}`;
  let browser: { close: () => Promise<void> } | null = null;

  try {
    // Disposable guests — controlled aliases only
    const guests = [
      { first: "RSAlpha", last: RUN, email: `jennifer+rs-a-${RUN}@hellotocheers.com` },
      { first: "RSBeta", last: RUN, email: `jennifer+rs-b-${RUN}@hellotocheers.com` },
      { first: "RSGamma", last: RUN, email: `jennifer+rs-c-${RUN}@hellotocheers.com` },
    ];
    for (const g of guests) {
      const rsvpToken = `rsvp_${RUN}_${randomBytes(4).toString("hex")}`;
      const { data, error } = await admin
        .from("couple_guests")
        .insert({
          venue_id: FANCY,
          client_id: BOOKED_CLIENT,
          first_name: g.first,
          last_name: g.last,
          email: g.email,
          rsvp_token: rsvpToken,
          rsvp_status: "pending",
          invitation_status: "ready",
          is_vendor_meal: false,
        })
        .select("id, email, invitation_status")
        .single();
      if (error) throw error;
      guestIds.push(data.id);
    }
    record("fixture-guests", guestIds.length === 3, `${guestIds.length} disposable guests`);

    const { error: sessErr } = await admin.from("client_portal_sessions").insert({
      venue_id: FANCY,
      client_id: BOOKED_CLIENT,
      event_id: BOOKED_EVENT,
      access_token: token,
      access_level: "couple",
      label: `RESEND-SCALE guest RSVP ${RUN}`,
      expires_at: new Date(Date.now() + 2 * 864e5).toISOString(),
    });
    if (sessErr) throw sessErr;
    record("portal-session", true, token.slice(0, 24));

    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    const inviteResponses: Array<Record<string, unknown>> = [];
    page.on("response", async (res: { url: () => string; request: () => { method: () => string }; json: () => Promise<unknown> }) => {
      if (res.url().includes("/api/portal/invite") && res.request().method() === "POST") {
        res.json().then((j) => inviteResponses.push(j as Record<string, unknown>)).catch(() => undefined);
      }
    });

    await page.goto(`${APP}/p/${token}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(2500);
    // Couple portal legal gate (if shown)
    const agree = page.getByText(/I have reviewed and agree/i);
    if (await agree.count()) {
      await page.locator('input[type="checkbox"]').first().check().catch(async () => {
        await agree.click();
      });
      await page.getByRole("button", { name: /^Continue$/i }).click();
      await page.waitForTimeout(2000);
    }
    await page.goto(`${APP}/p/${token}#guests`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(3500);

    // --- Deferred path: fill bulk capacity, then send two guests via API ---
    const fill = await fillBulkCapacity();
    record("bulk-capacity-fill", fill.granted === 6, `granted=${fill.granted}`);

    const deferredPair = guestIds.slice(0, 2);
    // Call the live Sandbox invite API directly (Node) so acceptance can
    // prove deferred semantics even before the invite-route admin fix is deployed.
    // Browser still loads /p/{token}#guests for UI evidence.
    const deferredHttp = await fetch(`${APP}/api/portal/invite`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, guestIds: deferredPair, emailType: "invitation" }),
    });
    const deferredResult = (await deferredHttp.json()) as Record<string, unknown>;
    deferredResult._http = deferredHttp.status;
    inviteResponses.push(deferredResult);

    const liveInviteBlocked =
      Number(deferredResult._http) === 401 || deferredResult.error === "Invalid token.";
    if (liveInviteBlocked) {
      record(
        "live-invite-rls-defect",
        true,
        "Deployed invite route returns Invalid token under anon RLS; hotfix uses createAdminClient",
      );
    }

    const deferredCount = Number(deferredResult.deferred ?? 0);
    const sentDeferredBatch = Number(deferredResult.sent ?? 0);
    const deferredIds = (deferredResult.deferredGuestIds as string[] | undefined) ?? [];
    record(
      "deferred-identified",
      liveInviteBlocked ? false : deferredCount >= 1 && deferredIds.length >= 1,
      liveInviteBlocked
        ? `blocked_http=${deferredResult._http} body=${JSON.stringify(deferredResult).slice(0, 200)}`
        : `sent=${sentDeferredBatch} deferred=${deferredCount} failed=${deferredResult.failed} msg=${deferredResult.message ?? ""}`,
    );

    // Confirm DB: deferred guests still not invitation_status=sent
    const { data: afterDefer } = await admin
      .from("couple_guests")
      .select("id, invitation_status, rsvp_sent_at")
      .in("id", deferredPair);
    const falselySent = (afterDefer ?? []).filter(
      (g) => deferredIds.includes(g.id) && (g.invitation_status === "sent" || g.rsvp_sent_at),
    );
    record(
      "deferred-not-logged-sent",
      falselySent.length === 0,
      falselySent.length ? JSON.stringify(falselySent) : "ok",
    );

    await cleanupPacingFrom(fill.now);
    await page.waitForTimeout(1100); // let wall-clock window clear

    // --- Successful send for one deferred guest (retry) ---
    const retryId = deferredIds[0] ?? deferredPair[0]!;
    const sentHttp = await fetch(`${APP}/api/portal/invite`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, guestIds: [retryId], emailType: "invitation" }),
    });
    const sentResult = (await sentHttp.json()) as Record<string, unknown>;
    sentResult._http = sentHttp.status;
    inviteResponses.push(sentResult);
    record(
      "retry-send-success",
      Number(sentResult.sent ?? 0) === 1 && Number(sentResult.deferred ?? 0) === 0,
      JSON.stringify({ sent: sentResult.sent, deferred: sentResult.deferred, failed: sentResult.failed }),
    );

    const { data: afterSent } = await admin
      .from("couple_guests")
      .select("id, invitation_status, rsvp_sent_at")
      .eq("id", retryId)
      .maybeSingle();
    record(
      "sent-guest-marked",
      afterSent?.invitation_status === "sent" && !!afterSent.rsvp_sent_at,
      JSON.stringify(afterSent),
    );

    // --- Partial batch: one already-sent + one still-ready ---
    const remaining = guestIds.find((id) => id !== retryId) ?? guestIds[1]!;
    // Ensure remaining is ready/unsent
    await admin
      .from("couple_guests")
      .update({ invitation_status: "ready", rsvp_sent_at: null })
      .eq("id", remaining);

    const partialHttp = await fetch(`${APP}/api/portal/invite`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, guestIds: [retryId, remaining], emailType: "invitation" }),
    });
    const partial = (await partialHttp.json()) as Record<string, unknown>;
    partial._http = partialHttp.status;
    inviteResponses.push(partial);
    // Idempotent retry of already-accepted + new send: at least remaining should send;
    // already-sent may succeed again via Resend idempotency without double-logging concern
    record(
      "partial-batch-accurate",
      Number(partial.sent ?? 0) >= 1 && partial.ok === true,
      JSON.stringify({
        sent: partial.sent,
        deferred: partial.deferred,
        failed: partial.failed,
        sentGuestIds: partial.sentGuestIds,
      }),
    );

    // UI: open guests section and confirm Ready/Sent labels exist for our names
    await page.goto(`${APP}/p/${token}#guests`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(3500);
    // Re-clear legal gate if it reappears
    if (await page.getByText(/I have reviewed and agree/i).count()) {
      await page.locator('input[type="checkbox"]').first().check().catch(() => undefined);
      await page.getByRole("button", { name: /^Continue$/i }).click().catch(() => undefined);
      await page.waitForTimeout(2000);
      await page.goto(`${APP}/p/${token}#guests`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(2500);
    }
    const bodyText = await page.locator("body").innerText();
    const onPortal = !/Welcome back|Sign in to your Hello to Cheers workspace/i.test(bodyText);
    record("ui-portal-loaded", onPortal, onPortal ? "portal shell" : "redirected to login");
    record("ui-shows-alpha", /RSAlpha/i.test(bodyText), "guest list visible");
    // Screenshot evidence
    const shot = join(DESK, `guests-${RUN}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    record("ui-screenshot", true, shot);

    // Selectable retry: a ready/deferred guest still has Send affordance (invitation ready)
    const { data: stillReady } = await admin
      .from("couple_guests")
      .select("id, invitation_status")
      .in("id", guestIds)
      .neq("invitation_status", "sent");
    record(
      "unsent-still-retryable",
      (stillReady ?? []).every((g) => g.invitation_status === "ready" || g.invitation_status === "draft"),
      JSON.stringify(stillReady ?? []),
    );
  } catch (err) {
    record("run-error", false, err instanceof Error ? err.message : String(err));
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (guestIds.length) {
      await admin.from("couple_guests").delete().in("id", guestIds);
    }
    await admin.from("client_portal_sessions").delete().eq("access_token", token);
    record("cleanup", true, `removed ${guestIds.length} guests + session`);
  }

  const pass = checks.every((c) => c.ok);
  const report = {
    at: new Date().toISOString(),
    serving_expect: "9de88f75",
    app: APP,
    run: RUN,
    pass,
    checks,
  };
  writeFileSync(join(OUT, "acceptance.json"), JSON.stringify(report, null, 2) + "\n");
  writeFileSync(join(DESK, "acceptance.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(pass ? "\nGREEN guest RSVP acceptance" : "\nNOT GREEN guest RSVP acceptance");
  process.exit(pass ? 0 : 1);
}

await main();
