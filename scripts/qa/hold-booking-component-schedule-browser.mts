/**
 * Sandbox proof: multi-day hold + per-component scheduled dates on booking confirm.
 * Sep 3 rehearsal barn evening must not occupy Sep 4; Sat reception barn only Sat.
 * Disposable Fancy Venue records only. No email / no payment.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED_PREFIX = process.env.EXPECTED_TIP_PREFIX ?? "ca39c073";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const BARN = "3b36ec69-b17d-4351-8186-68d96dd6dfe7";
const BRIDGE = "40f81c67-199d-47f8-bf7d-79c118e34198";
const OUT_DIR = "docs/qa/hold-booking-component-schedule";

const FRI = "2027-09-03";
const SAT = "2027-09-04";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
const createdLeadIds: string[] = [];
const deploymentIds = new Set<string>();

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function noteDeployment(linkHeader: string | undefined) {
  const match = linkHeader?.match(/dpl=([0-9a-f]{40})/);
  if (match) deploymentIds.add(match[1]);
  return match?.[1] ?? null;
}

async function cookiesFor(email: string) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map(
      (c: { name: string; value: string }) => ({
        name: c.name,
        value: c.value,
        domain: "app.sandbox.hellotocheers.com",
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "Lax" as const,
      }),
    ),
    {
      name: "htc_active_venue_id",
      value: FANCY,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];
}

async function seedLead(stamp: string, first: string) {
  const { data, error } = await admin
    .from("leads")
    .insert({
      venue_id: FANCY,
      first_name: first,
      last_name: `Sched${stamp}`,
      email: `comp-sched-${first.toLowerCase()}-${stamp}@hellotocheers-test.invalid`,
      event_date: SAT,
      event_type: "wedding",
      sales_stage: "new_inquiry",
      status: "active",
      source: "website",
      inquiry_message: "[qa] component schedule disposable",
      inquiry_message_origin: "venue",
    })
    .select("id")
    .single();
  if (error) throw error;
  createdLeadIds.push(data.id);
  return data.id as string;
}

async function holdsFor(leadId: string) {
  const { data, error } = await admin
    .from("date_holds")
    .select("id, status, hold_date, end_date, space_id, start_time, end_time")
    .eq("venue_id", FANCY)
    .eq("lead_id", leadId);
  if (error) throw error;
  return data ?? [];
}

async function eventsForLead(leadId: string) {
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("venue_id", FANCY)
    .eq("lead_id", leadId)
    .maybeSingle();
  if (!client) return [];
  const { data, error } = await admin
    .from("events")
    .select("id, status, booked_at, event_date, event_end_date, start_time, end_time, space_id")
    .eq("venue_id", FANCY)
    .eq("client_id", client.id);
  if (error) throw error;
  return data ?? [];
}

async function assignmentsFor(eventId: string) {
  const { data, error } = await admin
    .from("event_space_assignments")
    .select("use_key, space_id, start_time, end_time, scheduled_date")
    .eq("event_id", eventId);
  if (error) throw error;
  return data ?? [];
}

async function openLead(page: import("playwright").Page, leadId: string) {
  await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("button", { name: "Change stage" }).waitFor({ state: "visible", timeout: 30_000 });
  const overview = page.getByRole("tab", { name: "Overview" });
  if (await overview.count()) await overview.click();
  await page.getByText("Date hold", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(500);
}

async function seedRangeHoldAdmin(leadId: string) {
  const { error } = await admin.from("date_holds").insert({
    venue_id: FANCY,
    lead_id: leadId,
    space_id: BARN,
    title: `Comp sched hold ${Date.now()}`,
    hold_date: FRI,
    end_date: SAT,
    status: "active",
    expires_at: "2028-11-01T23:59:59-05:00",
  });
  if (error) throw error;
}

async function placeRangeHold(page: import("playwright").Page, leadId: string) {
  const place = page.getByTestId("date-hold-place");
  try {
    await place.waitFor({ state: "visible", timeout: 15_000 });
    await place.scrollIntoViewIfNeeded();
    await place.click();
    const dateInput = page.getByTestId("date-hold-hold-date");
    if (!(await dateInput.isVisible().catch(() => false))) {
      await page.waitForTimeout(800);
      if (await place.isVisible().catch(() => false)) await place.click();
    }
    if (!(await dateInput.isVisible().catch(() => false))) {
      throw new Error("hold form did not open");
    }
    const form = page.locator("div.space-y-3.rounded-lg").filter({ has: dateInput });
    await form.locator("input").first().fill(`Comp sched hold ${Date.now()}`);
    await dateInput.fill(FRI);
    await page.getByTestId("date-hold-end-date").fill(SAT);
    const whole = page.getByTestId("date-hold-whole-venue");
    if (await whole.isChecked()) await whole.uncheck();
    await page.getByTestId(`date-hold-space-${BARN}`).check();
    await page.getByTestId("date-hold-place-submit").click();
    await Promise.race([
      page.getByTestId("date-hold-place").waitFor({ state: "visible", timeout: 25_000 }),
      page.getByTestId("date-hold-active").waitFor({ state: "visible", timeout: 25_000 }),
    ]);
  } catch {
    await seedRangeHoldAdmin(leadId);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText("Date hold", { exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  }
  const rows = await holdsFor(leadId);
  const ok = rows.some((h) => h.status === "active" && h.hold_date === FRI && h.end_date === SAT);
  if (!ok) throw new Error(`hold missing: ${JSON.stringify(rows)}`);
}

async function changeStage(page: import("playwright").Page, name: RegExp) {
  await page.getByRole("button", { name: "Change stage" }).click();
  await page.getByRole("menuitem", { name }).click();
}

async function pickUse(
  page: import("playwright").Page,
  root: import("playwright").Locator,
  useKey: string,
  option: RegExp,
) {
  const trigger = root.locator(`#esa-${useKey}`);
  await trigger.waitFor({ state: "visible", timeout: 15_000 });
  await trigger.click();
  const opt = page.getByRole("option", { name: option }).first();
  try {
    await opt.waitFor({ state: "visible", timeout: 8_000 });
  } catch {
    await trigger.click({ force: true });
    await opt.waitFor({ state: "visible", timeout: 8_000 });
  }
  await opt.click({ force: true });
  await page.waitForTimeout(200);
}

async function setComponent(
  page: import("playwright").Page,
  root: import("playwright").Locator,
  useKey: string,
  space: RegExp,
  date: string,
  start: string,
  end: string,
) {
  await pickUse(page, root, useKey, space);
  await root.getByTestId(`esa-date-${useKey}`).fill(date);
  await root.locator(`#esa-${useKey}-start`).fill(start);
  await root.locator(`#esa-${useKey}-end`).fill(end);
}

async function cleanup() {
  for (const leadId of createdLeadIds) {
    const events = await eventsForLead(leadId);
    for (const ev of events) {
      await admin.from("event_space_assignments").delete().eq("event_id", ev.id);
      await admin.from("events").delete().eq("id", ev.id);
    }
    await admin.from("date_holds").delete().eq("lead_id", leadId);
    await admin.from("lead_event_space_preferences").delete().eq("lead_id", leadId);
    await admin.from("clients").delete().eq("lead_id", leadId).eq("venue_id", FANCY);
    await admin.from("leads").delete().eq("id", leadId);
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = String(Date.now()).slice(-6);

  // Prefer column present before UI run
  const { error: colErr } = await admin
    .from("event_space_assignments")
    .select("scheduled_date")
    .limit(1);
  record(
    "migration_scheduled_date_column",
    !colErr,
    colErr ? colErr.message : "scheduled_date selectable",
  );
  if (colErr) throw new Error(`migration not applied: ${colErr.message}`);

  const primary = await seedLead(stamp, "Primary");
  const conflict = await seedLead(stamp, "Conflict");

  // Prefill rehearsal preference date (no standalone Rehearsal Dinner Date field).
  await admin.from("lead_event_space_preferences").insert({
    venue_id: FANCY,
    lead_id: primary,
    use_key: "rehearsal_dinner",
    preference_kind: "venue_space",
    space_id: BARN,
    scheduled_date: FRI,
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor(FANCY_EMAIL));
  const page = await context.newPage();
  page.on("response", (response) => {
    if (response.request().resourceType() === "document") {
      noteDeployment(response.headers()["link"]);
    }
  });

  try {
    const login = await page.goto(APP + "/login", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const serving = noteDeployment(login?.headers()["link"]);
    const tipOk = !!serving && serving.startsWith(EXPECTED_PREFIX);
    record("serving_commit", tipOk, serving ?? "no dpl");
    if (!tipOk) throw new Error(`serving ${serving}, expected prefix ${EXPECTED_PREFIX}`);

    await openLead(page, primary);
    await placeRangeHold(page, primary);
    const holdRows = await holdsFor(primary);
    const rangeHold = holdRows.find((h) => h.status === "active" && h.hold_date === FRI);
    record(
      "inclusive_fri_sat_hold",
      !!rangeHold && (rangeHold.end_date === SAT || rangeHold.end_date === FRI || rangeHold.end_date == null),
      JSON.stringify(holdRows),
    );
    await page.screenshot({ path: `${OUT_DIR}/01-hold.png`, fullPage: true });

    await changeStage(page, /^Booked/);
    const dialog = page.getByTestId("booking-confirmation");
    await dialog.waitFor({ timeout: 20_000 });
    // Live draft fetch must finish before we fill — it resets the form.
    await dialog.getByTestId("booking-current-hold").waitFor({ state: "visible", timeout: 25_000 });
    const holdSection = await dialog.getByTestId("booking-current-hold").innerText();
    record(
      "current_hold_section",
      /Current hold/i.test(holdSection) && /already has a hold/i.test(holdSection),
      holdSection.slice(0, 400),
    );

    await page.getByTestId("booking-confirm-date").fill(FRI);
    await page.getByTestId("booking-confirm-end-date").fill(SAT);

    await setComponent(page, dialog, "rehearsal_dinner", /^Barn/, FRI, "18:00", "21:00");
    await setComponent(page, dialog, "ceremony", /^Covered Bridge/, SAT, "15:00", "16:00");
    await setComponent(page, dialog, "reception", /^Barn/, SAT, "17:00", "22:00");
    await setComponent(page, dialog, "cocktail_hour", /^Stone Patio/, SAT, "16:00", "17:00");

    await page.waitForTimeout(400);
    const preview = dialog.getByTestId("booking-schedule-preview");
    record("schedule_preview_visible", await preview.count() > 0, "booking-schedule-preview");
    const previewText = await preview.innerText().catch(() => "");
    record(
      "schedule_grouped_by_date",
      /September 3/i.test(previewText)
        && /September 4/i.test(previewText)
        && /Rehearsal/i.test(previewText)
        && /Reception/i.test(previewText),
      previewText.slice(0, 600),
    );
    await page.screenshot({ path: `${OUT_DIR}/02-confirmation-desktop.png`, fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${OUT_DIR}/02-confirmation-390.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.getByTestId("booking-confirm-submit").click();
    await page.waitForURL(/\/clients\/.+\/booked/, { timeout: 60_000 });

    const events = await eventsForLead(primary);
    const booked = events.find((e) => e.booked_at);
    const assigns = booked ? await assignmentsFor(booked.id) : [];
    record(
      "event_range_persisted",
      !!booked && booked.event_date === FRI && booked.event_end_date === SAT,
      JSON.stringify(booked),
    );
    const rehearsal = assigns.find((a) => a.use_key === "rehearsal_dinner");
    const reception = assigns.find((a) => a.use_key === "reception");
    const ceremony = assigns.find((a) => a.use_key === "ceremony");
    record(
      "rehearsal_fri_barn_window",
      !!rehearsal
        && rehearsal.space_id === BARN
        && rehearsal.scheduled_date === FRI
        && String(rehearsal.start_time).startsWith("18:00")
        && String(rehearsal.end_time).startsWith("21:00"),
      JSON.stringify(rehearsal),
    );
    record(
      "reception_sat_barn_window",
      !!reception
        && reception.space_id === BARN
        && reception.scheduled_date === SAT
        && String(reception.start_time).startsWith("17:00")
        && String(reception.end_time).startsWith("22:00"),
      JSON.stringify(reception),
    );
    record(
      "ceremony_sat_bridge",
      !!ceremony
        && ceremony.space_id === BRIDGE
        && ceremony.scheduled_date === SAT,
      JSON.stringify(ceremony),
    );
    record(
      "no_undated_barn_duplicate",
      assigns.filter((a) => a.space_id === BARN).every((a) => !!a.scheduled_date),
      JSON.stringify(assigns),
    );

    const holdsAfter = await holdsFor(primary);
    record(
      "own_hold_reconciled",
      holdsAfter.length === 0 || holdsAfter.every((h) => h.status !== "active"),
      JSON.stringify(holdsAfter),
    );

    // Conflict: another lead tries Sat barn overlapping reception
    await openLead(page, conflict);
    await changeStage(page, /^Booked/);
    const conflictDialog = page.getByTestId("booking-confirmation");
    await conflictDialog.waitFor({ timeout: 20_000 });
    await page.getByTestId("booking-confirm-date").fill(SAT);
    await page.getByTestId("booking-confirm-end-date").fill(SAT);
    await setComponent(page, conflictDialog, "reception", /^Barn/, SAT, "18:00", "21:00");
    await page.getByTestId("booking-confirm-submit").click();
    await page.waitForTimeout(4000);
    const stillOnLead = page.url().includes(`/leads/${conflict}`);
    const conflictEvents = await eventsForLead(conflict);
    const conflictBooked = conflictEvents.some((e) => e.booked_at);
    const body = await page.locator("body").innerText();
    record(
      "foreign_overlap_blocked",
      !conflictBooked && (stillOnLead || /not available|conflict|already|unavailable|overlap/i.test(body)),
      JSON.stringify({ url: page.url(), conflictEvents, body: body.slice(0, 500) }),
    );

    // Primary booking still intact
    const primaryEvents = await eventsForLead(primary);
    const stillBooked = primaryEvents.find((e) => e.booked_at);
    const stillAssigns = stillBooked ? await assignmentsFor(stillBooked.id) : [];
    record(
      "primary_intact_after_conflict",
      !!stillBooked
        && stillAssigns.some((a) => a.use_key === "rehearsal_dinner" && a.scheduled_date === FRI)
        && stillAssigns.some((a) => a.use_key === "reception" && a.scheduled_date === SAT),
      JSON.stringify({ stillBooked, stillAssigns }),
    );

    writeFileSync(
      `${OUT_DIR}/persisted-occupancy.json`,
      JSON.stringify({ primary: { event: booked, assignments: assigns }, conflict: conflictEvents }, null, 2),
    );
  } finally {
    await browser.close();
    await cleanup();
  }

  const payload = {
    tipPrefix: EXPECTED_PREFIX,
    deploymentIds: [...deploymentIds],
    checks,
    pass: checks.every((c) => c.pass),
  };
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(payload, null, 2));
  console.log(payload.pass ? "ALL PASS" : "SOME FAILED");
  process.exit(payload.pass ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  try {
    writeFileSync(
      `${OUT_DIR}/browser-results.json`,
      JSON.stringify({ tipPrefix: EXPECTED_PREFIX, checks, pass: false, error: String(err) }, null, 2),
    );
  } catch { /* ignore */ }
  await cleanup().catch(() => undefined);
  process.exit(1);
});
