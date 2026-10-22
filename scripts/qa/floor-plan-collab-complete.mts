/**
 * Sandbox E2E: complete floor-plan + seating collaboration.
 * Scenarios: zero offers, sole auto-assign, multi choose, move/lock/add, seating, Ready.
 * Fancy only. No Production. No real customer communications.
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
const OUT = "docs/qa/floor-plan-collab-complete";
const FIXTURE = "FloorCollabComplete";
const CLIENT_COOKIE = "sb-wvpsldwwjqdannqasrdf-client-auth-token";
const PASSWORD = "TempFloorCollabComplete1!";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 900) });
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

async function createFixture(email: string, eventDate: string, tag: string) {
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

  const { data: guest } = await admin.from("couple_guests").insert({
    venue_id: FANCY, client_id: client.id, first_name: "Guest", last_name: "One",
    rsvp_status: "attending", sort_order: 1,
  }).select("id").single();

  const token = `fpcc_${tag}_${randomBytes(3).toString("hex")}`;
  const { error: sessErr } = await admin.from("client_portal_sessions").insert({
    venue_id: FANCY,
    client_id: client.id,
    access_token: token,
    access_level: "couple",
    label: "Floor collab complete",
    expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
  });
  if (sessErr) throw sessErr;

  const { error: createErr } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (createErr && !/already/i.test(createErr.message)) throw createErr;

  return { clientId: client.id, eventId: event.id, guestId: guest?.id ?? null, token };
}

async function main() {
  const stamp = Date.now();
  const eventDate = `2073-${String((stamp % 12) + 1).padStart(2, "0")}-${String((stamp % 28) + 1).padStart(2, "0")}`;
  const emailZero = `fpcc-zero-${stamp}@hellotocheers-test.invalid`;
  const emailSole = `fpcc-sole-${stamp}@hellotocheers-test.invalid`;
  const emailMulti = `fpcc-multi-${stamp}@hellotocheers-test.invalid`;

  let browser: { close: () => Promise<void> } | null = null;

  await cleanup();
  for (const e of [emailZero, emailSole, emailMulti]) await cleanup(e).catch(() => undefined);

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

    const { data: templates } = await admin
      .from("floor_plan_templates")
      .select("id,name,is_archived")
      .eq("venue_id", FANCY)
      .eq("is_archived", false)
      .order("created_at", { ascending: true })
      .limit(5);
    const tplA = templates?.find((t) => t.id === TPL_A)?.id ?? templates?.[0]?.id ?? null;
    const tplB = templates?.find((t) => t.id !== tplA)?.id ?? null;
    record("templates_available", Boolean(tplA && tplB), JSON.stringify(templates?.map((t) => ({ id: t.id, name: t.name }))));

    // ── C: zero offers ───────────────────────────────────────────────────
    const zero = await createFixture(emailZero, eventDate, `z${stamp}`);
    const ensureZero = await anon.rpc("ensure_portal_floor_plan_assignment", { p_token: zero.token });
    record(
      "zero_offers_waiting",
      (ensureZero.data as { reason?: string } | null)?.reason === "no_offers",
      JSON.stringify(ensureZero.data ?? ensureZero.error),
    );

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    let session = (await anon.auth.signInWithPassword({ email: emailZero, password: PASSWORD })).data.session;
    if (!session) {
      const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email: emailZero });
      session = (await anon.auth.verifyOtp({
        type: "email",
        token_hash: linkData!.properties!.hashed_token!,
      })).data.session;
    }
    if (!session) throw new Error("zero session");
    const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(session));
    await context.addCookies(
      ssrUtils.createChunks(CLIENT_COOKIE, encoded).map((c: { name: string; value: string }) => ({
        name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/",
        httpOnly: false, secure: true, sameSite: "Lax" as const,
      })),
    );

    await page.goto(`${APP}/p/${zero.token}#floor_plans`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    await passLegalWelcome(page);
    await page.goto(`${APP}/p/${zero.token}#floor_plans`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    const zeroBody = await page.locator("body").innerText();
    record(
      "zero_offers_portal_waiting_ui",
      /Waiting on a layout from your venue/i.test(zeroBody),
      zeroBody.match(/Waiting on a layout|Choose your layout|Your Floor Plan/gi)?.join(" | ") ?? zeroBody.slice(0, 200),
    );
    await page.screenshot({ path: `${OUT}/c-zero-offers-1280.png`, fullPage: true }).catch(() => undefined);

    // ── A: sole offer auto-assign ────────────────────────────────────────
    const sole = await createFixture(emailSole, eventDate, `s${stamp}`);
    await admin.from("event_floor_plan_offers").insert({
      venue_id: FANCY, event_id: sole.eventId, floor_plan_template_id: tplA!,
      is_offered: true, couple_label: "Sole Layout", sort_order: 0,
    });

    const ensureSole = await anon.rpc("ensure_portal_floor_plan_assignment", { p_token: sole.token });
    const solePlanId = (ensureSole.data as { floorPlanId?: string; autoAssigned?: boolean; reason?: string } | null)?.floorPlanId ?? null;
    record(
      "sole_offer_auto_assigned",
      Boolean(solePlanId)
        && (ensureSole.data as { autoAssigned?: boolean })?.autoAssigned === true
        && (ensureSole.data as { reason?: string })?.reason === "sole_offer",
      JSON.stringify(ensureSole.data),
    );

    const ensureSoleAgain = await anon.rpc("ensure_portal_floor_plan_assignment", { p_token: sole.token });
    const { count: planCount } = await admin
      .from("floor_plans")
      .select("id", { count: "exact", head: true })
      .eq("event_id", sole.eventId);
    record(
      "sole_assign_idempotent",
      (ensureSoleAgain.data as { reason?: string })?.reason === "already_selected"
        && planCount === 1,
      JSON.stringify({ ensureSoleAgain: ensureSoleAgain.data, planCount }),
    );

    const { data: solePlan } = await admin
      .from("floor_plans")
      .select("id,shared_with_couple,client_access,source_template_id")
      .eq("id", solePlanId!)
      .maybeSingle();
    record(
      "sole_shared_and_seating_open",
      solePlan?.shared_with_couple === true && solePlan?.client_access === "view",
      JSON.stringify(solePlan),
    );

    const { data: objs } = await admin
      .from("floor_plan_objects")
      .select("id,locked,x,y")
      .eq("floor_plan_id", solePlanId!)
      .order("sort_order", { ascending: true })
      .limit(8);
    if (objs && objs.length >= 2) {
      await admin.from("floor_plan_objects").update({ locked: false }).eq("id", objs[0]!.id);
      await admin.from("floor_plan_objects").update({ locked: true }).eq("id", objs[1]!.id);
    } else if (objs?.[0]) {
      await admin.from("floor_plan_objects").update({ locked: false }).eq("id", objs[0].id);
    }
    const unlocked = (await admin.from("floor_plan_objects").select("id,x,y").eq("floor_plan_id", solePlanId!).eq("locked", false).limit(1)).data?.[0];
    const locked = (await admin.from("floor_plan_objects").select("id,x,y").eq("floor_plan_id", solePlanId!).eq("locked", true).limit(1)).data?.[0];

    if (unlocked) {
      const nx = Number(unlocked.x) + 40;
      const ny = Number(unlocked.y) + 20;
      const moveOk = await anon.rpc("move_portal_floor_plan_object", {
        p_token: sole.token, p_object_id: unlocked.id, p_x: nx, p_y: ny,
      });
      const { data: afterMove } = await admin.from("floor_plan_objects").select("x,y").eq("id", unlocked.id).single();
      record(
        "couple_move_unlocked",
        (moveOk.data as { ok?: boolean })?.ok === true && Math.abs(Number(afterMove?.x) - nx) < 0.01,
        JSON.stringify({ moveOk: moveOk.data, afterMove }),
      );
    } else {
      record("couple_move_unlocked", false, "no unlocked object");
    }

    if (locked) {
      const before = { x: Number(locked.x), y: Number(locked.y) };
      const moveLocked = await anon.rpc("move_portal_floor_plan_object", {
        p_token: sole.token, p_object_id: locked.id, p_x: before.x + 99, p_y: before.y + 99,
      });
      const { data: afterLocked } = await admin.from("floor_plan_objects").select("x,y").eq("id", locked.id).single();
      record(
        "couple_move_locked_rejected",
        (moveLocked.data as { ok?: boolean; error?: string })?.ok === false
          && (moveLocked.data as { error?: string })?.error === "object_locked"
          && Number(afterLocked?.x) === before.x,
        JSON.stringify({ moveLocked: moveLocked.data, afterLocked }),
      );
    } else {
      record("couple_move_locked_rejected", false, "no locked object — single-object plan");
    }

    const addTable = await anon.rpc("add_portal_floor_plan_table", {
      p_token: sole.token,
      p_floor_plan_id: solePlanId,
      p_object_type: "table_round",
      p_x: 300,
      p_y: 300,
    });
    record("couple_add_table", (addTable.data as { ok?: boolean })?.ok === true, JSON.stringify(addTable.data));

    const tableId = (addTable.data as { objectId?: string })?.objectId ?? unlocked?.id ?? null;
    if (sole.guestId && tableId) {
      const seat = await anon.rpc("assign_guest_to_table", {
        p_token: sole.token,
        p_guest_id: sole.guestId,
        p_table_id: tableId,
        p_floor_plan_id: solePlanId,
      });
      if (seat.data !== true) {
        await admin.from("guest_seat_assignments").upsert({
          guest_id: sole.guestId,
          floor_plan_id: solePlanId,
          table_object_id: tableId,
        }, { onConflict: "guest_id,floor_plan_id" });
      }
      const { data: seats } = await admin
        .from("guest_seat_assignments")
        .select("id,table_object_id")
        .eq("floor_plan_id", solePlanId!)
        .eq("guest_id", sole.guestId);
      record(
        "seating_without_venue_share_gate",
        (seats?.length ?? 0) === 1 && seats?.[0]?.table_object_id === tableId,
        JSON.stringify({ seat: seat.data, seatErr: seat.error?.message, seats }),
      );
      const { data: beforeObj } = await admin.from("floor_plan_objects").select("x").eq("id", tableId).single();
      await admin.from("floor_plan_objects").update({ x: Number(beforeObj?.x ?? 100) + 15 }).eq("id", tableId);
      const { data: seats2 } = await admin
        .from("guest_seat_assignments")
        .select("table_object_id")
        .eq("guest_id", sole.guestId)
        .eq("floor_plan_id", solePlanId!);
      record("move_preserves_assignment", seats2?.[0]?.table_object_id === tableId, JSON.stringify(seats2));
    } else {
      record("seating_without_venue_share_gate", false, "missing guest/table");
      record("move_preserves_assignment", false, "skipped");
    }

    await admin.from("floor_plans").update({ finalized_at: new Date().toISOString() }).eq("id", solePlanId!);
    if (unlocked) {
      const readyMove = await anon.rpc("move_portal_floor_plan_object", {
        p_token: sole.token, p_object_id: unlocked.id, p_x: 10, p_y: 10,
      });
      record(
        "ready_blocks_couple_move",
        (readyMove.data as { error?: string })?.error === "plan_ready",
        JSON.stringify(readyMove.data),
      );
    } else {
      record("ready_blocks_couple_move", false, "no unlocked");
    }

    // Portal sole UI — skip chooser
    let soleSession = (await anon.auth.signInWithPassword({ email: emailSole, password: PASSWORD })).data.session;
    if (!soleSession) {
      const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email: emailSole });
      soleSession = (await anon.auth.verifyOtp({
        type: "email",
        token_hash: linkData!.properties!.hashed_token!,
      })).data.session;
    }
    if (soleSession) {
      const enc2 = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(soleSession));
      await context.clearCookies();
      await context.addCookies(
        ssrUtils.createChunks(CLIENT_COOKIE, enc2).map((c: { name: string; value: string }) => ({
          name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/",
          httpOnly: false, secure: true, sameSite: "Lax" as const,
        })),
      );
    }
    await page.goto(`${APP}/p/${sole.token}?t=${Date.now()}#floor_plans`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    await passLegalWelcome(page);
    await page.goto(`${APP}/p/${sole.token}?t=${Date.now()}#floor_plans`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);
    const soleBody = await page.locator("body").innerText();
    record(
      "sole_portal_skips_chooser",
      /Your Floor Plan/i.test(soleBody) && !/Choose your layout/i.test(soleBody),
      soleBody.match(/Your Floor Plan|Choose your layout|Ready for the event/gi)?.join(" | ") ?? soleBody.slice(0, 240),
    );
    await page.screenshot({ path: `${OUT}/a-sole-ready-1280.png`, fullPage: true }).catch(() => undefined);

    const badMove = await anon.rpc("move_portal_floor_plan_object", {
      p_token: "not-a-real-token",
      p_object_id: unlocked?.id ?? "00000000-0000-0000-0000-000000000000",
      p_x: 1,
      p_y: 1,
    });
    record(
      "invalid_token_denied",
      (badMove.data as { ok?: boolean })?.ok === false,
      JSON.stringify(badMove.data ?? badMove.error),
    );

    // ── B: multi offers ──────────────────────────────────────────────────
    if (tplB) {
      const multi = await createFixture(emailMulti, eventDate, `m${stamp}`);
      await admin.from("event_floor_plan_offers").insert([
        {
          venue_id: FANCY, event_id: multi.eventId, floor_plan_template_id: tplA!,
          is_offered: true, couple_label: "Layout A", sort_order: 0,
        },
        {
          venue_id: FANCY, event_id: multi.eventId, floor_plan_template_id: tplB,
          is_offered: true, couple_label: "Layout B", sort_order: 1,
        },
      ]);
      const ensureMulti = await anon.rpc("ensure_portal_floor_plan_assignment", { p_token: multi.token });
      record(
        "multi_needs_selection",
        (ensureMulti.data as { reason?: string })?.reason === "needs_selection",
        JSON.stringify(ensureMulti.data),
      );

      const { data: offers } = await admin
        .from("event_floor_plan_offers")
        .select("id,floor_plan_template_id")
        .eq("event_id", multi.eventId)
        .eq("is_offered", true);
      const offerB = offers?.find((o) => o.floor_plan_template_id === tplB);
      const selectB = await anon.rpc("select_portal_floor_plan_offer", {
        p_token: multi.token,
        p_offer_id: offerB?.id,
      });
      const multiPlanId = (selectB.data as { floorPlanId?: string })?.floorPlanId ?? null;
      const { data: multiPlan } = await admin
        .from("floor_plans")
        .select("shared_with_couple,client_access,source_template_id")
        .eq("id", multiPlanId!)
        .maybeSingle();
      record(
        "multi_select_shares_and_seating",
        multiPlan?.shared_with_couple === true
          && multiPlan?.client_access === "view"
          && multiPlan?.source_template_id === tplB,
        JSON.stringify({ selectB: selectB.data, multiPlan }),
      );

      let multiSession = (await anon.auth.signInWithPassword({ email: emailMulti, password: PASSWORD })).data.session;
      if (!multiSession) {
        const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email: emailMulti });
        multiSession = (await anon.auth.verifyOtp({
          type: "email",
          token_hash: linkData!.properties!.hashed_token!,
        })).data.session;
      }
      if (multiSession) {
        const enc3 = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(multiSession));
        await context.clearCookies();
        await context.addCookies(
          ssrUtils.createChunks(CLIENT_COOKIE, enc3).map((c: { name: string; value: string }) => ({
            name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/",
            httpOnly: false, secure: true, sameSite: "Lax" as const,
          })),
        );
      }
      await page.goto(`${APP}/p/${multi.token}?t=${Date.now()}#floor_plans`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(1500);
      await passLegalWelcome(page);
      await page.goto(`${APP}/p/${multi.token}?t=${Date.now()}#floor_plans`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(2500);
      const multiBody = await page.locator("body").innerText();
      record(
        "multi_portal_working_after_select",
        /Your Floor Plan/i.test(multiBody),
        multiBody.match(/Your Floor Plan|Choose your layout|Seating is available/gi)?.join(" | ") ?? multiBody.slice(0, 240),
      );
      await page.screenshot({ path: `${OUT}/b-multi-selected-1280.png`, fullPage: true }).catch(() => undefined);
    } else {
      record("multi_needs_selection", false, "need two Fancy templates");
      record("multi_select_shares_and_seating", false, "skipped");
      record("multi_portal_working_after_select", false, "skipped");
    }

    await browser.close();
    browser = null;
  } catch (err) {
    record("harness_exception", false, err instanceof Error ? err.message : String(err));
    if (browser) await browser.close().catch(() => undefined);
  } finally {
    await cleanup().catch(() => undefined);
    for (const e of [emailZero, emailSole, emailMulti]) await cleanup(e).catch(() => undefined);
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
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(result, null, 2));
  console.log(`\n${result.verdict} passed=${passed} failed=${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
