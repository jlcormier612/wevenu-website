/**
 * Floor Plans Phase 3 — required setups + portal package view.
 *
 * EXPECTED_SHA=3979637b64ea341edd1aed0a1d2a7c0d8b58bbb7 \
 *   npx tsx docs/qa/floor-plans-phase3-required-setups/verify-browser.mts
 *
 * Disposable fixtures: FP3-{RUN}-* on Fancy venue only.
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
const RUN = process.env.E2E_RUN_ID ?? `FP3${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/floor-plans-phase3-required-setups";
const PREFIX = `FP3-${RUN}-`;
const FIXTURE_FIRST = "FP3Phase3";
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
  opts: { shared?: boolean; access?: string } = {},
) {
  const { data: tpl } = await admin.from("floor_plan_templates").select("*").eq("id", templateId).single();
  if (!tpl) throw new Error("tpl");
  const { data, error } = await admin
    .from("floor_plans")
    .insert({
      venue_id: FANCY,
      event_id: eventId,
      name,
      space_id: tpl.space_id ?? SPACE,
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
      notes: "fp-phase3-seat-fixture",
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
  const token = `fp3_${RUN}_${randomBytes(3).toString("hex")}`;
  const { error } = await admin.from("client_portal_sessions").insert({
    venue_id: FANCY,
    client_id: clientId,
    event_id: eventId,
    access_token: token,
    access_level: "couple",
    label: "Phase3 setups proof",
    expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
  });
  if (error) throw error;
  return token;
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  let eventId: string | null = null;
  let clientId: string | null = null;
  let leadId: string | null = null;
  let planCeremony: string | null = null;
  let planRecA: string | null = null;
  let planRecB: string | null = null;
  let setupCeremony: string | null = null;
  let setupReception: string | null = null;
  let seatSnapshot: { id: string; guest_id: string; table_object_id: string | null; floor_plan_id: string } | null =
    null;
  const createdPlanIds: string[] = [];
  const createdSetupIds: string[] = [];
  const guestIds: string[] = [];

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

    const { error: setupTableErr } = await admin.from("event_floor_plan_setups").select("id").limit(1);
    record("migration_setups_table", !setupTableErr, setupTableErr?.message ?? "ok");

    const eventDate = "2027-06-15";
    const coupleEmail = `fp3-${RUN.toLowerCase()}@example.com`;
    const fixture = await createBookedFixture(coupleEmail, eventDate);
    eventId = fixture.eventId;
    clientId = fixture.clientId;
    leadId = fixture.leadId;

    planCeremony = await insertPlan(eventId, `${PREFIX}Garden Ceremony`, TPL_A, {
      shared: true,
      access: "view",
    });
    createdPlanIds.push(planCeremony);
    planRecA = await insertPlan(eventId, `${PREFIX}Reception A`, TPL_B, { shared: true, access: "view" });
    createdPlanIds.push(planRecA);
    planRecB = await insertPlan(eventId, `${PREFIX}Reception B`, TPL_A, { shared: true, access: "view" });
    createdPlanIds.push(planRecB);

    await admin
      .from("events")
      .update({
        operational_floor_plan_id: planCeremony,
        seating_in_use_floor_plan_id: planCeremony,
      })
      .eq("id", eventId);

    const seat = await addSeat(clientId, planCeremony, "SeatGuest");
    seatSnapshot = seat;
    guestIds.push(seat.guest_id);

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
    if (s1e || !s1) throw s1e ?? new Error("setup ceremony");
    setupCeremony = s1.id;
    createdSetupIds.push(s1.id);

    const { data: s2, error: s2e } = await admin
      .from("event_floor_plan_setups")
      .insert({
        venue_id: FANCY,
        event_id: eventId,
        name: "Reception",
        sort_order: 1,
        operational_floor_plan_id: planRecA,
      })
      .select("id")
      .single();
    if (s2e || !s2) throw s2e ?? new Error("setup reception");
    setupReception = s2.id;
    createdSetupIds.push(s2.id);

    const { error: memErr } = await admin.from("event_floor_plan_setup_members").insert([
      { venue_id: FANCY, setup_id: setupCeremony, floor_plan_id: planCeremony, sort_order: 0 },
      { venue_id: FANCY, setup_id: setupReception, floor_plan_id: planRecA, sort_order: 0 },
      { venue_id: FANCY, setup_id: setupReception, floor_plan_id: planRecB, sort_order: 1 },
    ]);
    if (memErr) throw memErr;

    const persisted = {
      eventId,
      setups: (
        await admin
          .from("event_floor_plan_setups")
          .select(
            "id,name,operational_floor_plan_id,seating_in_use_floor_plan_id,couple_selected_floor_plan_id,couple_preference_status",
          )
          .eq("event_id", eventId)
          .order("sort_order")
      ).data,
      members: (
        await admin
          .from("event_floor_plan_setup_members")
          .select("setup_id,floor_plan_id,sort_order")
          .in("setup_id", [setupCeremony, setupReception])
          .order("sort_order")
      ).data,
      seatBefore: seatSnapshot,
    };
    writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify(persisted, null, 2));
    record(
      "gate1_required_setups_coexist",
      (persisted.setups?.length ?? 0) === 2
        && Boolean(persisted.setups?.some((s: { name: string }) => s.name === "Ceremony"))
        && Boolean(persisted.setups?.some((s: { name: string }) => s.name === "Reception")),
      JSON.stringify(persisted.setups),
    );
    record(
      "gate2_alts_scoped_to_reception",
      (persisted.members ?? []).filter((m: { setup_id: string }) => m.setup_id === setupReception).length === 2
        && (persisted.members ?? []).filter((m: { setup_id: string }) => m.setup_id === setupCeremony).length === 1
        && !(persisted.members ?? []).some(
          (m: { setup_id: string; floor_plan_id: string }) =>
            m.setup_id === setupCeremony && (m.floor_plan_id === planRecA || m.floor_plan_id === planRecB),
        ),
      JSON.stringify(persisted.members),
    );

    await context.addCookies(await staffCookies(FANCY));
    await page.goto(`${APP}/events/${eventId}?tab=floorplan`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/shots/01-venue-workspace-1280.png`, fullPage: true });

    const organizer = page.getByTestId("floor-plan-setup-package");
    record("venue_setup_organizer_present", (await organizer.count()) === 1, "setup package panel");
    if ((await page.getByTestId("floor-plan-setup-package-toggle").count()) > 0) {
      await page.getByTestId("floor-plan-setup-package-toggle").click();
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: `${OUT}/shots/02-venue-organizer-open-1280.png`, fullPage: true });
    const orgText = await organizer.innerText().catch(() => "");
    record(
      "venue_shows_ceremony_and_reception",
      /Ceremony/i.test(orgText) && /Reception/i.test(orgText),
      orgText.slice(0, 500),
    );
    record(
      "simple_path_controls_still_present",
      (await page.getByText(/Working layout|Additional layout|Share Floor Plan|Floor Plan/i).count()) >= 1,
      "workspace chrome",
    );

    const token = await portalToken(clientId, eventId);
    const setupsApi = await fetch(
      `${APP}/api/portal/floor-plan-setups?token=${encodeURIComponent(token)}`,
    ).then(async (r) => ({ status: r.status, body: await r.json() }));
    record(
      "portal_api_has_setups",
      setupsApi.status === 200
        && setupsApi.body?.hasSetups === true
        && Array.isArray(setupsApi.body?.setups)
        && setupsApi.body.setups.length === 2,
      JSON.stringify(setupsApi.body).slice(0, 1200),
    );
    const apiCeremony = (setupsApi.body?.setups ?? []).find(
      (s: { name: string }) => s.name === "Ceremony",
    );
    const apiReception = (setupsApi.body?.setups ?? []).find(
      (s: { name: string }) => s.name === "Reception",
    );
    record(
      "portal_api_alts_under_reception_only",
      (apiCeremony?.layouts?.length ?? 0) === 1
        && (apiReception?.layouts?.length ?? 0) === 2
        && !(apiCeremony?.layouts ?? []).some((l: { name: string }) => /Reception/i.test(l.name)),
      JSON.stringify({ apiCeremony, apiReception }).slice(0, 1200),
    );

    const couplePage = await context.newPage();
    await couplePage.goto(`${APP}/p/${token}#floor_plans`, { waitUntil: "networkidle", timeout: 90000 });
    await couplePage.waitForTimeout(2500);
    await couplePage.screenshot({ path: `${OUT}/shots/03-portal-package-1280.png`, fullPage: true });

    const weddingSetups = couplePage.getByTestId("floor-plan-wedding-setups");
    const wholeEventChooser = couplePage.getByTestId("floor-plan-choose-layout");
    record(
      "gate3_no_whole_event_false_chooser",
      (await weddingSetups.count()) === 1 && (await wholeEventChooser.count()) === 0,
      `weddingSetups=${await weddingSetups.count()} chooser=${await wholeEventChooser.count()}`,
    );
    record(
      "portal_heading_your_wedding_setups",
      (await couplePage.getByRole("heading", { name: /Your wedding setups/i }).count()) >= 1,
      "heading",
    );
    const portalText = await weddingSetups.innerText().catch(() => "");
    record(
      "portal_setups_as_one_plan",
      /Ceremony/i.test(portalText) && /Reception/i.test(portalText),
      portalText.slice(0, 600),
    );

    // Preference: Reception B via portal API — must not mutate Ceremony or ops/seating
    const selectRes = await fetch(`${APP}/api/portal/floor-plan-setups/select`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        setupId: setupReception,
        floorPlanId: planRecB,
      }),
    }).then(async (r) => ({ status: r.status, body: await r.json() }));
    record(
      "portal_select_reception_b_ok",
      selectRes.status === 200 && !selectRes.body?.error,
      JSON.stringify(selectRes),
    );

    const afterPref = (
      await admin
        .from("event_floor_plan_setups")
        .select(
          "id,name,couple_selected_floor_plan_id,couple_preference_status,operational_floor_plan_id,seating_in_use_floor_plan_id",
        )
        .eq("event_id", eventId)
    ).data;
    const cer = afterPref?.find((s: { id: string }) => s.id === setupCeremony);
    const rec = afterPref?.find((s: { id: string }) => s.id === setupReception);
    record(
      "preference_reception_does_not_change_ceremony",
      cer?.couple_selected_floor_plan_id == null
        && cer?.operational_floor_plan_id === planCeremony
        && cer?.seating_in_use_floor_plan_id === planCeremony
        && rec?.couple_selected_floor_plan_id === planRecB
        && rec?.couple_preference_status === "pending"
        && rec?.operational_floor_plan_id === planRecA,
      JSON.stringify(afterPref),
    );

    const seatsAfterPref = (
      await admin
        .from("guest_seat_assignments")
        .select("id,guest_id,table_object_id,floor_plan_id")
        .eq("id", seatSnapshot.id)
        .maybeSingle()
    ).data;
    record(
      "phase2_seats_preserved_after_preference",
      seatsAfterPref?.floor_plan_id === planCeremony
        && seatsAfterPref?.guest_id === seatSnapshot.guest_id
        && seatsAfterPref?.table_object_id === seatSnapshot.table_object_id,
      JSON.stringify({ before: seatSnapshot, after: seatsAfterPref }),
    );

    await couplePage.reload({ waitUntil: "networkidle" });
    await couplePage.waitForTimeout(2000);
    await couplePage.screenshot({ path: `${OUT}/shots/04-portal-after-pref-1280.png`, fullPage: true });
    record(
      "portal_still_package_not_whole_event_after_pref",
      (await couplePage.getByTestId("floor-plan-wedding-setups").count()) === 1
        && (await couplePage.getByTestId("floor-plan-choose-layout").count()) === 0,
      "after preference reload",
    );

    // Detach Reception B — layout + ceremony seats remain
    await admin
      .from("event_floor_plan_setup_members")
      .delete()
      .eq("setup_id", setupReception)
      .eq("floor_plan_id", planRecB);
    const planStill = (await admin.from("floor_plans").select("id,name").eq("id", planRecB).maybeSingle()).data;
    record("detach_preserves_layout_row", Boolean(planStill), JSON.stringify(planStill));
    const seatsAfterDetach = (
      await admin
        .from("guest_seat_assignments")
        .select("id,guest_id,table_object_id,floor_plan_id")
        .eq("id", seatSnapshot.id)
        .maybeSingle()
    ).data;
    record(
      "phase2_seats_preserved_after_detach",
      seatsAfterDetach?.floor_plan_id === planCeremony
        && seatsAfterDetach?.guest_id === seatSnapshot.guest_id,
      JSON.stringify(seatsAfterDetach),
    );

    // Sharing invariant: ceremony still shared; detach didn't flip share flags
    const ceremonyPlan = (
      await admin.from("floor_plans").select("id,shared_with_couple,client_access").eq("id", planCeremony).single()
    ).data;
    record(
      "phase2_sharing_preserved",
      ceremonyPlan?.shared_with_couple === true && ceremonyPlan?.client_access === "view",
      JSON.stringify(ceremonyPlan),
    );

    writeFileSync(
      `${OUT}/before-cleanup.json`,
      JSON.stringify(
        { eventId, clientId, leadId, createdPlanIds, createdSetupIds, seatSnapshot, beforeEvents },
        null,
        2,
      ),
    );
    writeFileSync(
      `${OUT}/persisted-state.json`,
      JSON.stringify(
        {
          ...persisted,
          afterPref,
          seatsAfterPref,
          seatsAfterDetach,
          ceremonyPlan,
          setupsApi: setupsApi.body,
          selectRes,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    record("harness_uncaught", false, errDetail(err));
    await page.screenshot({ path: `${OUT}/shots/error.png`, fullPage: true }).catch(() => undefined);
  } finally {
    if (seatSnapshot?.id) {
      await admin.from("guest_seat_assignments").delete().eq("id", seatSnapshot.id);
    }
    if (guestIds.length) {
      await admin.from("couple_guests").delete().in("id", guestIds).eq("venue_id", FANCY);
    }
    if (createdSetupIds.length) {
      await admin.from("event_floor_plan_setup_members").delete().in("setup_id", createdSetupIds);
      await admin.from("event_floor_plan_setups").delete().in("id", createdSetupIds);
    }
    if (createdPlanIds.length) {
      await admin.from("floor_plan_objects").delete().in("floor_plan_id", createdPlanIds);
      await admin.from("floor_plans").delete().in("id", createdPlanIds).eq("venue_id", FANCY);
    }
    if (eventId) {
      await admin.from("client_portal_sessions").delete().eq("event_id", eventId);
      await admin.from("events").delete().eq("id", eventId).eq("venue_id", FANCY);
    }
    if (clientId) {
      await admin.from("clients").delete().eq("id", clientId).eq("venue_id", FANCY);
    }
    if (leadId) {
      await admin.from("leads").delete().eq("id", leadId).eq("venue_id", FANCY);
    }
    const leftoverSetups = (
      await admin
        .from("event_floor_plan_setups")
        .select("id,name")
        .eq("venue_id", FANCY)
        .ilike("name", `${PREFIX}%`)
    ).data ?? [];
    // setups use Ceremony/Reception names — also check by event leftovers via plan name prefix
    const leftoverPlans = (
      await admin.from("floor_plans").select("id,name").eq("venue_id", FANCY).ilike("name", `${PREFIX}%`)
    ).data ?? [];
    const leftoverClients = (
      await admin
        .from("clients")
        .select("id")
        .eq("venue_id", FANCY)
        .eq("first_name", FIXTURE_FIRST)
        .eq("last_name", RUN)
    ).data ?? [];
    const afterEvents = (
      await admin.from("events").select("id", { count: "exact", head: true }).eq("venue_id", FANCY)
    ).count;
    writeFileSync(
      `${OUT}/after-cleanup.json`,
      JSON.stringify(
        { leftoverSetups, leftoverPlans, leftoverClients, afterEvents, beforeEvents },
        null,
        2,
      ),
    );
    record(
      "cleanup_complete",
      leftoverPlans.length === 0 && leftoverClients.length === 0 && afterEvents === beforeEvents,
      `plans=${leftoverPlans.length} clients=${leftoverClients.length} events ${beforeEvents}->${afterEvents}`,
    );
    await browser.close();
    const pass = checks.filter((c) => c.pass).length;
    const fail = checks.filter((c) => !c.pass).length;
    writeFileSync(
      `${OUT}/browser-results.json`,
      JSON.stringify({ expectedSha: EXPECTED, pass, fail, checks }, null, 2),
    );
    console.log(`\n${fail === 0 ? "GREEN" : "NOT GREEN"} — ${pass} pass / ${fail} fail`);
    process.exit(fail === 0 ? 0 : 1);
  }
}

main().catch((err) => {
  console.error(errDetail(err));
  process.exit(1);
});
