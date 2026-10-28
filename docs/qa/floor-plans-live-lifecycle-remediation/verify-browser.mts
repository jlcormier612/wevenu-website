/**
 * Floor Plans live lifecycle remediation — P1 defects + missing scenarios A–E.
 *
 * EXPECTED_SHA=12721ce6… \
 *   npx tsx docs/qa/floor-plans-live-lifecycle-remediation/verify-browser.mts
 *
 * Disposable fixtures only: FPLR-{RUN}-* on Fancy venue. Production untouched.
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
const BRIDGE = "40f81c67-199d-47f8-bf7d-79c118e34198";
const TPL_A = "3d4e11ef-7de7-495b-8fc7-b2eaf59584c3";
const TPL_B = "026fb633-2dce-4c73-87c8-144bb29a0318";
const EMAIL = "jennifer@hellotocheers.com";
const RUN = process.env.E2E_RUN_ID ?? `FPLR${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/floor-plans-live-lifecycle-remediation";
const PREFIX = `FPLR-${RUN}-`;
const FIXTURE_FIRST = "FPLRRemediation";
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

  await admin.rpc("replace_event_space_assignments", {
    p_venue_id: FANCY,
    p_event_id: event.id,
    p_primary_space_id: BARN,
    p_assignments: [
      {
        useKey: "ceremony",
        useLabel: "Ceremony",
        spaceId: BARN,
        startTime: null,
        endTime: null,
        scheduledDate: null,
        sortOrder: 0,
      },
    ],
  });

  return { clientId: client.id as string, eventId: event.id as string };
}

async function insertPlan(
  eventId: string,
  name: string,
  templateId: string,
  spaceId: string | null,
  extras: Record<string, unknown> = {},
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
      ...extras,
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

async function portalToken(clientId: string, eventId: string) {
  const token = `fplr_${RUN}_${randomBytes(3).toString("hex")}`;
  const { error } = await admin.from("client_portal_sessions").insert({
    venue_id: FANCY,
    client_id: clientId,
    event_id: eventId,
    access_token: token,
    access_level: "couple",
    label: "FPLR remediation",
    expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
  });
  if (error) throw error;
  return token;
}

async function gotoFloorPlans(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  eventId: string,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(`${APP}/events/${eventId}?tab=floorplan`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await page.waitForSelector('[data-testid="floor-plan-operational-workspace"]', {
        timeout: 45_000,
      });
      return;
    } catch (e) {
      if (attempt === 2) throw e;
      await page.waitForTimeout(1500);
    }
  }
}

async function cleanup(eventIds: string[], clientIds: string[]) {
  for (const eventId of eventIds) {
    await admin.from("event_floor_plan_review_flags").delete().eq("event_id", eventId);
    await admin.from("event_floor_plan_flips").delete().eq("event_id", eventId);
    const { data: setups } = await admin
      .from("event_floor_plan_setups")
      .select("id")
      .eq("event_id", eventId);
    const setupIds = (setups ?? []).map((s) => s.id);
    if (setupIds.length) {
      await admin.from("event_floor_plan_setup_members").delete().in("setup_id", setupIds);
      await admin.from("event_floor_plan_setups").delete().in("id", setupIds);
    }
    const { data: plans } = await admin.from("floor_plans").select("id").eq("event_id", eventId);
    const planIds = (plans ?? []).map((p) => p.id);
    if (planIds.length) {
      await admin.from("floor_plan_objects").delete().in("floor_plan_id", planIds);
      await admin.from("floor_plans").delete().in("id", planIds);
    }
    await admin.from("event_space_assignments").delete().eq("event_id", eventId);
    await admin.from("client_portal_sessions").delete().eq("event_id", eventId);
    await admin.from("events").delete().eq("id", eventId);
  }
  for (const clientId of clientIds) {
    await admin.from("clients").delete().eq("id", clientId);
  }
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const image = await servingImage();
  const shaOk = image.includes(EXPECTED.slice(0, 12));
  record("serving_sha", shaOk, image);
  if (!shaOk) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks, image }, null, 2));
    process.exit(1);
  }

  const eventDate = "2061-07-17";
  const email = `fplr-${RUN.toLowerCase()}@example.com`;
  const createdEventIds: string[] = [];
  const createdClientIds: string[] = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  try {
    // ── Fixture: ceremony + reception setups, two layouts, preference on A ──
    const { clientId, eventId } = await createBookedFixture(email, eventDate);
    createdEventIds.push(eventId);
    createdClientIds.push(clientId);

    const planCeremony = await insertPlan(eventId, `${PREFIX}Ceremony`, TPL_A, BARN, {
      couple_may_add_tables: true,
      client_layout_status: "working",
    });
    const planReception = await insertPlan(eventId, `${PREFIX}Reception`, TPL_B, BARN);
    // Unique(floor_plan_id): a layout belongs to at most one setup — Reception needs its own alt.
    const planReceptionAlt = await insertPlan(eventId, `${PREFIX}Reception-Alt`, TPL_A, BARN);
    await admin
      .from("events")
      .update({
        operational_floor_plan_id: planCeremony,
        couple_selected_floor_plan_id: planCeremony,
        couple_preference_status: "pending",
      })
      .eq("id", eventId);

    const { data: s1, error: s1e } = await admin
      .from("event_floor_plan_setups")
      .insert({
        venue_id: FANCY,
        event_id: eventId,
        name: "Ceremony",
        sort_order: 0,
        operational_floor_plan_id: planCeremony,
        seating_in_use_floor_plan_id: planCeremony,
      })
      .select("id")
      .single();
    if (s1e || !s1) throw s1e ?? new Error("ceremony setup");
    const { data: s2, error: s2e } = await admin
      .from("event_floor_plan_setups")
      .insert({
        venue_id: FANCY,
        event_id: eventId,
        name: "Reception",
        sort_order: 1,
        operational_floor_plan_id: planReception,
      })
      .select("id")
      .single();
    if (s2e || !s2) throw s2e ?? new Error("reception setup");
    const { error: memErr } = await admin.from("event_floor_plan_setup_members").insert([
      { venue_id: FANCY, setup_id: s1.id, floor_plan_id: planCeremony, sort_order: 0 },
      { venue_id: FANCY, setup_id: s2.id, floor_plan_id: planReception, sort_order: 0 },
      { venue_id: FANCY, setup_id: s2.id, floor_plan_id: planReceptionAlt, sort_order: 1 },
    ]);
    if (memErr) throw memErr;

    // ── Scenario D start + banner honesty (empty) ───────────────────────────
    await gotoFloorPlans(page, eventId);
    await page.waitForSelector('[data-testid="floor-plan-review-flags-panel"]', { timeout: 30_000 });
    await page.waitForSelector('[data-testid="floor-plan-review-loading"]', { state: "detached", timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(800);

    const emptyVisible = await page.locator('[data-testid="floor-plan-review-empty"]').isVisible();
    const bannerWhileEmpty = await page.locator('[data-testid="floor-plan-review-banner"]').count();
    const bookingRooms = await page.locator('[data-testid="floor-plan-review-booking-rooms"]').innerText().catch(() => "");
    record(
      "D0_banner_honest_when_empty",
      emptyVisible && bannerWhileEmpty === 0,
      `empty=${emptyVisible} bannerCount=${bannerWhileEmpty} rooms=${bookingRooms}`,
    );
    record(
      "D0_booking_rooms_not_none_while_assigned",
      /Barn/i.test(bookingRooms) && !/None assigned/i.test(bookingRooms),
      bookingRooms,
    );

    // Preference vs furniture labels on card
    const preferenceBadge = await page.locator('[data-testid="floor-plan-card-couple-preference"]').count();
    const furnitureApproved = await page.locator('[data-testid="floor-plan-card-furniture-approved"]').count();
    const legacyClientApproved = await page.locator("text=Client approved").count();
    record(
      "C_labels_preference_not_furniture",
      preferenceBadge > 0 && furnitureApproved === 0 && legacyClientApproved === 0,
      `preference=${preferenceBadge} furnitureApproved=${furnitureApproved} legacyClientApproved=${legacyClientApproved}`,
    );
    const visibilityHeading = await page.locator("text=Couple visibility & seating").count();
    const prepHeading = await page.locator("text=Venue prep").count();
    record(
      "P2_card_grouped_controls",
      visibilityHeading > 0 && prepHeading > 0,
      `visibility=${visibilityHeading} prep=${prepHeading}`,
    );
    await page.screenshot({ path: `${OUT}/shots/venue-empty-reviews-1280.png`, fullPage: false });

    // ── Scenario D: room mismatch → flag in UI → clear ──────────────────────
    const cardRoom = page.locator(`[data-testid="floor-plan-card-room-select"][data-plan-id="${planCeremony}"]`);
    await cardRoom.waitFor({ state: "visible", timeout: 20_000 });
    await cardRoom.selectOption(BRIDGE);
    await page.locator(`[data-testid="floor-plan-card-room-save"][data-plan-id="${planCeremony}"]`).click();
    let flagsAfter: Awaited<ReturnType<typeof openFlags>> = [];
    for (let i = 0; i < 20; i++) {
      flagsAfter = await openFlags(eventId);
      if (flagsAfter.some((f) => f.floor_plan_id === planCeremony && f.status === "open")) break;
      await page.waitForTimeout(400);
    }
    record(
      "D1_persist_open_flag",
      flagsAfter.some((f) => f.floor_plan_id === planCeremony && f.status === "open"),
      JSON.stringify(flagsAfter.map((f) => ({ id: f.id, trigger: f.trigger_code, plan: f.floor_plan_id }))),
    );

    await page.waitForSelector('[data-testid="floor-plan-review-list"]', { timeout: 20_000 });
    const bannerOpen = await page.locator('[data-testid="floor-plan-review-banner"]').isVisible();
    const listItems = await page.locator('[data-testid="floor-plan-review-item"]').count();
    const emptyGone = (await page.locator('[data-testid="floor-plan-review-empty"]').count()) === 0;
    record(
      "D2_ui_shows_open_review_and_banner",
      bannerOpen && listItems >= 1 && emptyGone,
      `banner=${bannerOpen} items=${listItems} emptyGone=${emptyGone}`,
    );

    // Navigate away and back — flag remains
    await page.goto(`${APP}/events/${eventId}?tab=overview`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await gotoFloorPlans(page, eventId);
    await page.waitForSelector('[data-testid="floor-plan-review-list"]', { timeout: 20_000 });
    const afterNav = await page.locator('[data-testid="floor-plan-review-item"]').count();
    record("D3_review_visible_after_navigation", afterNav >= 1, `items=${afterNav}`);

    const { data: planBeforeClear } = await admin
      .from("floor_plans")
      .select("id,space_id,shared_with_couple,client_access,client_layout_status")
      .eq("id", planCeremony)
      .single();
    const { data: eventBeforeClear } = await admin
      .from("events")
      .select("operational_floor_plan_id,couple_selected_floor_plan_id,seating_in_use_floor_plan_id")
      .eq("id", eventId)
      .single();

    await page.locator('[data-testid="floor-plan-review-clear"]').first().click();
    await page.waitForSelector('[data-testid="floor-plan-review-empty"]', { timeout: 20_000 });
    const bannerAfterClear = await page.locator('[data-testid="floor-plan-review-banner"]').count();
    const flagsCleared = await openFlags(eventId);
    record(
      "D4_clear_removes_from_ui_and_persist",
      flagsCleared.length === 0 && bannerAfterClear === 0,
      `openFlags=${flagsCleared.length} banner=${bannerAfterClear}`,
    );

    const { data: planAfterClear } = await admin
      .from("floor_plans")
      .select("id,space_id,shared_with_couple,client_access,client_layout_status")
      .eq("id", planCeremony)
      .single();
    const { data: eventAfterClear } = await admin
      .from("events")
      .select("operational_floor_plan_id,couple_selected_floor_plan_id,seating_in_use_floor_plan_id")
      .eq("id", eventId)
      .single();
    record(
      "D5_clear_does_not_mutate_layout_access_seating",
      planBeforeClear?.space_id === planAfterClear?.space_id
        && planBeforeClear?.shared_with_couple === planAfterClear?.shared_with_couple
        && planBeforeClear?.client_access === planAfterClear?.client_access
        && planBeforeClear?.client_layout_status === planAfterClear?.client_layout_status
        && eventBeforeClear?.operational_floor_plan_id === eventAfterClear?.operational_floor_plan_id
        && eventBeforeClear?.couple_selected_floor_plan_id === eventAfterClear?.couple_selected_floor_plan_id
        && eventBeforeClear?.seating_in_use_floor_plan_id === eventAfterClear?.seating_in_use_floor_plan_id,
      JSON.stringify({ planBeforeClear, planAfterClear, eventBeforeClear, eventAfterClear }),
    );
    await page.screenshot({ path: `${OUT}/shots/venue-after-clear-1280.png`, fullPage: false });

    // ── Scenario A: venue setups + couple portal selection ──────────────────
    const setupPanel = page.locator('[data-testid="floor-plan-setup-package"]');
    await setupPanel.waitFor({ state: "visible", timeout: 20_000 });
    const setupText = await setupPanel.innerText();
    record(
      "A1_venue_sees_required_setups",
      /Ceremony/i.test(setupText) && /Reception/i.test(setupText),
      setupText.slice(0, 400),
    );

    const token = await portalToken(clientId, eventId);
    const setupsApi = await fetch(
      `${APP}/api/portal/floor-plan-setups?token=${encodeURIComponent(token)}`,
    ).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    const apiCeremony = (setupsApi.body?.setups ?? []).find((s: { name: string }) => s.name === "Ceremony");
    const apiReception = (setupsApi.body?.setups ?? []).find((s: { name: string }) => s.name === "Reception");
    record(
      "A2_portal_api_has_setups",
      setupsApi.status === 200
        && setupsApi.body?.hasSetups === true
        && (apiCeremony?.layouts?.length ?? 0) === 1
        && (apiReception?.layouts?.length ?? 0) === 2,
      JSON.stringify(setupsApi.body).slice(0, 1200),
    );

    const portal = await context.newPage();
    await portal.goto(`${APP}/p/${token}#floor_plans`, { waitUntil: "networkidle", timeout: 90_000 });
    await portal.waitForTimeout(2500);
    await portal.getByTestId("floor-plan-wedding-setups").waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);
    const portalBody = await portal.evaluate(() => document.body?.innerText ?? "");
    const weddingSetupsCount = await portal.locator('[data-testid="floor-plan-wedding-setups"]').count();
    const packageVisible =
      weddingSetupsCount > 0
      || (/Your wedding setups/i.test(portalBody) && /Ceremony/i.test(portalBody) && /Reception/i.test(portalBody));
    record(
      "A2_couple_sees_setup_package",
      packageVisible,
      `weddingSetups=${weddingSetupsCount} body=${portalBody.slice(0, 500)}`,
    );

    // Reception preference via supported portal API (does not replace ceremony ops/seating)
    const selectRes = await fetch(`${APP}/api/portal/floor-plan-setups/select`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        setupId: s2.id,
        floorPlanId: planReceptionAlt,
      }),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    record(
      "A2b_portal_select_reception_ok",
      selectRes.status === 200 && !selectRes.body?.error,
      JSON.stringify(selectRes).slice(0, 800),
    );

    const { data: setupsAfterPref } = await admin
      .from("event_floor_plan_setups")
      .select("id,name,couple_selected_floor_plan_id,operational_floor_plan_id,seating_in_use_floor_plan_id")
      .eq("event_id", eventId);
    const cer = setupsAfterPref?.find((s) => s.id === s1.id);
    const rec = setupsAfterPref?.find((s) => s.id === s2.id);
    const { data: eventAfterPref } = await admin
      .from("events")
      .select("operational_floor_plan_id,couple_selected_floor_plan_id,seating_in_use_floor_plan_id")
      .eq("id", eventId)
      .single();
    record(
      "A3_preference_does_not_replace_working_or_seating",
      cer?.operational_floor_plan_id === planCeremony
        && cer?.seating_in_use_floor_plan_id === planCeremony
        && rec?.couple_selected_floor_plan_id === planReceptionAlt
        && rec?.operational_floor_plan_id === planReception
        && eventAfterPref?.operational_floor_plan_id === planCeremony,
      JSON.stringify({ cer, rec, eventAfterPref }),
    );
    await portal.screenshot({ path: `${OUT}/shots/portal-setups-1280.png`, fullPage: false });

    // ── Scenario B: before/after link + unlink ──────────────────────────────
    await gotoFloorPlans(page, eventId);
    await page.waitForSelector('[data-testid="floor-plan-flip-panel"]', { timeout: 30_000 });
    await page.click('[data-testid="floor-plan-flip-toggle"]');
    await page.waitForSelector('[data-testid="floor-plan-flip-form"]', { timeout: 15_000 });
    await page.selectOption('[data-testid="floor-plan-flip-before"]', planCeremony);
    await page.selectOption('[data-testid="floor-plan-flip-after"]', planReception);
    const notes = page.locator('[data-testid="floor-plan-flip-notes-draft"]');
    if ((await notes.count()) > 0) {
      await notes.fill("Move cocktail furniture after ceremony.");
    }
    await page.click('[data-testid="floor-plan-flip-link"]');
    await page.waitForSelector('[data-testid="floor-plan-flip-linked"]', {
      timeout: 20_000,
    }).catch(() => undefined);
    await page.waitForTimeout(1000);
    const { data: flips } = await admin
      .from("event_floor_plan_flips")
      .select("*")
      .eq("event_id", eventId);
    record(
      "B1_flip_linked_persist",
      (flips ?? []).some(
        (f) => f.before_floor_plan_id === planCeremony && f.after_floor_plan_id === planReception,
      ),
      JSON.stringify(flips ?? []),
    );
    const flipUi = await page.locator('[data-testid="floor-plan-flip-panel"]').innerText();
    record(
      "B2_venue_understands_link",
      /before|after|Ceremony|Reception|transition|link/i.test(flipUi),
      flipUi.slice(0, 400),
    );

    const { data: plansBeforeUnlink } = await admin
      .from("floor_plans")
      .select("id")
      .eq("event_id", eventId);
    await page.click('[data-testid="floor-plan-flip-unlink"]').catch(async () => {
      await page.getByRole("button", { name: /Unlink/i }).click();
    });
    await page.waitForTimeout(1500);
    const { data: flipsAfter } = await admin
      .from("event_floor_plan_flips")
      .select("id")
      .eq("event_id", eventId);
    const { data: plansAfterUnlink } = await admin
      .from("floor_plans")
      .select("id")
      .eq("event_id", eventId);
    const { data: objs } = await admin
      .from("floor_plan_objects")
      .select("id")
      .in("floor_plan_id", [planCeremony, planReception, planReceptionAlt]);
    record(
      "B3_unlink_preserves_layouts",
      (flipsAfter ?? []).length === 0
        && (plansAfterUnlink ?? []).length === (plansBeforeUnlink ?? []).length
        && (plansAfterUnlink ?? []).length >= 3
        && (objs ?? []).length > 0,
      `flips=${(flipsAfter ?? []).length} plans=${(plansAfterUnlink ?? []).length} objs=${(objs ?? []).length}`,
    );
    await page.screenshot({ path: `${OUT}/shots/venue-flip-unlinked-1280.png`, fullPage: false });

    // ── Scenario C: furniture placement submit → venue review labels ────────
    await admin
      .from("floor_plans")
      .update({
        client_layout_status: "submitted",
        client_submitted_at: new Date().toISOString(),
        couple_may_add_tables: true,
        shared_with_couple: true,
        client_access: "view",
      })
      .eq("id", planCeremony);
    await admin
      .from("events")
      .update({ couple_selected_floor_plan_id: planCeremony })
      .eq("id", eventId);

    await gotoFloorPlans(page, eventId);
    await page.waitForSelector('[data-testid="floor-plan-client-submission-review"]', { timeout: 30_000 });
    const submitPanel = await page.locator('[data-testid="floor-plan-client-submission-review"]').innerText();
    const submittedBadge = await page.locator('[data-testid="floor-plan-card-submitted"]').count();
    record(
      "C1_furniture_submit_distinct_from_preference",
      /Furniture placement submitted/i.test(submitPanel)
        && /not the same as approving their layout preference/i.test(submitPanel)
        && submittedBadge > 0,
      `badge=${submittedBadge} panel=${submitPanel.slice(0, 350)}`,
    );

    const approveBtn = page.locator('[data-testid="floor-plan-approve-submission"]');
    await approveBtn.waitFor({ state: "visible", timeout: 15_000 });
    await approveBtn.click();
    let afterApprove: { client_layout_status: string; space_id: string | null; shared_with_couple: boolean } | null = null;
    for (let i = 0; i < 20; i++) {
      const { data } = await admin
        .from("floor_plans")
        .select("client_layout_status,space_id,shared_with_couple")
        .eq("id", planCeremony)
        .single();
      afterApprove = data;
      if (data?.client_layout_status === "approved") break;
      await page.waitForTimeout(500);
    }
    await gotoFloorPlans(page, eventId);
    await page.waitForSelector('[data-testid="floor-plan-card-furniture-approved"]', { timeout: 20_000 }).catch(() => undefined);
    const furnitureApprovedAfter = await page.locator('[data-testid="floor-plan-card-furniture-approved"]').count();
    const stillPreference = await page.locator('[data-testid="floor-plan-card-couple-preference"]').count();
    const legacyClientApprovedAfter = await page.locator("text=Client approved").count();
    record(
      "C2_approve_furniture_label_and_persist",
      afterApprove?.client_layout_status === "approved"
        && furnitureApprovedAfter > 0
        && stillPreference > 0
        && legacyClientApprovedAfter === 0,
      JSON.stringify({ afterApprove, furnitureApprovedAfter, stillPreference, legacyClientApprovedAfter }),
    );

    // ── Scenario E: return visit handoffs ───────────────────────────────────
    await gotoFloorPlans(page, eventId);
    const statusBox = await page.locator('[data-testid="floor-plan-selection-status"]').innerText();
    const nextAfterApprove = await page.locator('[data-testid="floor-plan-next-mark-ready-after-approve"]').count();
    const furnitureBadge = await page.locator('[data-testid="floor-plan-card-furniture-approved"]').count();
    const preferenceBadgeE = await page.locator('[data-testid="floor-plan-card-couple-preference"]').count();
    record(
      "E1_venue_next_action_clear_after_furniture_approve",
      (nextAfterApprove > 0 || /Furniture layout is approved/i.test(statusBox))
        && furnitureBadge > 0
        && preferenceBadgeE > 0
        && /preference/i.test(statusBox),
      `nextAfterApprove=${nextAfterApprove} furnitureBadge=${furnitureBadge} preferenceBadge=${preferenceBadgeE} status=${statusBox.slice(0, 400)}`,
    );
    await portal.goto(`${APP}/p/${token}#floor_plans`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await portal.waitForTimeout(1500);
    const portalAfter = await portal.evaluate(() => document.body?.innerText ?? "");
    record(
      "E2_couple_not_told_false_completion",
      !/venue approved your preference and started seating/i.test(portalAfter),
      portalAfter.slice(0, 400),
    );
    await page.screenshot({ path: `${OUT}/shots/venue-handoff-1280.png`, fullPage: false });
    await portal.screenshot({ path: `${OUT}/shots/portal-handoff-1280.png`, fullPage: false });

    await portal.close();
  } catch (err) {
    record("harness_error", false, errDetail(err));
    try {
      await page.screenshot({ path: `${OUT}/shots/harness-error.png`, fullPage: true });
    } catch {
      /* ignore */
    }
  } finally {
    try {
      await cleanup(createdEventIds, createdClientIds);
      record("cleanup", true, `events=${createdEventIds.length}`);
    } catch (err) {
      record("cleanup", false, errDetail(err));
    }
    await browser.close();
  }

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  const results = {
    run: RUN,
    expectedSha: EXPECTED,
    servingImage: image,
    passed,
    failed,
    checks,
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(results, null, 2));
  writeFileSync(
    `${OUT}/persisted-state.json`,
    JSON.stringify({ run: RUN, prefix: PREFIX, note: "fixtures cleaned after run" }, null, 2),
  );
  console.log(`\nSUMMARY passed=${passed} failed=${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
