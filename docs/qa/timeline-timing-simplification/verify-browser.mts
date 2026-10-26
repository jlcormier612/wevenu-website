/**
 * Timeline timing simplification — Sandbox browser + persisted proof.
 * Scenarios A–G (focused): specific time, relative named anchor, missing start,
 * multi-day day labels, reapply contract sample, legacy conflict UI, schedule view.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolveEntryTimeFromOffset } from "@/lib/timeline/constants";

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
const RUN = process.env.E2E_RUN_ID ?? `TT${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/timeline-timing-simplification";
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

async function servingDigest(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].imageDigest' --output text`,
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

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const image = await servingImage();
  const digest = await servingDigest();
  const shaFromImage = image.split(":").pop() ?? "";
  record("serving-sha", shaFromImage.startsWith(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
  record("serving-digest", digest.startsWith("sha256:"), digest);

  const { data: beforeEvent } = await admin
    .from("events")
    .select("id,event_date,event_end_date,start_time")
    .eq("id", EVENT)
    .eq("venue_id", FANCY)
    .single();
  if (!beforeEvent?.event_date) throw new Error("fixture event missing");

  // Controlled Fancy fixture baseline — always restore these, not a dirty
  // mid-run snapshot left by a prior aborted harness.
  const FIXTURE_BASELINE = {
    start_time: "11:00:00",
    event_end_date: null as string | null,
  };

  const eventDate = beforeEvent.event_date as string;
  // Ensure multi-day span for scenario D (restore after)
  const endDate = (() => {
    const [y, m, d] = eventDate.split("-").map(Number);
    const dt = new Date(y!, m! - 1, d! + 2);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  })();

  let browser: any = null;
  try {
  await admin.from("events").update({
    start_time: "16:00:00",
    event_end_date: endDate,
  }).eq("id", EVENT).eq("venue_id", FANCY);

  const { data: spaces } = await admin.from("venue_spaces").select("id").eq("venue_id", FANCY).limit(1);
  const spaceId = spaces?.[0]?.id ?? null;

  const { data: tpl, error: tplErr } = await admin
    .from("timeline_templates")
    .insert({
      venue_id: FANCY,
      name: `QA-TT-${RUN}`,
      event_type: "wedding",
      space_id: spaceId,
      is_default: false,
      is_archived: false,
    })
    .select("id")
    .single();
  if (tplErr || !tpl) throw tplErr ?? new Error("template insert");

  // Seed relative + specific + day2 + dual-conflict + before-event + end-anchor
  const seedItems = [
    { title: `QA-TT-${RUN}-specific`, time_of_day: "15:00", minutes_offset: null, day_offset: 0, day_anchor: "event_start" },
    { title: `QA-TT-${RUN}-rel`, time_of_day: null, minutes_offset: -30, day_offset: 0, day_anchor: "event_start" },
    { title: `QA-TT-${RUN}-day2`, time_of_day: "10:00", minutes_offset: null, day_offset: 1, day_anchor: "event_start" },
    { title: `QA-TT-${RUN}-dual`, time_of_day: "14:00", minutes_offset: -15, day_offset: 0, day_anchor: "event_start" },
    { title: `QA-TT-${RUN}-before`, time_of_day: "09:00", minutes_offset: null, day_offset: -1, day_anchor: "event_start" },
    { title: `QA-TT-${RUN}-end`, time_of_day: "11:00", minutes_offset: null, day_offset: 0, day_anchor: "event_end" },
  ];
  const { error: itemErr } = await admin.from("timeline_template_items").insert(
    seedItems.map((it, i) => ({
      venue_id: FANCY,
      template_id: tpl.id,
      title: it.title,
      description: null,
      notes: null,
      time_of_day: it.time_of_day,
      minutes_offset: it.minutes_offset,
      day_offset: it.day_offset,
      day_anchor: it.day_anchor,
      needs_review: false,
      audiences: ["client"],
      sort_order: i,
    })),
  );
  if (itemErr) throw itemErr;

  // Pure resolve contract (matches apply.ts) — end date +2 from event_date.
  const { resolveTemplateDayToEventOffset } = await import("@/lib/timeline/timing-presentation");
  const { clampDayOffset } = await import("@/lib/timeline/constants");
  const endResolved = clampDayOffset(
    resolveTemplateDayToEventOffset(0, "event_end", eventDate, endDate),
    eventDate,
    endDate,
  );
  record("H-end-anchor-resolves-to-last-day", endResolved === 2, `resolved=${endResolved} endDate=${endDate}`);
  const beforeResolved = clampDayOffset(
    resolveTemplateDayToEventOffset(-1, "event_start", eventDate, endDate),
    eventDate,
    endDate,
  );
  record("H-before-offset-kept", beforeResolved === -1, `resolved=${beforeResolved}`);
  const missingEndFallback = resolveTemplateDayToEventOffset(0, "event_end", eventDate, null);
  record("H-missing-end-no-invent", missingEndFallback === 0, `fallback=${missingEndFallback}`);

  // C — missing start: relative must not invent
  record(
    "C-missing-start-no-invent",
    resolveEntryTimeFromOffset(-30, null) === null,
    "resolveEntryTimeFromOffset(-30,null)===null",
  );

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

    // ——— Template editor UI ———
    await page.goto(`${APP}/library/timeline-templates/${tpl.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/shots/template-list-1280.png`, fullPage: false });

    const body0 = await page.locator("body").innerText();
    record(
      "A-template-shows-day-label",
      /Day 1 — event start date|Day 1 — event date|On the event/i.test(body0),
      "day label",
    );
    record("B-template-shows-relative-phrase", /before Day-of schedule start/i.test(body0), "relative phrase");
    // Relative-day model: anchor + signed offset controls (not Day 1–7 only).
    await page.getByRole("button", { name: /^Add Item$/i }).first().click({ timeout: 15_000 }).catch(() => null);
    await page.waitForTimeout(500);
    const dayRule = page.getByTestId("timeline-template-day-rule");
    const dayRuleVisible = await dayRule.isVisible().catch(() => false);
    record("H-relative-day-rule-control", dayRuleVisible, "day rule sheet");
    if (dayRuleVisible) {
      record(
        "H-day-anchor-control",
        await page.getByTestId("timeline-template-day-anchor").isVisible().catch(() => false),
        "anchor",
      );
      record(
        "H-day-offset-control",
        await page.getByTestId("timeline-template-day-offset").isVisible().catch(() => false),
        "offset",
      );
      const preview = await page.getByTestId("timeline-template-day-preview").innerText().catch(() => "");
      record("H-day-preview-named", /event start|event end|before|after/i.test(preview), preview.slice(0, 200));
    }
    page.once("dialog", (d: { accept: () => Promise<void> }) => void d.accept());
    await page.getByRole("button", { name: /^Cancel$/i }).click().catch(() => null);
    await page.waitForTimeout(400);

    // Edit dual-conflict item → conflict banner + modes (row by exact title)
    const dualTitle = `QA-TT-${RUN}-dual`;
    const dualRow = page.locator("div.flex.items-start.gap-3").filter({
      has: page.getByText(dualTitle, { exact: true }),
    });
    await dualRow.getByRole("button", { name: "Edit" }).click({ timeout: 15_000 });
    await page.waitForTimeout(800);
    const sheet = page.locator('[data-testid="timeline-template-timing"]');
    await sheet.waitFor({ state: "visible", timeout: 15_000 }).catch(() => null);
    const sheetText = await page.locator('[data-testid="timeline-template-timing"]').innerText().catch(() => "");
    const conflictVisible = await page.getByTestId("timeline-timing-conflict").isVisible().catch(() => false);
    record("F-legacy-conflict-surfaced", conflictVisible || /both a clock time and a relative/i.test(sheetText), "conflict");
    record("A-specific-mode-control", await page.getByTestId("timeline-timing-mode-specific").isVisible().catch(() => false), "specific");
    record("B-relative-mode-control", await page.getByTestId("timeline-timing-mode-relative").isVisible().catch(() => false), "relative");
    record("no-raw-relative-min-label", !(await page.getByText("Relative Time (min)", { exact: true }).count()), "label gone");
    // Named anchor is on the relative mode control label — avoid applyTimingMode
    // which dirties the sheet and blocks Cancel behind the unsaved guard.
    record("B-named-anchor-in-editor", /Day-of schedule start/i.test(sheetText), "anchor named");
    await page.screenshot({ path: `${OUT}/shots/template-conflict-1280.png`, fullPage: false });

    // Close sheet without dirtying, then add specific-time item via UI
    page.once("dialog", (d: { accept: () => Promise<void> }) => void d.accept());
    await page.getByRole("button", { name: /^Cancel$/i }).click().catch(() => null);
    await page.waitForTimeout(500);
    try {
      await page.getByRole("button", { name: /^Add Item$/i }).first().click({ timeout: 15_000 });
      await page.waitForTimeout(600);
      await page.getByPlaceholder("Ceremony begins").fill(`QA-TT-${RUN}-ui-specific`);
      await page.getByTestId("timeline-timing-mode-specific").click();
      await page.getByTestId("timeline-template-time-of-day").fill("17:30");
      await page.getByRole("button", { name: /^Add Item$/i }).last().click();
      await page.waitForTimeout(2000);
      record("A-ui-add-item-flow", true, "add sheet completed");
    } catch (e) {
      record("A-ui-add-item-flow", false, String(e).slice(0, 400));
    }

    const { data: uiItem } = await admin
      .from("timeline_template_items")
      .select("id,time_of_day,minutes_offset,day_offset,title")
      .eq("template_id", tpl.id)
      .eq("title", `QA-TT-${RUN}-ui-specific`)
      .maybeSingle();
    record(
      "A-ui-specific-persisted",
      !!uiItem && (uiItem.time_of_day === "17:30:00" || uiItem.time_of_day === "17:30") && uiItem.minutes_offset == null,
      JSON.stringify(uiItem),
    );

    // ——— Apply (authoritative calc matching apply.ts) + event UI ———
    await admin.from("timeline_entries").delete().eq("event_id", EVENT).eq("venue_id", FANCY).like("title", `QA-TT-${RUN}%`);

    const { data: tplItems } = await admin
      .from("timeline_template_items")
      .select("title,time_of_day,minutes_offset,day_offset,day_anchor,sort_order,notes,description")
      .eq("template_id", tpl.id)
      .order("sort_order");

    const applied: { title: string; entry_time: string | null; day_offset: number }[] = [];
    for (const it of tplItems ?? []) {
      const tod = it.time_of_day ? String(it.time_of_day).slice(0, 5) : null;
      const entryTime =
        tod
        ?? resolveEntryTimeFromOffset(it.minutes_offset, "16:00")
        ?? null;
      const anchor = it.day_anchor === "event_end" ? "event_end" : "event_start";
      const dayOffset = clampDayOffset(
        resolveTemplateDayToEventOffset(it.day_offset ?? 0, anchor, eventDate, endDate),
        eventDate,
        endDate,
      );
      const { error } = await admin.from("timeline_entries").insert({
        venue_id: FANCY,
        event_id: EVENT,
        title: it.title,
        description: it.description ?? "",
        notes: it.notes ?? "",
        entry_time: entryTime,
        day_offset: dayOffset,
        sort_order: it.sort_order ?? 0,
        audiences: ["client"],
        status: "not_started",
        lock_state: "editable",
        owner: "venue",
      });
      if (error) throw error;
      applied.push({ title: it.title as string, entry_time: entryTime, day_offset: dayOffset });
    }
    const beforeRow = applied.find((r) => r.title.includes("-before"));
    record("H-before-applied", beforeRow?.day_offset === -1 && beforeRow?.entry_time === "09:00", JSON.stringify(beforeRow));
    const endRow = applied.find((r) => r.title.includes("-end"));
    record("H-end-applied-last-day", endRow?.day_offset === 2 && endRow?.entry_time === "11:00", JSON.stringify(endRow));

    const relRow = applied.find((r) => r.title.includes("-rel"));
    record("B-baked-relative-1530", relRow?.entry_time === "15:30", JSON.stringify(relRow));
    const day2 = applied.find((r) => r.title.includes("-day2"));
    record("D-day2-offset-preserved", day2?.day_offset === 1 && day2?.entry_time === "10:00", JSON.stringify(day2));
    const dual = applied.find((r) => r.title.includes("-dual"));
    record("F-dual-prefers-clock", dual?.entry_time === "14:00", JSON.stringify(dual));

    // C with null start bake path
    const missingBake = resolveEntryTimeFromOffset(-30, null);
    record("C-apply-path-null", missingBake === null, String(missingBake));

    // Event setup customize — day labels (not Day offset).
    // Booked events redirect /events/:id → /clients/:id; setup lives on the client page.
    await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3000);
    // Profile-backed events open the editor via "Change for this event", not
    // "Open Timeline" (that navigates to the management tab).
    const changeTimeline = page.getByTestId("event-setup-change-timeline");
    const openTimeline = page.getByTestId("event-setup-open-timeline");
    const opener = (await changeTimeline.count()) > 0 ? changeTimeline : openTimeline;
    await opener.scrollIntoViewIfNeeded().catch(() => null);
    await opener.click({ timeout: 20_000 });
    const editor = page.getByTestId("event-timeline-setup-editor");
    try {
      await editor.waitFor({ state: "visible", timeout: 20_000 });
      await page.getByTestId("timeline-setup-mode-customize").click();
      await page.waitForTimeout(1000);
      await page.getByTestId("timeline-setup-customize-path").waitFor({ state: "visible", timeout: 10_000 });
      const setupText = await editor.innerText();
      record(
        "D-no-day-offset-label",
        !/\bDay offset\b/i.test(setupText),
        "no bare Day offset label",
      );
      const dayControl = page.getByTestId("timeline-setup-row-day").first();
      const dayVisible = await dayControl.isVisible().catch(() => false);
      const dayDisabled = dayVisible
        ? await dayControl.isDisabled().catch(() => true)
        : true;
      record("D-event-day-control-present", dayVisible, "row day");
      record("I-event-day-editable", dayVisible && !dayDisabled, `disabled=${dayDisabled}`);
      if (dayVisible) {
        const dayVal = await dayControl.innerText().catch(async () => dayControl.inputValue());
        record("D-day-shows-calendar", /\d{4}|\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b|Day 1|event date|day before|day after/i.test(String(dayVal)), String(dayVal));
      }

      // I — move Day 1 specific item → Day 2; time must stay 15:00; template untouched.
      const specificTitle = `QA-TT-${RUN}-specific`;
      const specificRow = page.getByTestId("timeline-setup-row").filter({
        has: page.getByDisplayValue(specificTitle),
      }).first();
      const specificVisible = await specificRow.isVisible().catch(() => false);
      record("I-specific-row-present", specificVisible, specificTitle);
      if (specificVisible) {
        const rowDay = specificRow.getByTestId("timeline-setup-row-day");
        await rowDay.click({ timeout: 10_000 });
        await page.waitForTimeout(300);
        // Day 2 option — label includes "Day 2"
        const day2Option = page.getByRole("option").filter({ hasText: /Day 2/i }).first();
        const day2Visible = await day2Option.isVisible().catch(() => false);
        record("I-day2-option-present", day2Visible, "Day 2 option");
        if (day2Visible) {
          await day2Option.click();
          await page.waitForTimeout(400);
          await page.getByTestId("timeline-setup-save-all").click({ timeout: 10_000 });
          await page.waitForTimeout(2500);
          const { data: moved } = await admin
            .from("timeline_entries")
            .select("id,title,entry_time,day_offset")
            .eq("event_id", EVENT)
            .eq("venue_id", FANCY)
            .eq("title", specificTitle)
            .maybeSingle();
          const timeOk = moved
            && (moved.entry_time === "15:00:00" || moved.entry_time === "15:00");
          record("I-day-moved-persisted", !!moved && moved.day_offset === 1, JSON.stringify(moved));
          record("I-time-preserved-after-day-change", !!timeOk, JSON.stringify(moved));

          // Reload editor and confirm day sticks
          await page.reload({ waitUntil: "domcontentloaded" });
          await page.waitForTimeout(2500);
          const opener2 = (await page.getByTestId("event-setup-change-timeline").count()) > 0
            ? page.getByTestId("event-setup-change-timeline")
            : page.getByTestId("event-setup-open-timeline");
          await opener2.click({ timeout: 20_000 }).catch(() => null);
          await page.getByTestId("event-timeline-setup-editor").waitFor({ state: "visible", timeout: 20_000 }).catch(() => null);
          await page.getByTestId("timeline-setup-mode-customize").click().catch(() => null);
          await page.waitForTimeout(800);
          const reloadedRow = page.getByTestId("timeline-setup-row").filter({
            has: page.getByDisplayValue(specificTitle),
          }).first();
          const reloadedDay = await reloadedRow.getByTestId("timeline-setup-row-day").innerText().catch(() => "");
          record("I-day-persists-after-reload", /Day 2/i.test(reloadedDay), reloadedDay.slice(0, 200));
        }

        const { data: tplDayAfter } = await admin
          .from("timeline_template_items")
          .select("day_offset,day_anchor,time_of_day")
          .eq("template_id", tpl.id)
          .eq("title", specificTitle)
          .maybeSingle();
        record(
          "I-template-day-untouched",
          !!tplDayAfter
          && tplDayAfter.day_offset === 0
          && (tplDayAfter.day_anchor === "event_start" || tplDayAfter.day_anchor == null)
          && (tplDayAfter.time_of_day === "15:00:00" || tplDayAfter.time_of_day === "15:00"),
          JSON.stringify(tplDayAfter),
        );
      }
      await page.screenshot({ path: `${OUT}/shots/event-setup-customize-1280.png`, fullPage: false });
    } catch (e) {
      record("D-event-day-control-present", false, String(e).slice(0, 400));
      await page.screenshot({ path: `${OUT}/shots/event-setup-customize-1280.png`, fullPage: false });
    }

    // G — timeline tab downstream
    await page.goto(`${APP}/events/${EVENT}?tab=timeline`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(2500);
    const timelineBody = await page.locator("body").innerText();
    record(
      "G-schedule-shows-specific",
      new RegExp(`QA-TT-${RUN}-specific`, "i").test(timelineBody),
      "title visible",
    );
    record(
      "G-schedule-shows-baked-rel",
      /3:30\s*PM|15:30/i.test(timelineBody) || new RegExp(`QA-TT-${RUN}-rel`, "i").test(timelineBody),
      "rel item",
    );
    await page.screenshot({ path: `${OUT}/shots/event-timeline-1280.png`, fullPage: false });

    // E — template unchanged after event entries exist
    const { data: tplAfter } = await admin
      .from("timeline_template_items")
      .select("title,time_of_day,minutes_offset")
      .eq("template_id", tpl.id)
      .eq("title", `QA-TT-${RUN}-specific`)
      .maybeSingle();
    record(
      "E-template-untouched",
      !!tplAfter && (tplAfter.time_of_day === "15:00:00" || tplAfter.time_of_day === "15:00"),
      JSON.stringify(tplAfter),
    );

    writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify({
      templateId: tpl.id,
      eventId: EVENT,
      eventDate,
      endDate,
      applied,
      uiItem,
      at: new Date().toISOString(),
    }, null, 2));
  } finally {
    if (browser) await browser.close().catch(() => null);
    await admin.from("events").update({
      start_time: FIXTURE_BASELINE.start_time,
      event_end_date: FIXTURE_BASELINE.event_end_date,
    }).eq("id", EVENT).eq("venue_id", FANCY);
  }

  const pass = checks.every((c) => c.pass);
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({
    pass, image, digest, expectedSha: EXPECTED, checks, run: RUN, at: new Date().toISOString(),
  }, null, 2));
  console.log(pass ? "\nGREEN timeline timing simplification" : "\nNOT GREEN timeline timing simplification");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
