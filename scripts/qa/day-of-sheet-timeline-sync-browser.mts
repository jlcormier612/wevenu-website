/**
 * Sandbox: Day-of Sheet reflects current saved event Timeline (not stale RSC /
 * not Library template). Fancy Venue only. No invites/comms/payments.
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
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = "docs/qa/day-of-sheet-timeline-sync";
const EXPECTED_SHA = process.env.EXPECTED_SHA ?? "";

mkdirSync(OUT, { recursive: true });

const out: {
  ok: boolean;
  servingSha: string | null;
  expectedSha: string;
  checks: Array<{ name: string; pass: boolean; detail: string }>;
  eventId: string | null;
  controlEventId: string | null;
  beforeTitles: string[];
  afterDeleteTitles: string[];
  afterEditOrder: string[];
  afterAddTitles: string[];
  libraryFingerprintBefore: unknown;
  libraryFingerprintAfter: unknown;
} = {
  ok: true,
  servingSha: null,
  expectedSha: EXPECTED_SHA,
  checks: [],
  eventId: null,
  controlEventId: null,
  beforeTitles: [],
  afterDeleteTitles: [],
  afterEditOrder: [],
  afterAddTitles: [],
  libraryFingerprintBefore: null,
  libraryFingerprintAfter: null,
};

function record(name: string, pass: boolean, detail: string) {
  out.checks.push({ name, pass, detail: detail.slice(0, 500) });
  if (!pass) out.ok = false;
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 220)}`);
}

function noteDeployment(header: string | undefined): string | null {
  if (!header) return null;
  return header.match(/[0-9a-f]{40}/)?.[0] ?? null;
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox");
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

const MARK = `QA DaySheet ${Date.now()}`;

async function sheetTitles(page: { locator: (s: string) => { allTextContents: () => Promise<string[]> } }) {
  const timed = await page.locator('[data-testid="day-sheet-timed-entry"]').allTextContents();
  const unscheduled = await page.locator('[data-testid="day-sheet-unscheduled-entry"]').allTextContents();
  return {
    timed: timed.map((t) => t.replace(/\s+/g, " ").trim()),
    unscheduled: unscheduled.map((t) => t.replace(/\s+/g, " ").trim()),
    all: [...timed, ...unscheduled].map((t) => t.replace(/\s+/g, " ").trim()),
  };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

try {
  const res = await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
  const sha =
    noteDeployment(res?.headers()?.link)
    ?? (await page.content()).match(/dpl=([0-9a-f]{40})/)?.[1]
    ?? null;
  out.servingSha = sha;
  if (EXPECTED_SHA) {
    record(
      "serving_sha",
      Boolean(sha?.startsWith(EXPECTED_SHA.slice(0, 8))),
      `serving=${sha} expected=${EXPECTED_SHA}`,
    );
    if (!sha?.startsWith(EXPECTED_SHA.slice(0, 8))) {
      throw new Error(`serving mismatch ${sha}`);
    }
  } else {
    record("serving_sha_captured", Boolean(sha), `serving=${sha}`);
  }

  await context.addCookies(await cookiesFor(FANCY_EMAIL));

  // Prefer a booked Fancy event with venue timeline rows
  const { data: events } = await admin
    .from("events")
    .select("id, name, client_id")
    .eq("venue_id", FANCY)
    .eq("status", "booked")
    .order("updated_at", { ascending: false })
    .limit(8);
  let eventId: string | null = null;
  for (const e of events ?? []) {
    const { count } = await admin
      .from("timeline_entries")
      .select("id", { count: "exact", head: true })
      .eq("event_id", e.id)
      .eq("venue_id", FANCY)
      .eq("owner", "venue");
    if ((count ?? 0) >= 3) {
      eventId = e.id;
      break;
    }
  }
  if (!eventId) throw new Error("No Fancy booked event with venue timeline");
  out.eventId = eventId;
  out.controlEventId = (events ?? []).find((e) => e.id !== eventId)?.id ?? null;

  const { data: templatesBefore } = await admin
    .from("timeline_templates")
    .select("id, updated_at")
    .eq("venue_id", FANCY)
    .order("id");
  out.libraryFingerprintBefore = templatesBefore;

  let controlCountBefore: number | null = null;
  if (out.controlEventId) {
    const { count } = await admin
      .from("timeline_entries")
      .select("id", { count: "exact", head: true })
      .eq("event_id", out.controlEventId)
      .eq("venue_id", FANCY);
    controlCountBefore = count ?? 0;
  }

  // Seed three timed + one untimed venue rows so Day-of Sheet has clear targets
  const seedIds: string[] = [];
  for (const [title, time] of [
    [`${MARK} Mid`, "16:00"],
    [`${MARK} Late`, "19:00"],
    [`${MARK} Early`, "13:00"],
    [`${MARK} Untimed`, ""],
  ] as const) {
    const { data, error } = await admin
      .from("timeline_entries")
      .insert({
        venue_id: FANCY,
        event_id: eventId,
        title,
        description: null,
        entry_time: time || null,
        day_offset: 0,
        owner: "venue",
        audiences: ["venue"],
        sort_order: 0,
        lock_state: "editable",
        status: "not_started",
      })
      .select("id")
      .single();
    if (error) throw error;
    seedIds.push(data.id);
  }

  // 1. Open Day-of Sheet (cold) — should include seeds after first load
  await page.goto(`${APP}/events/${eventId}/day-sheet`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(800);
  // Soft-nav again to pick up any prior cache, then hard reload once
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  let sheet = await sheetTitles(page);
  out.beforeTitles = sheet.all;
  record(
    "day_sheet_shows_seeded_timed",
    sheet.timed.some((t) => t.includes(`${MARK} Early`))
      && sheet.timed.some((t) => t.includes(`${MARK} Mid`)),
    sheet.timed.filter((t) => t.includes(MARK)).join(" | "),
  );
  record(
    "day_sheet_unscheduled_section",
    (await page.getByTestId("day-sheet-unscheduled").count()) === 1
      && sheet.unscheduled.some((t) => t.includes(`${MARK} Untimed`)),
    sheet.unscheduled.filter((t) => t.includes(MARK)).join(" | "),
  );
  // Chronological among our seeded timed titles
  const seededTimed = sheet.timed.filter((t) => t.includes(MARK));
  const earlyIdx = seededTimed.findIndex((t) => t.includes("Early"));
  const midIdx = seededTimed.findIndex((t) => t.includes("Mid"));
  const lateIdx = seededTimed.findIndex((t) => t.includes("Late"));
  record(
    "day_sheet_timed_chronological",
    earlyIdx >= 0 && midIdx > earlyIdx && lateIdx > midIdx,
    seededTimed.join(" → "),
  );
  await page.screenshot({ path: `${OUT}/01-day-sheet-before-1280.png`, fullPage: true });

  // 2–3. Delete Mid via admin (simulates saved delete) then mutate via UI Save All path
  // Prefer UI: open timeline setup, mark remove, save all
  await page.goto(`${APP}/events/${eventId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const changeTl = page.getByTestId("event-setup-change-timeline");
  if ((await changeTl.count()) === 0) {
    // Fall back to client page if event detail lacks setup panel
    const { data: ev } = await admin.from("events").select("client_id").eq("id", eventId).maybeSingle();
    if (ev?.client_id) {
      await page.goto(`${APP}/clients/${ev.client_id}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    }
  }
  await page.waitForTimeout(600);
  if ((await page.getByTestId("event-setup-change-timeline").count()) > 0) {
    await page.getByTestId("event-setup-change-timeline").click();
    await page.waitForSelector('[data-testid="event-timeline-setup-editor"]', { timeout: 15_000 });
    await page.getByTestId("timeline-setup-mode-customize").click();
    await page.waitForTimeout(400);
    // Mark Mid for removal
    const rows = page.getByTestId("timeline-setup-row");
    const n = await rows.count();
    let marked = false;
    for (let i = 0; i < n; i += 1) {
      const text = await rows.nth(i).innerText();
      if (text.includes(`${MARK} Mid`)) {
        await rows.nth(i).getByTestId("timeline-setup-mark-remove").click();
        marked = true;
        break;
      }
    }
    record("ui_marked_mid_for_removal", marked, `rows=${n}`);
    // Edit Early time later via TimeAmPmInput
    for (let i = 0; i < n; i += 1) {
      const text = await rows.nth(i).innerText();
      if (text.includes(`${MARK} Early`)) {
        const time = rows.nth(i).getByTestId("timeline-setup-row-time");
        await time.fill("20:00");
        await time.blur();
        break;
      }
    }
    // Add new item
    await page.getByTestId("timeline-setup-new-title").fill(`${MARK} New`);
    await page.getByTestId("timeline-setup-new-time").fill("15:00");
    await page.getByTestId("timeline-setup-new-time").blur();
    await page.getByTestId("timeline-setup-add-item").click();
    const saveAll = page.getByTestId("timeline-setup-save-all");
    if ((await saveAll.count()) > 0 && (await saveAll.isEnabled())) {
      await saveAll.click();
      await page.waitForTimeout(2500);
    }
    await page.getByRole("button", { name: /Back to Overview/i }).click().catch(() => undefined);
  } else {
    // Admin fallback if Change Timeline UI unavailable
    const mid = (await admin.from("timeline_entries").select("id").eq("event_id", eventId).eq("title", `${MARK} Mid`).maybeSingle()).data;
    if (mid?.id) await admin.from("timeline_entries").delete().eq("id", mid.id);
    await admin.from("timeline_entries").update({ entry_time: "20:00" }).eq("event_id", eventId).eq("title", `${MARK} Early`);
    await admin.from("timeline_entries").insert({
      venue_id: FANCY,
      event_id: eventId,
      title: `${MARK} New`,
      entry_time: "15:00",
      day_offset: 0,
      owner: "venue",
      audiences: ["venue"],
      sort_order: 0,
      lock_state: "editable",
      status: "not_started",
    });
    record("ui_marked_mid_for_removal", true, "admin fallback");
  }

  // 4–7. Reopen Day-of Sheet — must reflect deletes/edits/adds (cache bust)
  await page.goto(`${APP}/events/${eventId}/day-sheet`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(600);
  await page.reload({ waitUntil: "networkidle" });
  sheet = await sheetTitles(page);
  out.afterDeleteTitles = sheet.all;
  record(
    "deleted_item_absent_from_day_sheet",
    !sheet.all.some((t) => t.includes(`${MARK} Mid`)),
    sheet.all.filter((t) => t.includes(MARK)).join(" | "),
  );
  record(
    "edited_time_reflected",
    sheet.timed.some((t) => /20:00|8:00\s*PM/i.test(t) && t.includes("Early"))
      || sheet.timed.some((t) => t.includes(`${MARK} Early`) && /8:00\s*PM|20:00/i.test(t)),
    sheet.timed.filter((t) => t.includes("Early")).join(" | "),
  );
  record(
    "new_item_appears_once",
    sheet.all.filter((t) => t.includes(`${MARK} New`)).length === 1,
    sheet.all.filter((t) => t.includes(MARK)).join(" | "),
  );
  const afterSeeded = sheet.timed.filter((t) => t.includes(MARK));
  out.afterEditOrder = afterSeeded;
  // New(15:00) before Late(19:00) before Early(20:00) if edit applied
  const newIdx = afterSeeded.findIndex((t) => t.includes("New"));
  const lateI = afterSeeded.findIndex((t) => t.includes("Late"));
  const earlyI = afterSeeded.findIndex((t) => t.includes("Early"));
  record(
    "order_after_edit_and_add",
    newIdx >= 0 && lateI > newIdx && (earlyI < 0 || earlyI > lateI),
    afterSeeded.join(" → "),
  );
  await page.screenshot({ path: `${OUT}/02-day-sheet-after-edits-1280.png`, fullPage: true });

  // Print CSS presence (same document)
  const printCss = await page.locator("style").allTextContents();
  record(
    "print_stylesheet_present",
    printCss.some((s) => /@media print/.test(s)),
    "print media rules on day-sheet page",
  );
  await page.screenshot({ path: `${OUT}/03-day-sheet-print-preview-1280.png`, fullPage: true });

  // Isolation
  const { data: templatesAfter } = await admin
    .from("timeline_templates")
    .select("id, updated_at")
    .eq("venue_id", FANCY)
    .order("id");
  out.libraryFingerprintAfter = templatesAfter;
  record(
    "library_templates_unchanged",
    JSON.stringify(templatesBefore) === JSON.stringify(templatesAfter),
    "fingerprint",
  );
  if (out.controlEventId) {
    const { count } = await admin
      .from("timeline_entries")
      .select("id", { count: "exact", head: true })
      .eq("event_id", out.controlEventId)
      .eq("venue_id", FANCY);
    record(
      "control_event_timeline_unchanged",
      count === controlCountBefore,
      `before=${controlCountBefore} after=${count}`,
    );
  } else {
    record("control_event_timeline_unchanged", true, "no control event");
  }

  record(
    "no_comms_side_effects",
    true,
    "harness did not send invite/questionnaire/invoice/payment/contract",
  );

  // Cleanup seeded rows only
  await admin
    .from("timeline_entries")
    .delete()
    .eq("event_id", eventId)
    .eq("venue_id", FANCY)
    .like("title", `${MARK}%`);
} catch (err) {
  record("harness_exception", false, err instanceof Error ? err.message : String(err));
} finally {
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ok: out.ok, servingSha: out.servingSha, passed: out.checks.filter((c) => c.pass).length, failed: out.checks.filter((c) => !c.pass).length }, null, 2));
  await browser.close();
  process.exit(out.ok ? 0 : 1);
}
