/**
 * Timeline P1b — Sandbox browser + persisted acceptance.
 * Disposable client/event/rows use P1B-{RUN}- prefix and are cleaned up.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const RUN = process.env.E2E_RUN_ID ?? `P1B${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/timeline-p1b-working-released";
mkdirSync(`${OUT}/shots`, { recursive: true });
const PREFIX = `P1B-${RUN}-`;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 420)}`);
}

async function servingImage(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function staffSession() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  const userId = otp.session.user.id;
  const { error: ctxErr } = await admin.from("venue_staff_active_context").upsert({
    user_id: userId,
    active_venue_id: FANCY,
  });
  if (ctxErr) throw ctxErr;
  const staff = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${otp.session.access_token}` } },
  });
  return { session: otp.session, staff };
}

async function staffCookies(session: { access_token: string; refresh_token: string; [k: string]: unknown }) {
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    })),
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

async function insertEntry(
  eventId: string,
  row: Record<string, unknown>,
) {
  const { data, error } = await admin
    .from("timeline_entries")
    .insert({
      venue_id: FANCY,
      event_id: eventId,
      owner: "venue",
      lock_state: "editable",
      status: "not_started",
      audiences: [],
      sort_order: 9000,
      ...row,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Record<string, unknown>;
}

async function portalTitles(token: string): Promise<string[]> {
  const { data, error } = await anon.rpc("get_portal_run_of_show", { p_token: token });
  if (error) throw error;
  const entries = Array.isArray((data as { entries?: unknown })?.entries)
    ? ((data as { entries: Array<{ title?: string; owner?: string }> }).entries)
    : [];
  return entries.filter((e) => e.owner === "venue").map((e) => String(e.title ?? ""));
}

async function cleanup(clientId: string | null, eventId: string | null) {
  if (eventId) {
    await admin.from("timeline_entries").delete().eq("event_id", eventId).eq("venue_id", FANCY);
    await admin.from("venue_timeline_releases").delete().eq("event_id", eventId).eq("venue_id", FANCY);
    await admin.from("client_portal_sessions").delete().eq("event_id", eventId).eq("venue_id", FANCY);
    await admin.from("events").delete().eq("id", eventId).eq("venue_id", FANCY);
  }
  if (clientId) {
    await admin.from("clients").delete().eq("id", clientId).eq("venue_id", FANCY);
  }
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  let clientId: string | null = null;
  let eventId: string | null = null;

  try {
    const image = await servingImage();
    const shaFromImage = image.split(":").pop() ?? "";
    record("serving-sha", shaFromImage.startsWith(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);

    const health = await fetch(`${APP}/api/health`).then((r) => r.json());
    record("health", health?.ok === true && health?.checks?.supabase === "ok", JSON.stringify(health));

    const html = await fetch(`${APP}/login`).then((r) => r.text());
    const dpl = html.match(/data-dpl-id="([^"]+)"/)?.[1] ?? "";
    record("html-dpl", dpl.startsWith(EXPECTED.slice(0, 12)), `dpl=${dpl}`);

    // Schema + cutover evidence
    const { data: tableProbe, error: tableErr } = await admin
      .from("venue_timeline_releases")
      .select("id")
      .limit(1);
    record("table-exists", !tableErr, tableErr?.message ?? `rows_sample=${tableProbe?.length ?? 0}`);

    const { count: cutoverCount } = await admin
      .from("venue_timeline_releases")
      .select("id", { count: "exact", head: true })
      .eq("source", "cutover");
    record("cutover-releases-present", (cutoverCount ?? 0) > 0, `cutoverCount=${cutoverCount}`);

    const { count: pointed } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .not("active_venue_timeline_release_id", "is", null);
    record("events-with-active-pointer", (pointed ?? 0) > 0, `pointed=${pointed}`);

    // Disposable fixture
    const { data: client, error: cErr } = await admin
      .from("clients")
      .insert({
        venue_id: FANCY,
        first_name: "P1b",
        last_name: RUN,
        email: `p1b-${RUN.toLowerCase()}@example.com`,
      })
      .select("id")
      .single();
    if (cErr || !client) throw cErr ?? new Error("client");
    clientId = client.id;

    const { data: event, error: eErr } = await admin
      .from("events")
      .insert({
        venue_id: FANCY,
        client_id: clientId,
        name: `${PREFIX}event`,
        event_type: "wedding",
        event_date: "2027-06-15",
        event_end_date: "2027-06-16",
        status: "confirmed",
      })
      .select("id,active_venue_timeline_release_id")
      .single();
    if (eErr || !event) throw eErr ?? new Error("event");
    eventId = event.id;
    // linkedEventId is derived from events.client_id (already set above).
    record("fixture-event", true, eventId);

    const portalToken = `qa-p1b-${RUN.toLowerCase()}`;
    const { error: sessErr } = await admin.from("client_portal_sessions").insert({
      venue_id: FANCY,
      client_id: clientId,
      event_id: eventId,
      access_token: portalToken,
      access_level: "couple",
    });
    if (sessErr) throw sessErr;

    const resolved = await insertEntry(eventId, {
      title: `${PREFIX}doors`,
      day_offset: 0,
      entry_time: "16:00",
      timing_day_intent: "relative",
      timing_day_anchor: "event_start",
      timing_relative_day_offset: 0,
      timing_clock_intent: "explicit",
      timing_attention: null,
    });
    const holdOut = await insertEntry(eventId, {
      title: `${PREFIX}tbd`,
      day_offset: 0,
      entry_time: "17:00",
      timing_day_intent: null,
      timing_clock_intent: null,
      timing_attention: "unknown_intent",
    });
    const softFar = await insertEntry(eventId, {
      title: `${PREFIX}far-fixed`,
      day_offset: 0,
      entry_time: "12:00",
      timing_day_intent: "fixed",
      timing_fixed_date: "2026-01-01",
      timing_clock_intent: "explicit",
      timing_attention: null,
    });

    const { session, staff } = await staffSession();

    // Cross-venue isolation: wrong event id under Fancy should fail event_not_found only if different venue —
    // use a random uuid for not found.
    const { data: missing } = await staff.rpc("preview_venue_timeline_release", {
      p_event_id: "00000000-0000-4000-8000-000000000099",
    });
    record(
      "authz-missing-event",
      (missing as { ok?: boolean; error?: string })?.ok === false,
      JSON.stringify(missing),
    );

    const { data: preview1, error: p1err } = await staff.rpc("preview_venue_timeline_release", {
      p_event_id: eventId,
    });
    if (p1err) throw p1err;
    const prev = preview1 as Record<string, unknown>;
    record(
      "preview-first-buckets",
      prev.ok === true
        && Array.isArray(prev.willShare)
        && (prev.willShare as unknown[]).length === 2
        && Array.isArray(prev.heldOut)
        && (prev.heldOut as unknown[]).length === 1
        && Array.isArray(prev.blocksRelease)
        && (prev.blocksRelease as unknown[]).length === 0
        && Array.isArray(prev.softWarnings)
        && (prev.softWarnings as unknown[]).length >= 1
        && prev.canRelease === true,
      JSON.stringify({
        will: (prev.willShare as unknown[])?.length,
        held: (prev.heldOut as unknown[])?.length,
        blocks: (prev.blocksRelease as unknown[])?.length,
        soft: (prev.softWarnings as unknown[])?.length,
        can: prev.canRelease,
      }),
    );

    // Cancellation: do nothing after preview — no release row.
    const { count: beforeCancel } = await admin
      .from("venue_timeline_releases")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    record("cancel-writes-nothing", (beforeCancel ?? 0) === 0, `count=${beforeCancel}`);

    // Stale fingerprint reject
    const { data: stale } = await staff.rpc("confirm_venue_timeline_release", {
      p_event_id: eventId,
      p_acknowledged_hold_out_ids: [holdOut.id],
      p_working_fingerprint: "deadbeef",
      p_idempotency_key: `stale-${RUN}`,
    });
    record(
      "stale-preview-rejected",
      (stale as { ok?: boolean; error?: string })?.ok === false
        && (stale as { error?: string }).error === "stale_preview",
      JSON.stringify(stale),
    );

    const fp = String(prev.workingFingerprint ?? "");
    const idem = `release-1-${RUN}`;
    const { data: conf1, error: c1err } = await staff.rpc("confirm_venue_timeline_release", {
      p_event_id: eventId,
      p_acknowledged_hold_out_ids: [holdOut.id],
      p_working_fingerprint: fp,
      p_idempotency_key: idem,
    });
    if (c1err) throw c1err;
    const ok1 = conf1 as Record<string, unknown>;
    record(
      "first-release-ok",
      ok1.ok === true && typeof ok1.releaseId === "string" && ok1.idempotentReplay !== true,
      JSON.stringify(ok1),
    );
    const release1 = String(ok1.releaseId ?? "");

    const { data: evAfter1 } = await admin
      .from("events")
      .select("active_venue_timeline_release_id")
      .eq("id", eventId)
      .single();
    record(
      "active-pointer-first",
      evAfter1?.active_venue_timeline_release_id === release1,
      JSON.stringify(evAfter1),
    );

    const { data: snap1 } = await admin
      .from("venue_timeline_releases")
      .select("snapshot,entry_count,held_out,released_at")
      .eq("id", release1)
      .single();
    const titles1 = ((snap1?.snapshot as Array<{ title?: string; id?: string }>) ?? []).map((x) => x.title);
    record(
      "snapshot-excludes-held-out",
      (snap1?.entry_count === 2)
        && titles1.includes(`${PREFIX}doors`)
        && titles1.includes(`${PREFIX}far-fixed`)
        && !titles1.includes(`${PREFIX}tbd`),
      JSON.stringify({ titles1, held: snap1?.held_out }),
    );

    const portal1 = await portalTitles(portalToken);
    record(
      "portal-matches-release-1",
      portal1.includes(`${PREFIX}doors`)
        && portal1.includes(`${PREFIX}far-fixed`)
        && !portal1.includes(`${PREFIX}tbd`),
      JSON.stringify(portal1),
    );

    // Working edit after release must not change portal
    await admin
      .from("timeline_entries")
      .update({ title: `${PREFIX}doors-EDITED` })
      .eq("id", resolved.id)
      .eq("venue_id", FANCY);
    const portalAfterEdit = await portalTitles(portalToken);
    record(
      "working-edit-does-not-change-portal",
      portalAfterEdit.includes(`${PREFIX}doors`) && !portalAfterEdit.includes(`${PREFIX}doors-EDITED`),
      JSON.stringify(portalAfterEdit),
    );
    // Restore for next release content
    await admin
      .from("timeline_entries")
      .update({ title: `${PREFIX}doors` })
      .eq("id", resolved.id)
      .eq("venue_id", FANCY);

    // Held-out remains unresolved in working
    const { data: heldRow } = await admin
      .from("timeline_entries")
      .select("timing_attention")
      .eq("id", holdOut.id)
      .single();
    record(
      "held-out-still-unresolved",
      heldRow?.timing_attention === "unknown_intent",
      JSON.stringify(heldRow),
    );

    // Idempotent retry
    const { data: replay } = await staff.rpc("confirm_venue_timeline_release", {
      p_event_id: eventId,
      p_acknowledged_hold_out_ids: [holdOut.id],
      p_working_fingerprint: fp,
      p_idempotency_key: idem,
    });
    record(
      "idempotent-retry",
      (replay as { ok?: boolean; releaseId?: string; idempotentReplay?: boolean })?.ok === true
        && (replay as { releaseId?: string }).releaseId === release1
        && (replay as { idempotentReplay?: boolean }).idempotentReplay === true,
      JSON.stringify(replay),
    );
    const { count: releaseCount } = await admin
      .from("venue_timeline_releases")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    record("no-duplicate-release", (releaseCount ?? 0) === 1, `count=${releaseCount}`);

    // Second release after resolving hold-out + adding item
    await admin
      .from("timeline_entries")
      .update({
        timing_attention: null,
        timing_day_intent: "relative",
        timing_day_anchor: "event_start",
        timing_relative_day_offset: 0,
        timing_clock_intent: "explicit",
        title: `${PREFIX}tbd-resolved`,
      })
      .eq("id", holdOut.id)
      .eq("venue_id", FANCY);
    const added = await insertEntry(eventId, {
      title: `${PREFIX}cake`,
      day_offset: 0,
      entry_time: "20:00",
      timing_day_intent: "relative",
      timing_day_anchor: "event_start",
      timing_relative_day_offset: 0,
      timing_clock_intent: "explicit",
      timing_attention: null,
    });

    const { data: preview2 } = await staff.rpc("preview_venue_timeline_release", { p_event_id: eventId });
    const prev2 = preview2 as Record<string, unknown>;
    const { data: conf2 } = await staff.rpc("confirm_venue_timeline_release", {
      p_event_id: eventId,
      p_acknowledged_hold_out_ids: [],
      p_working_fingerprint: String(prev2.workingFingerprint ?? ""),
      p_idempotency_key: `release-2-${RUN}`,
    });
    const ok2 = conf2 as Record<string, unknown>;
    record("second-release-ok", ok2.ok === true, JSON.stringify(ok2));
    const release2 = String(ok2.releaseId ?? "");

    const { data: evAfter2 } = await admin
      .from("events")
      .select("active_venue_timeline_release_id")
      .eq("id", eventId)
      .single();
    record(
      "active-pointer-second",
      evAfter2?.active_venue_timeline_release_id === release2 && release2 !== release1,
      JSON.stringify(evAfter2),
    );

    const portal2 = await portalTitles(portalToken);
    record(
      "portal-updates-only-after-second-release",
      portal2.includes(`${PREFIX}tbd-resolved`) && portal2.includes(`${PREFIX}cake`),
      JSON.stringify(portal2),
    );

    const { data: priorSnap } = await admin
      .from("venue_timeline_releases")
      .select("id,snapshot,entry_count")
      .eq("id", release1)
      .single();
    record(
      "prior-release-immutable",
      priorSnap?.entry_count === 2
        && ((priorSnap?.snapshot as Array<{ title?: string }>) ?? []).every(
          (x) => x.title !== `${PREFIX}cake`,
        ),
      JSON.stringify({ count: priorSnap?.entry_count }),
    );

    // Block: mark a previously released item unresolved
    await admin
      .from("timeline_entries")
      .update({ timing_attention: "missing_event_end", timing_day_intent: "relative", timing_day_anchor: "event_end" })
      .eq("id", added.id)
      .eq("venue_id", FANCY);
    const { data: previewBlock } = await staff.rpc("preview_venue_timeline_release", { p_event_id: eventId });
    const pb = previewBlock as Record<string, unknown>;
    record(
      "previously-released-unresolved-blocks",
      pb.canRelease === false && Array.isArray(pb.blocksRelease) && (pb.blocksRelease as unknown[]).length >= 1,
      JSON.stringify({ can: pb.canRelease, blocks: pb.blocksRelease }),
    );
    const { data: blockedConfirm } = await staff.rpc("confirm_venue_timeline_release", {
      p_event_id: eventId,
      p_acknowledged_hold_out_ids: [],
      p_working_fingerprint: String(pb.workingFingerprint ?? ""),
      p_idempotency_key: `blocked-${RUN}`,
    });
    const { data: evBlocked } = await admin
      .from("events")
      .select("active_venue_timeline_release_id")
      .eq("id", eventId)
      .single();
    record(
      "blocked-preserves-pointer",
      (blockedConfirm as { ok?: boolean; error?: string })?.ok === false
        && (blockedConfirm as { error?: string }).error === "blocks_release"
        && evBlocked?.active_venue_timeline_release_id === release2,
      JSON.stringify({ blockedConfirm, pointer: evBlocked?.active_venue_timeline_release_id }),
    );

    // Couple-owned entry + submissions untouched
    const { data: coupleEntry } = await admin
      .from("timeline_entries")
      .insert({
        venue_id: FANCY,
        event_id: eventId,
        owner: "client",
        title: `${PREFIX}couple-note`,
        day_offset: 0,
        entry_time: "11:00",
        lock_state: "editable",
        status: "not_started",
        audiences: [],
        sort_order: 1,
      })
      .select("id")
      .single();
    const { count: subBefore } = await admin
      .from("timeline_submissions")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    const venueOnly = await portalTitles(portalToken);
    const { data: portalFull } = await anon.rpc("get_portal_run_of_show", { p_token: portalToken });
    const allEntries = ((portalFull as { entries?: Array<{ title?: string; owner?: string }> })?.entries ?? []);
    const allTitles = allEntries.map((e) => e.title);
    record(
      "couple-owned-separate",
      allTitles.includes(`${PREFIX}couple-note`)
        && allEntries.some((e) => e.title === `${PREFIX}couple-note` && e.owner === "client")
        && !venueOnly.includes(`${PREFIX}couple-note`),
      JSON.stringify({ allTitles, venueOnly }),
    );
    const { count: subAfter } = await admin
      .from("timeline_submissions")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    record("submissions-unaffected", subBefore === subAfter, `before=${subBefore} after=${subAfter}`);

    // Soft ±14 does not block (already proven in first release with far-fixed)
    record("soft-warning-did-not-block-first-release", ok1.ok === true, "first release included far-fixed");

    // Cutover retry safety: re-run cutover selector logic via count of cutover keys
    const { data: cutovers } = await admin
      .from("venue_timeline_releases")
      .select("event_id,idempotency_key")
      .eq("source", "cutover")
      .like("idempotency_key", "cutover:%");
    const keys = new Set((cutovers ?? []).map((r) => r.idempotency_key));
    record(
      "cutover-idempotency-keys-unique",
      keys.size === (cutovers ?? []).length,
      `rows=${cutovers?.length} unique=${keys.size}`,
    );

    // Browser: booked workspace EventDetail Timeline tab (eventId release path).
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addCookies(await staffCookies(session));
    const page = await context.newPage();
    await page.goto(`${APP}/clients/${clientId}?tab=timeline`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(2500);
    // Ensure cake is resolved so preview can succeed for dialog copy assertion.
    await admin
      .from("timeline_entries")
      .update({
        timing_attention: null,
        timing_day_intent: "relative",
        timing_day_anchor: "event_start",
        timing_relative_day_offset: 0,
        timing_clock_intent: "explicit",
      })
      .eq("id", added.id)
      .eq("venue_id", FANCY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.getByTestId("timeline-share-with-couple").waitFor({ timeout: 45_000 }).catch(() => null);
    await page.screenshot({ path: `${OUT}/shots/venue-timeline-1280.png`, fullPage: true });
    const shareBtn = page.getByTestId("timeline-share-with-couple");
    const shareVisible = await shareBtn.count();
    record(
      "browser-share-control",
      shareVisible > 0 && page.url().includes(`/clients/${clientId}`),
      `count=${shareVisible} url=${page.url()}`,
    );
    if (shareVisible > 0) {
      page.once("dialog", async (d) => {
        record(
          "browser-preview-dialog",
          /Will share|Review what the couple/i.test(d.message()),
          d.message().slice(0, 500),
        );
        await d.dismiss(); // cancel path — must not create a new release
      });
      const { count: beforeUiCancel } = await admin
        .from("venue_timeline_releases")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId);
      await shareBtn.click();
      await page.waitForTimeout(2500);
      const { count: afterUiCancel } = await admin
        .from("venue_timeline_releases")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId);
      record(
        "browser-cancel-writes-nothing",
        beforeUiCancel === afterUiCancel,
        `before=${beforeUiCancel} after=${afterUiCancel}`,
      );
    } else {
      record("browser-preview-dialog", false, "share control missing on booked EventDetail timeline");
    }

    // Portal browser (same app origin /p/:token) — open Timeline surface.
    const portalPage = await context.newPage();
    await portalPage.goto(`${APP}/p/${portalToken}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const timelineNav = portalPage.locator('a,button').filter({ hasText: /^Timeline$/i });
    if ((await timelineNav.count()) > 0) {
      await timelineNav.first().click();
    } else {
      await portalPage.getByRole("link", { name: /view timeline/i }).first().click().catch(() => null);
    }
    const releasedTitle = portalPage.getByText(`${PREFIX}doors`, { exact: false });
    await releasedTitle.first().waitFor({ timeout: 20_000 }).catch(() => null);
    await portalPage.screenshot({ path: `${OUT}/shots/portal-timeline-1280.png`, fullPage: true });
    const body = await portalPage.locator("body").innerText().catch(() => "");
    const portalHasReleased =
      body.includes(`${PREFIX}doors`)
      || body.includes(`${PREFIX}cake`)
      || body.includes(`${PREFIX}tbd-resolved`)
      || body.includes(`${PREFIX}far-fixed`);
    record(
      "browser-portal-shows-released",
      portalHasReleased,
      `${portalPage.url()} :: titles=${[
        body.includes(`${PREFIX}doors`) ? "doors" : null,
        body.includes(`${PREFIX}cake`) ? "cake" : null,
        body.includes(`${PREFIX}far-fixed`) ? "far-fixed" : null,
      ].filter(Boolean).join(",") || "none"} body=${body.slice(0, 700)}`,
    );

    await browser.close();
    void coupleEntry;
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err && "message" in err
          ? String((err as { message: unknown }).message)
          : JSON.stringify(err);
    record("harness-error", false, detail);
  } finally {
    try {
      await cleanup(clientId, eventId);
      record("cleanup", true, `client=${clientId} event=${eventId}`);
    } catch (err) {
      record("cleanup", false, err instanceof Error ? err.message : String(err));
    }
  }

  const failed = checks.filter((c) => !c.pass).length;
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify({ run: RUN, expected: EXPECTED, failed, checks }, null, 2),
  );
  console.log(`\n${checks.length - failed} pass / ${failed} fail (run ${RUN})`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
