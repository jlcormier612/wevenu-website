/**
 * Sandbox: client portal multi-offer floor-plan selection E2E.
 * Selects the SECOND offered layout; proves DB + reload + operational reconcile + isolation.
 * Fancy only. No Production. No real invites/emails/payments.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomBytes } from "node:crypto";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const JEN = "67458154-e6fe-41e3-830e-ea39844e4e19";
const SPACE = "3b36ec69-b17d-4351-8186-68d96dd6dfe7"; // Fancy Barn
const TPL_A = "3d4e11ef-7de7-495b-8fc7-b2eaf59584c3"; // Barn-master-floorplan
const TPL_B = "026fb633-2dce-4c73-87c8-144bb29a0318"; // Reception Only — select this (second)
const EXPECTED_SHA = process.env.EXPECTED_SHA ?? "REPLACE_AFTER_DEPLOY";
const OUT = "docs/qa/booking-to-portal-simplification";
const FIXTURE = "PortalFloorSelect";
const CLIENT_COOKIE = "sb-wvpsldwwjqdannqasrdf-client-auth-token";
const PASSWORD = "TempPortalFloorSelect1!";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 700) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 280)}`);
}

async function cleanup(email?: string) {
  const { data: clients } = await admin.from("clients").select("id, lead_id").eq("venue_id", FANCY).eq("first_name", FIXTURE);
  for (const client of clients ?? []) {
    const { data: events } = await admin.from("events").select("id").eq("client_id", client.id);
    for (const event of events ?? []) {
      const { data: plans } = await admin.from("floor_plans").select("id").eq("event_id", event.id);
      for (const plan of plans ?? []) {
        await admin.from("guest_seat_assignments").delete().eq("floor_plan_id", plan.id);
        await admin.from("floor_plan_objects").delete().eq("floor_plan_id", plan.id);
      }
      // couple_guests are client-scoped; cleaned with client delete below
      await admin.from("event_floor_plan_offers").delete().eq("event_id", event.id);
      await admin.from("floor_plans").delete().eq("event_id", event.id);
      await admin.from("events").delete().eq("id", event.id);
    }
    await admin.from("client_portal_sessions").delete().eq("client_id", client.id);
    await admin.from("couple_guests").delete().eq("client_id", client.id);
    await admin.from("clients").delete().eq("id", client.id);
    if (client.lead_id) await admin.from("leads").delete().eq("id", client.lead_id);
  }
  if (email) {
    const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const user = listed?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user) await admin.auth.admin.deleteUser(user.id);
  }
}

async function passLegalWelcome(page: {
  locator: (s: string) => { isVisible: (o?: object) => Promise<boolean> };
  getByRole: (role: string, opts?: object) => {
    isVisible: (o?: object) => Promise<boolean>;
    click: (o?: object) => Promise<void>;
    check: (o?: object) => Promise<void>;
    innerText: () => Promise<string>;
  };
  waitForTimeout: (ms: number) => Promise<void>;
}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const welcome = page.locator('[data-welcome-experience="true"]');
    if (!(await welcome.isVisible().catch(() => false))) return;
    const agree = page.getByRole("checkbox");
    if (await agree.isVisible().catch(() => false)) {
      await agree.check({ force: true }).catch(async () => { await agree.click({ force: true }); });
    }
    const cont = page.getByRole("button", { name: /^(Continue|Saving)/i });
    if (await cont.isVisible().catch(() => false)) {
      const label = await cont.innerText().catch(() => "");
      if (/Continue/i.test(label)) await cont.click().catch(() => undefined);
    }
    await page.waitForTimeout(2000);
  }
}

async function main() {
  const stamp = Date.now();
  const tag = `${FIXTURE}-${stamp}-${randomBytes(2).toString("hex")}`;
  const email = `portal-floor-select-${stamp}@hellotocheers-test.invalid`;
  const eventDate = `2071-${String((stamp % 12) + 1).padStart(2, "0")}-${String((stamp % 28) + 1).padStart(2, "0")}`;
  let servingSha: string | null = null;
  let eventId: string | null = null;
  let clientId: string | null = null;
  let offerA: string | null = null;
  let offerB: string | null = null;
  let planA: string | null = null;
  let planB: string | null = null;
  let seatMarkerId: string | null = null;
  let otherEventId: string | null = null;
  let otherOffersBefore = 0;
  let libTplBefore = 0;
  let libObjBefore = 0;

  await cleanup();

  try {
    const loginHtml = await fetch(`${APP}/login`).then((r) => r.text());
    servingSha = (loginHtml.match(/dpl=([a-f0-9]{40})/) ?? [])[1]
      ?? (loginHtml.match(/data-dpl-id="([a-f0-9]{40})"/) ?? [])[1]
      ?? null;
    record(
      "serving_sha",
      !!servingSha && servingSha.startsWith(EXPECTED_SHA.slice(0, 8)),
      `serving=${servingSha} expected=${EXPECTED_SHA}`,
    );
    if (!servingSha?.startsWith(EXPECTED_SHA.slice(0, 8))) {
      throw new Error(`serving ${servingSha}, expected ${EXPECTED_SHA}`);
    }

    const { data: otherEv } = await admin
      .from("events")
      .select("id")
      .eq("venue_id", FANCY)
      .not("booked_at", "is", null)
      .limit(1)
      .maybeSingle();
    otherEventId = otherEv?.id ?? null;
    if (otherEventId) {
      otherOffersBefore = (await admin
        .from("event_floor_plan_offers")
        .select("id", { count: "exact", head: true })
        .eq("event_id", otherEventId)
        .eq("venue_id", FANCY)).count ?? 0;
    }
    libTplBefore = (await admin
      .from("floor_plan_templates")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY)
      .eq("is_archived", false)).count ?? 0;
    libObjBefore = (await admin
      .from("floor_plan_template_objects")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY)).count ?? 0;

    const { data: relId, error: relErr } = await admin.rpc("find_or_create_relationship", {
      p_venue_id: FANCY, p_email: email, p_first_name: FIXTURE, p_last_name: "Proof",
    });
    if (relErr || !relId) throw relErr ?? new Error("rel");

    const { data: lead, error: leadErr } = await admin.from("leads").insert({
      venue_id: FANCY, relationship_id: relId, first_name: FIXTURE, last_name: "Proof",
      email, event_type: "wedding", event_date: eventDate, guest_count: 80,
      status: "active", sales_stage: "proposal_sent", assigned_staff_id: JEN,
      planned_event_space_id: SPACE,
    }).select("id").single();
    if (leadErr || !lead) throw leadErr ?? new Error("lead");

    const { data: client, error: clientErr } = await admin.from("clients").insert({
      venue_id: FANCY, lead_id: lead.id, first_name: FIXTURE, last_name: "Proof",
      email, status: "booking", event_type: "wedding", event_date: eventDate,
      relationship_id: relId, lifecycle_booked_at: new Date().toISOString(),
    }).select("id").single();
    if (clientErr || !client) throw clientErr ?? new Error("client");
    clientId = client.id;

    const { data: event, error: eventErr } = await admin.from("events").insert({
      venue_id: FANCY, client_id: client.id, name: `${tag} Wedding`,
      event_type: "wedding", event_date: eventDate, start_time: "16:00", end_time: "22:00",
      guest_count: 80, status: "confirmed", space_id: SPACE, assigned_staff_id: JEN,
      booked_at: new Date().toISOString(),
    }).select("id").single();
    if (eventErr || !event) throw eventErr ?? new Error("event");
    eventId = event.id;

    // Two distinct active offers (A first / preferred, B second — client must pick B)
    const { data: oA, error: oAErr } = await admin.from("event_floor_plan_offers").insert({
      venue_id: FANCY, event_id: eventId, floor_plan_template_id: TPL_A,
      is_offered: true, couple_label: "Layout Option A — Barn", sort_order: 0,
    }).select("id").single();
    if (oAErr || !oA) throw oAErr ?? new Error("offer A");
    offerA = oA.id;
    const { data: oB, error: oBErr } = await admin.from("event_floor_plan_offers").insert({
      venue_id: FANCY, event_id: eventId, floor_plan_template_id: TPL_B,
      is_offered: true, couple_label: "Layout Option B — Reception Only", sort_order: 1,
    }).select("id").single();
    if (oBErr || !oB) throw oBErr ?? new Error("offer B");
    offerB = oB.id;

    // Initialize working layout from preferred (A) via ensure path used by product
    const { data: tplA } = await admin.from("floor_plan_templates").select("*").eq("id", TPL_A).single();
    if (!tplA) throw new Error("template A missing");
    const { data: planARow, error: planAErr } = await admin.from("floor_plans").insert({
      venue_id: FANCY, event_id: eventId, name: "Working — Barn",
      space_id: tplA.space_id ?? SPACE,
      background_image_url: tplA.background_image_url,
      background_image_opacity: tplA.background_image_opacity,
      room_width_ft: tplA.room_width_ft, room_depth_ft: tplA.room_depth_ft,
      measurement_unit: tplA.measurement_unit,
      source_template_id: TPL_A, shared_with_couple: false, client_access: "hidden",
    }).select("id").single();
    if (planAErr || !planARow) throw planAErr ?? new Error("plan A");
    planA = planARow.id;

    const { data: tplObjs } = await admin
      .from("floor_plan_template_objects")
      .select("object_type,label,capacity,x,y,width,height,rotation,sort_order,inventory_item_id,color,notes,locked,display_shape")
      .eq("template_id", TPL_A)
      .order("sort_order")
      .limit(5);
    if (tplObjs?.length) {
      await admin.from("floor_plan_objects").insert(
        tplObjs.map((o) => ({ ...o, venue_id: FANCY, floor_plan_id: planA })),
      );
    }

    await admin.from("events").update({
      operational_floor_plan_id: planA,
      couple_selected_floor_plan_id: null,
    }).eq("id", eventId).eq("venue_id", FANCY);

    // Seating marker on plan A — must survive selection of B (retarget pointers only)
    const { data: guest, error: gErr } = await admin.from("couple_guests").insert({
      venue_id: FANCY,
      client_id: clientId,
      first_name: "Seat",
      last_name: "Marker",
      rsvp_status: "attending",
      notes: "portal-multi-offer-seat-fixture",
      sort_order: 1,
    }).select("id").single();
    if (gErr || !guest) throw gErr ?? new Error("guest");
    const { data: tableObj } = await admin
      .from("floor_plan_objects")
      .select("id")
      .eq("floor_plan_id", planA)
      .limit(1)
      .maybeSingle();
    if (tableObj?.id) {
      const { data: seat, error: sErr } = await admin.from("guest_seat_assignments").insert({
        floor_plan_id: planA,
        guest_id: guest.id,
        table_object_id: tableObj.id,
      }).select("id").single();
      if (!sErr && seat) seatMarkerId = seat.id;
    }
    record(
      "fixture_two_offers_and_working_layout_a",
      Boolean(offerA && offerB && planA),
      JSON.stringify({ offerA, offerB, planA, seatMarkerId }),
    );

    const invitesBefore = (await admin
      .from("client_invitations")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY)
      .eq("client_id", clientId)).count ?? 0;

    const token = `pfloor_${stamp}_${randomBytes(3).toString("hex")}`;
    const { error: sessErr } = await admin.from("client_portal_sessions").insert({
      venue_id: FANCY,
      client_id: clientId,
      access_token: token,
      access_level: "couple",
      label: "Portal floor multi-offer proof",
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    });
    if (sessErr) throw sessErr;

    const { error: createErr } = await admin.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true,
    });
    if (createErr && !/already/i.test(createErr.message)) throw createErr;

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    try {
      let session = (await anon.auth.signInWithPassword({ email, password: PASSWORD })).data.session;
      if (!session) {
        const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email });
        const verified = await anon.auth.verifyOtp({
          type: "email",
          token_hash: linkData!.properties!.hashed_token!,
        });
        session = verified.data.session;
      }
      if (!session) throw new Error("couple session");
      const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(session));
      await context.addCookies(
        ssrUtils.createChunks(CLIENT_COOKIE, encoded).map((c: { name: string; value: string }) => ({
          name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/",
          httpOnly: false, secure: true, sameSite: "Lax" as const,
        })),
      );

      await page.goto(`${APP}/p/${token}#floor_plans`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(1500);
      await passLegalWelcome(page);
      await page.goto(`${APP}/p/${token}#floor_plans`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(2000);

      await page.waitForSelector("text=Choose your layout", { timeout: 30_000 });
      const body = await page.locator("body").innerText();
      record(
        "portal_shows_two_layout_options",
        /Layout Option A — Barn/i.test(body) && /Layout Option B — Reception Only/i.test(body),
        body.match(/Layout Option [AB][^\n]*/g)?.join(" | ") ?? body.slice(0, 300),
      );
      await page.screenshot({ path: `${OUT}/portal-multi-offer-chooser-1280.png`, fullPage: true }).catch(() => undefined);

      // Select the SECOND option (B), not the default first
      const optionB = page.getByRole("button", { name: /Layout Option B — Reception Only/i }).first();
      await optionB.click();
      await page.waitForTimeout(800);
      const chooseBtn = page.getByRole("button", { name: /Choose this layout/i });
      await chooseBtn.waitFor({ state: "visible", timeout: 10_000 });
      await chooseBtn.click();
      for (let i = 0; i < 30; i += 1) {
        await page.waitForTimeout(400);
        const { data: ev } = await admin
          .from("events")
          .select("couple_selected_floor_plan_id,operational_floor_plan_id")
          .eq("id", eventId!)
          .single();
        if (ev?.couple_selected_floor_plan_id && ev.couple_selected_floor_plan_id !== planA) {
          planB = ev.couple_selected_floor_plan_id;
          break;
        }
      }
      record(
        "portal_select_second_persists_db",
        Boolean(planB) && planB !== planA,
        JSON.stringify({ planA, planB }),
      );

      const { data: evAfter } = await admin
        .from("events")
        .select("couple_selected_floor_plan_id,operational_floor_plan_id")
        .eq("id", eventId!)
        .single();
      record(
        "operational_matches_couple_selection",
        evAfter?.couple_selected_floor_plan_id === planB
          && evAfter?.operational_floor_plan_id === planB,
        JSON.stringify(evAfter),
      );

      const { data: selectedPlan } = await admin
        .from("floor_plans")
        .select("id,name,source_template_id,event_id,shared_with_couple,client_access")
        .eq("id", planB!)
        .maybeSingle();
      record(
        "selected_layout_is_real_plan_for_template_b",
        selectedPlan?.source_template_id === TPL_B
          && selectedPlan?.event_id === eventId,
        JSON.stringify(selectedPlan),
      );
      record(
        "select_shares_layout_and_seating",
        selectedPlan?.shared_with_couple === true
          && selectedPlan?.client_access === "view",
        JSON.stringify({
          shared_with_couple: selectedPlan?.shared_with_couple,
          client_access: selectedPlan?.client_access,
        }),
      );

      await page.waitForSelector("text=Your Floor Plan", { timeout: 20_000 }).catch(() => undefined);
      const afterSelectBody = await page.locator("body").innerText();
      record(
        "portal_shows_working_layout_after_select",
        /Your Floor Plan/i.test(afterSelectBody),
        afterSelectBody.match(/Your Floor Plan|Your choice|Ready|Seating is available/gi)?.join(" | ") ?? afterSelectBody.slice(0, 240),
      );
      await page.screenshot({ path: `${OUT}/portal-multi-offer-selected-b-1280.png`, fullPage: true }).catch(() => undefined);

      // Reload / fresh navigation — selection sticks
      await page.goto(`${APP}/p/${token}#floor_plans`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(2000);
      await page.waitForSelector("text=Choose your layout", { timeout: 20_000 });
      const afterReload = await page.locator("body").innerText();
      record(
        "portal_selection_survives_reload",
        /Your choice/i.test(afterReload) && /Layout Option B — Reception Only/i.test(afterReload),
        afterReload.match(/Layout Option B[^\n]*|Your choice/gi)?.join(" | ") ?? afterReload.slice(0, 240),
      );
      record(
        "portal_working_layout_survives_reload",
        /Your working layout/i.test(afterReload),
        afterReload.match(/Your working layout[^\n]*/gi)?.join(" | ") ?? afterReload.slice(0, 200),
      );
      await page.screenshot({ path: `${OUT}/portal-multi-offer-reload-1280.png`, fullPage: true }).catch(() => undefined);

      // Repeat selection of B — no duplicate clones for template B
      const optionB2 = page.getByRole("button", { name: /Layout Option B — Reception Only/i }).first();
      await optionB2.click();
      await page.waitForTimeout(400);
      const chooseAgain = page.getByRole("button", { name: /Selected|Choose this layout/i });
      if (await chooseAgain.isEnabled().catch(() => false)) {
        const label = await chooseAgain.innerText();
        if (/Choose this layout/i.test(label)) await chooseAgain.click();
      }
      await page.waitForTimeout(1500);
      const plansForB = (await admin
        .from("floor_plans")
        .select("id")
        .eq("event_id", eventId!)
        .eq("venue_id", FANCY)
        .eq("source_template_id", TPL_B)).data ?? [];
      record(
        "repeat_select_no_duplicate_b_plans",
        plansForB.length === 1,
        JSON.stringify(plansForB),
      );

      // Prior plan A + seating retained
      const { count: planAStill } = await admin
        .from("floor_plans")
        .select("id", { count: "exact", head: true })
        .eq("id", planA!);
      let seatStill = true;
      if (seatMarkerId) {
        const { count } = await admin
          .from("guest_seat_assignments")
          .select("id", { count: "exact", head: true })
          .eq("id", seatMarkerId)
          .eq("floor_plan_id", planA!);
        seatStill = (count ?? 0) === 1;
      }
      record(
        "prior_working_layout_and_seating_retained",
        (planAStill ?? 0) === 1 && seatStill,
        JSON.stringify({ planAStill, seatMarkerId, seatStill }),
      );

      // Idempotent plan count for event (A + B only)
      const { count: eventPlans } = await admin
        .from("floor_plans")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId!)
        .eq("venue_id", FANCY);
      record(
        "event_has_exactly_two_plans_after_select",
        (eventPlans ?? 0) === 2,
        `eventPlans=${eventPlans}`,
      );

      if (otherEventId) {
        const otherOffersAfter = (await admin
          .from("event_floor_plan_offers")
          .select("id", { count: "exact", head: true })
          .eq("event_id", otherEventId)
          .eq("venue_id", FANCY)).count ?? 0;
        record(
          "other_booking_offers_unchanged",
          otherOffersAfter === otherOffersBefore,
          `before=${otherOffersBefore} after=${otherOffersAfter}`,
        );
      } else {
        record("other_booking_offers_unchanged", true, "no other booked event");
      }

      const libTplAfter = (await admin
        .from("floor_plan_templates")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", FANCY)
        .eq("is_archived", false)).count ?? 0;
      const libObjAfter = (await admin
        .from("floor_plan_template_objects")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", FANCY)).count ?? 0;
      record(
        "library_templates_unchanged",
        libTplAfter === libTplBefore && libObjAfter === libObjBefore,
        `tpl ${libTplBefore}->${libTplAfter} obj ${libObjBefore}->${libObjAfter}`,
      );

      const invitesAfter = (await admin
        .from("client_invitations")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", FANCY)
        .eq("client_id", clientId!)).count ?? 0;
      record(
        "no_invitation_side_effect",
        invitesAfter === invitesBefore,
        `before=${invitesBefore} after=${invitesAfter}`,
      );

      const { count: qSent } = await admin
        .from("event_questionnaires")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId!)
        .eq("status", "sent");
      record("no_questionnaire_send_side_effect", (qSent ?? 0) === 0, `sent=${qSent}`);

      const { count: invoices } = await admin
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId!);
      record("no_invoice_side_effect", (invoices ?? 0) === 0, `invoices=${invoices}`);
    } finally {
      await browser.close();
    }
  } catch (err) {
    const detail = err instanceof Error
      ? err.message
      : (typeof err === "object" && err && "message" in err
        ? String((err as { message: unknown }).message)
        : JSON.stringify(err));
    record("harness_error", false, detail);
  } finally {
    // Keep fixture for evidence unless GREEN — still clean disposable auth user
    await cleanup(email).catch(() => undefined);
    const failed = checks.filter((c) => !c.pass).length;
    const passed = checks.filter((c) => c.pass).length;
    const payload = {
      workflow: "floor-plans-portal-multi-offer-selection",
      status: failed === 0 ? "GREEN" : "NOT_GREEN",
      expectedSha: EXPECTED_SHA,
      servingSha,
      ids: { eventId, clientId, offerA, offerB, planA, planB, seatMarkerId, tag },
      passed,
      failed,
      checks,
    };
    writeFileSync(`${OUT}/portal-multi-offer-selection-results.json`, JSON.stringify(payload, null, 2));
    console.log(JSON.stringify({ passed, failed, servingSha, eventId, planB, status: payload.status }, null, 2));
    process.exitCode = failed === 0 ? 0 : 1;
  }
}

main();
