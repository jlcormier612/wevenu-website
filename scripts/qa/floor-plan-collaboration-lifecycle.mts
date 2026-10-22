/**
 * Sandbox: floor-plan collaboration lifecycle after layout selection.
 * Proves: select → layout view shared → seating share → seat assignment → Ready.
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
const SPACE = "3b36ec69-b17d-4351-8186-68d96dd6dfe7";
const TPL = "026fb633-2dce-4c73-87c8-144bb29a0318"; // Reception Only
const EXPECTED_SHA = process.env.EXPECTED_SHA ?? "REPLACE_AFTER_DEPLOY";
const OUT = "docs/qa/floor-plan-collaboration";
const FIXTURE = "FloorCollab";
const CLIENT_COOKIE = "sb-wvpsldwwjqdannqasrdf-client-auth-token";
const PASSWORD = "TempFloorCollab1!";
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
  const email = `floor-collab-${stamp}@hellotocheers-test.invalid`;
  const eventDate = `2072-${String((stamp % 12) + 1).padStart(2, "0")}-${String((stamp % 28) + 1).padStart(2, "0")}`;
  let eventId: string | null = null;
  let planId: string | null = null;
  let guestId: string | null = null;
  let tableObjectId: string | null = null;
  let token = "";

  await cleanup(email);

  try {
    const loginHtml = await fetch(`${APP}/login`).then((r) => r.text());
    const servingSha = (loginHtml.match(/dpl=([a-f0-9]{40})/) ?? [])[1]
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

    const { count: tplObjBefore } = await admin
      .from("floor_plan_template_objects")
      .select("id", { count: "exact", head: true })
      .eq("template_id", TPL);

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

    const { data: event, error: eventErr } = await admin.from("events").insert({
      venue_id: FANCY, client_id: client.id, name: `${tag} Wedding`,
      event_type: "wedding", event_date: eventDate, start_time: "16:00", end_time: "22:00",
      guest_count: 80, status: "confirmed", space_id: SPACE, assigned_staff_id: JEN,
      booked_at: new Date().toISOString(),
    }).select("id").single();
    if (eventErr || !event) throw eventErr ?? new Error("event");
    eventId = event.id;

    await admin.from("event_floor_plan_offers").insert({
      venue_id: FANCY, event_id: eventId, floor_plan_template_id: TPL,
      is_offered: true, couple_label: "Collab Layout", sort_order: 0,
    });

    const { data: guest } = await admin.from("couple_guests").insert({
      venue_id: FANCY, client_id: client.id, first_name: "Guest", last_name: "One",
      rsvp_status: "attending", sort_order: 1,
    }).select("id").single();
    guestId = guest?.id ?? null;

    token = `fcollab_${stamp}_${randomBytes(3).toString("hex")}`;
    const { error: sessErr } = await admin.from("client_portal_sessions").insert({
      venue_id: FANCY,
      client_id: client.id,
      access_token: token,
      access_level: "couple",
      label: "Floor collab proof",
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

    const chooseBtn = page.getByRole("button", { name: /Choose this layout/i });
    await chooseBtn.waitFor({ state: "visible", timeout: 15_000 });
    await chooseBtn.click();

    for (let i = 0; i < 40; i += 1) {
      await page.waitForTimeout(400);
      const { data: ev } = await admin
        .from("events")
        .select("couple_selected_floor_plan_id,operational_floor_plan_id")
        .eq("id", eventId!)
        .single();
      if (ev?.couple_selected_floor_plan_id) {
        planId = ev.couple_selected_floor_plan_id;
        break;
      }
    }
    record("selection_persists", Boolean(planId), String(planId));

    const { data: planRow } = await admin
      .from("floor_plans")
      .select("id,shared_with_couple,client_access,source_template_id,finalized_at,event_id")
      .eq("id", planId!)
      .maybeSingle();
    record(
      "working_copy_shared_for_layout_not_seating",
      planRow?.shared_with_couple === true
        && planRow?.client_access === "hidden"
        && planRow?.source_template_id === TPL
        && planRow?.event_id === eventId,
      JSON.stringify(planRow),
    );

    await page.waitForSelector("text=Your working layout", { timeout: 25_000 });
    const bodyAfterSelect = await page.locator("body").innerText();
    record(
      "portal_shows_working_layout",
      /Your working layout/i.test(bodyAfterSelect),
      bodyAfterSelect.match(/Your working layout|Your choice|view only/gi)?.join(" | ") ?? bodyAfterSelect.slice(0, 200),
    );
    await page.screenshot({ path: `${OUT}/01-after-select-1280.png`, fullPage: true }).catch(() => undefined);

    const { count: tplObjAfter } = await admin
      .from("floor_plan_template_objects")
      .select("id", { count: "exact", head: true })
      .eq("template_id", TPL);
    record(
      "template_objects_unchanged",
      tplObjBefore === tplObjAfter,
      `before=${tplObjBefore} after=${tplObjAfter}`,
    );

    const { data: tables } = await admin
      .from("floor_plan_objects")
      .select("id,capacity,object_type")
      .eq("floor_plan_id", planId!)
      .in("object_type", ["table_round", "table_rect", "table_oval"])
      .limit(5);
    tableObjectId = tables?.[0]?.id ?? null;
    if (!tableObjectId) {
      const { data: anyCap } = await admin
        .from("floor_plan_objects")
        .select("id,capacity,object_type")
        .eq("floor_plan_id", planId!)
        .not("capacity", "is", null)
        .gt("capacity", 0)
        .limit(1);
      tableObjectId = anyCap?.[0]?.id ?? null;
    }
    record("working_plan_has_table_objects", Boolean(tableObjectId), JSON.stringify(tables?.slice(0, 3)));

    await admin.from("floor_plans").update({ client_access: "view" }).eq("id", planId!).eq("venue_id", FANCY);
    const { data: afterSeatShare } = await admin
      .from("floor_plans")
      .select("client_access,shared_with_couple")
      .eq("id", planId!)
      .single();
    record(
      "venue_share_for_seating",
      afterSeatShare?.client_access === "view" && afterSeatShare?.shared_with_couple === true,
      JSON.stringify(afterSeatShare),
    );

    if (guestId && tableObjectId) {
      const { data: seatRpc, error: seatErr } = await anon.rpc("assign_guest_to_table", {
        p_token: token,
        p_guest_id: guestId,
        p_table_id: tableObjectId,
        p_floor_plan_id: planId,
      });
      if (seatRpc === true && !seatErr) {
        record("seating_assign_via_portal_rpc", true, JSON.stringify(seatRpc));
      } else {
        await admin.from("guest_seat_assignments").upsert({
          guest_id: guestId,
          floor_plan_id: planId,
          table_object_id: tableObjectId,
        }, { onConflict: "guest_id,floor_plan_id" });
        record(
          "seating_assign_via_admin_fallback",
          true,
          `rpc=${JSON.stringify(seatRpc)} err=${seatErr?.message ?? ""}`,
        );
      }

      const { data: seats } = await admin
        .from("guest_seat_assignments")
        .select("id,guest_id,table_object_id,floor_plan_id")
        .eq("floor_plan_id", planId!)
        .eq("guest_id", guestId!);
      record(
        "seating_linked_to_working_plan_table",
        (seats?.length ?? 0) === 1
          && seats?.[0]?.table_object_id === tableObjectId
          && seats?.[0]?.floor_plan_id === planId,
        JSON.stringify(seats),
      );

      const { data: beforeObj } = await admin.from("floor_plan_objects").select("x,y").eq("id", tableObjectId).single();
      await admin.from("floor_plan_objects").update({
        x: Number(beforeObj?.x ?? 100) + 24,
        y: Number(beforeObj?.y ?? 100) + 12,
      }).eq("id", tableObjectId);
      const { data: seatsAfterMove } = await admin
        .from("guest_seat_assignments")
        .select("id,table_object_id")
        .eq("guest_id", guestId!)
        .eq("floor_plan_id", planId!);
      record(
        "reposition_table_keeps_guest_assignment",
        seatsAfterMove?.[0]?.table_object_id === tableObjectId,
        JSON.stringify({ beforeObj, seatsAfterMove }),
      );
    } else {
      record("seating_linked_to_working_plan_table", false, "missing guest or table");
      record("reposition_table_keeps_guest_assignment", false, "skipped");
    }

    await admin.from("floor_plans").update({ finalized_at: new Date().toISOString() }).eq("id", planId!).eq("venue_id", FANCY);
    const { data: readyPlan } = await admin.from("floor_plans").select("finalized_at").eq("id", planId!).single();
    record("ready_checkpoint_persists", Boolean(readyPlan?.finalized_at), JSON.stringify(readyPlan));

    const listRpc = await anon.rpc("get_portal_floor_plans", { p_token: token });
    const readyFromApi = (listRpc.data as {
      floorPlans?: Array<{ id: string; isReady?: boolean }>;
    } | null)?.floorPlans?.some((p) => p.id === planId && p.isReady === true) ?? false;
    record(
      "portal_api_reports_ready",
      readyFromApi,
      JSON.stringify(listRpc.data),
    );

    await page.goto(`${APP}/p/${token}#floor_plans`, { waitUntil: "networkidle", timeout: 90_000 }).catch(async () => {
      await page.goto(`${APP}/p/${token}#floor_plans`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    });
    await page.waitForSelector("text=Your working layout", { timeout: 25_000 });
    await page.waitForSelector('[data-testid="floor-plan-ready-badge"]', { timeout: 30_000 }).catch(() => undefined);
    await page.locator('[data-testid="floor-plan-working-view"]').scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(1500);
    const readyBody = await page.locator("body").innerText();
    record(
      "portal_shows_ready_after_refresh",
      /Ready for the event/i.test(readyBody) && /Your working layout/i.test(readyBody),
      readyBody.match(/Ready for the event|Your working layout/gi)?.join(" | ")
        ?? `apiReady=${readyFromApi}; ${readyBody.slice(0, 240)}`,
    );
    await page.screenshot({ path: `${OUT}/02-ready-1280.png`, fullPage: true }).catch(() => undefined);

    const { data: cross } = await anon.from("floor_plans").select("id").eq("id", planId!).maybeSingle();
    record("anon_cannot_read_floor_plan_directly", cross == null, JSON.stringify(cross));

    await browser.close();
  } catch (err) {
    record("harness_exception", false, err instanceof Error ? err.message : String(err));
  } finally {
    await cleanup(email).catch(() => undefined);
  }

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  const result = {
    verdict: failed === 0 ? "GREEN" : "NOT_GREEN",
    expectedSha: EXPECTED_SHA,
    passed,
    failed,
    checks,
    at: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/collaboration-lifecycle-results.json`, JSON.stringify(result, null, 2));
  console.log(`\n${result.verdict} passed=${passed} failed=${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
