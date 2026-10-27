/**
 * Timeline P1b — gap-closure Sandbox verification.
 * Concurrent confirm, mid-txn fault rollback, link immutability,
 * prepare-release browser, cross-venue authz, never-released portal,
 * working-ahead summary signal.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
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
const OTHER_VENUE = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const EMAIL = "jennifer@hellotocheers.com";
const RUN = process.env.E2E_RUN_ID ?? `P1BG${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/timeline-p1b-working-released";
mkdirSync(`${OUT}/shots`, { recursive: true });
const PREFIX = `P1BG-${RUN}-`;

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

async function staffForVenue(venueId: string) {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  await admin.from("venue_staff_active_context").upsert({
    user_id: otp.session.user.id,
    active_venue_id: venueId,
  });
  const staff = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${otp.session.access_token}` } },
  });
  return { session: otp.session, staff, userId: otp.session.user.id };
}

async function staffCookies(
  session: { access_token: string; refresh_token: string; [k: string]: unknown },
  venueId = FANCY,
) {
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
      value: venueId,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];
}

async function makeFixture(venueId: string, label: string) {
  const { data: client, error: cErr } = await admin
    .from("clients")
    .insert({
      venue_id: venueId,
      first_name: "P1bGap",
      last_name: `${label}-${RUN}`,
      email: `p1bgap-${label}-${RUN.toLowerCase()}@example.com`,
      status: "confirmed",
    })
    .select("id")
    .single();
  if (cErr || !client) throw cErr ?? new Error("client");
  const { data: event, error: eErr } = await admin
    .from("events")
    .insert({
      venue_id: venueId,
      client_id: client.id,
      name: `${PREFIX}${label}`,
      event_type: "wedding",
      event_date: "2027-07-10",
      event_end_date: "2027-07-11",
      status: "confirmed",
    })
    .select("id")
    .single();
  if (eErr || !event) throw eErr ?? new Error("event");
  return { clientId: client.id as string, eventId: event.id as string };
}

async function insertVenueEntry(venueId: string, eventId: string, row: Record<string, unknown>) {
  const { data, error } = await admin
    .from("timeline_entries")
    .insert({
      venue_id: venueId,
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

async function portalVenueTitles(token: string) {
  const { data, error } = await anon.rpc("get_portal_run_of_show", { p_token: token });
  if (error) throw error;
  const entries = Array.isArray((data as { entries?: unknown })?.entries)
    ? ((data as { entries: Array<{ title?: string; owner?: string; links?: unknown }> }).entries)
    : [];
  return {
    full: data as Record<string, unknown>,
    venue: entries.filter((e) => e.owner === "venue"),
    all: entries,
  };
}

async function cleanup(clientId: string | null, eventId: string | null, venueId = FANCY) {
  if (eventId) {
    const { data: ents } = await admin
      .from("timeline_entries")
      .select("id")
      .eq("event_id", eventId)
      .eq("venue_id", venueId);
    const ids = (ents ?? []).map((e) => e.id);
    if (ids.length) {
      await admin.from("timeline_entry_links").delete().in("timeline_entry_id", ids).eq("venue_id", venueId);
      await admin.from("timeline_entry_attachments").delete().in("timeline_entry_id", ids).eq("venue_id", venueId);
    }
    await admin.from("timeline_entries").delete().eq("event_id", eventId).eq("venue_id", venueId);
    await admin.from("venue_timeline_releases").delete().eq("event_id", eventId).eq("venue_id", venueId);
    await admin.from("client_portal_sessions").delete().eq("event_id", eventId).eq("venue_id", venueId);
    await admin.from("event_setup_states").delete().eq("event_id", eventId).eq("venue_id", venueId);
    await admin.from("documents").delete().eq("event_id", eventId).eq("venue_id", venueId);
    await admin.from("events").delete().eq("id", eventId).eq("venue_id", venueId);
  }
  if (clientId) {
    await admin.from("clients").delete().eq("id", clientId).eq("venue_id", venueId);
  }
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const fixtures: Array<{ clientId: string; eventId: string; venueId: string }> = [];

  try {
    const image = await servingImage();
    record("serving-sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
    const health = await fetch(`${APP}/api/health`).then((r) => r.json());
    record("health", health?.ok === true, JSON.stringify(health));
    const html = await fetch(`${APP}/login`).then((r) => r.text());
    const dpl = html.match(/data-dpl-id="([^"]+)"/)?.[1] ?? "";
    record("html-dpl", dpl.startsWith(EXPECTED.slice(0, 12)), `dpl=${dpl}`);

    // Cutover still intact
    const { count: cutoverCount } = await admin
      .from("venue_timeline_releases")
      .select("id", { count: "exact", head: true })
      .eq("source", "cutover");
    const { count: pointed } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .not("active_venue_timeline_release_id", "is", null);
    record("cutover-still-72", cutoverCount === 72, `cutover=${cutoverCount} pointed=${pointed}`);

    const { session, staff } = await staffForVenue(FANCY);
    const fx = await makeFixture(FANCY, "main");
    fixtures.push({ ...fx, venueId: FANCY });

    const doors = await insertVenueEntry(FANCY, fx.eventId, {
      title: `${PREFIX}doors`,
      day_offset: 0,
      entry_time: "16:00",
      timing_day_intent: "relative",
      timing_day_anchor: "event_start",
      timing_relative_day_offset: 0,
      timing_clock_intent: "explicit",
      timing_attention: null,
    });
    const { data: linkRow, error: linkErr } = await admin
      .from("timeline_entry_links")
      .insert({
        venue_id: FANCY,
        timeline_entry_id: doors.id,
        url: "https://example.com/p1b-original",
        label: "Original link",
        sort_order: 0,
      })
      .select("id,url,label")
      .single();
    if (linkErr) throw linkErr;

    const { data: docRow, error: docErr } = await admin
      .from("documents")
      .insert({
        venue_id: FANCY,
        event_id: fx.eventId,
        name: `${PREFIX}attach-original`,
        file_name: `${PREFIX}attach-original.pdf`,
        file_size: 128,
        mime_type: "application/pdf",
        storage_path: `qa/p1b/${RUN}/attach-original.pdf`,
        storage_url: "https://example.com/p1b-attach-original.pdf",
        category: "other",
        uploaded_by_type: "venue",
      })
      .select("id,name,storage_url")
      .single();
    if (docErr) throw docErr;
    const { error: attErr } = await admin.from("timeline_entry_attachments").insert({
      venue_id: FANCY,
      timeline_entry_id: doors.id,
      document_id: docRow!.id,
      sort_order: 0,
    });
    if (attErr) throw attErr;

    const portalToken = `qa-p1bg-${RUN.toLowerCase()}`;
    await admin.from("client_portal_sessions").insert({
      venue_id: FANCY,
      client_id: fx.clientId,
      event_id: fx.eventId,
      access_token: portalToken,
      access_level: "couple",
    });

    // ——— Never-released portal ———
    const neverTok = `qa-p1bg-never-${RUN.toLowerCase()}`;
    const neverFx = await makeFixture(FANCY, "never");
    fixtures.push({ ...neverFx, venueId: FANCY });
    await insertVenueEntry(FANCY, neverFx.eventId, {
      title: `${PREFIX}unreleased-work`,
      day_offset: 0,
      entry_time: "09:00",
      timing_day_intent: "relative",
      timing_day_anchor: "event_start",
      timing_relative_day_offset: 0,
      timing_clock_intent: "explicit",
      timing_attention: null,
    });
    await admin.from("client_portal_sessions").insert({
      venue_id: FANCY,
      client_id: neverFx.clientId,
      event_id: neverFx.eventId,
      access_token: neverTok,
      access_level: "couple",
    });
    const neverPortal = await portalVenueTitles(neverTok);
    record(
      "never-released-portal-empty-venue",
      neverPortal.venue.length === 0
        && !neverPortal.all.some((e) => e.title === `${PREFIX}unreleased-work`),
      JSON.stringify({ venue: neverPortal.venue.length, titles: neverPortal.all.map((e) => e.title) }),
    );

    // ——— First release + working-ahead signal ———
    const { data: prev0 } = await staff.rpc("preview_venue_timeline_release", { p_event_id: fx.eventId });
    const p0 = prev0 as Record<string, unknown>;
    record(
      "preview-working-ahead-fields",
      p0.ok === true && "workingAheadOfRelease" in p0 && p0.hasPriorRelease === false,
      JSON.stringify({ ahead: p0.workingAheadOfRelease, hasPrior: p0.hasPriorRelease }),
    );

    const { data: conf1, error: c1e } = await staff.rpc("confirm_venue_timeline_release", {
      p_event_id: fx.eventId,
      p_acknowledged_hold_out_ids: [],
      p_working_fingerprint: String(p0.workingFingerprint),
      p_idempotency_key: `gap-r1-${RUN}`,
    });
    if (c1e) throw c1e;
    const ok1 = conf1 as Record<string, unknown>;
    record("first-release", ok1.ok === true, JSON.stringify(ok1));
    const release1 = String(ok1.releaseId);

    const { data: prevSync } = await staff.rpc("preview_venue_timeline_release", { p_event_id: fx.eventId });
    const ps = prevSync as Record<string, unknown>;
    record(
      "summary-in-sync-after-release",
      ps.hasPriorRelease === true && ps.workingAheadOfRelease === false,
      JSON.stringify({ ahead: ps.workingAheadOfRelease, fp: ps.workingFingerprint, last: ps.lastWorkingFingerprint }),
    );

    // ——— Link immutability ———
    const beforePortal = await portalVenueTitles(portalToken);
    const releasedLink = (beforePortal.venue[0] as { links?: Array<{ url?: string }> })?.links?.[0]?.url;
    record("portal-has-original-link", releasedLink === "https://example.com/p1b-original", `link=${releasedLink}`);

    await admin
      .from("timeline_entry_links")
      .update({ url: "https://example.com/p1b-MUTATED", label: "Mutated" })
      .eq("id", linkRow!.id)
      .eq("venue_id", FANCY);

    const afterMutate = await portalVenueTitles(portalToken);
    const stillLink = (afterMutate.venue[0] as { links?: Array<{ url?: string }> })?.links?.[0]?.url;
    record(
      "snapshot-link-immutable",
      stillLink === "https://example.com/p1b-original",
      `after=${stillLink}`,
    );

    const releasedAtt = (
      beforePortal.venue[0] as { attachments?: Array<{ name?: string; url?: string }> }
    )?.attachments?.[0];
    record(
      "portal-has-original-attachment",
      releasedAtt?.url === "https://example.com/p1b-attach-original.pdf"
        && String(releasedAtt?.name ?? "").includes("attach-original"),
      JSON.stringify(releasedAtt),
    );
    await admin
      .from("documents")
      .update({
        name: `${PREFIX}attach-MUTATED`,
        storage_url: "https://example.com/p1b-attach-MUTATED.pdf",
      })
      .eq("id", docRow!.id)
      .eq("venue_id", FANCY);
    const afterAttMutate = await portalVenueTitles(portalToken);
    const stillAtt = (
      afterAttMutate.venue[0] as { attachments?: Array<{ name?: string; url?: string }> }
    )?.attachments?.[0];
    record(
      "snapshot-attachment-immutable",
      stillAtt?.url === "https://example.com/p1b-attach-original.pdf"
        && String(stillAtt?.name ?? "").includes("attach-original")
        && !String(stillAtt?.name ?? "").includes("MUTATED"),
      JSON.stringify(stillAtt),
    );

    // Working ahead after content change
    await admin
      .from("timeline_entries")
      .update({ title: `${PREFIX}doors-EDITED` })
      .eq("id", doors.id)
      .eq("venue_id", FANCY);
    const { data: prevAhead } = await staff.rpc("preview_venue_timeline_release", { p_event_id: fx.eventId });
    const pa = prevAhead as Record<string, unknown>;
    record(
      "summary-ahead-after-edit",
      pa.workingAheadOfRelease === true,
      JSON.stringify({ ahead: pa.workingAheadOfRelease }),
    );
    // restore title for later releases
    await admin
      .from("timeline_entries")
      .update({ title: `${PREFIX}doors` })
      .eq("id", doors.id)
      .eq("venue_id", FANCY);

    // ——— Mid-txn fault rollback ———
    const { data: prevFault } = await staff.rpc("preview_venue_timeline_release", { p_event_id: fx.eventId });
    const pf = prevFault as Record<string, unknown>;
    const { data: evBeforeFault } = await admin
      .from("events")
      .select("active_venue_timeline_release_id")
      .eq("id", fx.eventId)
      .single();
    const { count: relBeforeFault } = await admin
      .from("venue_timeline_releases")
      .select("id", { count: "exact", head: true })
      .eq("event_id", fx.eventId);
    const { data: priorSnap } = await admin
      .from("venue_timeline_releases")
      .select("id,snapshot,entry_count,released_at")
      .eq("id", release1)
      .single();

    const { data: faultData, error: faultErr } = await admin.rpc(
      "confirm_venue_timeline_release_sandbox_fault",
      {
        p_event_id: fx.eventId,
        p_acknowledged_hold_out_ids: [],
        p_working_fingerprint: String(pf.workingFingerprint),
        p_idempotency_key: `gap-fault-${RUN}`,
      },
    );
    const faultFailed =
      Boolean(faultErr)
      || (faultData && (faultData as { ok?: boolean }).ok === false)
      || String(faultErr?.message ?? faultData ?? "").includes("FORCE_FAIL");
    record(
      "mid-txn-fault-raised",
      faultFailed,
      JSON.stringify({ faultErr: faultErr?.message ?? null, faultData }),
    );

    const { data: evAfterFault } = await admin
      .from("events")
      .select("active_venue_timeline_release_id")
      .eq("id", fx.eventId)
      .single();
    const { count: relAfterFault } = await admin
      .from("venue_timeline_releases")
      .select("id", { count: "exact", head: true })
      .eq("event_id", fx.eventId);
    const { data: priorSnapAfter } = await admin
      .from("venue_timeline_releases")
      .select("id,snapshot,entry_count,released_at")
      .eq("id", release1)
      .single();
    const portalAfterFault = await portalVenueTitles(portalToken);
    record(
      "mid-txn-preserves-pointer",
      evAfterFault?.active_venue_timeline_release_id === evBeforeFault?.active_venue_timeline_release_id
        && evAfterFault?.active_venue_timeline_release_id === release1,
      JSON.stringify({ before: evBeforeFault, after: evAfterFault }),
    );
    record(
      "mid-txn-no-partial-release",
      relAfterFault === relBeforeFault,
      `before=${relBeforeFault} after=${relAfterFault}`,
    );
    record(
      "mid-txn-prior-snapshot-unchanged",
      priorSnapAfter?.entry_count === priorSnap?.entry_count
        && JSON.stringify(priorSnapAfter?.snapshot) === JSON.stringify(priorSnap?.snapshot)
        && priorSnapAfter?.released_at === priorSnap?.released_at,
      JSON.stringify({ before: priorSnap?.released_at, after: priorSnapAfter?.released_at }),
    );
    record(
      "mid-txn-portal-unchanged",
      portalAfterFault.venue.some((e) => e.title === `${PREFIX}doors`)
        && (portalAfterFault.venue[0] as { links?: Array<{ url?: string }> })?.links?.[0]?.url
          === "https://example.com/p1b-original",
      JSON.stringify(portalAfterFault.venue.map((e) => e.title)),
    );

    // Subsequent valid release still works
    const { data: prev2 } = await staff.rpc("preview_venue_timeline_release", { p_event_id: fx.eventId });
    const { data: conf2 } = await staff.rpc("confirm_venue_timeline_release", {
      p_event_id: fx.eventId,
      p_acknowledged_hold_out_ids: [],
      p_working_fingerprint: String((prev2 as Record<string, unknown>).workingFingerprint),
      p_idempotency_key: `gap-r2-${RUN}`,
    });
    record("release-after-fault-ok", (conf2 as { ok?: boolean })?.ok === true, JSON.stringify(conf2));

    // ——— Concurrent confirms (same idempotency key) ———
    await insertVenueEntry(FANCY, fx.eventId, {
      title: `${PREFIX}toast`,
      day_offset: 0,
      entry_time: "18:00",
      timing_day_intent: "relative",
      timing_day_anchor: "event_start",
      timing_relative_day_offset: 0,
      timing_clock_intent: "explicit",
      timing_attention: null,
    });
    const staffA = await staffForVenue(FANCY);
    const staffB = await staffForVenue(FANCY);
    const { data: prevC } = await staffA.staff.rpc("preview_venue_timeline_release", { p_event_id: fx.eventId });
    const fpC = String((prevC as Record<string, unknown>).workingFingerprint);
    const sameKey = `gap-concurrent-same-${RUN}`;
    const { count: beforeConc } = await admin
      .from("venue_timeline_releases")
      .select("id", { count: "exact", head: true })
      .eq("event_id", fx.eventId);

    const [rA, rB] = await Promise.all([
      staffA.staff.rpc("confirm_venue_timeline_release", {
        p_event_id: fx.eventId,
        p_acknowledged_hold_out_ids: [],
        p_working_fingerprint: fpC,
        p_idempotency_key: sameKey,
      }),
      staffB.staff.rpc("confirm_venue_timeline_release", {
        p_event_id: fx.eventId,
        p_acknowledged_hold_out_ids: [],
        p_working_fingerprint: fpC,
        p_idempotency_key: sameKey,
      }),
    ]);
    const aOk = rA.data as Record<string, unknown> | null;
    const bOk = rB.data as Record<string, unknown> | null;
    const { count: afterConc } = await admin
      .from("venue_timeline_releases")
      .select("id", { count: "exact", head: true })
      .eq("event_id", fx.eventId);
    const ids = [aOk?.releaseId, bOk?.releaseId].filter(Boolean);
    const uniqueIds = new Set(ids.map(String));
    record(
      "concurrent-same-key-one-release",
      aOk?.ok === true
        && bOk?.ok === true
        && uniqueIds.size === 1
        && (afterConc ?? 0) === (beforeConc ?? 0) + 1
        && (Boolean(aOk?.idempotentReplay) || Boolean(bOk?.idempotentReplay)),
      JSON.stringify({
        a: aOk,
        b: bOk,
        beforeConc,
        afterConc,
        aErr: rA.error?.message,
        bErr: rB.error?.message,
      }),
    );
    const { data: evConc } = await admin
      .from("events")
      .select("active_venue_timeline_release_id")
      .eq("id", fx.eventId)
      .single();
    record(
      "concurrent-same-key-pointer-valid",
      evConc?.active_venue_timeline_release_id === String([...uniqueIds][0]),
      JSON.stringify(evConc),
    );
    const portalConc = await portalVenueTitles(portalToken);
    record(
      "concurrent-portal-consistent",
      portalConc.venue.some((e) => e.title === `${PREFIX}toast`)
        && portalConc.venue.some((e) => e.title === `${PREFIX}doors`),
      JSON.stringify(portalConc.venue.map((e) => e.title)),
    );

    // Concurrent with different keys after another working bump
    await insertVenueEntry(FANCY, fx.eventId, {
      title: `${PREFIX}sparkler`,
      day_offset: 0,
      entry_time: "21:00",
      timing_day_intent: "relative",
      timing_day_anchor: "event_start",
      timing_relative_day_offset: 0,
      timing_clock_intent: "explicit",
      timing_attention: null,
    });
    const { data: prevD } = await staff.rpc("preview_venue_timeline_release", { p_event_id: fx.eventId });
    const fpD = String((prevD as Record<string, unknown>).workingFingerprint);
    const { count: beforeDiff } = await admin
      .from("venue_timeline_releases")
      .select("id", { count: "exact", head: true })
      .eq("event_id", fx.eventId);
    const [dA, dB] = await Promise.all([
      staffA.staff.rpc("confirm_venue_timeline_release", {
        p_event_id: fx.eventId,
        p_acknowledged_hold_out_ids: [],
        p_working_fingerprint: fpD,
        p_idempotency_key: `gap-diff-a-${RUN}`,
      }),
      staffB.staff.rpc("confirm_venue_timeline_release", {
        p_event_id: fx.eventId,
        p_acknowledged_hold_out_ids: [],
        p_working_fingerprint: fpD,
        p_idempotency_key: `gap-diff-b-${RUN}`,
      }),
    ]);
    const da = dA.data as Record<string, unknown> | null;
    const db = dB.data as Record<string, unknown> | null;
    const { count: afterDiff } = await admin
      .from("venue_timeline_releases")
      .select("id", { count: "exact", head: true })
      .eq("event_id", fx.eventId);
    const bothOk = da?.ok === true && db?.ok === true;
    const oneOkOneFail =
      (da?.ok === true && db?.ok === false) || (da?.ok === false && db?.ok === true);
    record(
      "concurrent-diff-keys-consistent",
      (bothOk || oneOkOneFail)
        && (afterDiff ?? 0) >= (beforeDiff ?? 0) + 1
        && (afterDiff ?? 0) <= (beforeDiff ?? 0) + 2,
      JSON.stringify({ da, db, beforeDiff, afterDiff }),
    );
    const { data: evDiff } = await admin
      .from("events")
      .select("active_venue_timeline_release_id")
      .eq("id", fx.eventId)
      .single();
    const { data: activeRel } = await admin
      .from("venue_timeline_releases")
      .select("id,entry_count,snapshot")
      .eq("id", evDiff!.active_venue_timeline_release_id!)
      .single();
    record(
      "concurrent-diff-keys-pointer-complete",
      Boolean(activeRel?.id)
        && (activeRel?.entry_count ?? 0) >= 1
        && Array.isArray(activeRel?.snapshot)
        && (activeRel!.snapshot as unknown[]).length === activeRel!.entry_count,
      JSON.stringify({ pointer: evDiff, entry_count: activeRel?.entry_count }),
    );

    // Race: confirm with stale fingerprint after intervening edit
    const { data: prevE } = await staff.rpc("preview_venue_timeline_release", { p_event_id: fx.eventId });
    const staleFp = String((prevE as Record<string, unknown>).workingFingerprint);
    await admin
      .from("timeline_entries")
      .update({ title: `${PREFIX}doors-RACE` })
      .eq("id", doors.id)
      .eq("venue_id", FANCY);
    const { data: staleConf } = await staff.rpc("confirm_venue_timeline_release", {
      p_event_id: fx.eventId,
      p_acknowledged_hold_out_ids: [],
      p_working_fingerprint: staleFp,
      p_idempotency_key: `gap-stale-race-${RUN}`,
    });
    record(
      "concurrent-edit-stale-rejected",
      (staleConf as { ok?: boolean; error?: string })?.ok === false
        && (staleConf as { error?: string }).error === "stale_preview",
      JSON.stringify(staleConf),
    );
    await admin
      .from("timeline_entries")
      .update({ title: `${PREFIX}doors` })
      .eq("id", doors.id)
      .eq("venue_id", FANCY);

    // ——— Cross-venue ———
    // Prefer a real foreign event on OTHER_VENUE
    const { data: foreignEv } = await admin
      .from("events")
      .select("id,venue_id")
      .eq("venue_id", OTHER_VENUE)
      .not("active_venue_timeline_release_id", "is", null)
      .limit(1)
      .maybeSingle();
    let foreignEventId = foreignEv?.id as string | undefined;
    let foreignClientId: string | null = null;
    if (!foreignEventId) {
      const ffx = await makeFixture(OTHER_VENUE, "foreign");
      fixtures.push({ ...ffx, venueId: OTHER_VENUE });
      foreignEventId = ffx.eventId;
      foreignClientId = ffx.clientId;
      await insertVenueEntry(OTHER_VENUE, foreignEventId, {
        title: `${PREFIX}foreign-item`,
        day_offset: 0,
        entry_time: "12:00",
        timing_day_intent: "relative",
        timing_day_anchor: "event_start",
        timing_relative_day_offset: 0,
        timing_clock_intent: "explicit",
        timing_attention: null,
      });
    }
    const { data: xPrev } = await staff.rpc("preview_venue_timeline_release", {
      p_event_id: foreignEventId,
    });
    record(
      "cross-venue-preview-denied",
      (xPrev as { ok?: boolean; error?: string })?.ok === false
        && ["event_not_found", "unauthorized"].includes(String((xPrev as { error?: string }).error)),
      JSON.stringify(xPrev),
    );
    const { data: xConf } = await staff.rpc("confirm_venue_timeline_release", {
      p_event_id: foreignEventId,
      p_acknowledged_hold_out_ids: [],
      p_working_fingerprint: "deadbeef",
      p_idempotency_key: `gap-xvenue-${RUN}`,
    });
    record(
      "cross-venue-confirm-denied",
      (xConf as { ok?: boolean; error?: string })?.ok === false,
      JSON.stringify(xConf),
    );
    const { data: fancyStill } = await admin
      .from("events")
      .select("active_venue_timeline_release_id")
      .eq("id", fx.eventId)
      .single();
    record(
      "cross-venue-fancy-unaffected",
      Boolean(fancyStill?.active_venue_timeline_release_id),
      JSON.stringify(fancyStill),
    );
    void foreignClientId;

    // Seed setup decisions so Prepare Release CTA is enabled (decisionsComplete).
    // Skip planning so missing client checklist is not an outstanding blocker.
    // Timeline set_up is fine when working entries exist (fixture has them).
    const setupDecisions = {
      planning: "skipped",
      timeline: "set_up",
      floor_plans: "skipped",
      vendors: "skipped",
      questionnaires: "skipped",
      inventory: "skipped",
      event_order: "skipped",
    };
    const { error: setupErr } = await admin.from("event_setup_states").upsert(
      {
        event_id: fx.eventId,
        venue_id: FANCY,
        collapsed_at: null,
        decisions: setupDecisions,
        uses_profile: false,
        profile_id: null,
        profile_name: null,
        inherited_decisions: {},
        inherited_template_refs: {},
        overrides: {},
      },
      { onConflict: "event_id" },
    );
    if (setupErr) throw setupErr;

    // ——— Prepare-release browser ———
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies(await staffCookies(session));
    const page = await context.newPage();
    await page.goto(`${APP}/clients/${fx.clientId}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(2500);
    if ((await page.getByTestId("event-setup-panel").count()) === 0) {
      const show = page.getByRole("button", { name: /Show setup/i });
      if ((await show.count()) > 0) {
        await show.click();
        await page.waitForTimeout(1000);
      }
    }
    // Reopen if collapsed
    const reopen = page.getByRole("button", { name: /Show setup|Event setup/i });
    if ((await page.getByTestId("prepare-and-release-portal").count()) === 0 && (await reopen.count()) > 0) {
      await reopen.first().click().catch(() => null);
      await page.waitForTimeout(800);
    }
    await page.getByTestId("event-setup-panel").waitFor({ timeout: 30_000 }).catch(() => null);
    const prepareBtn = page.getByTestId("prepare-and-release-portal");
    const prepareVisible = await prepareBtn.count();
    record(
      "browser-prepare-control",
      prepareVisible > 0,
      `prepare=${prepareVisible} panel=${await page.getByTestId("event-setup-panel").count()} url=${page.url()} body=${(await page.locator("body").innerText()).slice(0, 400)}`,
    );
    if (prepareVisible > 0) {
      // Ensure working has a content change so prepare creates a new release.
      await admin
        .from("timeline_entries")
        .update({ title: `${PREFIX}doors-PREP` })
        .eq("id", doors.id)
        .eq("venue_id", FANCY);
      const { count: beforePrep } = await admin
        .from("venue_timeline_releases")
        .select("id", { count: "exact", head: true })
        .eq("event_id", fx.eventId);
      const pointerBefore = (
        await admin.from("events").select("active_venue_timeline_release_id").eq("id", fx.eventId).single()
      ).data?.active_venue_timeline_release_id;
      await prepareBtn.click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: `${OUT}/shots/prepare-release-1280.png`, fullPage: true });
      const { count: afterPrep } = await admin
        .from("venue_timeline_releases")
        .select("id", { count: "exact", head: true })
        .eq("event_id", fx.eventId);
      const pointerAfter = (
        await admin.from("events").select("active_venue_timeline_release_id").eq("id", fx.eventId).single()
      ).data?.active_venue_timeline_release_id;
      record(
        "browser-prepare-release-persisted",
        (afterPrep ?? 0) > (beforePrep ?? 0) && pointerAfter !== null && pointerAfter !== pointerBefore,
        `before=${beforePrep} after=${afterPrep} pointerBefore=${pointerBefore} pointerAfter=${pointerAfter}`,
      );
      const prepPortal = await portalVenueTitles(portalToken);
      record(
        "browser-prepare-portal-updated",
        prepPortal.venue.some((e) => String(e.title).includes("doors")),
        JSON.stringify(prepPortal.venue.map((e) => e.title)),
      );
      const body = await page.locator("body").innerText();
      record(
        "browser-prepare-truthful-feedback",
        !(/Sharing didn't finish/i.test(body) && /Shared with the couple/i.test(body)),
        body.slice(0, 300),
      );
    } else {
      record("browser-prepare-release-persisted", false, "prepare button missing");
      record("browser-prepare-portal-updated", false, "prepare button missing");
    }

    // Summary bar language after reload
    await page.goto(`${APP}/clients/${fx.clientId}?tab=timeline`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/shots/summary-bar-1280.png`, fullPage: false });
    const summaryText = await page.locator("body").innerText();
    const sharedLine = summaryText.match(/Shared with the couple[^\n]*/i)?.[0] ?? "";
    record(
      "browser-summary-not-always-ahead",
      /Shared with the couple/i.test(summaryText)
        && !/working changes not shared yet/i.test(sharedLine),
      `line=${sharedLine || summaryText.slice(0, 400)}`,
    );

    await browser.close();
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err && "message" in err
          ? String((err as { message: unknown }).message)
          : JSON.stringify(err);
    record("harness-error", false, detail);
  } finally {
    for (const f of fixtures) {
      try {
        await cleanup(f.clientId, f.eventId, f.venueId);
      } catch (e) {
        record("cleanup-partial", false, e instanceof Error ? e.message : String(e));
      }
    }
    record("cleanup", true, `fixtures=${fixtures.length}`);
  }

  const failed = checks.filter((c) => !c.pass).length;
  writeFileSync(
    `${OUT}/gap-results.json`,
    JSON.stringify({ run: RUN, expected: EXPECTED, failed, checks }, null, 2),
  );
  console.log(`\n${checks.length - failed} pass / ${failed} fail (run ${RUN})`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
