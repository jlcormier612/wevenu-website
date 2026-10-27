/**
 * Timeline P1c — Sandbox browser + persisted acceptance (T4 date + T7 Day-of start).
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { buildTimingRecalcPreview } from "@/lib/timeline/timing-recalc";
import type { TimelineEntry } from "@/lib/timeline/types";

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
const RUN = process.env.E2E_RUN_ID ?? `P1C${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/timeline-p1c-date-dayof";
mkdirSync(`${OUT}/shots`, { recursive: true });
const PREFIX = `P1C-${RUN}-`;

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
  checks.push({ name, pass, detail: String(detail).slice(0, 2500) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 480)}`);
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
  await admin.from("venue_staff_active_context").upsert({
    user_id: otp.session.user.id,
    active_venue_id: FANCY,
  });
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

async function cleanup(clientId: string | null, eventId: string | null) {
  if (eventId) {
    const { data: ents } = await admin.from("timeline_entries").select("id").eq("event_id", eventId).eq("venue_id", FANCY);
    const ids = (ents ?? []).map((e) => e.id);
    if (ids.length) {
      await admin.from("timeline_entry_links").delete().in("timeline_entry_id", ids).eq("venue_id", FANCY);
    }
    await admin.from("timeline_entries").delete().eq("event_id", eventId).eq("venue_id", FANCY);
    await admin.from("venue_timeline_releases").delete().eq("event_id", eventId).eq("venue_id", FANCY);
    await admin.from("client_portal_sessions").delete().eq("event_id", eventId).eq("venue_id", FANCY);
    await admin.from("events").delete().eq("id", eventId).eq("venue_id", FANCY);
  }
  if (clientId) await admin.from("clients").delete().eq("id", clientId).eq("venue_id", FANCY);
}

async function portalTitles(token: string) {
  const { data, error } = await anon.rpc("get_portal_run_of_show", { p_token: token });
  if (error) throw error;
  const entries = Array.isArray((data as { entries?: unknown })?.entries)
    ? ((data as { entries: Array<{ title?: string; owner?: string; entry_time?: string; day_offset?: number }> }).entries)
    : [];
  return entries.filter((e) => e.owner === "venue");
}

function mapEntry(row: Record<string, unknown>): TimelineEntry {
  return {
    id: String(row.id),
    venueId: FANCY,
    eventId: String(row.event_id),
    title: String(row.title),
    description: null,
    notes: null,
    entryTime: row.entry_time ? String(row.entry_time).slice(0, 5) : null,
    dayOffset: Number(row.day_offset ?? 0),
    audiences: [],
    sectionId: null,
    sortOrder: 0,
    owner: (row.owner as "venue" | "client") ?? "venue",
    lockState: "editable",
    status: "not_started",
    assignedToStaffId: null,
    createdAt: "",
    updatedAt: "",
    timing: {
      dayIntent: (row.timing_day_intent as "relative" | "fixed" | null) ?? null,
      dayAnchor: (row.timing_day_anchor as "event_start" | "event_end" | null) ?? null,
      relativeDayOffset: row.timing_relative_day_offset == null ? null : Number(row.timing_relative_day_offset),
      dayOffsetOverridden: Boolean(row.timing_day_offset_overridden),
      templateDayOffset: row.timing_template_day_offset == null ? null : Number(row.timing_template_day_offset),
      templateDayAnchor: (row.timing_template_day_anchor as "event_start" | "event_end" | null) ?? null,
      fixedDate: row.timing_fixed_date ? String(row.timing_fixed_date) : null,
      clockIntent: (row.timing_clock_intent as "relative" | "explicit" | "untimed" | null) ?? null,
      relativeMinutes: row.timing_relative_minutes == null ? null : Number(row.timing_relative_minutes),
      clockOverridden: Boolean(row.timing_clock_overridden),
      attention: (row.timing_attention as "unknown_intent" | "missing_event_end" | "invalid_event_end" | null) ?? null,
    },
  };
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  let clientId: string | null = null;
  let eventId: string | null = null;

  try {
    const image = await servingImage();
    record("serving-sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
    const health = await fetch(`${APP}/api/health`).then((r) => r.json());
    record("health", health?.ok === true, JSON.stringify(health));
    const html = await fetch(`${APP}/login`).then((r) => r.text());
    const dpl = html.match(/data-dpl-id="([^"]+)"/)?.[1] ?? "";
    record("html-dpl", dpl.startsWith(EXPECTED.slice(0, 12)), `dpl=${dpl}`);

    const { session, staff } = await staffSession();

    const { data: client, error: cErr } = await admin
      .from("clients")
      .insert({
        venue_id: FANCY,
        first_name: "P1c",
        last_name: `${RUN}`,
        email: `p1c-${RUN.toLowerCase()}@example.com`,
        status: "confirmed",
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
        name: `${PREFIX}wedding`,
        event_type: "wedding",
        event_date: "2028-06-10",
        event_end_date: "2028-06-11",
        start_time: "11:00",
        status: "confirmed",
      })
      .select("id")
      .single();
    if (eErr || !event) throw eErr ?? new Error("event");
    eventId = event.id;

    const { data: relative, error: rErr } = await admin
      .from("timeline_entries")
      .insert({
        venue_id: FANCY,
        event_id: eventId,
        owner: "venue",
        title: `${PREFIX}brunch`,
        day_offset: 1,
        entry_time: null,
        lock_state: "editable",
        status: "not_started",
        audiences: [],
        sort_order: 1,
        timing_day_intent: "relative",
        timing_day_anchor: "event_end",
        timing_relative_day_offset: 0,
        timing_template_day_offset: 0,
        timing_template_day_anchor: "event_end",
        timing_clock_intent: "untimed",
      })
      .select("*")
      .single();
    if (rErr || !relative) throw rErr ?? new Error("relative");

    const { data: fixed, error: fErr } = await admin
      .from("timeline_entries")
      .insert({
        venue_id: FANCY,
        event_id: eventId,
        owner: "venue",
        title: `${PREFIX}hair`,
        day_offset: -1,
        entry_time: "09:00",
        lock_state: "editable",
        status: "not_started",
        audiences: [],
        sort_order: 2,
        timing_day_intent: "fixed",
        timing_fixed_date: "2028-06-09",
        timing_clock_intent: "explicit",
        timing_clock_overridden: true,
      })
      .select("*")
      .single();
    if (fErr || !fixed) throw fErr ?? new Error("fixed");

    const { data: clockRel, error: crErr } = await admin
      .from("timeline_entries")
      .insert({
        venue_id: FANCY,
        event_id: eventId,
        owner: "venue",
        title: `${PREFIX}doors`,
        day_offset: 0,
        entry_time: "12:00",
        lock_state: "editable",
        status: "not_started",
        audiences: [],
        sort_order: 3,
        timing_day_intent: "relative",
        timing_day_anchor: "event_start",
        timing_relative_day_offset: 0,
        timing_clock_intent: "relative",
        timing_relative_minutes: 60,
        timing_clock_overridden: false,
      })
      .select("*")
      .single();
    if (crErr || !clockRel) throw crErr ?? new Error("clock");

    const { data: unknown, error: uErr } = await admin
      .from("timeline_entries")
      .insert({
        venue_id: FANCY,
        event_id: eventId,
        owner: "venue",
        title: `${PREFIX}legacy`,
        day_offset: 0,
        entry_time: "15:00",
        lock_state: "editable",
        status: "not_started",
        audiences: [],
        sort_order: 4,
        timing_attention: "unknown_intent",
      })
      .select("*")
      .single();
    if (uErr || !unknown) throw uErr ?? new Error("unknown");

    // First release for portal isolation
    const { data: prev0 } = await staff.rpc("preview_venue_timeline_release", { p_event_id: eventId });
    const { data: conf0 } = await staff.rpc("confirm_venue_timeline_release", {
      p_event_id: eventId,
      p_acknowledged_hold_out_ids: [unknown.id],
      p_working_fingerprint: String((prev0 as { workingFingerprint?: string }).workingFingerprint),
      p_idempotency_key: `p1c-r1-${RUN}`,
    });
    record("first-release", (conf0 as { ok?: boolean })?.ok === true, JSON.stringify(conf0));
    const releaseId = String((conf0 as { releaseId?: string }).releaseId);
    const { data: releaseRow } = await admin
      .from("venue_timeline_releases")
      .select("snapshot,released_at")
      .eq("id", releaseId)
      .single();
    const portalToken = `qa-p1c-${RUN.toLowerCase()}`;
    await admin.from("client_portal_sessions").insert({
      venue_id: FANCY,
      client_id: clientId,
      event_id: eventId,
      access_token: portalToken,
      access_level: "couple",
    });
    const portalBefore = await portalTitles(portalToken);

    // ——— T4 preview after date change (event already updated) ———
    await admin
      .from("events")
      .update({ event_date: "2028-07-10", event_end_date: "2028-07-12" })
      .eq("id", eventId)
      .eq("venue_id", FANCY);

    const { data: afterDateRows } = await admin
      .from("timeline_entries")
      .select("*")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY);
    const entries = (afterDateRows ?? []).map((r) => mapEntry(r as Record<string, unknown>));
    const activeIds = new Set(
      ((releaseRow?.snapshot as Array<{ id?: string }>) ?? []).map((s) => String(s.id)).filter(Boolean),
    );
    const datePreview = buildTimingRecalcPreview({
      eventId: eventId!,
      entries,
      activeReleaseEntryIds: activeIds,
      hasActiveRelease: true,
      previousEventDate: "2028-06-10",
      previousEndDate: "2028-06-11",
      previousStartTime: "11:00",
      nextEventDate: "2028-07-10",
      nextEndDate: "2028-07-12",
      nextStartTime: "11:00",
    });
    const brunch = datePreview.rows.find((r) => r.entryId === relative.id);
    const hair = datePreview.rows.find((r) => r.entryId === fixed.id);
    const legacy = datePreview.rows.find((r) => r.entryId === unknown.id);
    record(
      "t4-preview-relative-end-anchored",
      brunch?.eligible === true && brunch.proposedDayOffset === 2,
      JSON.stringify(brunch),
    );
    record(
      "t4-preview-fixed-stays-calendar",
      hair?.eligible === true && hair.proposedDayOffset !== hair.currentDayOffset && hair.dayIntent === "fixed",
      JSON.stringify(hair),
    );
    record(
      "t4-preview-unknown-not-eligible",
      legacy?.eligible === false && legacy?.blockedReason === "unknown_intent",
      JSON.stringify(legacy),
    );

    // Cancel path: leave working rows unchanged after event already moved
    const { data: brunchBeforeApply } = await admin
      .from("timeline_entries")
      .select("day_offset")
      .eq("id", relative.id)
      .single();
    record("t4-cancel-keeps-working-day", brunchBeforeApply?.day_offset === 1, JSON.stringify(brunchBeforeApply));

    // Confirm apply eligible date rows
    const dateEligible = datePreview.rows.filter((r) => r.eligible);
    const dateUpdates = dateEligible.map((row) => {
      const ent = entries.find((e) => e.id === row.entryId)!;
      return {
        id: row.entryId,
        day_offset: row.proposedDayOffset,
        entry_time: row.proposedEntryTime,
        timing_day_intent: ent.timing?.dayIntent,
        timing_day_anchor: ent.timing?.dayAnchor,
        timing_relative_day_offset: ent.timing?.relativeDayOffset,
        timing_day_offset_overridden: ent.timing?.dayOffsetOverridden,
        timing_template_day_offset: ent.timing?.templateDayOffset,
        timing_template_day_anchor: ent.timing?.templateDayAnchor,
        timing_fixed_date: ent.timing?.fixedDate,
        timing_clock_intent: ent.timing?.clockIntent,
        timing_relative_minutes: ent.timing?.relativeMinutes,
        timing_clock_overridden: ent.timing?.clockOverridden,
        timing_attention: row.attention,
      };
    });
    const { data: applyDate, error: applyDateErr } = await staff.rpc("apply_venue_timeline_timing_recalc", {
      p_event_id: eventId,
      p_updates: dateUpdates,
    });
    record(
      "t4-confirm-apply",
      !applyDateErr && (applyDate as { ok?: boolean })?.ok === true && Number((applyDate as { applied?: number }).applied) >= 1,
      JSON.stringify({ applyDate, applyDateErr: applyDateErr?.message }),
    );
    const { data: brunchAfter } = await admin.from("timeline_entries").select("day_offset").eq("id", relative.id).single();
    const { data: hairAfter } = await admin
      .from("timeline_entries")
      .select("day_offset,timing_fixed_date")
      .eq("id", fixed.id)
      .single();
    record("t4-working-relative-updated", brunchAfter?.day_offset === 2, JSON.stringify(brunchAfter));
    record(
      "t4-working-fixed-calendar",
      hairAfter?.timing_fixed_date === "2028-06-09" && hairAfter?.day_offset !== 1,
      JSON.stringify(hairAfter),
    );

    const { data: evPtr } = await admin
      .from("events")
      .select("active_venue_timeline_release_id")
      .eq("id", eventId)
      .single();
    const { data: relAfter } = await admin
      .from("venue_timeline_releases")
      .select("snapshot,released_at")
      .eq("id", releaseId)
      .single();
    record(
      "t4-release-pointer-unchanged",
      evPtr?.active_venue_timeline_release_id === releaseId
        && relAfter?.released_at === releaseRow?.released_at
        && JSON.stringify(relAfter?.snapshot) === JSON.stringify(releaseRow?.snapshot),
      JSON.stringify({ ptr: evPtr?.active_venue_timeline_release_id, released_at: relAfter?.released_at }),
    );
    const portalAfterDate = await portalTitles(portalToken);
    record(
      "t4-portal-unchanged",
      JSON.stringify(portalAfterDate.map((e) => ({ t: e.title, d: e.day_offset, tm: e.entry_time })))
        === JSON.stringify(portalBefore.map((e) => ({ t: e.title, d: e.day_offset, tm: e.entry_time }))),
      JSON.stringify({ before: portalBefore.length, after: portalAfterDate.length }),
    );

    // Stale fingerprint: mutate working then expect confirm path to rebuild differently
    const staleFp = datePreview.fingerprint;
    await admin.from("timeline_entries").update({ title: `${PREFIX}brunch-STALE` }).eq("id", relative.id);
    const { data: staleRows } = await admin.from("timeline_entries").select("*").eq("event_id", eventId);
    const stalePreview = buildTimingRecalcPreview({
      eventId: eventId!,
      entries: (staleRows ?? []).map((r) => mapEntry(r as Record<string, unknown>)),
      activeReleaseEntryIds: activeIds,
      hasActiveRelease: true,
      previousEventDate: "2028-06-10",
      previousEndDate: "2028-06-11",
      previousStartTime: "11:00",
      nextEventDate: "2028-07-10",
      nextEndDate: "2028-07-12",
      nextStartTime: "11:00",
    });
    record("t4-stale-fingerprint-differs", stalePreview.fingerprint !== staleFp, `stale=${staleFp.slice(0, 12)} now=${stalePreview.fingerprint.slice(0, 12)}`);
    await admin.from("timeline_entries").update({ title: `${PREFIX}brunch` }).eq("id", relative.id);

    // ——— T7 Day-of start ———
    await admin.from("events").update({ start_time: "13:00" }).eq("id", eventId).eq("venue_id", FANCY);
    const { data: afterStartRows } = await admin.from("timeline_entries").select("*").eq("event_id", eventId);
    const startPreview = buildTimingRecalcPreview({
      eventId: eventId!,
      entries: (afterStartRows ?? []).map((r) => mapEntry(r as Record<string, unknown>)),
      activeReleaseEntryIds: activeIds,
      hasActiveRelease: true,
      previousEventDate: "2028-07-10",
      previousEndDate: "2028-07-12",
      previousStartTime: "11:00",
      nextEventDate: "2028-07-10",
      nextEndDate: "2028-07-12",
      nextStartTime: "13:00",
    });
    const doors = startPreview.rows.find((r) => r.entryId === clockRel.id);
    record(
      "t7-preview-relative-clock",
      doors?.eligible === true && doors.proposedEntryTime === "14:00",
      JSON.stringify(doors),
    );
    record(
      "t7-preview-skips-explicit-fixed-clock",
      !startPreview.rows.some((r) => r.entryId === fixed.id && r.kind === "day_of_start" && r.eligible),
      JSON.stringify(startPreview.rows.filter((r) => r.kind === "day_of_start")),
    );

    const t7Updates = startPreview.rows
      .filter((r) => r.eligible)
      .map((row) => ({
        id: row.entryId,
        day_offset: row.proposedDayOffset,
        entry_time: row.proposedEntryTime,
        timing_clock_intent: "relative",
        timing_relative_minutes: 60,
        timing_clock_overridden: false,
      }));
    const { data: applyStart, error: applyStartErr } = await staff.rpc("apply_venue_timeline_timing_recalc", {
      p_event_id: eventId,
      p_updates: t7Updates,
    });
    record(
      "t7-confirm-apply",
      !applyStartErr && (applyStart as { ok?: boolean })?.ok === true,
      JSON.stringify({ applyStart, err: applyStartErr?.message }),
    );
    const { data: doorsAfter } = await admin.from("timeline_entries").select("entry_time").eq("id", clockRel.id).single();
    record("t7-working-clock-updated", String(doorsAfter?.entry_time).startsWith("14:00"), JSON.stringify(doorsAfter));
    const portalAfterStart = await portalTitles(portalToken);
    record(
      "t7-portal-unchanged",
      portalAfterStart.some((e) => String(e.title).includes("doors") && String(e.entry_time ?? "").startsWith("12:00")),
      JSON.stringify(portalAfterStart.map((e) => ({ t: e.title, tm: e.entry_time }))),
    );

    // Subsequent explicit release publishes working
    const { data: prev2 } = await staff.rpc("preview_venue_timeline_release", { p_event_id: eventId });
    const holdOuts = ((prev2 as { heldOut?: Array<{ id?: string }> })?.heldOut ?? [])
      .map((h) => h.id)
      .filter(Boolean);
    const { data: conf2 } = await staff.rpc("confirm_venue_timeline_release", {
      p_event_id: eventId,
      p_acknowledged_hold_out_ids: holdOuts,
      p_working_fingerprint: String((prev2 as { workingFingerprint?: string }).workingFingerprint),
      p_idempotency_key: `p1c-r2-${RUN}`,
    });
    record("rerelease-ok", (conf2 as { ok?: boolean })?.ok === true, JSON.stringify(conf2));
    const portalAfterRelease = await portalTitles(portalToken);
    record(
      "rerelease-portal-has-new-clock",
      portalAfterRelease.some((e) => String(e.title).includes("doors") && String(e.entry_time ?? "").startsWith("14:00")),
      JSON.stringify(portalAfterRelease.map((e) => ({ t: e.title, tm: e.entry_time, d: e.day_offset }))),
    );
    record(
      "rerelease-portal-has-new-day",
      portalAfterRelease.some((e) => String(e.title).includes("brunch") && e.day_offset === 2),
      JSON.stringify(portalAfterRelease.map((e) => ({ t: e.title, d: e.day_offset }))),
    );

    // ——— Browser Edit Event ———
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies(await staffCookies(session));
    const page = await context.newPage();
    await page.goto(`${APP}/events/${eventId}/edit`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/shots/edit-event-1280.png`, fullPage: true });

    // Change Day-of start only for UI dialog exercise (#st = Day-of schedule Start time).
    await page.locator("#st").fill("15:00");
    await page.getByRole("button", { name: /Save changes/i }).click();
    await page.waitForTimeout(5000);
    const dialog = page.getByTestId("timeline-timing-recalc-dialog");
    const dialogVisible = await dialog.isVisible().catch(() => false);
    record("browser-recalc-dialog", dialogVisible, `visible=${dialogVisible} url=${page.url()}`);
    await page.screenshot({ path: `${OUT}/shots/recalc-dialog-1280.png`, fullPage: true });
    if (dialogVisible) {
      await page.getByTestId("timeline-timing-recalc-cancel").click();
      await page.waitForTimeout(1500);
      const { data: doorsCancel } = await admin.from("timeline_entries").select("entry_time").eq("id", clockRel.id).single();
      record(
        "browser-cancel-no-timeline-write",
        String(doorsCancel?.entry_time).startsWith("14:00"),
        JSON.stringify(doorsCancel),
      );
    } else {
      record("browser-cancel-no-timeline-write", false, "dialog missing");
    }

    // Confirm path
    await page.goto(`${APP}/events/${eventId}/edit`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    await page.locator("#st").fill("16:00");
    await page.getByRole("button", { name: /Save changes/i }).click();
    await page.waitForTimeout(5000);
    const dialog2 = page.getByTestId("timeline-timing-recalc-dialog");
    if (await dialog2.isVisible().catch(() => false)) {
      await page.getByTestId("timeline-timing-recalc-confirm").click();
      await page.waitForTimeout(5000);
      const { data: doorsConfirm } = await admin.from("timeline_entries").select("entry_time").eq("id", clockRel.id).single();
      record(
        "browser-confirm-updates-working",
        String(doorsConfirm?.entry_time).startsWith("17:00"),
        JSON.stringify(doorsConfirm),
      );
      const portalStillOld = await portalTitles(portalToken);
      record(
        "browser-confirm-portal-still-prior-release",
        portalStillOld.some((e) => String(e.title).includes("doors") && String(e.entry_time ?? "").startsWith("14:00")),
        JSON.stringify(portalStillOld.map((e) => ({ t: e.title, tm: e.entry_time }))),
      );
    } else {
      record("browser-confirm-updates-working", false, "dialog missing on confirm path");
      record("browser-confirm-portal-still-prior-release", false, "dialog missing");
    }
    await page.screenshot({ path: `${OUT}/shots/after-confirm-1280.png`, fullPage: true });
    await browser.close();
  } catch (err) {
    record("harness-error", false, err instanceof Error ? err.message : JSON.stringify(err));
  } finally {
    try {
      await cleanup(clientId, eventId);
      record("cleanup", true, `client=${clientId} event=${eventId}`);
    } catch (e) {
      record("cleanup", false, e instanceof Error ? e.message : String(e));
    }
  }

  const failed = checks.filter((c) => !c.pass).length;
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ run: RUN, expected: EXPECTED, failed, checks }, null, 2));
  console.log(`\n${checks.length - failed} pass / ${failed} fail (run ${RUN})`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
