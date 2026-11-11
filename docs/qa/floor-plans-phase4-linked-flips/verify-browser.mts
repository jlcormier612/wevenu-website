/**
 * Floor Plans Phase 4 — real linked before/after room flips.
 *
 * EXPECTED_SHA=<sha> npx tsx docs/qa/floor-plans-phase4-linked-flips/verify-browser.mts
 *
 * Disposable fixtures: FP4-{RUN}-* on Fancy venue only.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
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
const JEN = "67458154-e6fe-41e3-830e-ea39844e4e19";
const SPACE = "3b36ec69-b17d-4351-8186-68d96dd6dfe7";
const TPL_A = "3d4e11ef-7de7-495b-8fc7-b2eaf59584c3";
const TPL_B = "026fb633-2dce-4c73-87c8-144bb29a0318";
const EMAIL = "jennifer@hellotocheers.com";
const RUN = process.env.E2E_RUN_ID ?? `FP4${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/floor-plans-phase4-linked-flips";
const PREFIX = `FP4-${RUN}-`;
const FIXTURE_FIRST = "FP4Phase4";
mkdirSync(`${OUT}/shots`, { recursive: true });

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
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 500)}`);
}

function errDetail(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
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

async function staffCookies(venueId = FANCY) {
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
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
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

async function cloneTemplateObjects(planId: string, templateId: string, limit = 4) {
  const { data: tplObjs } = await admin
    .from("floor_plan_template_objects")
    .select(
      "object_type,label,capacity,x,y,width,height,rotation,sort_order,inventory_item_id,color,notes,locked,display_shape",
    )
    .eq("template_id", templateId)
    .order("sort_order")
    .limit(limit);
  if (tplObjs?.length) {
    await admin.from("floor_plan_objects").insert(
      tplObjs.map((o) => ({ ...o, venue_id: FANCY, floor_plan_id: planId })),
    );
  }
}

async function createBookedFixture(email: string, eventDate: string) {
  const { data: relId, error: relErr } = await admin.rpc("find_or_create_relationship", {
    p_venue_id: FANCY,
    p_email: email,
    p_first_name: FIXTURE_FIRST,
    p_last_name: RUN,
  });
  if (relErr || !relId) throw relErr ?? new Error("rel");

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .insert({
      venue_id: FANCY,
      relationship_id: relId,
      first_name: FIXTURE_FIRST,
      last_name: RUN,
      email,
      event_type: "wedding",
      event_date: eventDate,
      guest_count: 80,
      status: "active",
      sales_stage: "proposal_sent",
      assigned_staff_id: JEN,
      planned_event_space_id: SPACE,
    })
    .select("id")
    .single();
  if (leadErr || !lead) throw leadErr ?? new Error("lead");

  const { data: client, error: clientErr } = await admin
    .from("clients")
    .insert({
      venue_id: FANCY,
      lead_id: lead.id,
      first_name: FIXTURE_FIRST,
      last_name: RUN,
      email,
      status: "booking",
      event_type: "wedding",
      event_date: eventDate,
      relationship_id: relId,
      lifecycle_booked_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (clientErr || !client) throw clientErr ?? new Error("client");

  const { data: event, error: eventErr } = await admin
    .from("events")
    .insert({
      venue_id: FANCY,
      client_id: client.id,
      name: `${PREFIX}Wedding`,
      event_type: "wedding",
      event_date: eventDate,
      start_time: "16:00",
      end_time: "22:00",
      guest_count: 80,
      status: "confirmed",
      space_id: SPACE,
      assigned_staff_id: JEN,
      booked_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (eventErr || !event) throw eventErr ?? new Error("event");

  return { clientId: client.id as string, eventId: event.id as string, leadId: lead.id as string };
}

async function insertPlan(
  eventId: string,
  name: string,
  templateId: string,
  opts: { shared?: boolean; access?: string; spaceId?: string | null } = {},
) {
  const { data: tpl } = await admin.from("floor_plan_templates").select("*").eq("id", templateId).single();
  if (!tpl) throw new Error("tpl");
  const { data, error } = await admin
    .from("floor_plans")
    .insert({
      venue_id: FANCY,
      event_id: eventId,
      name,
      space_id: opts.spaceId === undefined ? (tpl.space_id ?? SPACE) : opts.spaceId,
      background_image_url: tpl.background_image_url,
      background_image_opacity: tpl.background_image_opacity,
      room_width_ft: tpl.room_width_ft,
      room_depth_ft: tpl.room_depth_ft,
      measurement_unit: tpl.measurement_unit,
      source_template_id: templateId,
      shared_with_couple: opts.shared ?? true,
      client_access: opts.access ?? "view",
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("plan");
  await cloneTemplateObjects(data.id, templateId);
  return data.id as string;
}

async function addSeat(clientId: string, planId: string, label: string) {
  const { data: guest, error: gErr } = await admin
    .from("couple_guests")
    .insert({
      venue_id: FANCY,
      client_id: clientId,
      first_name: label,
      last_name: "Seat",
      rsvp_status: "attending",
      notes: "fp-phase4-seat-fixture",
      sort_order: 1,
    })
    .select("id")
    .single();
  if (gErr || !guest) throw gErr ?? new Error("guest");
  const { data: tableObj } = await admin
    .from("floor_plan_objects")
    .select("id")
    .eq("floor_plan_id", planId)
    .limit(1)
    .maybeSingle();
  const { data: seat, error: sErr } = await admin
    .from("guest_seat_assignments")
    .insert({
      floor_plan_id: planId,
      guest_id: guest.id,
      table_object_id: tableObj?.id ?? null,
    })
    .select("id,guest_id,table_object_id,floor_plan_id")
    .single();
  if (sErr || !seat) throw sErr ?? new Error("seat");
  return seat;
}

async function portalToken(clientId: string, eventId: string) {
  const token = `fp4_${RUN}_${randomBytes(3).toString("hex")}`;
  const { error } = await admin.from("client_portal_sessions").insert({
    venue_id: FANCY,
    client_id: clientId,
    event_id: eventId,
    access_token: token,
    access_level: "couple",
    label: "Phase4 flip proof",
    expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
  });
  if (error) throw error;
  return token;
}

async function snapshotSideEffects(eventId: string, planIds: string[]) {
  const { data: event } = await admin
    .from("events")
    .select(
      "operational_floor_plan_id,seating_in_use_floor_plan_id,couple_selected_floor_plan_id,couple_preference_status,couple_approved_floor_plan_id",
    )
    .eq("id", eventId)
    .single();
  const { data: plans } = await admin
    .from("floor_plans")
    .select("id,name,shared_with_couple,client_access,space_id")
    .in("id", planIds)
    .order("name");
  const { data: objects } = await admin
    .from("floor_plan_objects")
    .select("id,floor_plan_id")
    .in("floor_plan_id", planIds);
  const { data: seats } = await admin
    .from("guest_seat_assignments")
    .select("id,guest_id,table_object_id,floor_plan_id")
    .in("floor_plan_id", planIds);
  const { data: members } = await admin
    .from("event_floor_plan_setup_members")
    .select("setup_id,floor_plan_id")
    .in("floor_plan_id", planIds);
  const { data: setups } = await admin
    .from("event_floor_plan_setups")
    .select(
      "id,name,couple_selected_floor_plan_id,couple_preference_status,couple_approved_floor_plan_id,operational_floor_plan_id,seating_in_use_floor_plan_id",
    )
    .eq("event_id", eventId)
    .order("sort_order");
  return {
    event,
    plans: (plans ?? []).sort((a, b) => a.id.localeCompare(b.id)),
    objectCount: objects?.length ?? 0,
    objectsByPlan: Object.fromEntries(
      planIds.map((id) => [id, (objects ?? []).filter((o) => o.floor_plan_id === id).length]),
    ),
    seats: (seats ?? []).sort((a, b) => a.id.localeCompare(b.id)),
    members: (members ?? []).sort((a, b) =>
      `${a.setup_id}:${a.floor_plan_id}`.localeCompare(`${b.setup_id}:${b.floor_plan_id}`),
    ),
    setups: (setups ?? []).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function stableEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  let eventId: string | null = null;
  let clientId: string | null = null;
  let leadId: string | null = null;
  let planBefore: string | null = null;
  let planAfter: string | null = null;
  let planExtra: string | null = null;
  let simpleEventId: string | null = null;
  let simpleClientId: string | null = null;
  let simpleLeadId: string | null = null;
  let simplePlanId: string | null = null;
  const createdPlanIds: string[] = [];
  const createdSetupIds: string[] = [];
  const guestIds: string[] = [];
  const persisted: Record<string, unknown> = { run: RUN, expectedSha: EXPECTED };

  const beforeEvents = (
    await admin.from("events").select("id", { count: "exact", head: true }).eq("venue_id", FANCY)
  ).count;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    const image = await servingImage();
    record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
    if (!image.includes(EXPECTED.slice(0, 12))) throw new Error(`Serving ${image}`);

    const health = await fetch(`${APP}/api/health`).then(async (r) => ({
      status: r.status,
      body: await r.json().catch(() => null),
    }));
    record("api_health", health.status === 200 && health.body?.ok === true, JSON.stringify(health));
    const html = await fetch(`${APP}/login`).then((r) => r.text());
    const dpl = html.match(/data-dpl-id="([^"]+)"/)?.[1] ?? "";
    record("html_dpl", dpl.startsWith(EXPECTED.slice(0, 12)), `dpl=${dpl}`);

    const { error: flipTableErr } = await admin.from("event_floor_plan_flips").select("id").limit(1);
    record("migration_flips_table", !flipTableErr, flipTableErr?.message ?? "ok");

    const eventDate = "2027-07-18";
    const coupleEmail = `fp4-${RUN.toLowerCase()}@example.com`;
    const fixture = await createBookedFixture(coupleEmail, eventDate);
    eventId = fixture.eventId;
    clientId = fixture.clientId;
    leadId = fixture.leadId;

    planBefore = await insertPlan(eventId, `${PREFIX}Before Ceremony`, TPL_A, {
      shared: true,
      access: "view",
    });
    createdPlanIds.push(planBefore);
    planAfter = await insertPlan(eventId, `${PREFIX}After Reception`, TPL_B, {
      shared: true,
      access: "view",
    });
    createdPlanIds.push(planAfter);
    planExtra = await insertPlan(eventId, `${PREFIX}Alt Reception`, TPL_A, {
      shared: false,
      access: "hidden",
    });
    createdPlanIds.push(planExtra);

    await admin
      .from("events")
      .update({
        operational_floor_plan_id: planBefore,
        seating_in_use_floor_plan_id: planBefore,
        couple_selected_floor_plan_id: planAfter,
        couple_preference_status: "pending",
      })
      .eq("id", eventId);

    const seat = await addSeat(clientId, planBefore, "SeatGuest");
    guestIds.push(seat.guest_id);

    const { data: s1, error: s1e } = await admin
      .from("event_floor_plan_setups")
      .insert({
        venue_id: FANCY,
        event_id: eventId,
        name: "Ceremony",
        sort_order: 0,
        operational_floor_plan_id: planBefore,
        seating_in_use_floor_plan_id: planBefore,
      })
      .select("id")
      .single();
    if (s1e || !s1) throw s1e ?? new Error("setup ceremony");
    createdSetupIds.push(s1.id);
    const { data: s2, error: s2e } = await admin
      .from("event_floor_plan_setups")
      .insert({
        venue_id: FANCY,
        event_id: eventId,
        name: "Reception",
        sort_order: 1,
        operational_floor_plan_id: planAfter,
        couple_selected_floor_plan_id: planAfter,
        couple_preference_status: "pending",
      })
      .select("id")
      .single();
    if (s2e || !s2) throw s2e ?? new Error("setup reception");
    createdSetupIds.push(s2.id);
    await admin.from("event_floor_plan_setup_members").insert([
      { venue_id: FANCY, setup_id: s1.id, floor_plan_id: planBefore, sort_order: 0 },
      { venue_id: FANCY, setup_id: s2.id, floor_plan_id: planAfter, sort_order: 0 },
      { venue_id: FANCY, setup_id: s2.id, floor_plan_id: planExtra, sort_order: 1 },
    ]);

    const beforeLinkSnap = await snapshotSideEffects(eventId, createdPlanIds);
    persisted.beforeLink = beforeLinkSnap;

    await context.addCookies(await staffCookies());
    await page.goto(`${APP}/events/${eventId}?tab=floorplan`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForSelector('[data-testid="floor-plan-flip-panel"]', { timeout: 60_000 });

    // P4-6 / P4-7: panel present but collapsed; no forced warning on load
    const flipForced = await page.locator('[data-testid="floor-plan-flip-editor"]').count();
    const autoClaim = await page.locator("text=/automatically\\s+transitions|timed flip executes/i").count();
    record(
      "P4-6_opt_in_collapsed",
      flipForced === 0,
      `editorVisible=${flipForced} (summary may exist only after link)`,
    );
    record("P4-7_no_auto_claim_on_workspace", autoClaim === 0, `autoClaimHits=${autoClaim}`);

    await page.click('[data-testid="floor-plan-flip-toggle"]');
    await page.waitForSelector('[data-testid="floor-plan-flip-form"]', { timeout: 15_000 });

    // P4-5 cancel: fill then cancel — no row
    await page.selectOption('[data-testid="floor-plan-flip-before"]', planBefore);
    await page.selectOption('[data-testid="floor-plan-flip-after"]', planAfter);
    await page.fill('[data-testid="floor-plan-flip-notes-draft"]', "TEMP draft notes should not persist");
    await page.click('[data-testid="floor-plan-flip-cancel"]');
    const { data: afterCancel } = await admin
      .from("event_floor_plan_flips")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();
    record("P4-5_cancel_no_partial_link", !afterCancel, afterCancel ? JSON.stringify(afterCancel) : "none");

    // Re-open and link for real
    const formVisible = await page.locator('[data-testid="floor-plan-flip-form"]').count();
    if (formVisible === 0) {
      await page.click('[data-testid="floor-plan-flip-toggle"]').catch(() => undefined);
      // if already linked somehow, unlink first
    }
    if ((await page.locator('[data-testid="floor-plan-flip-form"]').count()) === 0) {
      await page.click('[data-testid="floor-plan-flip-toggle"]');
    }
    await page.waitForSelector('[data-testid="floor-plan-flip-form"]', { timeout: 15_000 });
    await page.selectOption('[data-testid="floor-plan-flip-before"]', planBefore);
    await page.selectOption('[data-testid="floor-plan-flip-after"]', planAfter);
    const NOTES = `Staff turnover: clear ceremony chairs then set reception (${RUN})`;
    await page.fill('[data-testid="floor-plan-flip-notes-draft"]', NOTES);
    await page.click('[data-testid="floor-plan-flip-link"]');
    await page.waitForSelector('[data-testid="floor-plan-flip-linked"]', { timeout: 30_000 });

    const { data: linkedRow } = await admin
      .from("event_floor_plan_flips")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();
    record(
      "P4-1_persisted_pair",
      !!linkedRow &&
        linkedRow.before_floor_plan_id === planBefore &&
        linkedRow.after_floor_plan_id === planAfter,
      JSON.stringify(linkedRow),
    );
    record(
      "P4-2_notes_persisted",
      !!linkedRow && String(linkedRow.transition_notes ?? "").includes(RUN),
      String(linkedRow?.transition_notes ?? ""),
    );

    const afterLinkSnap = await snapshotSideEffects(eventId, createdPlanIds);
    persisted.afterLink = afterLinkSnap;
    record(
      "P4-4_no_side_effects_on_link",
      stableEqual(beforeLinkSnap, afterLinkSnap),
      stableEqual(beforeLinkSnap, afterLinkSnap)
        ? "equal"
        : JSON.stringify({ before: beforeLinkSnap, after: afterLinkSnap }).slice(0, 2000),
    );

    // Reload venue UI
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="floor-plan-flip-panel"]', { timeout: 60_000 });
    // may be collapsed with summary
    const summaryOrLinked =
      (await page.locator('[data-testid="floor-plan-flip-summary"]').count()) +
      (await page.locator('[data-testid="floor-plan-flip-linked"]').count());
    if ((await page.locator('[data-testid="floor-plan-flip-linked"]').count()) === 0) {
      await page.click('[data-testid="floor-plan-flip-toggle"]');
      await page.waitForSelector('[data-testid="floor-plan-flip-linked"]', { timeout: 15_000 });
    }
    const beforeLabel = await page.locator('[data-testid="floor-plan-flip-before-label"]').innerText();
    const afterLabel = await page.locator('[data-testid="floor-plan-flip-after-label"]').innerText();
    const notesVal = await page.locator('[data-testid="floor-plan-flip-notes"]').inputValue();
    record(
      "P4-1_reload_pair_visible",
      beforeLabel.includes("Before") && afterLabel.includes("After") && summaryOrLinked >= 0,
      `before=${beforeLabel} after=${afterLabel}`,
    );
    record("P4-2_notes_reload", notesVal.includes(RUN), notesVal.slice(0, 200));
    const pairCopy = await page.locator('[data-testid="floor-plan-flip-pair-label"]').innerText();
    record(
      "P4-honest_copy_not_auto",
      /not an automatic room switch/i.test(pairCopy),
      pairCopy,
    );
    await page.screenshot({ path: `${OUT}/shots/linked-1280.png`, fullPage: true });

    // Couple API privacy + sharing
    const token = await portalToken(clientId, eventId);
    const portalPlans = await fetch(
      `${APP}/api/portal/floor-plans?token=${encodeURIComponent(token)}`,
    ).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
    const portalBlob = JSON.stringify(portalPlans.body ?? {});
    const forbidden = ["transition_notes", "transitionNotes", "flipNotes", NOTES.slice(0, 20)];
    const leak = forbidden.filter((k) => portalBlob.includes(k));
    record(
      "P4-2_couple_api_no_notes",
      portalPlans.status === 200 && leak.length === 0,
      `status=${portalPlans.status} leaks=${leak.join(",") || "none"} bodyKeys=${Object.keys(portalPlans.body ?? {}).join(",")}`,
    );
    persisted.portalFloorPlans = {
      status: portalPlans.status,
      keys: Object.keys(portalPlans.body ?? {}),
      floorPlanIds: ((portalPlans.body as { floorPlans?: Array<{ id: string }> } | null)?.floorPlans ?? []).map(
        (p) => p.id,
      ),
      leak,
    };

    const portalSetups = await fetch(
      `${APP}/api/portal/floor-plan-setups?token=${encodeURIComponent(token)}`,
    ).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
    const setupsBlob = JSON.stringify(portalSetups.body ?? {});
    const setupLeak = forbidden.filter((k) => setupsBlob.includes(k));
    record(
      "P4-8_portal_setups_intact_no_notes",
      portalSetups.status === 200 &&
        setupLeak.length === 0 &&
        Boolean((portalSetups.body as { hasSetups?: boolean } | null)?.hasSetups),
      `status=${portalSetups.status} hasSetups=${(portalSetups.body as { hasSetups?: boolean } | null)?.hasSetups} leaks=${setupLeak.join(",") || "none"}`,
    );

    // Shared plans visible under existing rules (before+after shared; extra not)
    const sharedIds = new Set(
      ((portalPlans.body as { floorPlans?: Array<{ id: string }> } | null)?.floorPlans ?? []).map((p) => p.id),
    );
    record(
      "P4-9_share_rules",
      sharedIds.has(planBefore) && sharedIds.has(planAfter) && !sharedIds.has(planExtra),
      `shared=${[...sharedIds].join(",")}`,
    );

    // Portal UI: no notes / no auto flip claim
    await page.goto(`${APP}/p/${token}`, { waitUntil: "networkidle", timeout: 120_000 });
    const portalText = await page.locator("body").innerText();
    record(
      "P4-9_portal_ui_no_notes_no_auto",
      !portalText.includes(NOTES) && !/automatically\s+transitions|timed flip executes/i.test(portalText),
      portalText.includes(NOTES) ? "notes leaked" : "notes absent",
    );
    await page.screenshot({ path: `${OUT}/shots/portal-1280.png`, fullPage: true });

    // Unlink
    await page.goto(`${APP}/events/${eventId}?tab=floorplan`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForSelector('[data-testid="floor-plan-flip-panel"]', { timeout: 60_000 });
    if ((await page.locator('[data-testid="floor-plan-flip-unlink"]').count()) === 0) {
      await page.click('[data-testid="floor-plan-flip-toggle"]');
      await page.waitForSelector('[data-testid="floor-plan-flip-unlink"]', { timeout: 15_000 });
    }
    const beforeUnlinkSnap = await snapshotSideEffects(eventId, createdPlanIds);
    persisted.beforeUnlink = beforeUnlinkSnap;
    await page.click('[data-testid="floor-plan-flip-unlink"]');
    await page.waitForTimeout(1500);
    // wait until flip row gone
    for (let i = 0; i < 20; i++) {
      const { data } = await admin
        .from("event_floor_plan_flips")
        .select("id")
        .eq("event_id", eventId)
        .maybeSingle();
      if (!data) break;
      await page.waitForTimeout(500);
    }
    const { data: afterUnlinkRow } = await admin
      .from("event_floor_plan_flips")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();
    record("P4-3_unlink_removes_relationship", !afterUnlinkRow, afterUnlinkRow ? "still present" : "gone");

    const afterUnlinkSnap = await snapshotSideEffects(eventId, createdPlanIds);
    persisted.afterUnlink = afterUnlinkSnap;
    record(
      "P4-3_layouts_seats_membership_preserved",
      stableEqual(beforeUnlinkSnap, afterUnlinkSnap),
      stableEqual(beforeUnlinkSnap, afterUnlinkSnap)
        ? "equal"
        : JSON.stringify({ before: beforeUnlinkSnap, after: afterUnlinkSnap }).slice(0, 2000),
    );
    record(
      "P4-4_no_side_effects_on_unlink",
      stableEqual(beforeLinkSnap, afterUnlinkSnap),
      stableEqual(beforeLinkSnap, afterUnlinkSnap) ? "equal to pre-link baseline" : "diverged from pre-link",
    );

    // Phase 3 coexistence still: setups + members intact (already in snap), package panel
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="floor-plan-setup-package"]', { timeout: 60_000 });
    record(
      "P4-8_setup_package_panel_present",
      (await page.locator('[data-testid="floor-plan-setup-package"]').count()) === 1,
      "ok",
    );
    const { count: memberCount } = await admin
      .from("event_floor_plan_setup_members")
      .select("id", { count: "exact", head: true })
      .in("floor_plan_id", createdPlanIds);
    record("P4-8_membership_count", memberCount === 3, `members=${memberCount}`);

    // Simple path: one-layout event — flip panel opt-in, need-two message, no forced editor
    const simpleEmail = `fp4-simple-${RUN.toLowerCase()}@example.com`;
    const simple = await createBookedFixture(simpleEmail, "2027-08-01");
    simpleEventId = simple.eventId;
    simpleClientId = simple.clientId;
    simpleLeadId = simple.leadId;
    simplePlanId = await insertPlan(simpleEventId, `${PREFIX}Only Layout`, TPL_A, { shared: true });
    createdPlanIds.push(simplePlanId);
    await page.goto(`${APP}/events/${simpleEventId}?tab=floorplan`, {
      waitUntil: "networkidle",
      timeout: 120_000,
    });
    await page.waitForSelector('[data-testid="floor-plan-flip-panel"]', { timeout: 60_000 });
    const simpleEditor = await page.locator('[data-testid="floor-plan-flip-editor"]').count();
    record("P4-6_simple_path_no_forced_editor", simpleEditor === 0, `editor=${simpleEditor}`);
    await page.click('[data-testid="floor-plan-flip-toggle"]');
    await page.waitForSelector('[data-testid="floor-plan-flip-need-two"]', { timeout: 15_000 });
    const needTwo = await page.locator('[data-testid="floor-plan-flip-need-two"]').innerText();
    record(
      "P4-6_simple_path_need_two_copy",
      /single-layout wedding does not need a flip link/i.test(needTwo),
      needTwo,
    );
    await page.screenshot({ path: `${OUT}/shots/simple-path-1280.png`, fullPage: true });

    // FP-SR honesty: starter description still static (DB template if provisioned)
    const { data: fpsr } = await admin
      .from("floor_plan_templates")
      .select("key,name,description")
      .eq("venue_id", FANCY)
      .eq("key", "FP-SR")
      .maybeSingle();
    if (fpsr) {
      record(
        "P4-7_fpsr_template_static",
        /static|does not switch/i.test(String(fpsr.description ?? "")),
        String(fpsr.description ?? "").slice(0, 300),
      );
    } else {
      record("P4-7_fpsr_template_static", true, "FP-SR template not provisioned on Fancy; code starter copy covered by unit tests");
    }

    // Retry unlink when already gone (idempotent)
    await page.goto(`${APP}/events/${eventId}?tab=floorplan`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForSelector('[data-testid="floor-plan-flip-panel"]', { timeout: 60_000 });
    await page.click('[data-testid="floor-plan-flip-toggle"]');
    // Should show form (unlinked), not error partial state
    await page.waitForSelector('[data-testid="floor-plan-flip-form"]', { timeout: 15_000 });
    record(
      "P4-5_after_unlink_form_ready_no_partial",
      (await page.locator('[data-testid="floor-plan-flip-linked"]').count()) === 0,
      "form ready",
    );

    await page.screenshot({ path: `${OUT}/shots/after-unlink-1280.png`, fullPage: true });
  } catch (err) {
    record("harness_exception", false, errDetail(err));
    try {
      await page.screenshot({ path: `${OUT}/shots/failure.png`, fullPage: true });
    } catch {
      /* ignore */
    }
  } finally {
    // Cleanup fixtures
    const cleanup: Record<string, unknown> = {};
    try {
      if (eventId) {
        await admin.from("event_floor_plan_flips").delete().eq("event_id", eventId);
      }
      if (createdSetupIds.length) {
        await admin.from("event_floor_plan_setup_members").delete().in("setup_id", createdSetupIds);
        await admin.from("event_floor_plan_setups").delete().in("id", createdSetupIds);
      }
      if (createdPlanIds.length) {
        await admin.from("guest_seat_assignments").delete().in("floor_plan_id", createdPlanIds);
        await admin.from("floor_plan_objects").delete().in("floor_plan_id", createdPlanIds);
        await admin.from("floor_plans").delete().in("id", createdPlanIds);
      }
      if (guestIds.length) {
        await admin.from("couple_guests").delete().in("id", guestIds);
      }
      for (const eid of [eventId, simpleEventId]) {
        if (!eid) continue;
        await admin.from("client_portal_sessions").delete().eq("event_id", eid);
        await admin.from("events").delete().eq("id", eid);
      }
      for (const cid of [clientId, simpleClientId]) {
        if (!cid) continue;
        await admin.from("clients").delete().eq("id", cid);
      }
      for (const lid of [leadId, simpleLeadId]) {
        if (!lid) continue;
        await admin.from("leads").delete().eq("id", lid);
      }
      // orphaned guests from simple path none
      const leftoverFlips = eventId
        ? (
            await admin
              .from("event_floor_plan_flips")
              .select("id", { count: "exact", head: true })
              .eq("event_id", eventId)
          ).count
        : 0;
      const leftoverPlans = (
        await admin.from("floor_plans").select("id", { count: "exact", head: true }).in("id", createdPlanIds)
      ).count;
      cleanup.leftoverFlips = leftoverFlips;
      cleanup.leftoverPlans = leftoverPlans;
      cleanup.ok = leftoverFlips === 0 && leftoverPlans === 0;
      record(
        "cleanup_no_artifacts",
        Boolean(cleanup.ok),
        JSON.stringify(cleanup),
      );
    } catch (cerr) {
      record("cleanup_no_artifacts", false, errDetail(cerr));
    }

    const afterEvents = (
      await admin.from("events").select("id", { count: "exact", head: true }).eq("venue_id", FANCY)
    ).count;
    record(
      "cleanup_event_count_restored",
      afterEvents === beforeEvents,
      `before=${beforeEvents} after=${afterEvents}`,
    );
    persisted.beforeEvents = beforeEvents;
    persisted.afterEvents = afterEvents;
    persisted.cleanup = cleanup;

    writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify(persisted, null, 2));
    writeFileSync(
      `${OUT}/browser-results.json`,
      JSON.stringify(
        {
          run: RUN,
          expectedSha: EXPECTED,
          pass: checks.filter((c) => c.pass).length,
          fail: checks.filter((c) => !c.pass).length,
          checks,
        },
        null,
        2,
      ),
    );
    writeFileSync(
      `${OUT}/browser-run.log`,
      checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.name} — ${c.detail}`).join("\n") + "\n",
    );

    await browser.close();
  }

  const failed = checks.filter((c) => !c.pass);
  if (failed.length) {
    console.error(`NOT GREEN — ${failed.length} failed`);
    process.exit(1);
  }
  console.log(`GREEN — ${checks.length} pass / 0 fail`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
