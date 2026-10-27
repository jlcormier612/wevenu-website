/**
 * Timeline P1a — Sandbox browser + persisted acceptance.
 * Temporary QA rows use title prefix P1A-{RUN}- and are deleted on cleanup.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import {
  projectTimingAfterEventDateChange,
  provenanceFromTemplateApply,
  timingColumnsForUntypedDisplaySave,
  type TimingProvenance,
} from "@/lib/timeline/timing-provenance";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const RUN = process.env.E2E_RUN_ID ?? `P1A${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/timeline-p1a-timing-provenance";
mkdirSync(`${OUT}/shots`, { recursive: true });
const PREFIX = `P1A-${RUN}-`;

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
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 420)}`);
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

async function staffCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
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
      value: FANCY,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];
}

async function insertEntry(row: Record<string, unknown>) {
  const { data, error } = await admin
    .from("timeline_entries")
    .insert({
      venue_id: FANCY,
      event_id: EVENT,
      owner: "venue",
      lock_state: "editable",
      status: "not_started",
      audiences: ["client"],
      sort_order: 9000,
      ...row,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Record<string, unknown>;
}

async function cleanupQaRows(titleLike = `${PREFIX}%`) {
  const { data } = await admin
    .from("timeline_entries")
    .select("id,title")
    .eq("venue_id", FANCY)
    .eq("event_id", EVENT)
    .like("title", titleLike);
  const ids = (data ?? []).map((r) => r.id);
  if (ids.length) {
    await admin.from("timeline_entries").delete().in("id", ids).eq("venue_id", FANCY);
  }
  return ids.length;
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const image = await servingImage();
  const shaFromImage = image.split(":").pop() ?? "";
  record("serving-sha", shaFromImage.startsWith(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);

  const health = await fetch(`${APP}/api/health`).then((r) => r.json());
  record("health", health?.ok === true && health?.checks?.supabase === "ok", JSON.stringify(health));

  const { data: event } = await admin
    .from("events")
    .select("id,event_date,event_end_date,start_time")
    .eq("id", EVENT)
    .eq("venue_id", FANCY)
    .single();
  if (!event?.event_date) throw new Error("fixture event missing");
  const eventDate = String(event.event_date).slice(0, 10);
  const priorEnd = event.event_end_date;
  const priorStart = event.start_time;

  // Clear this run's prefix and any leftover P1A-* rows from a prior crashed run.
  await cleanupQaRows("P1A-%");

  // ——— Persisted provenance seeds ———
  const unknown = await insertEntry({
    title: `${PREFIX}unknown`,
    day_offset: 0,
    entry_time: "10:00",
    timing_day_intent: null,
    timing_clock_intent: null,
    timing_attention: "unknown_intent",
  });
  const relative = await insertEntry({
    title: `${PREFIX}relative-start`,
    day_offset: 0,
    entry_time: "16:30",
    timing_day_intent: "relative",
    timing_day_anchor: "event_start",
    timing_relative_day_offset: 0,
    timing_day_offset_overridden: false,
    timing_template_day_offset: 0,
    timing_template_day_anchor: "event_start",
    timing_clock_intent: "relative",
    timing_relative_minutes: 30,
    timing_clock_overridden: false,
  });
  const fixed = await insertEntry({
    title: `${PREFIX}fixed`,
    day_offset: 2,
    entry_time: "15:00",
    timing_day_intent: "fixed",
    timing_fixed_date: (() => {
      const [y, m, d] = eventDate.split("-").map(Number);
      const dt = new Date(y!, m! - 1, d! + 2);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    })(),
    timing_clock_intent: "explicit",
    timing_clock_overridden: false,
  });
  const endAnchored = await insertEntry({
    title: `${PREFIX}end-anchored`,
    day_offset: 0,
    entry_time: "18:00",
    timing_day_intent: "relative",
    timing_day_anchor: "event_end",
    timing_relative_day_offset: 0,
    timing_template_day_offset: 0,
    timing_template_day_anchor: "event_end",
    timing_clock_intent: "explicit",
    timing_attention: "missing_event_end",
  });
  const shared = await insertEntry({
    title: `${PREFIX}shared`,
    day_offset: 1,
    entry_time: "12:00",
    audiences: ["client"],
    timing_day_intent: "relative",
    timing_day_anchor: "event_start",
    timing_relative_day_offset: 1,
    timing_template_day_offset: 1,
    timing_template_day_anchor: "event_start",
    timing_clock_intent: "explicit",
  });
  const generated = await insertEntry({
    title: `${PREFIX}generated`,
    day_offset: 0,
    entry_time: "14:00",
    source_space_use_key: `qa_p1a_${RUN}`,
    timing_day_intent: null,
    timing_clock_intent: null,
    timing_attention: "unknown_intent",
  });

  record(
    "seed-unknown-intent",
    unknown.timing_day_intent == null && unknown.timing_attention === "unknown_intent",
    JSON.stringify({ intent: unknown.timing_day_intent, attention: unknown.timing_attention }),
  );
  record(
    "seed-relative-vs-fixed",
    relative.timing_day_intent === "relative" && fixed.timing_day_intent === "fixed" && !!fixed.timing_fixed_date,
    JSON.stringify({ relative: relative.timing_day_intent, fixed: fixed.timing_day_intent, date: fixed.timing_fixed_date }),
  );
  record(
    "seed-end-attention-missing-end",
    endAnchored.timing_day_anchor === "event_end" && endAnchored.timing_attention === "missing_event_end",
    JSON.stringify({ anchor: endAnchored.timing_day_anchor, attention: endAnchored.timing_attention, end: event.event_end_date }),
  );

  // Missing end: template apply must not invent start-relative day
  const missingEndApply = provenanceFromTemplateApply({
    dayOffset: -1,
    dayAnchor: "event_end",
    timeOfDay: "18:00",
    minutesOffset: null,
    eventDate,
    eventEndDate: null,
    eventStartTime: "16:00",
    preserveDayOffset: 3,
  });
  record(
    "missing-end-no-start-fallback",
    missingEndApply.attention === "missing_event_end"
      && missingEndApply.dayOffset === 3
      && missingEndApply.relativeDayOffset === -1,
    JSON.stringify(missingEndApply),
  );

  // Invalid end
  const invalidEndApply = provenanceFromTemplateApply({
    dayOffset: 0,
    dayAnchor: "event_end",
    timeOfDay: null,
    minutesOffset: null,
    eventDate: "2028-10-05",
    eventEndDate: "2028-10-01",
    eventStartTime: null,
    preserveDayOffset: 2,
  });
  record(
    "invalid-end-no-start-fallback",
    invalidEndApply.attention === "invalid_event_end" && invalidEndApply.dayOffset === 2,
    JSON.stringify(invalidEndApply),
  );

  // Shared schedule projection blocked
  const sharedProv: TimingProvenance = {
    dayIntent: "relative",
    dayAnchor: "event_start",
    relativeDayOffset: 1,
    dayOffsetOverridden: false,
    templateDayOffset: 1,
    templateDayAnchor: "event_start",
    fixedDate: null,
    clockIntent: "explicit",
    relativeMinutes: null,
    clockOverridden: false,
    attention: null,
  };
  const sharedProj = projectTimingAfterEventDateChange(
    sharedProv,
    { dayOffset: 1, entryTime: "12:00" },
    {
      previousEventDate: eventDate,
      nextEventDate: "2099-01-01",
      nextEndDate: null,
      sharedWithCouple: true,
    },
  );
  // P1c: projection may be eligible for working rows; the helper still does not write.
  // Couple protection is P1b release snapshots, not this audience flag.
  record(
    "shared-schedule-not-rewritten",
    sharedProj.eligible === true
      && sharedProj.blockedReason === null
      && sharedProj.dayOffset === 1
      && sharedProj.entryTime === "12:00",
    JSON.stringify(sharedProj),
  );
  const { data: sharedAfter } = await admin
    .from("timeline_entries")
    .select("day_offset,entry_time,timing_day_intent")
    .eq("id", shared.id)
    .single();
  record(
    "shared-row-unchanged-in-db",
    sharedAfter?.day_offset === 1
      && String(sharedAfter?.entry_time).startsWith("12:00")
      && sharedAfter?.timing_day_intent === "relative",
    JSON.stringify(sharedAfter),
  );

  // Untyped save rules (mirrors Save all / schedule sync)
  const fixedKeep = timingColumnsForUntypedDisplaySave(
    { dayIntent: "fixed", dayAnchor: null, clockIntent: "explicit", dayOffset: 2, entryTime: "15:00" },
    { dayOffset: 9, entryTime: "15:00" },
  );
  record("untyped-fixed-day-preserved", fixedKeep.dayOffset === 2, JSON.stringify(fixedKeep));
  const endKeep = timingColumnsForUntypedDisplaySave(
    { dayIntent: "relative", dayAnchor: "event_end", clockIntent: "explicit", dayOffset: 0, entryTime: "18:00" },
    { dayOffset: 6, entryTime: "18:00" },
  );
  record("untyped-end-day-preserved", endKeep.dayOffset === 0, JSON.stringify(endKeep));
  const unknownKeep = timingColumnsForUntypedDisplaySave(
    { dayIntent: null, dayAnchor: null, clockIntent: null, dayOffset: 0, entryTime: "10:00" },
    { dayOffset: 3, entryTime: "11:00" },
  );
  record(
    "untyped-unknown-stays-unknown",
    unknownKeep.dayOffset === 3 && Object.keys(unknownKeep.timingColumns).length === 0,
    JSON.stringify(unknownKeep),
  );

  // Schedule-sync style update on generated unknown row: day may move, intent stays null
  await admin
    .from("timeline_entries")
    .update({ day_offset: 1, entry_time: "15:00" })
    .eq("id", generated.id)
    .eq("venue_id", FANCY);
  const { data: genAfter } = await admin
    .from("timeline_entries")
    .select("day_offset,entry_time,timing_day_intent,timing_attention")
    .eq("id", generated.id)
    .single();
  record(
    "schedule-unknown-follows-day-keeps-null-intent",
    genAfter?.day_offset === 1
      && String(genAfter?.entry_time).startsWith("15:00")
      && genAfter?.timing_day_intent == null,
    JSON.stringify(genAfter),
  );

  // Fixed generated-like: day must not move when untyped rules applied via update of display only
  // Simulate schedule sync helper outcome by forcing a day change attempt then restoring via rule
  const fixedSync = timingColumnsForUntypedDisplaySave(
    {
      dayIntent: "fixed",
      dayAnchor: null,
      clockIntent: "explicit",
      dayOffset: Number(fixed.day_offset),
      entryTime: "15:00",
    },
    { dayOffset: Number(fixed.day_offset) + 3, entryTime: "16:00" },
  );
  await admin
    .from("timeline_entries")
    .update({
      day_offset: fixedSync.dayOffset,
      entry_time: fixedSync.entryTime,
      ...fixedSync.timingColumns,
    })
    .eq("id", fixed.id)
    .eq("venue_id", FANCY);
  const { data: fixedAfter } = await admin
    .from("timeline_entries")
    .select("day_offset,entry_time,timing_day_intent,timing_fixed_date,timing_clock_intent")
    .eq("id", fixed.id)
    .single();
  record(
    "schedule-fixed-day-preserved-clock-may-update",
    fixedAfter?.day_offset === 2
      && fixedAfter?.timing_day_intent === "fixed"
      && !!fixedAfter?.timing_fixed_date
      && String(fixedAfter?.entry_time).startsWith("16:00")
      && fixedAfter?.timing_clock_intent === "explicit",
    JSON.stringify(fixedAfter),
  );

  // Venue export via staff session RPC
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (otpErr || !otp?.session) throw otpErr ?? new Error("staff otp");
  const staff = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${otp.session.access_token}` } },
  });
  // Active venue cookie is app-side; RPC uses current_user_venue_id from staff membership.
  const { data: exportJson, error: exportErr } = await staff.rpc("get_venue_export", { p_venue_id: FANCY });
  if (exportErr) {
    record("venue-export-rpc", false, exportErr.message);
  } else if (exportJson && typeof exportJson === "object" && "error" in (exportJson as object)) {
    record("venue-export-rpc", false, JSON.stringify(exportJson));
  } else {
    const collections = (exportJson as { collections?: Record<string, unknown[]> })?.collections
      ?? (exportJson as Record<string, unknown>);
    const entries = (collections as { timeline_entries?: Record<string, unknown>[] })?.timeline_entries
      ?? [];
    const sample = entries.find((e) => String(e.title ?? "").startsWith(PREFIX))
      ?? entries[0]
      ?? {};
    const keys = Object.keys(sample);
    const needed = [
      "timing_day_intent",
      "timing_day_anchor",
      "timing_relative_day_offset",
      "timing_day_offset_overridden",
      "timing_template_day_offset",
      "timing_template_day_anchor",
      "timing_fixed_date",
      "timing_clock_intent",
      "timing_relative_minutes",
      "timing_clock_overridden",
      "timing_attention",
    ];
    const missing = needed.filter((k) => !keys.includes(k));
    record(
      "venue-export-timing-fields",
      missing.length === 0,
      missing.length ? `missing=${missing.join(",")}` : `sample_keys_ok title=${sample.title}`,
    );
  }

  // ——— Browser Save All + timing controls ———
  // Booked events redirect /events/:id → /clients/:id; setup editor opens from Event Setup.
  let browser: any = null;
  let unknownDayBeforeSave: number | null = null;
  let unknownTimeBeforeSave: string | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies(await staffCookies());
    const page = await context.newPage();

    await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${OUT}/shots/event-setup-1280.png`, fullPage: false });
    record(
      "browser-timeline-loaded",
      /Event setup|Timeline|Planning|Open Timeline|Change for this event/i.test(await page.locator("body").innerText()),
      `url=${page.url()}`,
    );

    const changeTimeline = page.getByTestId("event-setup-change-timeline");
    const openTimeline = page.getByTestId("event-setup-open-timeline");
    const opener = (await changeTimeline.count()) > 0 ? changeTimeline : openTimeline;
    let editorOpen = false;
    try {
      await opener.scrollIntoViewIfNeeded();
      await opener.click({ timeout: 20_000 });
      const editor = page.getByTestId("event-timeline-setup-editor");
      await editor.waitFor({ state: "visible", timeout: 20_000 });
      await page.getByTestId("timeline-setup-mode-customize").click();
      await page.waitForTimeout(1000);
      await page.getByTestId("timeline-setup-customize-path").waitFor({ state: "visible", timeout: 10_000 });
      editorOpen = true;
      record("setup-editor-open", true, "customize path visible");
      await page.screenshot({ path: `${OUT}/shots/setup-editor-1280.png`, fullPage: false });
    } catch (e) {
      record("setup-editor-open", false, String(e).slice(0, 400));
      await page.screenshot({ path: `${OUT}/shots/setup-editor-fail-1280.png`, fullPage: false });
    }

    if (editorOpen) {
      const unknownRow = page.getByTestId("timeline-setup-row").filter({
        has: page.locator(`input[aria-label="Timeline item title"][value="${PREFIX}unknown"]`),
      }).first();
      const unknownVisible = await unknownRow.isVisible().catch(() => false);
      record("browser-unknown-row-visible", unknownVisible, `${PREFIX}unknown`);

      if (unknownVisible) {
        const dayCtl = unknownRow.getByTestId("timeline-setup-row-day");
        const timeCtl = unknownRow.getByTestId("timeline-setup-row-time");
        unknownDayBeforeSave = Number(await dayCtl.inputValue().catch(async () => {
          const t = await dayCtl.innerText();
          const m = t.match(/Day\s+(\d+)/i);
          return m ? String(Number(m[1]) - 1) : "0";
        }).catch(() => "0"));
        // Flip day via select: open and pick a different Day option
        await dayCtl.click({ timeout: 10_000 });
        await page.waitForTimeout(300);
        const options = page.getByRole("option");
        const optionCount = await options.count();
        let picked = false;
        for (let i = 0; i < optionCount; i += 1) {
          const label = await options.nth(i).innerText();
          if (/Day\s+[23]/i.test(label) || /day after/i.test(label)) {
            await options.nth(i).click();
            picked = true;
            break;
          }
        }
        if (!picked && optionCount > 1) {
          await options.nth(Math.min(2, optionCount - 1)).click();
          picked = true;
        }
        record("browser-unknown-day-changed", picked, `beforeDay=${unknownDayBeforeSave}`);
        // Nudge clock with AM/PM so TimeAmPmInput publishes into draft state
        await timeCtl.click();
        await timeCtl.fill("10:15 AM");
        await timeCtl.press("Tab");
        await page.waitForTimeout(300);
        unknownTimeBeforeSave = "10:15";
      }

      // Add a new untyped row via setup editor
      const newTitle = page.getByTestId("timeline-setup-new-title");
      if (await newTitle.isVisible().catch(() => false)) {
        await newTitle.fill(`${PREFIX}ui-new`);
        const newTime = page.getByTestId("timeline-setup-new-time");
        if (await newTime.isVisible().catch(() => false)) {
          await newTime.fill("1:45 PM");
          await newTime.press("Tab");
        }
        await page.getByTestId("timeline-setup-add-item").click();
        await page.waitForTimeout(800);
        const draftNew = page.getByTestId("timeline-setup-row").filter({
          has: page.locator(`input[aria-label="Timeline item title"][value="${PREFIX}ui-new"]`),
        }).first();
        record(
          "browser-new-row-in-draft",
          await draftNew.isVisible().catch(() => false),
          `${PREFIX}ui-new`,
        );
      }

      const saveAll = page.getByTestId("timeline-setup-save-all");
      const saveVisible = await saveAll.isVisible().catch(() => false);
      record("save-all-control", saveVisible, "timeline-setup-save-all");
      if (saveVisible) {
        await saveAll.click();
        // Wait until Save finishes (button no longer shows spinner / unsaved cleared)
        await page.waitForFunction(
          () => {
            const btn = document.querySelector('[data-testid="timeline-setup-save-all"]');
            const status = Array.from(document.querySelectorAll("p")).some((p) =>
              /No unsaved timeline edits/i.test(p.textContent || ""),
            );
            const spinning = !!btn?.querySelector(".animate-spin");
            return !spinning && status;
          },
          { timeout: 45_000 },
        ).catch(() => null);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${OUT}/shots/after-save-all-1280.png`, fullPage: false });
        const batchErrText = await page.getByTestId("timeline-setup-batch-error").innerText().catch(() => "");
        record("save-all-no-batch-error", !batchErrText, batchErrText || "ok");

        const { data: prefixRows } = await admin
          .from("timeline_entries")
          .select("id,title,timing_day_intent,timing_clock_intent,day_offset,entry_time,timing_attention")
          .eq("event_id", EVENT)
          .eq("venue_id", FANCY)
          .like("title", `${PREFIX}%`);
        const uiNew = (prefixRows ?? []).find((r) => r.title === `${PREFIX}ui-new`) ?? null;
        record(
          "save-all-new-row-no-invented-intent",
          !!uiNew && uiNew.timing_day_intent == null && uiNew.timing_clock_intent == null,
          JSON.stringify({ uiNew, titles: (prefixRows ?? []).map((r) => r.title) }),
        );

        const unknownAfter = (prefixRows ?? []).find((r) => r.id === unknown.id)
          ?? (await admin
            .from("timeline_entries")
            .select("id,day_offset,entry_time,timing_day_intent,timing_clock_intent,timing_attention")
            .eq("id", unknown.id)
            .single()).data;
        const timeSlice = String(unknownAfter?.entry_time ?? "").slice(0, 5);
        const dayMoved = unknownAfter != null
          && unknownDayBeforeSave != null
          && Number(unknownAfter.day_offset) !== unknownDayBeforeSave;
        record(
          "save-all-unknown-persisted-no-invented-intent",
          !!unknownAfter
            && unknownAfter.timing_day_intent == null
            && (unknownAfter.timing_attention === "unknown_intent" || unknownAfter.timing_attention == null)
            && timeSlice === "10:15"
            && dayMoved,
          JSON.stringify({ unknownAfter, unknownTimeBeforeSave, unknownDayBeforeSave, dayMoved }),
        );

        // Reload page, reopen editor, confirm values stick
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(3000);
        const opener2 = (await page.getByTestId("event-setup-change-timeline").count()) > 0
          ? page.getByTestId("event-setup-change-timeline")
          : page.getByTestId("event-setup-open-timeline");
        await opener2.click({ timeout: 20_000 }).catch(() => null);
        await page.getByTestId("event-timeline-setup-editor").waitFor({ state: "visible", timeout: 20_000 }).catch(() => null);
        await page.getByTestId("timeline-setup-mode-customize").click().catch(() => null);
        await page.waitForTimeout(1500);
        const reloadedUnknown = page.getByTestId("timeline-setup-row").filter({
          has: page.locator(`input[aria-label="Timeline item title"][value="${PREFIX}unknown"]`),
        }).first();
        const reloadedTime = await reloadedUnknown.getByTestId("timeline-setup-row-time").inputValue().catch(() => "");
        const { data: unknownReloadUi } = await admin
          .from("timeline_entries")
          .select("day_offset,entry_time,timing_day_intent")
          .eq("id", unknown.id)
          .single();
        const reloadTimeOk = String(unknownReloadUi?.entry_time ?? "").slice(0, 5) === "10:15";
        const uiTimeOk = /10:15/.test(reloadedTime);
        record(
          "save-all-reload-consistent",
          unknownReloadUi?.timing_day_intent == null && reloadTimeOk && uiTimeOk,
          JSON.stringify({ unknownReloadUi, reloadedTime, url: page.url() }),
        );
      }
    }

    // Timeline management tab — progressive timing controls on Edit
    await page.goto(`${APP}/events/${EVENT}?tab=timeline`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/shots/timeline-tab-1280.png`, fullPage: false });
    const bodyHasSeed = await page.locator("body").innerText().then((t: string) => t.includes(`${PREFIX}unknown`)).catch(() => false);
    record("browser-timeline-tab-shows-seeds", bodyHasSeed, `url=${page.url()}`);

    // Prefer editing the unknown seeded row
    const unknownCard = page.getByText(`${PREFIX}unknown`, { exact: false }).first();
    if (await unknownCard.isVisible().catch(() => false)) {
      await unknownCard.click().catch(() => null);
      await page.waitForTimeout(400);
    }
    // Edit affordance is hover-revealed; force click so headless can reach it.
    const editBtn = page.locator('button[aria-label="Edit"]').first();
    if (await editBtn.count() > 0) {
      await editBtn.click({ force: true });
      await page.waitForTimeout(1000);
      const timing = page.getByTestId("timeline-timing-controls");
      const timingVisible = await timing.isVisible().catch(() => false);
      // details may be collapsed — open summary
      if (!timingVisible) {
        const summary = page.locator('[data-testid="timeline-timing-controls"] summary').first();
        if (await summary.isVisible().catch(() => false)) await summary.click();
      }
      const openTiming = await page.getByTestId("timeline-timing-controls").isVisible().catch(() => false);
      record("browser-timing-controls", openTiming, "progressive timing details");
      const unknownHint = await page.getByTestId("timeline-timing-unknown").isVisible().catch(() => false);
      record("browser-unknown-timing-hint", unknownHint, "legacy unknown copy");
      await page.screenshot({ path: `${OUT}/shots/timing-controls-1280.png`, fullPage: false });
      await page.keyboard.press("Escape").catch(() => null);
    } else {
      // Try aria-label Edit on row actions
      const ariaEdit = page.getByRole("button", { name: /^Edit$/i }).or(page.locator('button[aria-label="Edit"]')).first();
      if (await ariaEdit.isVisible().catch(() => false)) {
        await ariaEdit.click();
        await page.waitForTimeout(1000);
        const openTiming = await page.getByTestId("timeline-timing-controls").isVisible().catch(() => false);
        record("browser-timing-controls", openTiming, "via aria-label Edit");
      } else {
        record("browser-timing-controls", false, "no Edit button on timeline tab");
        await page.screenshot({ path: `${OUT}/shots/timing-controls-missing-1280.png`, fullPage: false });
      }
    }

    // End-anchored attention on edit — row cards use class "group"
    try {
      const endEdit = page
        .locator(".group")
        .filter({ hasText: `${PREFIX}end-anchored` })
        .locator('button[aria-label="Edit"]')
        .first();
      if (await endEdit.count() > 0) {
        await endEdit.click({ force: true });
        await page.waitForTimeout(1000);
        const endAttn = await page.getByTestId("timeline-timing-end-attention").isVisible().catch(() => false);
        record("browser-end-attention-hint", endAttn, "missing/invalid end copy");
        await page.screenshot({ path: `${OUT}/shots/end-attention-1280.png`, fullPage: false });
        const cancel = page.getByRole("button", { name: /Cancel/i }).first();
        if (await cancel.isVisible().catch(() => false)) await cancel.click().catch(() => null);
        else await page.keyboard.press("Escape").catch(() => null);
      } else {
        record("browser-end-attention-hint", false, "end-anchored row not found on timeline tab");
      }
    } catch (e) {
      record("browser-end-attention-hint", false, String(e).slice(0, 400));
      await page.screenshot({ path: `${OUT}/shots/end-attention-fail-1280.png`, fullPage: false }).catch(() => null);
    }

    const { data: unknownReload } = await admin
      .from("timeline_entries")
      .select("day_offset,entry_time,timing_day_intent,timing_attention")
      .eq("id", unknown.id)
      .single();
    record(
      "reload-unknown-still-unknown",
      unknownReload?.timing_day_intent == null,
      JSON.stringify(unknownReload),
    );
    const { data: fixedReload } = await admin
      .from("timeline_entries")
      .select("day_offset,timing_day_intent,timing_fixed_date")
      .eq("id", fixed.id)
      .single();
    record(
      "reload-fixed-still-fixed",
      fixedReload?.timing_day_intent === "fixed" && !!fixedReload?.timing_fixed_date && fixedReload?.day_offset === 2,
      JSON.stringify(fixedReload),
    );
    const { data: relativeReload } = await admin
      .from("timeline_entries")
      .select("day_offset,entry_time,timing_day_intent,timing_day_anchor,timing_relative_day_offset")
      .eq("id", relative.id)
      .single();
    record(
      "reload-relative-still-relative",
      relativeReload?.timing_day_intent === "relative"
        && relativeReload?.timing_day_anchor === "event_start"
        && relativeReload?.timing_relative_day_offset === 0,
      JSON.stringify(relativeReload),
    );
    const { data: endReload } = await admin
      .from("timeline_entries")
      .select("timing_day_anchor,timing_attention,timing_day_intent")
      .eq("id", endAnchored.id)
      .single();
    record(
      "reload-end-still-needs-resolution",
      endReload?.timing_day_anchor === "event_end"
        && endReload?.timing_attention === "missing_event_end"
        && endReload?.timing_day_intent === "relative",
      JSON.stringify(endReload),
    );
  } catch (e) {
    record("browser-section-error", false, String(e).slice(0, 800));
    console.error(e);
  } finally {
    if (browser) await browser.close().catch(() => null);
  }

  const deleted = await cleanupQaRows("P1A-%");
  const { count: leftover } = await admin
    .from("timeline_entries")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", FANCY)
    .eq("event_id", EVENT)
    .like("title", "P1A-%");
  record("cleanup-qa-rows", (leftover ?? 0) === 0, `deleted=${deleted} leftover=${leftover}`);

  // Restore event times if we changed them (we did not in this harness)
  await admin
    .from("events")
    .update({ event_end_date: priorEnd, start_time: priorStart })
    .eq("id", EVENT)
    .eq("venue_id", FANCY);

  const summary = {
    run: RUN,
    expectedSha: EXPECTED,
    servingImage: image,
    eventId: EVENT,
    pass: checks.filter((c) => c.pass).length,
    fail: checks.filter((c) => !c.pass).length,
    checks,
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ pass: summary.pass, fail: summary.fail }, null, 2));
  if (summary.fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
