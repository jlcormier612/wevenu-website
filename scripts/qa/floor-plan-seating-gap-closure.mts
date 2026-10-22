/**
 * Sandbox E2E: floor-plan & seating functionality gap closure (catalog, qty,
 * dimensions, fidelity, capacity, isolation). Fancy only. No Production.
 *
 * Scenarios A–F from the gap-closure brief.
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
const TPL_A = "026fb633-2dce-4c73-87c8-144bb29a0318";
const EXPECTED_SHA = process.env.EXPECTED_SHA ?? "REPLACE_AFTER_DEPLOY";
const OUT = "docs/qa/floor-plan-seating-gap-closure";
const FIXTURE = "FloorGapClosure";
const CLIENT_COOKIE = "sb-wvpsldwwjqdannqasrdf-client-auth-token";
const PASSWORD = "TempFloorGapClosure1!";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 1200) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 320)}`);
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
    await admin.from("couple_guests").delete().eq("client_id", client.id);
    await admin.from("client_portal_sessions").delete().eq("client_id", client.id);
    await admin.from("clients").delete().eq("id", client.id);
    if (client.lead_id) await admin.from("leads").delete().eq("id", client.lead_id);
  }
  if (email) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const u of list?.users ?? []) {
      if (u.email === email) await admin.auth.admin.deleteUser(u.id);
    }
  }
}

async function createFixture(email: string, eventDate: string, tag: string) {
  const { data: rel } = await admin.from("relationships").insert({
    venue_id: FANCY, kind: "couple", display_name: `${FIXTURE} ${tag}`,
  }).select("id").single();
  const relId = rel!.id;

  const { data: lead } = await admin.from("leads").insert({
    venue_id: FANCY, relationship_id: relId, first_name: FIXTURE, last_name: "Gap",
    email, event_type: "wedding", event_date: eventDate, guest_count: 80,
    status: "active", sales_stage: "proposal_sent", assigned_staff_id: JEN,
    planned_event_space_id: SPACE,
  }).select("id").single();

  const { data: client } = await admin.from("clients").insert({
    venue_id: FANCY, lead_id: lead!.id, first_name: FIXTURE, last_name: "Gap",
    email, status: "booking", event_type: "wedding", event_date: eventDate,
    relationship_id: relId, lifecycle_booked_at: new Date().toISOString(),
  }).select("id").single();

  const { data: event } = await admin.from("events").insert({
    venue_id: FANCY, client_id: client!.id, name: `${tag} Gap Wedding`,
    event_type: "wedding", event_date: eventDate, start_time: "16:00", end_time: "22:00",
    guest_count: 80, status: "confirmed", space_id: SPACE, assigned_staff_id: JEN,
    booked_at: new Date().toISOString(),
  }).select("id").single();

  const guests = [];
  for (let i = 1; i <= 4; i++) {
    const { data: g } = await admin.from("couple_guests").insert({
      venue_id: FANCY, client_id: client!.id, first_name: `Guest${i}`, last_name: "Gap",
      rsvp_status: "attending", sort_order: i,
    }).select("id").single();
    if (g) guests.push(g.id);
  }

  const token = `fpgc_${tag}_${randomBytes(3).toString("hex")}`;
  await admin.from("client_portal_sessions").insert({
    venue_id: FANCY, client_id: client!.id, access_token: token,
    access_level: "couple", label: "Floor gap closure",
    expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
  });

  const { error: createErr } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (createErr && !/already/i.test(createErr.message)) throw createErr;

  return { clientId: client!.id, eventId: event!.id, guestIds: guests, token };
}

async function main() {
  const stamp = Date.now();
  const dateA = `2075-03-${String((stamp % 27) + 1).padStart(2, "0")}`;
  const dateB = `2075-08-${String((stamp % 27) + 1).padStart(2, "0")}`;
  const emailA = `fpgc-a-${stamp}@hellotocheers-test.invalid`;
  const emailB = `fpgc-b-${stamp}@hellotocheers-test.invalid`;

  let browser: { close: () => Promise<void> } | null = null;
  let inventoryItemId: string | null = null;
  let inventoryPrevQty: number | null = null;

  await cleanup();
  for (const e of [emailA, emailB]) await cleanup(e).catch(() => undefined);

  try {
    const loginHtml = await fetch(`${APP}/login`).then((r) => r.text());
    const servingSha = (loginHtml.match(/dpl=([a-f0-9]{40})/) ?? [])[1] ?? null;
    record(
      "serving_sha",
      !!servingSha && servingSha.startsWith(EXPECTED_SHA.slice(0, 8)),
      `serving=${servingSha} expected=${EXPECTED_SHA}`,
    );
    if (!servingSha?.startsWith(EXPECTED_SHA.slice(0, 8))) {
      throw new Error(`serving ${servingSha}, expected ${EXPECTED_SHA}`);
    }

    // Seed a finite inventory quantity for catalog enforcement (do not leave Fancy at 0 forever).
    const { data: inv } = await admin.from("inventory_items")
      .select("id,quantity_available,name,width,length,shape")
      .eq("venue_id", FANCY)
      .eq("available_for_floor_plans", true)
      .eq("shape", "round")
      .ilike("name", "%72%Round%")
      .limit(1)
      .maybeSingle();
    inventoryItemId = inv?.id ?? null;
    inventoryPrevQty = inv?.quantity_available ?? null;
    if (inventoryItemId) {
      await admin.from("inventory_items").update({ quantity_available: 2 }).eq("id", inventoryItemId);
    }
    record("inventory_seed", Boolean(inventoryItemId), JSON.stringify({ inventoryItemId, prev: inventoryPrevQty }));

    const { data: tplObjs } = await admin
      .from("floor_plan_template_objects")
      .select("object_type,label,capacity,width,height,display_shape,locked")
      .eq("template_id", TPL_A);
    record("scenario_a_template_objects", (tplObjs?.length ?? 0) >= 10, `count=${tplObjs?.length}`);

    const fixture = await createFixture(emailA, dateA, `a${stamp}`);
    await admin.from("event_floor_plan_offers").insert({
      venue_id: FANCY, event_id: fixture.eventId, floor_plan_template_id: TPL_A,
      is_offered: true, couple_label: "Gap Layout", sort_order: 0,
    });

    const ensure = await anon.rpc("ensure_portal_floor_plan_assignment", { p_token: fixture.token });
    const planId = (ensure.data as { floorPlanId?: string })?.floorPlanId ?? null;
    record("ensure_sole", Boolean(planId), JSON.stringify(ensure.data ?? ensure.error));

    const { data: planObjs } = await admin
      .from("floor_plan_objects")
      .select("id,object_type,label,capacity,width,height,display_shape,locked,x,y,inventory_item_id")
      .eq("floor_plan_id", planId!);
    const tplTypes = new Set((tplObjs ?? []).map((o) => `${o.object_type}:${o.label}`));
    const planTypes = new Set((planObjs ?? []).map((o) => `${o.object_type}:${o.label}`));
    const missing = [...tplTypes].filter((k) => !planTypes.has(k));
    record(
      "scenario_a_fidelity",
      missing.length === 0 && (planObjs?.length ?? 0) === (tplObjs?.length ?? 0),
      JSON.stringify({ tpl: tplObjs?.length, plan: planObjs?.length, missing: missing.slice(0, 8) }),
    );

    const seatable = (planObjs ?? []).filter((o) =>
      ["table_round", "table_rect", "table_oval"].includes(o.object_type),
    );
    const totalCap = seatable.reduce((s, o) => s + (o.capacity ?? 0), 0);
    record(
      "scenario_d_capacity_source",
      totalCap > 0 && seatable.every((o) => o.capacity != null),
      JSON.stringify({ tables: seatable.length, totalCap }),
    );

    // Catalog RPC
    const catalog = await anon.rpc("get_portal_floor_plan_furniture_catalog", {
      p_token: fixture.token,
      p_floor_plan_id: planId,
    });
    const cat = catalog.data as {
      inventoryItems?: Array<{ inventoryItemId: string; addable: boolean; remaining: number; placeWidth?: number }>;
      planTableTypes?: Array<{ objectType: string; addable: boolean; remaining: number }>;
      error?: string;
    } | null;
    const invEntry = cat?.inventoryItems?.find((i) => i.inventoryItemId === inventoryItemId);
    record(
      "scenario_b_catalog",
      Boolean(cat && !cat.error && (cat.inventoryItems?.length ?? 0) > 0),
      JSON.stringify({
        invCount: cat?.inventoryItems?.length,
        planTypes: cat?.planTableTypes?.length,
        seeded: invEntry,
        err: catalog.error?.message,
      }),
    );

    // Add via inventory (allowed while remaining)
    const add1 = await anon.rpc("add_portal_floor_plan_table", {
      p_token: fixture.token,
      p_floor_plan_id: planId,
      p_inventory_item_id: inventoryItemId,
      p_x: 200,
      p_y: 200,
    });
    record("scenario_b_add_inventory", (add1.data as { ok?: boolean })?.ok === true, JSON.stringify(add1.data));
    const addedId = (add1.data as { objectId?: string })?.objectId ?? null;

    const add2 = await anon.rpc("add_portal_floor_plan_table", {
      p_token: fixture.token,
      p_floor_plan_id: planId,
      p_inventory_item_id: inventoryItemId,
      p_x: 280,
      p_y: 200,
    });
    record("scenario_b_add_second", (add2.data as { ok?: boolean })?.ok === true, JSON.stringify(add2.data));

    const add3 = await anon.rpc("add_portal_floor_plan_table", {
      p_token: fixture.token,
      p_floor_plan_id: planId,
      p_inventory_item_id: inventoryItemId,
      p_x: 360,
      p_y: 200,
    });
    record(
      "scenario_b_qty_exceeded",
      (add3.data as { ok?: boolean; error?: string })?.ok === false
        && (add3.data as { error?: string })?.error === "quantity_exceeded",
      JSON.stringify(add3.data),
    );

    // Concurrent-ish double add after resetting qty to 1 with zero used of a different item path:
    // already at qty 2 used — further API add rejected above.

    // Outside room
    const { data: planRow } = await admin.from("floor_plans")
      .select("room_width_ft,room_depth_ft").eq("id", planId!).single();
    const roomW = Number(planRow?.room_width_ft ?? 0) * 12;
    const roomH = Number(planRow?.room_depth_ft ?? 0) * 12;
    if (roomW > 0 && roomH > 0 && addedId) {
      const outside = await anon.rpc("move_portal_floor_plan_object", {
        p_token: fixture.token,
        p_object_id: addedId,
        p_x: roomW + 500,
        p_y: roomH + 500,
      });
      record(
        "scenario_c_outside_room",
        (outside.data as { error?: string })?.error === "outside_room",
        JSON.stringify({ outside: outside.data, roomW, roomH }),
      );
    } else {
      record("scenario_c_outside_room", false, `room not configured roomW=${roomW} roomH=${roomH}`);
    }

    // Move unlocked + preserve assignments
    const moveTarget = addedId ?? seatable[0]?.id ?? null;
    if (moveTarget && fixture.guestIds[0]) {
      await admin.from("guest_seat_assignments").upsert({
        guest_id: fixture.guestIds[0],
        floor_plan_id: planId!,
        table_object_id: moveTarget,
      }, { onConflict: "guest_id,floor_plan_id" });
      const { data: before } = await admin.from("floor_plan_objects").select("x,y").eq("id", moveTarget).single();
      const nx = Number(before?.x ?? 200) + 25;
      const ny = Number(before?.y ?? 200) + 15;
      const moved = await anon.rpc("move_portal_floor_plan_object", {
        p_token: fixture.token, p_object_id: moveTarget, p_x: nx, p_y: ny,
      });
      const { data: seatAfter } = await admin.from("guest_seat_assignments")
        .select("table_object_id").eq("guest_id", fixture.guestIds[0]).eq("floor_plan_id", planId!).single();
      record(
        "scenario_d_move_preserves_assignment",
        (moved.data as { ok?: boolean })?.ok === true
          && seatAfter?.table_object_id === moveTarget,
        JSON.stringify({ moved: moved.data, seatAfter }),
      );
    } else {
      record("scenario_d_move_preserves_assignment", false, "missing move target or guest");
    }

    // Remove with assignments requires confirm
    if (moveTarget) {
      const rem = await anon.rpc("remove_portal_floor_plan_object", {
        p_token: fixture.token, p_object_id: moveTarget, p_confirm_unassign: false,
      });
      record(
        "scenario_d_remove_blocked",
        (rem.data as { error?: string })?.error === "has_assignments",
        JSON.stringify(rem.data),
      );
      const remOk = await anon.rpc("remove_portal_floor_plan_object", {
        p_token: fixture.token, p_object_id: moveTarget, p_confirm_unassign: true,
      });
      const { data: seatGone } = await admin.from("guest_seat_assignments")
        .select("id").eq("guest_id", fixture.guestIds[0]).eq("floor_plan_id", planId!);
      record(
        "scenario_d_remove_confirmed",
        (remOk.data as { ok?: boolean })?.ok === true && (seatGone?.length ?? 0) === 0,
        JSON.stringify({ remOk: remOk.data, seatGone }),
      );
    }

    // Isolation: second event does not see first event's added inventory usage as template mutation
    const fixtureB = await createFixture(emailB, dateB, `b${stamp}`);
    await admin.from("event_floor_plan_offers").insert({
      venue_id: FANCY, event_id: fixtureB.eventId, floor_plan_template_id: TPL_A,
      is_offered: true, couple_label: "Gap Layout B", sort_order: 0,
    });
    const ensureB = await anon.rpc("ensure_portal_floor_plan_assignment", { p_token: fixtureB.token });
    const planB = (ensureB.data as { floorPlanId?: string })?.floorPlanId ?? null;
    const { data: tplAfter } = await admin
      .from("floor_plan_template_objects")
      .select("id")
      .eq("template_id", TPL_A);
    record(
      "scenario_f_template_unchanged",
      (tplAfter?.length ?? 0) === (tplObjs?.length ?? 0),
      `tplBefore=${tplObjs?.length} tplAfter=${tplAfter?.length}`,
    );
    const { data: objsB } = await admin.from("floor_plan_objects").select("id,inventory_item_id").eq("floor_plan_id", planB!);
    const bHasAInventory = (objsB ?? []).some((o) => o.inventory_item_id === inventoryItemId);
    record(
      "scenario_f_event_isolation",
      Boolean(planB) && planB !== planId && !bHasAInventory,
      JSON.stringify({ planA: planId, planB, bHasAInventory, countB: objsB?.length }),
    );

    // Browser UX
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    let session = (await anon.auth.signInWithPassword({ email: emailA, password: PASSWORD })).data.session;
    if (!session) {
      const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email: emailA });
      session = (await anon.auth.verifyOtp({
        type: "email",
        token_hash: linkData!.properties!.hashed_token!,
      })).data.session;
    }
    if (!session) throw new Error("session");
    const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(session));
    await context.addCookies(
      ssrUtils.createChunks(CLIENT_COOKIE, encoded).map((c: { name: string; value: string }) => ({
        name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/",
        httpOnly: false, secure: true, sameSite: "Lax" as const,
      })),
    );

    await page.goto(`${APP}/p/${fixture.token}#floor_plans`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    const working = await page.locator("[data-testid=floor-plan-working-canvas]").count();
    const addBtn = await page.locator("[data-testid=floor-plan-add-table]").count();
    record("browser_working_canvas", working > 0, `working=${working} addBtn=${addBtn}`);

    if (addBtn > 0) {
      await page.locator("[data-testid=floor-plan-add-table]").click();
      await page.waitForTimeout(1200);
      const catalogVisible = await page.locator("[data-testid=floor-plan-furniture-catalog]").count();
      const items = await page.locator("[data-testid=floor-plan-catalog-item]").count();
      record("browser_catalog", catalogVisible > 0 && items > 0, `catalog=${catalogVisible} items=${items}`);
      await page.screenshot({ path: `${OUT}/catalog-1280.png`, fullPage: true });
    } else {
      record("browser_catalog", false, "add button missing");
    }

    await page.goto(`${APP}/p/${fixture.token}#seating`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    const seatingText = await page.locator("body").innerText();
    const hasTables = /tables/i.test(seatingText);
    const hasSeats = /seats/i.test(seatingText);
    record("scenario_e_seating_workspace", hasTables && hasSeats, seatingText.slice(0, 400));
    await page.screenshot({ path: `${OUT}/seating-1280.png`, fullPage: true });

    // Ready lock still rejects adds
    await admin.from("floor_plans").update({ finalized_at: new Date().toISOString() }).eq("id", planId!);
    const addReady = await anon.rpc("add_portal_floor_plan_table", {
      p_token: fixture.token,
      p_floor_plan_id: planId,
      p_object_type: "table_round",
      p_x: 220,
      p_y: 220,
    });
    record(
      "scenario_f_ready_rejects_add",
      (addReady.data as { error?: string })?.error === "plan_ready",
      JSON.stringify(addReady.data),
    );
  } catch (err) {
    record("harness_error", false, err instanceof Error ? err.message : String(err));
  } finally {
    if (inventoryItemId != null && inventoryPrevQty != null) {
      await admin.from("inventory_items")
        .update({ quantity_available: inventoryPrevQty })
        .eq("id", inventoryItemId);
    }
    await browser?.close().catch(() => undefined);
    await cleanup().catch(() => undefined);
    for (const e of [emailA, emailB]) await cleanup(e).catch(() => undefined);

    const passed = checks.filter((c) => c.pass).length;
    const failed = checks.filter((c) => !c.pass).length;
    const summary = { expectedSha: EXPECTED_SHA, passed, failed, checks };
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(summary, null, 2));
    writeFileSync(
      `${OUT}/browser-run.log`,
      checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.name} — ${c.detail}`).join("\n") + `\npassed=${passed} failed=${failed}\n`,
    );
    console.log(`\n${failed === 0 ? "GREEN" : "NOT GREEN"} passed=${passed} failed=${failed}`);
    process.exit(failed === 0 ? 0 : 1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
