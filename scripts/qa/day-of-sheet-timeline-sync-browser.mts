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

/** Title lives in an <input>, so innerText is unreliable — match by input value. */
async function findSetupRowByTitle(
  page: {
    getByTestId: (s: string) => {
      count: () => Promise<number>;
      nth: (i: number) => {
        locator: (s: string) => { inputValue: () => Promise<string> };
        getByTestId: (s: string) => {
          click: () => Promise<void>;
          fill: (v: string) => Promise<void>;
        };
      };
    };
  },
  title: string,
) {
  const rows = page.getByTestId("timeline-setup-row");
  const n = await rows.count();
  for (let i = 0; i < n; i += 1) {
    const value = await rows.nth(i).locator('input[aria-label="Timeline item title"]').inputValue();
    if (value === title) return rows.nth(i);
  }
  return null;
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

  // Prefer a profile-based confirmed/booked Fancy event with Change Timeline UI
  // (uses_profile + timeline set_up + setup not collapsed) so Save All is reachable.
  const { data: setupStates } = await admin
    .from("event_setup_states")
    .select("event_id, collapsed_at, uses_profile, inherited_decisions, overrides")
    .eq("venue_id", FANCY)
    .eq("uses_profile", true)
    .is("collapsed_at", null)
    .limit(40);
  let eventId: string | null = null;
  const candidateIds: string[] = [];
  for (const s of setupStates ?? []) {
    const inherited = (s.inherited_decisions ?? {}) as Record<string, string>;
    const overrides = (s.overrides ?? {}) as Record<string, string>;
    const timelineDecision = overrides.timeline ?? inherited.timeline;
    if (timelineDecision !== "set_up") continue;
    candidateIds.push(s.event_id);
  }
  for (const id of candidateIds) {
    const { data: ev } = await admin
      .from("events")
      .select("id, name, client_id, status")
      .eq("id", id)
      .in("status", ["confirmed", "booked"])
      .maybeSingle();
    if (!ev) continue;
    const { count } = await admin
      .from("timeline_entries")
      .select("id", { count: "exact", head: true })
      .eq("event_id", ev.id)
      .eq("venue_id", FANCY)
      .eq("owner", "venue");
    if ((count ?? 0) >= 3) {
      eventId = ev.id;
      break;
    }
  }
  if (!eventId) throw new Error("No Fancy confirmed/booked event with profile timeline setup UI");
  out.eventId = eventId;
  out.controlEventId = candidateIds.find((id) => id !== eventId) ?? null;

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

  // 2–3. Mutate via UI Save All (required for Defect B — no admin time writes)
  await page.goto(`${APP}/events/${eventId}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(800);
  if ((await page.getByTestId("event-setup-change-timeline").count()) === 0) {
    const showSetup = page.getByRole("button", { name: /Show setup/i });
    if ((await showSetup.count()) > 0) {
      await showSetup.click();
      await page.waitForTimeout(1500);
    }
  }
  if ((await page.getByTestId("event-setup-change-timeline").count()) === 0) {
    throw new Error("event-setup-change-timeline unavailable — cannot exercise Save All race");
  }
  await page.getByTestId("event-setup-change-timeline").click();
  await page.waitForSelector('[data-testid="event-timeline-setup-editor"]', { timeout: 15_000 });
  await page.getByTestId("timeline-setup-mode-customize").click();
  await page.waitForTimeout(400);
  // Mark Mid for removal
  const rowCount = await page.getByTestId("timeline-setup-row").count();
  const midRow = await findSetupRowByTitle(page, `${MARK} Mid`);
  if (midRow) await midRow.getByTestId("timeline-setup-mark-remove").click();
  record("ui_marked_mid_for_removal", Boolean(midRow), `rows=${rowCount}`);
  // Edit Early → 8:00 PM; assign Untimed → 2:00 PM — then Save all WITHOUT
  // an explicit blur (regression for missing Day-of Sheet times).
  const earlyRow = await findSetupRowByTitle(page, `${MARK} Early`);
  if (earlyRow) await earlyRow.getByTestId("timeline-setup-row-time").fill("8:00 PM");
  const untimedRow = await findSetupRowByTitle(page, `${MARK} Untimed`);
  if (untimedRow) await untimedRow.getByTestId("timeline-setup-row-time").fill("2:00 PM");
  record(
    "ui_found_seed_rows_for_time_edits",
    Boolean(earlyRow && untimedRow),
    `early=${Boolean(earlyRow)} untimed=${Boolean(untimedRow)}`,
  );
  // Add new item
  await page.getByTestId("timeline-setup-new-title").fill(`${MARK} New`);
  await page.getByTestId("timeline-setup-new-time").fill("3:00 PM");
  await page.getByTestId("timeline-setup-add-item").click();
  const saveAll = page.getByTestId("timeline-setup-save-all");
  if ((await saveAll.count()) > 0 && (await saveAll.isEnabled())) {
    // Click Save while a time field may still be focused — must persist times.
    await saveAll.click();
    await page.waitForTimeout(3000);
  }
  // Prove DB persisted the newly assigned 2:00 PM before opening the sheet
  let untimedPersisted = false;
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(300);
    const { data: urow } = await admin
      .from("timeline_entries")
      .select("entry_time,title")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY)
      .eq("title", `${MARK} Untimed`)
      .maybeSingle();
    if (urow?.entry_time && String(urow.entry_time).startsWith("14:00")) {
      untimedPersisted = true;
      break;
    }
  }
  record(
    "persisted_assigned_time_on_formerly_untimed",
    untimedPersisted,
    "entry_time should be 14:00 after Save all",
  );

  // Clear Late time (empty string) and Save All — must become Unscheduled.
  const lateRow = await findSetupRowByTitle(page, `${MARK} Late`);
  if (lateRow) await lateRow.getByTestId("timeline-setup-row-time").fill("");
  if (lateRow && (await saveAll.count()) > 0 && (await saveAll.isEnabled())) {
    await saveAll.click();
    await page.waitForTimeout(2500);
  }
  let lateCleared = false;
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(250);
    const { data: lrow } = await admin
      .from("timeline_entries")
      .select("entry_time,title")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY)
      .eq("title", `${MARK} Late`)
      .maybeSingle();
    if (lrow && (lrow.entry_time == null || lrow.entry_time === "")) {
      lateCleared = true;
      break;
    }
  }
  record(
    "persisted_cleared_time",
    lateCleared,
    "entry_time should be null after clearing Late",
  );
  await page.getByRole("button", { name: /Back to Overview/i }).click().catch(() => undefined);

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
    sheet.timed.some((t) => t.includes(`${MARK} Early`) && /8:00\s*PM/i.test(t)),
    sheet.timed.filter((t) => t.includes("Early")).join(" | "),
  );
  record(
    "assigned_time_appears_on_day_sheet",
    sheet.timed.some((t) => t.includes(`${MARK} Untimed`) && /2:00\s*PM/i.test(t))
      && !sheet.unscheduled.some((t) => t.includes(`${MARK} Untimed`)),
    `timed=${sheet.timed.filter((t) => t.includes(MARK)).join(" | ")} unscheduled=${sheet.unscheduled.filter((t) => t.includes(MARK)).join(" | ")}`,
  );
  record(
    "cleared_time_becomes_unscheduled",
    sheet.unscheduled.some((t) => t.includes(`${MARK} Late`))
      && !sheet.timed.some((t) => t.includes(`${MARK} Late`)),
    `unscheduled=${sheet.unscheduled.filter((t) => t.includes(MARK)).join(" | ")}`,
  );
  record(
    "new_item_appears_once",
    sheet.all.filter((t) => t.includes(`${MARK} New`)).length === 1
      && sheet.timed.some((t) => t.includes(`${MARK} New`) && /3:00\s*PM/i.test(t)),
    sheet.all.filter((t) => t.includes(MARK)).join(" | "),
  );
  const afterSeeded = sheet.timed.filter((t) => t.includes(MARK));
  out.afterEditOrder = afterSeeded;
  // Untimed(14:00) → New(15:00) → Early(20:00); Late cleared → Unscheduled
  const untimedI = afterSeeded.findIndex((t) => t.includes("Untimed"));
  const newIdx = afterSeeded.findIndex((t) => t.includes("New"));
  const earlyI = afterSeeded.findIndex((t) => t.includes("Early"));
  record(
    "order_after_edit_and_add",
    untimedI >= 0 && newIdx > untimedI && earlyI > newIdx,
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
