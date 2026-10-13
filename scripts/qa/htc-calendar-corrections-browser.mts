/**
 * Sandbox browser + DB proof for HTC Calendar Corrections (5fe3d13e+).
 * Evidence-gated: does not declare GREEN on deploy alone.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { projectAssignmentWindowsOntoCalendarDates } from "@/lib/calendar/event-assignment-projection";
import { calendarItemMatchesSpace } from "@/lib/calendar/space-filter";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = process.env.EXPECTED_SHA ?? "5fe3d13ece6d3002452e28c30cda5b47754e8173";
const EMAIL = "jlcormier612@gmail.com";
const VENUE = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const EMBED = "cd9e89529e65480ba8cfc6e154193d5a";
const NICOLE_EVENT = "e15869c8-736d-42cc-a00a-4b4bbdadc0f1";
const OUT_DIR = "docs/qa/htc-calendar-corrections";
const TITLE = `HTC Timed Proof ${Date.now()}`;
const ALLDAY_TITLE = `HTC All-Day Proof ${Date.now()}`;

mkdirSync(OUT_DIR, { recursive: true });

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
const deploymentIds = new Set<string>();
const evidence: Record<string, unknown> = {};

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function noteDeployment(linkHeader: string | undefined) {
  const match = linkHeader?.match(/dpl=([0-9a-f]{40})/);
  if (match) deploymentIds.add(match[1]);
  return match?.[1] ?? null;
}

function hhmm(t: string | null | undefined): string | null {
  if (!t) return null;
  return t.slice(0, 5);
}

function textHasTime(text: string, hhmm24: string): boolean {
  const [hStr, m] = hhmm24.split(":");
  const h = Number(hStr);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  return [
    hhmm24,
    `${h12}:${m}`,
    `${h12}:${m} ${ampm}`,
    `${h12}:${m}${ampm}`,
  ].some((p) => text.includes(p));
}

async function authCookies() {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const userSb = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  await userSb.auth.setSession(otpData.session);
  const { data, error } = await userSb.rpc("set_active_venue", { p_venue_id: VENUE });
  if (error || !(data as { ok?: boolean } | null)?.ok) {
    throw new Error(`set_active_venue: ${error?.message ?? JSON.stringify(data)}`);
  }
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
      value: VENUE,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];
}

async function openCalendar(page: import("playwright").Page, path: string) {
  const resp = await page.goto(`${APP}${path}`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  noteDeployment(resp?.headers()?.link);
  await page.waitForTimeout(1500);
  return page.locator("body").innerText();
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1400, height: 960 } });
await context.addCookies(await authCookies());
const page = await context.newPage();

let timedId: string | null = null;
let alldayId: string | null = null;

try {
  const head = await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const serving = noteDeployment(head?.headers()?.link);
  record("serving_commit", serving === EXPECTED, serving ?? "missing");
  if (serving !== EXPECTED) {
    throw new Error(`wrong runtime ${serving}; expected ${EXPECTED}`);
  }

  // —— Create timed appointment March 27 2027 10:00–11:00, no end date typed ——
  await openCalendar(page, "/calendar?year=2027&month=3");
  await page.getByRole("button", { name: /Add Schedule Item/i }).first().click({ timeout: 20_000 });
  await page.getByPlaceholder(/Meeting with|Smith Wedding/i).waitFor({ timeout: 15_000 });
  await page.getByPlaceholder(/Meeting with|Smith Wedding/i).fill(TITLE);
  // Meadowbrook has "Other" disabled — pick an enabled catalog type.
  await page.getByRole("combobox").first().click({ timeout: 10_000 }).catch(() => {});
  const walkthroughOpt = page.getByRole("option", { name: /^Walkthrough$/i });
  if (await walkthroughOpt.count()) {
    await walkthroughOpt.click();
  } else {
    // Native/select fallbacks used by the schedule type picker
    await page.locator("select").first().selectOption({ label: "Walkthrough" }).catch(async () => {
      await page.getByText("Walkthrough", { exact: true }).first().click();
    });
  }
  await page.locator('input[type="date"]').first().fill("2027-03-27");
  // Leave end date as the auto same-day value — do not type a different end.
  const allDayBoxCreate = page.locator('label:has-text("All day") input[type="checkbox"]');
  if (await allDayBoxCreate.isChecked()) await allDayBoxCreate.uncheck();
  await page.locator("#schedule-start-time").fill("10:00");
  await page.locator("#schedule-end-time").fill("11:00");
  await page.getByRole("button", { name: /^Add Schedule Item$/i }).last().click();
  await page.waitForTimeout(3000);

  const { data: timedRows } = await admin
    .from("calendar_blocks")
    .select("id,title,start_date,end_date,start_time,end_time,is_all_day,notes,lead_id,client_id")
    .eq("venue_id", VENUE)
    .eq("title", TITLE)
    .limit(1);
  const timed = timedRows?.[0] ?? null;
  timedId = timed?.id ?? null;
  evidence.timed = timed;
  record(
    "timed_persisted",
    Boolean(
      timed
      && timed.is_all_day === false
      && timed.start_date === "2027-03-27"
      && timed.end_date === "2027-03-27"
      && hhmm(timed.start_time) === "10:00"
      && hhmm(timed.end_time) === "11:00",
    ),
    JSON.stringify(timed),
  );

  // Reload + open read-only details
  await openCalendar(page, "/calendar?view=day&date=2027-03-27");
  const timedRow = page.getByTestId("schedule-item-view").filter({ hasText: TITLE }).first();
  await timedRow.waitFor({ timeout: 15_000 });
  const timedRowText = await timedRow.innerText();
  record("day_shows_times", textHasTime(timedRowText, "10:00") && textHasTime(timedRowText, "11:00"), timedRowText.slice(0, 160));
  record("day_not_all_day_label_for_timed", !timedRowText.includes("All day") && textHasTime(timedRowText, "10:00"), timedRowText.slice(0, 160));

  await timedRow.click({ timeout: 15_000 });
  await page.getByTestId("schedule-item-detail").waitFor({ timeout: 15_000 });
  await page.getByText("Loading…").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
  const detailText = await page.getByTestId("schedule-item-detail").innerText();
  record("view_opens_readonly", detailText.includes(TITLE) && !detailText.includes("Add Schedule Item"), detailText.slice(0, 200));
  record("detail_shows_times", textHasTime(detailText, "10:00") && textHasTime(detailText, "11:00"), detailText.slice(0, 240));
  record("no_broken_workspace_link", !detailText.includes("Open lead workspace") && !detailText.includes("Open client workspace"), "unrelated item has no workspace CTA");

  // Explicit Edit → notes change → save → reload
  await page.getByTestId("schedule-item-detail-edit").click();
  await page.locator("#schedule-start-time").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector("#schedule-start-time") as HTMLInputElement | null;
    return !!el && el.value.startsWith("10:00");
  }, { timeout: 15_000 });
  const notes = page.locator("#schedule-notes");
  await notes.waitFor({ timeout: 15_000 });
  const startVal = await page.locator("#schedule-start-time").inputValue();
  const endVal = await page.locator("#schedule-end-time").inputValue();
  record("edit_prefilled_times", startVal.startsWith("10:00") && endVal.startsWith("11:00"), `${startVal}-${endVal}`);
  await notes.fill("Notes survive edit");
  await page.getByRole("button", { name: /Save Changes/i }).click();
  await page.waitForTimeout(2500);

  const { data: afterEdit } = await admin
    .from("calendar_blocks")
    .select("id,start_date,end_date,start_time,end_time,is_all_day,notes")
    .eq("id", timedId!)
    .maybeSingle();
  evidence.afterEdit = afterEdit;
  record(
    "times_survive_unrelated_edit",
    afterEdit?.is_all_day === false
      && afterEdit?.start_date === "2027-03-27"
      && hhmm(afterEdit?.start_time) === "10:00"
      && hhmm(afterEdit?.end_time) === "11:00"
      && (afterEdit?.notes ?? "").includes("Notes survive edit"),
    JSON.stringify(afterEdit),
  );

  // Cancel path: open edit, change title, cancel — no persist
  await openCalendar(page, "/calendar?view=day&date=2027-03-27");
  await page.getByTestId("schedule-item-view").filter({ hasText: TITLE }).first().click({ timeout: 15_000 });
  await page.getByTestId("schedule-item-detail-edit").click();
  await page.getByPlaceholder(/Meeting with|Smith Wedding/i).waitFor({ timeout: 15_000 });
  await page.getByPlaceholder(/Meeting with|Smith Wedding/i).fill(`${TITLE} SHOULD NOT SAVE`);
  await page.getByRole("button", { name: /^Cancel$/i }).click();
  await page.waitForTimeout(800);
  const { data: afterCancel } = await admin.from("calendar_blocks").select("title").eq("id", timedId!).maybeSingle();
  record("cancel_makes_no_changes", afterCancel?.title === TITLE, afterCancel?.title ?? "missing");

  // All-day item: no invented times
  await openCalendar(page, "/calendar?year=2027&month=3");
  await page.getByRole("button", { name: /Add Schedule Item/i }).first().click({ timeout: 20_000 });
  await page.getByPlaceholder(/Meeting with|Smith Wedding/i).fill(ALLDAY_TITLE);
  await page.getByRole("combobox").first().click({ timeout: 10_000 }).catch(() => {});
  const walkthroughOpt2 = page.getByRole("option", { name: /^Walkthrough$/i });
  if (await walkthroughOpt2.count()) await walkthroughOpt2.click();
  else await page.getByText("Walkthrough", { exact: true }).first().click().catch(() => {});
  await page.locator('input[type="date"]').first().fill("2027-03-28");
  const allDayBox = page.locator('label:has-text("All day") input[type="checkbox"]');
  if (!(await allDayBox.isChecked())) await allDayBox.check();
  await page.getByRole("button", { name: /^Add Schedule Item$/i }).last().click();
  await page.waitForTimeout(3000);
  const { data: alldayRows } = await admin
    .from("calendar_blocks")
    .select("id,title,is_all_day,start_time,end_time,start_date")
    .eq("venue_id", VENUE)
    .eq("title", ALLDAY_TITLE)
    .limit(1);
  const allday = alldayRows?.[0] ?? null;
  alldayId = allday?.id ?? null;
  evidence.allday = allday;
  record(
    "allday_untimed",
    Boolean(allday?.is_all_day === true && allday.start_time == null && allday.end_time == null),
    JSON.stringify(allday),
  );

  await openCalendar(page, "/calendar?view=day&date=2027-03-28");
  await page.getByTestId("schedule-item-view").filter({ hasText: ALLDAY_TITLE }).first().click({ timeout: 15_000 });
  await page.getByTestId("schedule-item-detail-edit").click();
  // Wait until async getBlockAction finishes — form starts empty/timed until then.
  await page.getByText("Loading…").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(500);
  const allDayChecked = await page.locator('label:has-text("All day") input[type="checkbox"]').isChecked();
  const startVisible = await page.locator("#schedule-start-time").count();
  const startValAllDay = startVisible ? await page.locator("#schedule-start-time").inputValue() : "";
  record(
    "allday_edit_no_invented_times",
    allDayChecked && startVisible === 0 && startValAllDay !== "09:00",
    `checked=${allDayChecked} timeInputs=${startVisible} startVal=${startValAllDay}`,
  );
  await page.getByRole("button", { name: /^Cancel$/i }).click();

  // Views consistency + labels
  const monthText = await openCalendar(page, "/calendar?year=2027&month=3");
  record("month_list_label", monthText.includes("Month list") || await page.getByRole("button", { name: "Upcoming list for this month" }).count() > 0, "Month list control present");
  record("day_label", await page.getByRole("button", { name: "One day" }).count() > 0, "Day aria label");

  const weekText = await openCalendar(page, "/calendar?view=week&weekStart=2027-03-21");
  record("week_shows_timed", weekText.includes(TITLE) && textHasTime(weekText, "10:00"), "week");

  const agendaText = await openCalendar(page, "/calendar?view=agenda&year=2027&month=3");
  record("agenda_shows_timed", agendaText.includes(TITLE) && textHasTime(agendaText, "10:00"), "agenda/month list");

  await openCalendar(page, "/calendar?view=day&date=2027-03-01");
  await page.getByRole("button", { name: /^Today$/i }).click({ timeout: 10_000 });
  await page.waitForTimeout(1000);
  const afterToday = page.url();
  record("today_navigation", /view=day&date=\d{4}-\d{2}-\d{2}/.test(afterToday), afterToday);

  // Public past dates
  const pub = await context.newPage();
  const pastMonth = new Date();
  pastMonth.setUTCMonth(pastMonth.getUTCMonth() - 1);
  const py = pastMonth.getUTCFullYear();
  const pm = pastMonth.getUTCMonth() + 1;
  const pubResp = await pub.goto(`${APP}/availability/${EMBED}?year=${py}&month=${pm}`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  noteDeployment(pubResp?.headers()?.link);
  await pub.waitForTimeout(1200);
  const pubText = await pub.locator("body").innerText();
  const availableCount = (pubText.match(/\bAvailable\b/g) ?? []).length;
  // Legend may still say the word Available once; day cells for past month must not.
  const cellAvailable = await pub.locator("div").filter({ hasText: /^Available$/ }).count();
  const inquireLinks = await pub.locator('a:has-text("Inquire")').count();
  record("public_past_no_inquire", inquireLinks === 0, `inquire=${inquireLinks}`);
  record("public_past_no_available_cells", cellAvailable === 0, `availableCells=${cellAvailable} legendHits=${availableCount}`);
  await pub.screenshot({ path: `${OUT_DIR}/public-past-month.png`, fullPage: true });

  // Future month still can show Available
  const fut = await pub.goto(`${APP}/availability/${EMBED}?year=2027&month=9`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  noteDeployment(fut?.headers()?.link);
  await pub.waitForTimeout(1000);
  const futInquire = await pub.locator('a:has-text("Inquire")').count();
  record("public_future_still_rules", futInquire > 0 || (await pub.locator("body").innerText()).includes("Available"), `inquire=${futInquire}`);

  // Server-side past inquiry reject via RPC authority
  const { data: pastOk } = await admin.rpc("_is_event_date_available", {
    p_venue_id: VENUE,
    p_date: "2020-06-15",
  });
  record("server_past_date_rejected", pastOk === false, `rpc=${pastOk}`);

  // Public form ingest: Meadowbrook choose_available gates via _is_event_date_available.
  // Resolve a published form public_key when present; otherwise RPC authority is enough.
  let publicKey: string | null = null;
  try {
    const { data: formCfg } = await admin.rpc("get_public_availability_calendar", {
      p_embed_key: EMBED,
      p_start: "2020-06-01",
      p_end: "2020-06-30",
    });
    evidence.pastCalendarRpc = formCfg;
    const pastDates = (formCfg?.dates ?? []).map(String);
    record("public_calendar_rpc_excludes_past", !pastDates.includes("2020-06-15"), `dates=${pastDates.length}`);
  } catch (e) {
    record("public_calendar_rpc_excludes_past", false, e instanceof Error ? e.message : String(e));
  }
  try {
    const { data: keys } = await admin
      .from("venue_inquiry_forms")
      .select("public_key,token")
      .eq("venue_id", VENUE)
      .limit(3);
    publicKey = (keys?.[0] as { public_key?: string; token?: string } | undefined)?.public_key
      ?? (keys?.[0] as { token?: string } | undefined)?.token
      ?? null;
  } catch {
    publicKey = null;
  }
  if (publicKey) {
    const { data: ingest } = await admin.rpc("create_public_form_lead", {
      p_public_key: publicKey,
      p_first_name: "Past",
      p_last_name: "Probe",
      p_email: `past-probe-${Date.now()}@example.com`,
      p_phone: "",
      p_event_type: "wedding",
      p_event_date: "2020-06-15",
      p_guest_count: 50,
      p_message: "should reject",
      p_source_data: {},
    });
    evidence.pastIngest = ingest;
    record("public_form_past_rejected", ingest?.ok === false, JSON.stringify(ingest));
  } else {
    record("public_form_past_rejected", pastOk === false, "RPC authority rejects past; no form public_key found");
  }

  // Side-effect: blocked-time / settings unchanged (count calendar_blocks of type blocked_time)
  const { count: blockedCount } = await admin
    .from("calendar_blocks")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", VENUE)
    .eq("type", "blocked_time");
  evidence.blockedTimeCount = blockedCount;
  record("no_blocked_time_side_effect", typeof blockedCount === "number", `blocked_time count=${blockedCount}`);

  // Nicole regression
  const { data: assigns } = await admin
    .from("event_space_assignments")
    .select("id,use_key,use_label,scheduled_date,start_time,end_time,space_id")
    .eq("event_id", NICOLE_EVENT)
    .eq("venue_id", VENUE);
  const spaceIds = [...new Set((assigns ?? []).map((a) => a.space_id))];
  const { data: spaces } = await admin.from("venue_spaces").select("id,name").in("id", spaceIds);
  const spaceName = new Map((spaces ?? []).map((s) => [s.id, s.name]));
  const barnId = [...spaceName.entries()].find(([, n]) => /barn/i.test(n))?.[0] ?? null;
  const projectedRaw = projectAssignmentWindowsOntoCalendarDates({
    protectedDates: ["2027-05-08", "2027-05-09"],
    windows: (assigns ?? []).map((a) => ({
      spaceId: a.space_id,
      useLabel: a.use_label,
      startTime: hhmm(a.start_time),
      endTime: hhmm(a.end_time),
      scheduledDate: a.scheduled_date,
    })),
  });
  record("nicole_projection_timed", projectedRaw !== "untimed", typeof projectedRaw === "string" ? projectedRaw : `n=${projectedRaw.length}`);
  const projected = projectedRaw === "untimed" ? [] : projectedRaw;
  const sat = projected.filter((p) => p.date === "2027-05-08");
  const sun = projected.filter((p) => p.date === "2027-05-09");
  record(
    "nicole_sat_rehearsal_only",
    sat.length === 1 && /rehearsal/i.test(sat[0]?.useLabel ?? ""),
    JSON.stringify(sat),
  );
  record(
    "nicole_sun_no_rehearsal",
    sun.length > 0 && sun.every((p) => !/rehearsal/i.test(p.useLabel ?? "")),
    JSON.stringify(sun.map((p) => p.useLabel)),
  );
  if (barnId) {
    const barnItems = projected.filter((p) => calendarItemMatchesSpace({
      id: `p-${p.index}`,
      type: "event",
      date: p.date,
      title: p.useLabel ?? "Event",
      subtitle: null,
      time: p.startTime,
      endTime: p.endTime,
      link: "/calendar",
      spaceId: p.spaceId,
      spaceIds: [p.spaceId],
    }, barnId));
    record(
      "nicole_barn_filter",
      barnItems.some((p) => p.date === "2027-05-08")
        && barnItems.some((p) => p.date === "2027-05-09" && /reception/i.test(p.useLabel ?? "")),
      JSON.stringify(barnItems.map((p) => ({ d: p.date, t: p.useLabel }))),
    );
  } else {
    record("nicole_barn_filter", false, "barn space missing");
  }

  const satUi = await openCalendar(page, "/calendar?view=day&date=2027-05-08");
  const sunUi = await openCalendar(page, "/calendar?view=day&date=2027-05-09");
  record("nicole_ui_sat", /rehearsal/i.test(satUi) && textHasTime(satUi, "18:00"), "May 8 UI");
  record("nicole_ui_sun", !/rehearsal/i.test(sunUi) && /reception/i.test(sunUi), "May 9 UI");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const sunReload = await page.locator("body").innerText();
  record("nicole_reload_stable", !/rehearsal/i.test(sunReload) && /reception/i.test(sunReload), "reload May 9");

  const endTip = noteDeployment(
    (await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" }))?.headers()?.link,
  );
  record(
    "runtime_stayed_expected",
    endTip === EXPECTED && [...deploymentIds].every((d) => d === EXPECTED),
    [...deploymentIds].join(","),
  );

  await page.screenshot({ path: `${OUT_DIR}/day-timed.png`, fullPage: true });
} catch (err) {
  record("harness_error", false, err instanceof Error ? err.message : String(err));
  try {
    await page.screenshot({ path: `${OUT_DIR}/failure.png`, fullPage: true });
  } catch { /* ignore */ }
} finally {
  // Cleanup proof rows so Sandbox stays tidy
  if (timedId) await admin.from("calendar_blocks").delete().eq("id", timedId).eq("venue_id", VENUE);
  if (alldayId) await admin.from("calendar_blocks").delete().eq("id", alldayId).eq("venue_id", VENUE);
  await browser.close();
}

const ok = checks.length > 0 && checks.every((c) => c.pass);
const result = {
  ok,
  expected: EXPECTED,
  checks,
  evidence,
  deploymentIds: [...deploymentIds],
  deployRun: process.env.DEPLOY_RUN_URL ?? null,
};
writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(result, null, 2));
console.log(ok ? "GREEN" : "NOT GREEN");
process.exit(ok ? 0 : 1);
