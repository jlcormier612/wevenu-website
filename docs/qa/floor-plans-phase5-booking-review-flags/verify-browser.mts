/**
 * Floor Plans Phase 5 — booking-change review flags (T1 + T3).
 *
 * EXPECTED_SHA=<sha> npx tsx docs/qa/floor-plans-phase5-booking-review-flags/verify-browser.mts
 *
 * Disposable fixtures only: FP5-{RUN}-* on Fancy venue.
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
const BARN = "3b36ec69-b17d-4351-8186-68d96dd6dfe7";
const GARDEN = "95f961e0-1995-4c62-8b01-add7a2cffc84";
const BRIDGE = "40f81c67-199d-47f8-bf7d-79c118e34198";
const TPL_A = "3d4e11ef-7de7-495b-8fc7-b2eaf59584c3";
const TPL_B = "026fb633-2dce-4c73-87c8-144bb29a0318";
const EMAIL = "jennifer@hellotocheers.com";
const RUN = process.env.E2E_RUN_ID ?? `FP5${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/floor-plans-phase5-booking-review-flags";
const PREFIX = `FP5-${RUN}-`;
const FIXTURE_FIRST = "FP5Phase5";
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

async function cloneTemplateObjects(planId: string, templateId: string, limit = 3) {
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
      planned_event_space_id: BARN,
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
      space_id: BARN,
      assigned_staff_id: JEN,
      booked_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (eventErr || !event) throw eventErr ?? new Error("event");

  return { clientId: client.id as string, eventId: event.id as string, leadId: lead.id as string };
}

async function setAssignments(
  eventId: string,
  rows: Array<{ useKey: string; useLabel: string; spaceId: string }>,
) {
  const primary = rows[0]?.spaceId ?? null;
  const { error } = await admin.rpc("replace_event_space_assignments", {
    p_venue_id: FANCY,
    p_event_id: eventId,
    p_primary_space_id: primary,
    p_assignments: rows.map((a, i) => ({
      useKey: a.useKey,
      useLabel: a.useLabel,
      spaceId: a.spaceId,
      startTime: null,
      endTime: null,
      scheduledDate: null,
      sortOrder: i,
    })),
  });
  if (error) throw error;
}

async function insertPlan(
  eventId: string,
  name: string,
  templateId: string,
  spaceId: string | null,
) {
  const { data: tpl } = await admin.from("floor_plan_templates").select("*").eq("id", templateId).single();
  if (!tpl) throw new Error("tpl");
  const { data, error } = await admin
    .from("floor_plans")
    .insert({
      venue_id: FANCY,
      event_id: eventId,
      name,
      space_id: spaceId,
      background_image_url: tpl.background_image_url,
      background_image_opacity: tpl.background_image_opacity,
      room_width_ft: tpl.room_width_ft,
      room_depth_ft: tpl.room_depth_ft,
      measurement_unit: tpl.measurement_unit,
      source_template_id: templateId,
      shared_with_couple: true,
      client_access: "view",
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("plan");
  await cloneTemplateObjects(data.id, templateId);
  return data.id as string;
}

async function openFlags(eventId: string) {
  const { data, error } = await admin
    .from("event_floor_plan_review_flags")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function allFlags(eventId: string) {
  const { data, error } = await admin
    .from("event_floor_plan_review_flags")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function portalToken(clientId: string, eventId: string) {
  const token = `fp5_${RUN}_${randomBytes(3).toString("hex")}`;
  const { error } = await admin.from("client_portal_sessions").insert({
    venue_id: FANCY,
    client_id: clientId,
    event_id: eventId,
    access_token: token,
    access_level: "couple",
    label: "Phase5 review proof",
    expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
  });
  if (error) throw error;
  return token;
}

async function pickBaseUiOption(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  rowTestId: string,
  optionName: string | RegExp,
) {
  const row = page.locator(`[data-testid="${rowTestId}"]`);
  await row.locator("button").first().click();
  await page.getByRole("option", { name: optionName }).click();
}

async function saveEventEdit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
) {
  const save = page.getByRole("button", { name: /Save|Update event|Save changes/i }).first();
  await save.click();
  await page.waitForTimeout(2500);
}

async function gotoFloorPlans(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  eventId: string,
) {
  await page.goto(`${APP}/events/${eventId}?tab=floorplan`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.waitForSelector('[data-testid="floor-plan-review-flags-panel"]', { timeout: 60_000 });
}

async function cardRoomSelect(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  planId: string,
  spaceIdOrNone: string,
) {
  const select = page.locator(`[data-testid="floor-plan-card-room-select"][data-plan-id="${planId}"]`);
  await select.selectOption(spaceIdOrNone);
  await page.locator(`[data-testid="floor-plan-card-room-save"][data-plan-id="${planId}"]`).click();
  await page.waitForTimeout(2000);
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  let eventId: string | null = null;
  let clientId: string | null = null;
  let leadId: string | null = null;
  let planBarn: string | null = null;
  let planGarden: string | null = null;
  let planNull: string | null = null;
  const createdPlanIds: string[] = [];
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

    const { error: flagTableErr } = await admin.from("event_floor_plan_review_flags").select("id").limit(1);
    record("migration_review_flags", !flagTableErr, flagTableErr?.message ?? "ok");
    if (flagTableErr) throw flagTableErr;

    const { error: snapErr } = await admin
      .from("event_floor_plan_flips")
      .select("recorded_before_space_id,recorded_after_space_id,room_snapshot_captured_at")
      .limit(1);
    record("migration_flip_snapshot_cols", !snapErr, snapErr?.message ?? "ok");
    if (snapErr) throw snapErr;

    const eventDate = "2027-08-22";
    const coupleEmail = `fp5-${RUN.toLowerCase()}@example.com`;
    const fixture = await createBookedFixture(coupleEmail, eventDate);
    eventId = fixture.eventId;
    clientId = fixture.clientId;
    leadId = fixture.leadId;

    await setAssignments(eventId, [
      { useKey: "ceremony", useLabel: "Ceremony", spaceId: BARN },
      { useKey: "reception", useLabel: "Reception", spaceId: GARDEN },
    ]);

    planBarn = await insertPlan(eventId, `${PREFIX}Barn Layout`, TPL_A, BARN);
    planGarden = await insertPlan(eventId, `${PREFIX}Garden Layout`, TPL_B, GARDEN);
    planNull = await insertPlan(eventId, `${PREFIX}No Room Layout`, TPL_A, null);
    createdPlanIds.push(planBarn, planGarden, planNull);

    await context.addCookies(await staffCookies());
    await gotoFloorPlans(page, eventId);

    // S1 + S4: consistent rooms + null layout → empty reviews
    let flags = await openFlags(eventId);
    const emptyUi = await page.locator('[data-testid="floor-plan-review-empty"]').count();
    record(
      "S1_consistent_unflagged",
      flags.length === 0 && emptyUi > 0,
      `open=${flags.length} emptyUi=${emptyUi}`,
    );
    record("S4_null_layout_unflagged", flags.every((f) => f.floor_plan_id !== planNull), `open=${flags.length}`);
    await page.screenshot({ path: `${OUT}/shots/01-empty-reviews.png`, fullPage: true });

    // S2 + S3: remove Garden from booking via event edit → only garden layout flagged
    await page.goto(`${APP}/events/${eventId}/edit`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForSelector('[data-testid="esa-row-reception"]', { timeout: 60_000 });
    await pickBaseUiOption(page, "esa-row-reception", /Not assigned/i);
    await saveEventEdit(page);
    // May land on event detail; go back to floor plans
    await gotoFloorPlans(page, eventId);
    flags = await openFlags(eventId);
    const gardenFlagged = flags.filter((f) => f.floor_plan_id === planGarden && f.trigger_code === "t1_booking_room");
    const barnFlagged = flags.filter((f) => f.floor_plan_id === planBarn);
    const nullFlagged = flags.filter((f) => f.floor_plan_id === planNull);
    record(
      "S2_removed_room_flags_only_that_layout",
      gardenFlagged.length === 1 && barnFlagged.length === 0,
      JSON.stringify(flags.map((f) => ({ fp: f.floor_plan_id, t: f.trigger_code, s: f.status }))),
    );
    record("S3_remaining_room_layout_unaffected", barnFlagged.length === 0, `barnFlags=${barnFlagged.length}`);
    record("S4b_null_still_unflagged", nullFlagged.length === 0, `nullFlags=${nullFlagged.length}`);
    persisted.afterRemoveGarden = flags;
    await page.screenshot({ path: `${OUT}/shots/02-after-remove-garden.png`, fullPage: true });

    // S8: repeat same effective save (edit event, save without change) → no duplicate
    const openCountBefore = flags.length;
    await page.goto(`${APP}/events/${eventId}/edit`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForSelector('[data-testid="esa-row-ceremony"]', { timeout: 60_000 });
    await saveEventEdit(page);
    flags = await openFlags(eventId);
    record(
      "S8_idempotent_repeat_save",
      flags.length === openCountBefore
        && flags.filter((f) => f.floor_plan_id === planGarden && f.status === "open").length === 1,
      `before=${openCountBefore} after=${flags.length}`,
    );

    // S5: clear all rooms → empty set must not create NEW mismatch flags for barn/null
    const openBeforeEmpty = await openFlags(eventId);
    await page.goto(`${APP}/events/${eventId}/edit`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForSelector('[data-testid="esa-row-ceremony"]', { timeout: 60_000 });
    await pickBaseUiOption(page, "esa-row-ceremony", /Not assigned/i);
    // reception already none
    await saveEventEdit(page);
    const openAfterEmpty = await openFlags(eventId);
    const newBarnOrNull = openAfterEmpty.filter(
      (f) =>
        (f.floor_plan_id === planBarn || f.floor_plan_id === planNull)
        && !openBeforeEmpty.some((o) => o.id === f.id),
    );
    record(
      "S5_empty_booking_set_no_new_mismatch",
      newBarnOrNull.length === 0,
      `newBarnOrNull=${newBarnOrNull.length} openAfter=${openAfterEmpty.length}`,
    );

    // Restore barn+bridge for later layout/flip tests (via admin RPC — then UI reconcile via layout edit)
    await setAssignments(eventId, [
      { useKey: "ceremony", useLabel: "Ceremony", spaceId: BARN },
      { useKey: "cocktail_hour", useLabel: "Cocktail hour", spaceId: BRIDGE },
    ]);
    // Trigger app reconcile by saving layout room for barn (idempotent same room) after assignments restored
    await gotoFloorPlans(page, eventId);
    await cardRoomSelect(page, planBarn!, BARN);

    // S6: change garden layout room to Bridge while booking has Barn+Bridge — wait, garden already may have open flag.
    // Clear garden review first if open, then set garden layout to a room NOT in set (use a room not assigned).
    // Stone Patio is cocktail-only; set garden layout to Stone Patio while booking is Barn+Bridge.
    const patio = "f6df6024-e6a0-4df8-b391-27f2eae61238";
    // Clear any open garden flag first so S6 creates a fresh layout-room flag
    for (const f of await openFlags(eventId)) {
      if (f.floor_plan_id === planGarden) {
        await page.locator(`[data-flag-id="${f.id}"] [data-testid="floor-plan-review-clear"]`).click();
        await page.waitForTimeout(1500);
      }
    }
    await gotoFloorPlans(page, eventId);
    await cardRoomSelect(page, planGarden!, patio);
    flags = await openFlags(eventId);
    const layoutRoomFlag = flags.find(
      (f) => f.floor_plan_id === planGarden && f.trigger_code === "t1_layout_room",
    );
    record(
      "S6_layout_room_conflict_creates_review",
      !!layoutRoomFlag,
      JSON.stringify(flags.map((f) => ({ id: f.id, t: f.trigger_code, fp: f.floor_plan_id }))),
    );
    persisted.afterLayoutConflict = flags;

    // S7: change layout room to null — no new mismatch; existing flag not silently cleared
    const openBeforeNull = await openFlags(eventId);
    const gardenOpenBefore = openBeforeNull.filter((f) => f.floor_plan_id === planGarden);
    await cardRoomSelect(page, planGarden!, "__none__");
    const openAfterNull = await openFlags(eventId);
    const gardenOpenAfter = openAfterNull.filter((f) => f.floor_plan_id === planGarden);
    const newMismatchOnNull = openAfterNull.filter(
      (f) =>
        f.floor_plan_id === planGarden
        && f.trigger_code.startsWith("t1_")
        && !openBeforeNull.some((o) => o.id === f.id),
    );
    record(
      "S7_null_room_no_new_flag_no_silent_clear",
      newMismatchOnNull.length === 0 && gardenOpenAfter.length === gardenOpenBefore.length,
      `before=${gardenOpenBefore.length} after=${gardenOpenAfter.length} new=${newMismatchOnNull.length}`,
    );

    // S9: Clear review persists; seating/layouts unchanged
    await gotoFloorPlans(page, eventId);
    const toClear = (await openFlags(eventId)).find((f) => f.floor_plan_id === planGarden);
    const { data: planBeforeClear } = await admin
      .from("floor_plans")
      .select("id,space_id,name,shared_with_couple,client_access")
      .eq("id", planGarden!)
      .single();
    if (toClear) {
      await page.locator(`[data-flag-id="${toClear.id}"] [data-testid="floor-plan-review-clear"]`).click();
      await page.waitForTimeout(2000);
    }
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="floor-plan-review-flags-panel"]', { timeout: 60_000 });
    const afterClear = await allFlags(eventId);
    const clearedRow = afterClear.find((f) => f.id === toClear?.id);
    const { data: planAfterClear } = await admin
      .from("floor_plans")
      .select("id,space_id,name,shared_with_couple,client_access")
      .eq("id", planGarden!)
      .single();
    record(
      "S9_clear_persists_no_layout_change",
      !!clearedRow
        && clearedRow.status === "cleared"
        && JSON.stringify(planBeforeClear) === JSON.stringify(planAfterClear)
        && (await page.locator(`[data-flag-id="${toClear?.id}"]`).count()) === 0,
      JSON.stringify({ clearedRow: clearedRow && { status: clearedRow.status, cleared_at: clearedRow.cleared_at }, planAfterClear }),
    );

    // S10: qualifying change after clear → new open flag
    await cardRoomSelect(page, planGarden!, patio);
    flags = await openFlags(eventId);
    const newAfterClear = flags.find(
      (f) => f.floor_plan_id === planGarden && f.trigger_code === "t1_layout_room" && f.id !== toClear?.id,
    );
    record("S10_new_flag_after_clear", !!newAfterClear, JSON.stringify(flags.map((f) => f.id)));

    // S11: link flip captures snapshot
    await page.click('[data-testid="floor-plan-flip-toggle"]').catch(() => undefined);
    if ((await page.locator('[data-testid="floor-plan-flip-form"]').count()) === 0) {
      await page.click('[data-testid="floor-plan-flip-toggle"]');
    }
    await page.waitForSelector('[data-testid="floor-plan-flip-form"]', { timeout: 15_000 });
    await page.selectOption('[data-testid="floor-plan-flip-before"]', planBarn!);
    await page.selectOption('[data-testid="floor-plan-flip-after"]', planGarden!);
    const NOTES = `Phase5 flip notes ${RUN}`;
    await page.fill('[data-testid="floor-plan-flip-notes-draft"]', NOTES);
    await page.click('[data-testid="floor-plan-flip-link"]');
    await page.waitForSelector('[data-testid="floor-plan-flip-linked"]', { timeout: 30_000 });
    const { data: flipRow } = await admin
      .from("event_floor_plan_flips")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();
    record(
      "S11_flip_snapshot_captured",
      !!flipRow?.room_snapshot_captured_at
        && flipRow.recorded_before_space_id === BARN
        && flipRow.recorded_after_space_id === patio,
      JSON.stringify({
        captured: flipRow?.room_snapshot_captured_at,
        before: flipRow?.recorded_before_space_id,
        after: flipRow?.recorded_after_space_id,
      }),
    );
    persisted.flipAfterLink = flipRow;

    // S12: change linked layout room → T3
    await cardRoomSelect(page, planBarn!, BRIDGE);
    flags = await openFlags(eventId);
    const t3 = flags.find((f) => f.trigger_code === "t3_flip_snapshot" && f.target_kind === "flip");
    record("S12_layout_room_triggers_t3", !!t3, JSON.stringify(flags.filter((f) => f.trigger_code === "t3_flip_snapshot")));
    persisted.afterT3 = flags;

    // S13: notes-only edit does not refresh snapshot or create new T3 fingerprint change from notes
    const snapBeforeNotes = flipRow?.room_snapshot_captured_at;
    const t3BeforeNotes = t3?.id;
    if ((await page.locator('[data-testid="floor-plan-flip-notes"]').count()) > 0) {
      await page.fill('[data-testid="floor-plan-flip-notes"]', `${NOTES} edited`);
      await page.click('[data-testid="floor-plan-flip-save-notes"]').catch(async () => {
        // some UIs auto-save; try blur
        await page.locator('[data-testid="floor-plan-flip-notes"]').blur();
      });
      await page.waitForTimeout(2000);
    }
    const { data: flipAfterNotes } = await admin
      .from("event_floor_plan_flips")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();
    const t3AfterNotes = (await openFlags(eventId)).filter((f) => f.trigger_code === "t3_flip_snapshot");
    record(
      "S13_notes_only_no_snapshot_refresh",
      flipAfterNotes?.room_snapshot_captured_at === snapBeforeNotes
        && t3AfterNotes.length === 1
        && t3AfterNotes[0]?.id === t3BeforeNotes,
      JSON.stringify({
        snapBefore: snapBeforeNotes,
        snapAfter: flipAfterNotes?.room_snapshot_captured_at,
        t3Ids: t3AfterNotes.map((f) => f.id),
      }),
    );

    // S14: unlink leaves no orphaned open T3
    if ((await page.locator('[data-testid="floor-plan-flip-unlink"]').count()) === 0) {
      await page.click('[data-testid="floor-plan-flip-toggle"]');
    }
    await page.waitForSelector('[data-testid="floor-plan-flip-unlink"]', { timeout: 15_000 });
    await page.click('[data-testid="floor-plan-flip-unlink"]');
    await page.waitForTimeout(2000);
    const { data: flipGone } = await admin
      .from("event_floor_plan_flips")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();
    const orphanT3 = (await openFlags(eventId)).filter((f) => f.trigger_code === "t3_flip_snapshot");
    record(
      "S14_unlink_no_orphan_t3",
      !flipGone && orphanT3.length === 0,
      JSON.stringify({ flipGone, orphanT3: orphanT3.length }),
    );

    // S15: portal does not expose review flags
    const token = await portalToken(clientId!, eventId!);
    const portalPlans = await fetch(
      `${APP}/api/portal/floor-plans?token=${encodeURIComponent(token)}`,
    ).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
    const portalBlob = JSON.stringify(portalPlans.body ?? {});
    const leakKeys = [
      "review_flags",
      "reviewFlags",
      "event_floor_plan_review_flags",
      "reason_summary",
      "Clear review",
      "t1_booking_room",
      "t3_flip_snapshot",
    ].filter((k) => portalBlob.includes(k));
    await page.goto(`${APP}/p/${token}`, { waitUntil: "networkidle", timeout: 120_000 });
    const portalText = await page.locator("body").innerText();
    record(
      "S15_portal_no_review_flags",
      portalPlans.status === 200 && leakKeys.length === 0 && !/Clear review|layout reviews/i.test(portalText),
      `leaks=${leakKeys.join(",") || "none"} status=${portalPlans.status}`,
    );
    await page.screenshot({ path: `${OUT}/shots/15-portal.png`, fullPage: true });

    // Legacy flip without snapshot must not T3 (insert legacy-like row without captured_at)
    await admin.from("event_floor_plan_flips").delete().eq("event_id", eventId!);
    const { data: legacyFlip, error: legErr } = await admin
      .from("event_floor_plan_flips")
      .insert({
        venue_id: FANCY,
        event_id: eventId!,
        before_floor_plan_id: planBarn!,
        after_floor_plan_id: planNull!,
        transition_notes: "legacy",
        recorded_before_space_id: null,
        recorded_after_space_id: null,
        room_snapshot_captured_at: null,
      })
      .select("*")
      .single();
    if (legErr) throw legErr;
    await admin.from("floor_plans").update({ space_id: BRIDGE }).eq("id", planBarn!);
    // Trigger reconcile via same-room save on null plan (no-op room) then barn already changed via admin —
    // use card save on null plan after setting barn via admin; call layout room on planNull to same null
    await gotoFloorPlans(page, eventId!);
    await cardRoomSelect(page, planNull!, "__none__");
    const legacyT3 = (await openFlags(eventId!)).filter((f) => f.trigger_code === "t3_flip_snapshot");
    record(
      "legacy_flip_no_t3",
      legacyT3.length === 0 && !!legacyFlip && !legacyFlip.room_snapshot_captured_at,
      `legacyT3=${legacyT3.length}`,
    );

    persisted.finalFlags = await allFlags(eventId!);
    persisted.plans = await admin
      .from("floor_plans")
      .select("id,name,space_id")
      .in("id", createdPlanIds)
      .then((r) => r.data);

    await page.screenshot({ path: `${OUT}/shots/final-workspace.png`, fullPage: true });
  } catch (err) {
    record("harness_error", false, errDetail(err));
    await page.screenshot({ path: `${OUT}/shots/error.png`, fullPage: true }).catch(() => undefined);
  } finally {
    // Cleanup disposable fixtures only
    try {
      if (eventId) {
        await admin.from("event_floor_plan_review_flags").delete().eq("event_id", eventId);
        await admin.from("event_floor_plan_flips").delete().eq("event_id", eventId);
        await admin.from("event_floor_plan_setup_members").delete().eq("venue_id", FANCY).in(
          "floor_plan_id",
          createdPlanIds.length ? createdPlanIds : ["00000000-0000-0000-0000-000000000000"],
        );
        await admin.from("event_floor_plan_setups").delete().eq("event_id", eventId);
        if (createdPlanIds.length) {
          await admin.from("guest_seat_assignments").delete().in("floor_plan_id", createdPlanIds);
          await admin.from("floor_plan_objects").delete().in("floor_plan_id", createdPlanIds);
          await admin.from("floor_plans").delete().in("id", createdPlanIds);
        }
        await admin.from("event_space_assignments").delete().eq("event_id", eventId);
        await admin.from("events").delete().eq("id", eventId);
      }
      if (clientId) {
        await admin.from("client_portal_sessions").delete().eq("client_id", clientId);
        await admin.from("couple_guests").delete().eq("client_id", clientId);
        await admin.from("clients").delete().eq("id", clientId);
      }
      if (leadId) await admin.from("leads").delete().eq("id", leadId);
    } catch (cleanupErr) {
      record("cleanup_error", false, errDetail(cleanupErr));
    }

    const afterEvents = (
      await admin.from("events").select("id", { count: "exact", head: true }).eq("venue_id", FANCY)
    ).count;
    record(
      "cleanup_event_count_stable",
      beforeEvents === afterEvents,
      `before=${beforeEvents} after=${afterEvents}`,
    );

    await browser.close();

    const failed = checks.filter((c) => !c.pass);
    const summary = {
      run: RUN,
      expectedSha: EXPECTED,
      passed: checks.filter((c) => c.pass).length,
      failed: failed.length,
      checks,
      verdict: failed.length === 0 ? "GREEN" : "NOT GREEN",
    };
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(summary, null, 2));
    writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify(persisted, null, 2));
    writeFileSync(
      `${OUT}/browser-run.log`,
      checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.name} — ${c.detail}`).join("\n"),
    );
    console.log(`\n${summary.verdict}: ${summary.passed} pass / ${summary.failed} fail`);
    if (failed.length) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
