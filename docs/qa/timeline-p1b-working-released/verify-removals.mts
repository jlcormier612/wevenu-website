/**
 * Timeline T3 — removal disclosure Sandbox acceptance.
 * Deleted previously-released items must appear in preview; portal stays on
 * prior release until confirm; cancel/stale/fault/venue isolation preserved.
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
const RUN = process.env.E2E_RUN_ID ?? `T3R${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/timeline-p1b-working-released";
mkdirSync(`${OUT}/shots`, { recursive: true });
const PREFIX = `T3R-${RUN}-`;

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
  return { session: otp.session, staff };
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
      first_name: "T3Rem",
      last_name: `${label}-${RUN}`,
      email: `t3rem-${label}-${RUN.toLowerCase()}@example.com`,
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
      event_date: "2027-08-20",
      event_end_date: "2027-08-21",
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

async function portalTitles(token: string): Promise<string[]> {
  const { data, error } = await anon.rpc("get_portal_run_of_show", { p_token: token });
  if (error) throw error;
  const entries = Array.isArray((data as { entries?: unknown })?.entries)
    ? ((data as { entries: Array<{ title?: string; owner?: string }> }).entries)
    : [];
  return entries.filter((e) => e.owner === "venue").map((e) => String(e.title ?? ""));
}

async function cleanup(clientId: string | null, eventId: string | null, venueId = FANCY) {
  if (eventId) {
    await admin.from("timeline_entries").delete().eq("event_id", eventId).eq("venue_id", venueId);
    await admin.from("venue_timeline_releases").delete().eq("event_id", eventId).eq("venue_id", venueId);
    await admin.from("client_portal_sessions").delete().eq("event_id", eventId).eq("venue_id", venueId);
    await admin.from("events").delete().eq("id", eventId).eq("venue_id", venueId);
  }
  if (clientId) {
    await admin.from("clients").delete().eq("id", clientId).eq("venue_id", venueId);
  }
}

type Rem = { id?: string; title?: string };

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

    const { session, staff } = await staffForVenue(FANCY);
    const fx = await makeFixture(FANCY, "main");
    fixtures.push({ ...fx, venueId: FANCY });

    const keep = await insertVenueEntry(FANCY, fx.eventId, {
      title: `${PREFIX}keep`,
      day_offset: 0,
      entry_time: "16:00",
      timing_day_intent: "relative",
      timing_day_anchor: "event_start",
      timing_relative_day_offset: 0,
      timing_clock_intent: "explicit",
      timing_attention: null,
    });
    const drop = await insertVenueEntry(FANCY, fx.eventId, {
      title: `${PREFIX}drop-me`,
      day_offset: 0,
      entry_time: "17:00",
      timing_day_intent: "relative",
      timing_day_anchor: "event_start",
      timing_relative_day_offset: 0,
      timing_clock_intent: "explicit",
      timing_attention: null,
    });

    const portalToken = `qa-t3r-${RUN.toLowerCase()}`;
    await admin.from("client_portal_sessions").insert({
      venue_id: FANCY,
      client_id: fx.clientId,
      event_id: fx.eventId,
      access_token: portalToken,
      access_level: "couple",
    });

    // ——— No prior release: no false removals ———
    const { data: prev0 } = await staff.rpc("preview_venue_timeline_release", { p_event_id: fx.eventId });
    const p0 = prev0 as Record<string, unknown>;
    record(
      "no-prior-release-empty-removals",
      p0.ok === true
        && Array.isArray(p0.removedFromRelease)
        && (p0.removedFromRelease as unknown[]).length === 0
        && p0.hasPriorRelease === false
        && typeof p0.workingFingerprint === "string"
        && String(p0.workingFingerprint).endsWith("|"),
      JSON.stringify({
        rem: p0.removedFromRelease,
        hasPrior: p0.hasPriorRelease,
        fp: p0.workingFingerprint,
        baseline: p0.releaseBaselineId,
      }),
    );

    const { data: conf1, error: c1e } = await staff.rpc("confirm_venue_timeline_release", {
      p_event_id: fx.eventId,
      p_acknowledged_hold_out_ids: [],
      p_working_fingerprint: String(p0.workingFingerprint),
      p_idempotency_key: `t3r-r1-${RUN}`,
    });
    if (c1e) throw c1e;
    const ok1 = conf1 as Record<string, unknown>;
    record("first-release", ok1.ok === true, JSON.stringify(ok1));
    const release1 = String(ok1.releaseId);
    const portalAfter1 = await portalTitles(portalToken);
    record(
      "portal-has-both-after-first-release",
      portalAfter1.includes(`${PREFIX}keep`) && portalAfter1.includes(`${PREFIX}drop-me`),
      JSON.stringify(portalAfter1),
    );

    // ——— Never-released working item is not a removal ———
    const never = await insertVenueEntry(FANCY, fx.eventId, {
      title: `${PREFIX}never-released`,
      day_offset: 0,
      entry_time: "18:00",
      timing_day_intent: "relative",
      timing_day_anchor: "event_start",
      timing_relative_day_offset: 0,
      timing_clock_intent: "explicit",
      timing_attention: null,
    });
    const { data: prevNever } = await staff.rpc("preview_venue_timeline_release", {
      p_event_id: fx.eventId,
    });
    const pn = prevNever as Record<string, unknown>;
    const remNever = (pn.removedFromRelease as Rem[] | undefined) ?? [];
    record(
      "never-released-not-listed-as-removal",
      remNever.length === 0 && !remNever.some((r) => r.id === never.id),
      JSON.stringify(remNever),
    );

    // ——— Delete previously released item ———
    await admin.from("timeline_entries").delete().eq("id", drop.id).eq("venue_id", FANCY);
    const { data: prevDrop } = await staff.rpc("preview_venue_timeline_release", {
      p_event_id: fx.eventId,
    });
    const pd = prevDrop as Record<string, unknown>;
    const remDrop = (pd.removedFromRelease as Rem[] | undefined) ?? [];
    record(
      "deleted-released-item-in-preview",
      remDrop.length === 1
        && remDrop[0]?.id === drop.id
        && remDrop[0]?.title === `${PREFIX}drop-me`
        && !remDrop.some((r) => r.id === keep.id)
        && !remDrop.some((r) => r.id === never.id)
        && pd.releaseBaselineId === release1
        && String(pd.workingFingerprint).includes(`|${release1}`),
      JSON.stringify({ rem: remDrop, baseline: pd.releaseBaselineId, fp: pd.workingFingerprint }),
    );
    record(
      "retained-item-not-listed-as-removal",
      !remDrop.some((r) => r.id === keep.id)
        && Array.isArray(pd.willShare)
        && (pd.willShare as Rem[]).some((w) => w.id === keep.id),
      JSON.stringify({ rem: remDrop, will: pd.willShare }),
    );

    // Portal still has drop before confirm
    const portalBeforeConfirm = await portalTitles(portalToken);
    record(
      "portal-still-has-removed-item-before-confirm",
      portalBeforeConfirm.includes(`${PREFIX}drop-me`)
        && portalBeforeConfirm.includes(`${PREFIX}keep`),
      JSON.stringify(portalBeforeConfirm),
    );

    // Cancel = do not confirm after preview
    const { count: beforeCancel } = await admin
      .from("venue_timeline_releases")
      .select("id", { count: "exact", head: true })
      .eq("event_id", fx.eventId);
    const { data: evBeforeCancel } = await admin
      .from("events")
      .select("active_venue_timeline_release_id")
      .eq("id", fx.eventId)
      .single();
    record(
      "cancel-leaves-active-release",
      (beforeCancel ?? 0) === 1
        && evBeforeCancel?.active_venue_timeline_release_id === release1
        && (await portalTitles(portalToken)).includes(`${PREFIX}drop-me`),
      JSON.stringify({ count: beforeCancel, pointer: evBeforeCancel }),
    );

    // Held-out / blocked distinction: unresolved previously-released → block, not removal
    const blockItem = await insertVenueEntry(FANCY, fx.eventId, {
      title: `${PREFIX}will-block`,
      day_offset: 0,
      entry_time: "19:00",
      timing_day_intent: "relative",
      timing_day_anchor: "event_start",
      timing_relative_day_offset: 0,
      timing_clock_intent: "explicit",
      timing_attention: null,
    });
    // release keep+never+block first so block becomes previously released
    // but we still have drop as removal — need clean path: confirm current state would block? 
    // Currently: keep, never resolved; drop deleted (removal); block resolved.
    // Instead: confirm removal release first, then mutate a released item to unresolved.
    const { data: conf2, error: c2e } = await staff.rpc("confirm_venue_timeline_release", {
      p_event_id: fx.eventId,
      p_acknowledged_hold_out_ids: [],
      p_working_fingerprint: String(pd.workingFingerprint),
      p_idempotency_key: `t3r-r2-${RUN}`,
    });
    if (c2e) throw c2e;
    const ok2 = conf2 as Record<string, unknown>;
    record("confirm-removal-release", ok2.ok === true, JSON.stringify(ok2));
    const release2 = String(ok2.releaseId);

    const { data: snap2 } = await admin
      .from("venue_timeline_releases")
      .select("snapshot,entry_count")
      .eq("id", release2)
      .single();
    const titles2 = ((snap2?.snapshot as Array<{ title?: string; id?: string }>) ?? []).map((x) => x.title);
    record(
      "new-snapshot-excludes-removed",
      !titles2.includes(`${PREFIX}drop-me`)
        && titles2.includes(`${PREFIX}keep`)
        && titles2.includes(`${PREFIX}never-released`)
        && titles2.includes(`${PREFIX}will-block`),
      JSON.stringify(titles2),
    );
    const portalAfter2 = await portalTitles(portalToken);
    record(
      "portal-after-confirm-drops-removed",
      !portalAfter2.includes(`${PREFIX}drop-me`)
        && portalAfter2.includes(`${PREFIX}keep`),
      JSON.stringify(portalAfter2),
    );

    // Held-out never-released unresolved ≠ removal
    const held = await insertVenueEntry(FANCY, fx.eventId, {
      title: `${PREFIX}held-out`,
      day_offset: 0,
      entry_time: "10:00",
      timing_day_intent: null,
      timing_attention: "unknown_intent",
    });
    // Block: previously released item becomes unresolved
    await admin
      .from("timeline_entries")
      .update({ timing_attention: "missing_event_end", timing_day_intent: null })
      .eq("id", blockItem.id)
      .eq("venue_id", FANCY);

    const { data: prevG1 } = await staff.rpc("preview_venue_timeline_release", {
      p_event_id: fx.eventId,
    });
    const pg = prevG1 as Record<string, unknown>;
    const remG1 = (pg.removedFromRelease as Rem[] | undefined) ?? [];
    const heldG1 = (pg.heldOut as Rem[] | undefined) ?? [];
    const blocksG1 = (pg.blocksRelease as Rem[] | undefined) ?? [];
    record(
      "held-out-not-mislabeled-removal",
      heldG1.some((h) => h.id === held.id)
        && !remG1.some((r) => r.id === held.id),
      JSON.stringify({ held: heldG1, rem: remG1 }),
    );
    record(
      "blocked-not-mislabeled-removal",
      blocksG1.some((b) => b.id === blockItem.id)
        && !remG1.some((r) => r.id === blockItem.id)
        && pg.canRelease === false,
      JSON.stringify({ blocks: blocksG1, rem: remG1, can: pg.canRelease }),
    );

    // Resolve block so we can test stale baseline / fault
    await admin
      .from("timeline_entries")
      .update({
        timing_attention: null,
        timing_day_intent: "relative",
        timing_day_anchor: "event_start",
        timing_relative_day_offset: 0,
        timing_clock_intent: "explicit",
      })
      .eq("id", blockItem.id)
      .eq("venue_id", FANCY);

    // Stale: working edit after preview
    const { data: prevStale } = await staff.rpc("preview_venue_timeline_release", {
      p_event_id: fx.eventId,
    });
    const ps = prevStale as Record<string, unknown>;
    const staleFp = String(ps.workingFingerprint);
    await admin
      .from("timeline_entries")
      .update({ title: `${PREFIX}keep-EDITED` })
      .eq("id", keep.id)
      .eq("venue_id", FANCY);
    const { data: staleConf } = await staff.rpc("confirm_venue_timeline_release", {
      p_event_id: fx.eventId,
      p_acknowledged_hold_out_ids: [held.id as string],
      p_working_fingerprint: staleFp,
      p_idempotency_key: `t3r-stale-${RUN}`,
    });
    record(
      "stale-working-rejected",
      (staleConf as { ok?: boolean; error?: string })?.ok === false
        && (staleConf as { error?: string }).error === "stale_preview",
      JSON.stringify(staleConf),
    );
    await admin
      .from("timeline_entries")
      .update({ title: `${PREFIX}keep` })
      .eq("id", keep.id)
      .eq("venue_id", FANCY);

    // Stale: baseline release pointer changed (simulate by confirming a release then using old fp)
    const { data: prevBeforeBase } = await staff.rpc("preview_venue_timeline_release", {
      p_event_id: fx.eventId,
    });
    const pbb = prevBeforeBase as Record<string, unknown>;
    const oldBaselineFp = String(pbb.workingFingerprint);
    const { data: conf3 } = await staff.rpc("confirm_venue_timeline_release", {
      p_event_id: fx.eventId,
      p_acknowledged_hold_out_ids: [held.id as string],
      p_working_fingerprint: oldBaselineFp,
      p_idempotency_key: `t3r-r3-${RUN}`,
    });
    record("third-release-for-baseline", (conf3 as { ok?: boolean })?.ok === true, JSON.stringify(conf3));
    const { data: staleBase } = await staff.rpc("confirm_venue_timeline_release", {
      p_event_id: fx.eventId,
      p_acknowledged_hold_out_ids: [held.id as string],
      p_working_fingerprint: oldBaselineFp,
      p_idempotency_key: `t3r-stale-base-${RUN}`,
    });
    record(
      "stale-baseline-rejected",
      (staleBase as { ok?: boolean; error?: string })?.ok === false
        && (staleBase as { error?: string }).error === "stale_preview",
      JSON.stringify(staleBase),
    );

    // Failure / atomicity via sandbox fault
    const { data: prevFault } = await staff.rpc("preview_venue_timeline_release", {
      p_event_id: fx.eventId,
    });
    const pf = prevFault as Record<string, unknown>;
    const { data: evBeforeFault } = await admin
      .from("events")
      .select("active_venue_timeline_release_id")
      .eq("id", fx.eventId)
      .single();
    const pointerBefore = evBeforeFault?.active_venue_timeline_release_id;
    const { count: relBeforeFault } = await admin
      .from("venue_timeline_releases")
      .select("id", { count: "exact", head: true })
      .eq("event_id", fx.eventId);
    const { data: faultData, error: faultErr } = await admin.rpc(
      "confirm_venue_timeline_release_sandbox_fault",
      {
        p_event_id: fx.eventId,
        p_acknowledged_hold_out_ids: [held.id as string],
        p_working_fingerprint: String(pf.workingFingerprint),
        p_idempotency_key: `t3r-fault-${RUN}`,
      },
    );
    const faultFailed =
      Boolean(faultErr)
      || (faultData && (faultData as { ok?: boolean }).ok === false)
      || String(faultErr?.message ?? faultData ?? "").includes("FORCE_FAIL");
    const { data: evAfterFault } = await admin
      .from("events")
      .select("active_venue_timeline_release_id")
      .eq("id", fx.eventId)
      .single();
    const { count: relAfterFault } = await admin
      .from("venue_timeline_releases")
      .select("id", { count: "exact", head: true })
      .eq("event_id", fx.eventId);
    record(
      "fault-preserves-prior-release",
      faultFailed
        && evAfterFault?.active_venue_timeline_release_id === pointerBefore
        && relAfterFault === relBeforeFault,
      JSON.stringify({
        faultErr: faultErr?.message,
        faultData,
        pointerBefore,
        pointerAfter: evAfterFault?.active_venue_timeline_release_id,
        relBefore: relBeforeFault,
        relAfter: relAfterFault,
      }),
    );

    // Cross-venue: Fancy staff cannot see other venue removals
    const { data: foreignEv } = await admin
      .from("events")
      .select("id")
      .eq("venue_id", OTHER_VENUE)
      .limit(1)
      .maybeSingle();
    let foreignEventId = foreignEv?.id as string | undefined;
    if (!foreignEventId) {
      const ffx = await makeFixture(OTHER_VENUE, "foreign");
      fixtures.push({ ...ffx, venueId: OTHER_VENUE });
      foreignEventId = ffx.eventId;
      await insertVenueEntry(OTHER_VENUE, foreignEventId, {
        title: `${PREFIX}foreign`,
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

    // Browser: dialog shows removal copy; cancel does not advance release
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.addCookies(await staffCookies(session));
    const page = await context.newPage();
    // Seed a fresh removable item for UI: delete never-released after including it...
    // Current portal points at r3; delete keep's sibling never for UI message.
    // Simpler: delete `never` so next share preview lists it as removal.
    await admin.from("timeline_entries").delete().eq("id", never.id).eq("venue_id", FANCY);
    await page.goto(`${APP}/clients/${fx.clientId}?tab=timeline`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.waitForTimeout(2500);
    await page.getByTestId("timeline-share-with-couple").waitFor({ timeout: 45_000 }).catch(() => null);
    await page.screenshot({ path: `${OUT}/shots/removal-preview-390.png`, fullPage: true });
    const shareBtn = page.getByTestId("timeline-share-with-couple");
    const shareVisible = await shareBtn.count();
    record("browser-share-control", shareVisible > 0, `count=${shareVisible} url=${page.url()}`);
    if (shareVisible > 0) {
      const { data: evUiBefore } = await admin
        .from("events")
        .select("active_venue_timeline_release_id")
        .eq("id", fx.eventId)
        .single();
      page.once("dialog", async (d) => {
        const msg = d.message();
        record(
          "browser-removal-disclosure",
          /Items being removed from the couple/i.test(msg)
            && msg.includes(`${PREFIX}never-released`)
            && /Confirming this release will remove these items/i.test(msg),
          msg.slice(0, 900),
        );
        await d.dismiss();
      });
      await shareBtn.click();
      await page.waitForTimeout(2500);
      const { data: evUiAfter } = await admin
        .from("events")
        .select("active_venue_timeline_release_id")
        .eq("id", fx.eventId)
        .single();
      record(
        "browser-cancel-preserves-pointer",
        evUiBefore?.active_venue_timeline_release_id === evUiAfter?.active_venue_timeline_release_id,
        JSON.stringify({ before: evUiBefore, after: evUiAfter }),
      );
    } else {
      record("browser-removal-disclosure", false, "share control missing");
      record("browser-cancel-preserves-pointer", false, "share control missing");
    }

    // Desktop width screenshot
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: `${OUT}/shots/removal-preview-1280.png`, fullPage: true });
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
    try {
      for (const f of fixtures) {
        await cleanup(f.clientId, f.eventId, f.venueId);
      }
      record("cleanup", true, `fixtures=${fixtures.length}`);
    } catch (err) {
      record("cleanup", false, err instanceof Error ? err.message : String(err));
    }
  }

  const failed = checks.filter((c) => !c.pass).length;
  writeFileSync(
    `${OUT}/removal-results.json`,
    JSON.stringify({ run: RUN, expected: EXPECTED, failed, checks }, null, 2),
  );
  console.log(`\n${checks.length - failed} pass / ${failed} fail (run ${RUN})`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
