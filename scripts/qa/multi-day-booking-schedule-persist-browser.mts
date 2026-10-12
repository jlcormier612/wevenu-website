/**
 * Sandbox: booking confirmation persists per-component scheduled_date, summary
 * groups Sat/Sun correctly, and Edit schedule saves safely.
 * Disposable Meadowbrook records only. Production untouched.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const STAFF_EMAIL = "jlcormier612@gmail.com";
const VENUE = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const SPACE = {
  barn: "6366187b-e7f5-45d0-b9bd-5534a48f6650",
  villa: "e11e9e2f-1930-464d-b9e7-d0c61c30b221",
  bridge: "696791d8-0e6f-4a6c-b99e-031ee7237d38",
  lawn: "56a70756-5ee3-4e08-8e1b-d1713c5bbbec",
};
const OUT_DIR = "docs/qa/multi-day-summary-tasks-questionnaires";
const EXPECTED_PREFIX = process.env.EXPECTED_SHA_PREFIX ?? "";

// Unique Sat/Sun weekend far from Nicole May 2027 dogfood
const SAT = "2028-05-13";
const SUN = "2028-05-14";

const out: {
  ok: boolean;
  servingSha: string | null;
  checks: Array<{ name: string; pass: boolean; detail: string }>;
  ids: Record<string, string | null>;
  urls: Record<string, string>;
  persisted?: unknown;
  afterEdit?: unknown;
} = { ok: true, servingSha: null, checks: [], ids: {}, urls: {} };

function record(name: string, pass: boolean, detail: string) {
  out.checks.push({ name, pass, detail });
  if (!pass) out.ok = false;
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function noteDeployment(html: string): string | null {
  const m = html.match(/dpl=([0-9a-f]{40})/i);
  return m?.[1] ?? null;
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox");
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
  const encoded =
    "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return ssrUtils.createChunks(cookieName, encoded).map(
    (c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    }),
  );
}

async function loadAssignments(eventId: string) {
  const { data } = await admin
    .from("event_space_assignments")
    .select("use_key, use_label, scheduled_date, start_time, end_time, space_id, sort_order")
    .eq("event_id", eventId)
    .order("sort_order");
  return data ?? [];
}

async function seedLeadReadyToBook() {
  const stamp = Date.now();
  const email = `sched-persist-${stamp}@hellotocheers.test`;
  const { data: lead, error: leadErr } = await admin.from("leads").insert({
    venue_id: VENUE,
    first_name: "Sched",
    last_name: `Persist${stamp}`,
    email,
    sales_stage: "tour_completed",
    status: "active",
    source: "website",
    event_type: "wedding",
    event_date: SAT,
    end_date: SUN,
  }).select("id").single();
  if (leadErr || !lead) throw leadErr ?? new Error("lead");

  const prefs = [
    { use_key: "rehearsal_dinner", space_id: SPACE.barn },
    { use_key: "getting_ready", space_id: SPACE.villa },
    { use_key: "ceremony", space_id: SPACE.bridge },
    { use_key: "cocktail_hour", space_id: SPACE.lawn },
    { use_key: "reception", space_id: SPACE.barn },
  ];
  const { error: prefErr } = await admin.from("lead_event_space_preferences").insert(
    prefs.map((p) => ({
      venue_id: VENUE,
      lead_id: lead.id,
      use_key: p.use_key,
      preference_kind: "venue_space",
      space_id: p.space_id,
      scheduled_date: null,
    })),
  );
  if (prefErr) throw prefErr;

  const { data: hold, error: holdErr } = await admin.from("date_holds").insert({
    venue_id: VENUE,
    lead_id: lead.id,
    status: "active",
    hold_date: SAT,
    end_date: SUN,
    start_time: "14:00",
    end_time: "22:00",
    space_id: SPACE.barn,
  }).select("id").single();
  if (holdErr || !hold) throw holdErr ?? new Error("hold");
  await admin.from("date_hold_spaces").insert({
    hold_id: hold.id,
    space_id: SPACE.barn,
  });

  return { leadId: lead.id as string, email, stamp };
}

async function cleanup(ids: {
  leadId?: string | null;
  clientId?: string | null;
  eventId?: string | null;
}) {
  if (ids.eventId) {
    await admin.from("event_space_assignments").delete().eq("event_id", ids.eventId);
    await admin.from("events").delete().eq("id", ids.eventId);
  }
  if (ids.clientId) await admin.from("clients").delete().eq("id", ids.clientId);
  if (ids.leadId) {
    await admin.from("date_holds").delete().eq("lead_id", ids.leadId);
    await admin.from("lead_event_space_preferences").delete().eq("lead_id", ids.leadId);
    await admin.from("leads").delete().eq("id", ids.leadId);
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const seeded = await seedLeadReadyToBook();
  out.ids.leadId = seeded.leadId;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor(STAFF_EMAIL));
  await context.addCookies([{
    name: "htc_active_venue_id",
    value: VENUE,
    domain: "app.sandbox.hellotocheers.com",
    path: "/",
    secure: true,
    sameSite: "Lax",
  }]);
  const page = await context.newPage();

  try {
    await page.goto(`${APP}/leads/${seeded.leadId}`, { waitUntil: "networkidle", timeout: 90_000 });
    out.servingSha = noteDeployment(await page.content());
    if (EXPECTED_PREFIX) {
      record("serving_commit", Boolean(out.servingSha?.startsWith(EXPECTED_PREFIX)), out.servingSha ?? "missing");
    } else {
      record("serving_commit", Boolean(out.servingSha), out.servingSha ?? "missing");
    }

    // Open booking confirmation via Change stage → Booked
    await page.getByRole("button", { name: /^Change stage$/i }).click({ timeout: 20_000 });
    await page.getByRole("menuitem", { name: /Booked/i }).click();

    await page.getByTestId("booking-confirmation").waitFor({ state: "visible", timeout: 30_000 });
    await page.getByTestId("booking-confirm-date").fill(SAT);
    const endInput = page.locator("#booking-confirm-end-date, [data-testid='booking-confirm-end-date']").first();
    if (await endInput.count()) await endInput.fill(SUN);
    else {
      // End date field by label
      const endByLabel = page.getByLabel(/end date/i);
      if (await endByLabel.count()) await endByLabel.fill(SUN);
    }

    // Wait for materialize effect, then set Sunday component dates + times
    await page.waitForTimeout(500);
    const schedule: Array<{ key: string; date: string; start: string; end: string }> = [
      { key: "rehearsal_dinner", date: SAT, start: "18:00", end: "22:00" },
      { key: "getting_ready", date: SUN, start: "14:00", end: "16:00" },
      { key: "ceremony", date: SUN, start: "16:00", end: "17:00" },
      { key: "cocktail_hour", date: SUN, start: "17:00", end: "18:00" },
      { key: "reception", date: SUN, start: "18:00", end: "22:00" },
    ];
    for (const row of schedule) {
      const date = page.getByTestId(`esa-date-${row.key}`);
      await date.waitFor({ state: "visible", timeout: 15_000 });
      await date.fill(row.date);
      const start = page.locator(`#esa-${row.key}-start`);
      const end = page.locator(`#esa-${row.key}-end`);
      if (await start.count()) await start.fill(row.start);
      if (await end.count()) await end.fill(row.end);
    }

    await page.screenshot({ path: `${OUT_DIR}/confirm-schedule-1280.png`, fullPage: true });
    await page.getByTestId("booking-confirm-submit").click();
    await page.getByTestId("booking-confirmation").waitFor({ state: "hidden", timeout: 60_000 }).catch(() => null);
    await page.waitForTimeout(2000);

    const { data: client } = await admin.from("clients").select("id").eq("lead_id", seeded.leadId).maybeSingle();
    out.ids.clientId = client?.id ?? null;
    const { data: event } = await admin.from("events").select("id, event_date, event_end_date, status, booked_at")
      .eq("client_id", client?.id ?? "").maybeSingle();
    out.ids.eventId = event?.id ?? null;
    record("booking_created", Boolean(event?.id && event.booked_at), JSON.stringify(event));

    const persisted = event?.id ? await loadAssignments(event.id) : [];
    out.persisted = persisted;
    const byKey = Object.fromEntries(persisted.map((r) => [r.use_key, r]));
    record("db_rehearsal_sat", byKey.rehearsal_dinner?.scheduled_date === SAT, String(byKey.rehearsal_dinner?.scheduled_date));
    record("db_getting_ready_sun", byKey.getting_ready?.scheduled_date === SUN, String(byKey.getting_ready?.scheduled_date));
    record("db_ceremony_sun", byKey.ceremony?.scheduled_date === SUN, String(byKey.ceremony?.scheduled_date));
    record("db_cocktail_sun", byKey.cocktail_hour?.scheduled_date === SUN, String(byKey.cocktail_hour?.scheduled_date));
    record("db_reception_sun", byKey.reception?.scheduled_date === SUN, String(byKey.reception?.scheduled_date));
    record("db_no_null_dates", persisted.every((r) => !!r.scheduled_date), JSON.stringify(persisted.map((r) => r.scheduled_date)));

    if (!client?.id) throw new Error("No client after book");
    out.urls.client = `${APP}/clients/${client.id}`;
    await page.goto(out.urls.client, { waitUntil: "networkidle", timeout: 90_000 });
    await page.getByTestId("event-booking-summary").waitFor({ state: "visible", timeout: 30_000 });
    const summary = await page.getByTestId("event-booking-component-schedule").innerText();
    record("ui_saturday_group", /Saturday,\s*May 13,\s*2028/i.test(summary) && /Rehearsal Dinner/i.test(summary), summary.slice(0, 400));
    record("ui_sunday_group", /Sunday,\s*May 14,\s*2028/i.test(summary) && /Reception/i.test(summary) && /Ceremony/i.test(summary), "sunday components");
    record("ui_no_date_not_set", !/Date not set/i.test(summary), summary.includes("Date not set") ? "has Date not set" : "clean");
    await page.screenshot({ path: `${OUT_DIR}/summary-persist-1280.png`, fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "networkidle" });
    const summary390 = await page.getByTestId("event-booking-component-schedule").innerText();
    record("ui_390_groups", /May 13/i.test(summary390) && /May 14/i.test(summary390) && !/Date not set/i.test(summary390), summary390.slice(0, 300));
    await page.screenshot({ path: `${OUT_DIR}/summary-persist-390.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });

    // Edit schedule — change getting_ready date to SAT (then back), verify save + cancel
    await page.getByTestId("edit-booking-schedule").click();
    await page.getByTestId("edit-booking-schedule-dialog").waitFor({ state: "visible" });
    const prefills = await page.getByTestId("esa-date-reception").inputValue();
    record("edit_prefill_reception", prefills === SUN, prefills);

    // Cancel path
    await page.getByTestId("esa-date-getting_ready").fill(SAT);
    await page.getByRole("button", { name: /^Cancel$/i }).click();
    await page.getByTestId("edit-booking-schedule-dialog").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => null);
    const afterCancel = await loadAssignments(event!.id);
    record(
      "edit_cancel_no_persist",
      afterCancel.find((r) => r.use_key === "getting_ready")?.scheduled_date === SUN,
      String(afterCancel.find((r) => r.use_key === "getting_ready")?.scheduled_date),
    );

    // Save path — move cocktail to a slightly different time
    await page.getByTestId("edit-booking-schedule").click();
    await page.getByTestId("edit-booking-schedule-dialog").waitFor({ state: "visible" });
    await page.locator("#esa-cocktail_hour-start").fill("17:15");
    await page.getByTestId("edit-schedule-save").click();
    await page.getByTestId("edit-booking-schedule-dialog").waitFor({ state: "hidden", timeout: 45_000 });
    await page.reload({ waitUntil: "networkidle" });
    const afterEdit = await loadAssignments(event!.id);
    out.afterEdit = afterEdit;
    const cocktail = afterEdit.find((r) => r.use_key === "cocktail_hour");
    record("edit_save_time", String(cocktail?.start_time).startsWith("17:15"), String(cocktail?.start_time));
    record(
      "edit_preserves_others",
      afterEdit.find((r) => r.use_key === "reception")?.scheduled_date === SUN
        && afterEdit.find((r) => r.use_key === "rehearsal_dinner")?.scheduled_date === SAT,
      "others intact",
    );

    // Conflict: try Barn overlapping Nicole is not needed — conflict with own rehearsal on SAT
    await page.getByTestId("edit-booking-schedule").click();
    await page.getByTestId("edit-booking-schedule-dialog").waitFor({ state: "visible" });
    await page.getByTestId("esa-date-reception").fill(SAT); // same barn as rehearsal Sat 18-22
    await page.locator("#esa-reception-start").fill("18:00");
    await page.locator("#esa-reception-end").fill("22:00");
    await page.getByTestId("edit-schedule-save").click();
    await page.waitForTimeout(2500);
    const errVisible = await page.getByTestId("edit-schedule-error").isVisible().catch(() => false);
    const dialogStill = await page.getByTestId("edit-booking-schedule-dialog").isVisible().catch(() => false);
    const afterConflict = await loadAssignments(event!.id);
    record(
      "edit_conflict_rejected",
      (errVisible || dialogStill) && afterConflict.find((r) => r.use_key === "reception")?.scheduled_date === SUN,
      errVisible ? "error shown" : dialogStill ? "dialog open" : "unexpected accept",
    );
    if (dialogStill) {
      await page.getByRole("button", { name: /^Cancel$/i }).click();
    }

    // Booking status / contracts unchanged
    const { data: eventAfter } = await admin.from("events").select("status, booked_at").eq("id", event!.id).single();
    record("booking_status_unchanged", eventAfter?.status === "confirmed" && !!eventAfter.booked_at, JSON.stringify(eventAfter));
  } finally {
    await browser.close();
    writeFileSync(`${OUT_DIR}/schedule-persist-browser-results.json`, JSON.stringify(out, null, 2));
    // Keep disposable for evidence unless CLEANUP=1
    if (process.env.CLEANUP === "1") {
      await cleanup(out.ids);
    }
  }

  console.log(JSON.stringify({ ok: out.ok, servingSha: out.servingSha, ids: out.ids }, null, 2));
  if (!out.ok) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  writeFileSync(`${OUT_DIR}/schedule-persist-browser-results.json`, JSON.stringify({ ...out, fatal: String(err) }, null, 2));
  process.exit(1);
});
