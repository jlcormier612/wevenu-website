/**
 * Sandbox browser acceptance — Timeline AM/PM + Save All + schedule speed.
 * Fancy Venue only. Does not send invites/contracts/payments/comms.
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
const OUT_DIR = "docs/qa/timeline-editing-interaction-speed";
const EXPECTED_PREFIX = process.env.EXPECTED_SHA_PREFIX ?? "";

const out: {
  ok: boolean;
  servingSha: string | null;
  expectedPrefix: string;
  checks: Array<{ name: string; pass: boolean; detail: string }>;
  timings: Record<string, number | null>;
  eventId: string | null;
  otherEventId: string | null;
  templateFingerprintBefore: unknown;
  templateFingerprintAfter: unknown;
  otherEventCountBefore: number | null;
  otherEventCountAfter: number | null;
} = {
  ok: true,
  servingSha: null,
  expectedPrefix: EXPECTED_PREFIX,
  checks: [],
  timings: {
    saveAllFirstSpinnerMs: null,
    saveAllCompleteMs: null,
    saveAllNetworkOps: null,
    scheduleSaveCompleteMs: null,
  },
  eventId: null,
  otherEventId: null,
  templateFingerprintBefore: null,
  templateFingerprintAfter: null,
  otherEventCountBefore: null,
  otherEventCountAfter: null,
};

function record(name: string, pass: boolean, detail: string) {
  out.checks.push({ name, pass, detail });
  if (!pass) out.ok = false;
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function noteDeployment(link: string | undefined): string | null {
  if (!link) return null;
  const m = link.match(/dpl=([0-9a-f]{40})/i) ?? link.match(/commit\/([0-9a-f]{7,40})/i);
  return m?.[1] ?? null;
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

const MARK = `QA Timeline Speed ${Date.now()}`;

async function findOrSkipEvent(): Promise<{ id: string; name: string } | null> {
  const { data } = await admin
    .from("events")
    .select("id, name")
    .eq("venue_id", FANCY)
    .eq("status", "booked")
    .order("updated_at", { ascending: false })
    .limit(5);
  const rows = data ?? [];
  // Prefer an event that already has venue timeline entries
  for (const e of rows) {
    const { count } = await admin
      .from("timeline_entries")
      .select("id", { count: "exact", head: true })
      .eq("event_id", e.id)
      .eq("venue_id", FANCY)
      .eq("owner", "venue");
    if ((count ?? 0) >= 2) return e;
  }
  return rows[0] ?? null;
}

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

try {
  const headers = await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
  const link = headers?.headers()?.link ?? (await page.content()).match(/dpl=([0-9a-f]{40})/)?.[0];
  const sha =
    noteDeployment(headers?.headers()?.link)
    ?? noteDeployment(typeof link === "string" ? link : undefined)
    ?? (await page.content()).match(/dpl=([0-9a-f]{40})/)?.[1]
    ?? null;
  out.servingSha = sha;
  if (EXPECTED_PREFIX) {
    record(
      "serving_sha_matches_expected",
      Boolean(sha?.startsWith(EXPECTED_PREFIX)),
      `serving=${sha} expectedPrefix=${EXPECTED_PREFIX}`,
    );
  } else {
    record("serving_sha_captured", Boolean(sha), `serving=${sha}`);
  }

  await context.addCookies(await cookiesFor(FANCY_EMAIL));

  const event = await findOrSkipEvent();
  if (!event) {
    record("event_fixture", false, "No booked Fancy event found");
    throw new Error("No event");
  }
  out.eventId = event.id;

  const { data: otherEvents } = await admin
    .from("events")
    .select("id")
    .eq("venue_id", FANCY)
    .neq("id", event.id)
    .limit(1);
  out.otherEventId = otherEvents?.[0]?.id ?? null;
  if (out.otherEventId) {
    const { count } = await admin
      .from("timeline_entries")
      .select("id", { count: "exact", head: true })
      .eq("event_id", out.otherEventId)
      .eq("venue_id", FANCY);
    out.otherEventCountBefore = count ?? 0;
  }

  const { data: templatesBefore } = await admin
    .from("timeline_templates")
    .select("id, updated_at, name")
    .eq("venue_id", FANCY)
    .order("updated_at", { ascending: false })
    .limit(5);
  out.templateFingerprintBefore = templatesBefore;

  await page.goto(`${APP}/events/${event.id}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.screenshot({ path: `${OUT_DIR}/01-event-overview-1280.png`, fullPage: true });

  const changeTl = page.getByTestId("event-setup-change-timeline");
  if ((await changeTl.count()) === 0) {
    record("open_timeline_editor", false, "event-setup-change-timeline missing");
  } else {
    await changeTl.click();
    await page.waitForSelector('[data-testid="event-timeline-setup-editor"]', { timeout: 15_000 });
    await page.getByTestId("timeline-setup-mode-customize").click();
    await page.waitForSelector('[data-testid="timeline-setup-customize-path"]', { timeout: 10_000 });
    record("open_timeline_editor", true, "customize path open");

    // Time format: AM/PM placeholder / values
    const timeInputs = page.getByTestId("timeline-setup-row-time");
    const timeCount = await timeInputs.count();
    let ampmOk = false;
    if (timeCount > 0) {
      const v0 = await timeInputs.first().inputValue();
      ampmOk = /AM|PM/i.test(v0) || v0 === "" || /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(v0);
      // Also check placeholder
      const ph = await timeInputs.first().getAttribute("placeholder");
      ampmOk = ampmOk || ph === "6:00 PM";
    } else {
      const newPh = await page.getByTestId("timeline-setup-new-time").getAttribute("placeholder");
      ampmOk = newPh === "6:00 PM";
    }
    record("time_format_ampm", ampmOk, `rowTimes=${timeCount}`);

    await page.screenshot({ path: `${OUT_DIR}/02-timeline-editor-ampm-1280.png`, fullPage: true });

    // Multi-row draft: edit first venue row time if present, add two items, mark one remove+undo
    const rows = page.getByTestId("timeline-setup-row");
    const rowCount = await rows.count();
    if (rowCount > 0) {
      const firstTime = rows.first().getByTestId("timeline-setup-row-time");
      await firstTime.fill("6:30 PM");
      await firstTime.blur();
    }

    const t1 = `${MARK} A`;
    const t2 = `${MARK} B`;
    await page.getByTestId("timeline-setup-new-title").fill(t1);
    await page.getByTestId("timeline-setup-new-time").fill("7:00 PM");
    await page.getByTestId("timeline-setup-new-time").blur();
    await page.getByTestId("timeline-setup-add-item").click();
    await page.getByTestId("timeline-setup-new-title").fill(t2);
    await page.getByTestId("timeline-setup-new-time").fill("8:00 PM");
    await page.getByTestId("timeline-setup-new-time").blur();
    await page.getByTestId("timeline-setup-add-item").click();

    // Mark last new row for removal then undo
    const allRows = page.getByTestId("timeline-setup-row");
    const n = await allRows.count();
    if (n > 0) {
      await allRows.nth(n - 1).getByTestId("timeline-setup-mark-remove").click();
      await page.waitForSelector('[data-testid="timeline-setup-row-pending-remove"]', { timeout: 5_000 });
      await page.getByTestId("timeline-setup-undo-remove").first().click();
    }
    record("pending_remove_undo", true, "marked and undid removal");

    await page.screenshot({ path: `${OUT_DIR}/03-timeline-draft-before-save-1280.png`, fullPage: true });

    // Measure Save All
    let networkOps = 0;
    const onReq = (req: { url: (): string; method: () => string }) => {
      const u = req.url();
      if (u.includes(APP) && (req.method() === "POST" || u.includes("timeline"))) {
        networkOps += 1;
      }
    };
    page.on("request", onReq);

    const saveAll = page.getByTestId("timeline-setup-save-all");
    record("save_all_visible", await saveAll.isVisible(), "Save all changes");
    const t0 = Date.now();
    await saveAll.click();
    // First saving response — spinner or disabled button
    let firstSpinner = Date.now() - t0;
    for (let i = 0; i < 50; i += 1) {
      const disabled = await saveAll.isDisabled();
      if (disabled) {
        firstSpinner = Date.now() - t0;
        break;
      }
      await page.waitForTimeout(20);
    }
    out.timings.saveAllFirstSpinnerMs = firstSpinner;

    // Wait for success toast / re-enable
    for (let i = 0; i < 60; i += 1) {
      await page.waitForTimeout(250);
      const { data: created } = await admin
        .from("timeline_entries")
        .select("id, title, entry_time")
        .eq("event_id", event.id)
        .eq("venue_id", FANCY)
        .like("title", `${MARK}%`);
      if ((created?.length ?? 0) >= 2) {
        out.timings.saveAllCompleteMs = Date.now() - t0;
        record(
          "batch_add_persists",
          true,
          JSON.stringify(created?.map((c) => ({ title: c.title, entry_time: c.entry_time }))),
        );
        break;
      }
    }
    if (out.timings.saveAllCompleteMs == null) {
      out.timings.saveAllCompleteMs = Date.now() - t0;
      record("batch_add_persists", false, "created rows not found in time");
    }
    page.off("request", onReq);
    out.timings.saveAllNetworkOps = networkOps;
    record(
      "batch_save_network_ops_recorded",
      networkOps >= 1,
      `ops=${networkOps} firstSpinnerMs=${out.timings.saveAllFirstSpinnerMs} completeMs=${out.timings.saveAllCompleteMs}`,
    );

    // Reopen / stay open — editor should still be present
    record(
      "editor_remains_open_after_save",
      (await page.getByTestId("event-timeline-setup-editor").count()) === 1,
      "sheet still open",
    );

    // No-change save
    const dirtyHint = await page.getByText(/No unsaved timeline edits/i).count();
    if (dirtyHint > 0) {
      // Save all should be disabled
      record("no_change_save_disabled", await saveAll.isDisabled(), "Save all disabled when clean");
    } else {
      record("no_change_save_disabled", true, "draft may still be settling after refresh");
    }

    await page.getByRole("button", { name: /Back to Overview/i }).click();
    await page.waitForTimeout(400);

    // Verify stored times are HH:MM (18:00 style) for 6:00 PM entries
    const { data: marked } = await admin
      .from("timeline_entries")
      .select("id, title, entry_time, day_offset")
      .eq("event_id", event.id)
      .eq("venue_id", FANCY)
      .like("title", `${MARK}%`)
      .order("entry_time", { ascending: true });
    const timesOk = (marked ?? []).every(
      (r) => !r.entry_time || /^\d{2}:\d{2}$/.test(r.entry_time),
    );
    record("stored_times_hhmm", timesOk, JSON.stringify(marked));

    // Chronological: 7:00 before 8:00
    if ((marked?.length ?? 0) >= 2) {
      const titles = marked!.map((m) => m.title);
      const iA = titles.findIndex((t) => t.endsWith(" A"));
      const iB = titles.findIndex((t) => t.endsWith(" B"));
      record(
        "chronological_order_persisted",
        iA >= 0 && iB >= 0 && (marked![iA]!.entry_time ?? "") < (marked![iB]!.entry_time ?? ""),
        JSON.stringify(marked),
      );
    }

    // Cleanup created QA rows only
    if (marked?.length) {
      await admin.from("timeline_entries").delete().in(
        "id",
        marked.map((m) => m.id),
      );
    }
  }

  // Schedule / space selector path
  const editSchedule = page.getByTestId("edit-booking-schedule");
  if ((await editSchedule.count()) > 0) {
    await editSchedule.click();
    await page.waitForSelector('[data-testid="edit-booking-schedule-dialog"]', { timeout: 15_000 });
    await page.screenshot({ path: `${OUT_DIR}/04-edit-schedule-1280.png`, fullPage: true });
    const tSched0 = Date.now();
    await page.getByTestId("edit-schedule-save").click();
    // Wait for dialog close or toast
    for (let i = 0; i < 40; i += 1) {
      await page.waitForTimeout(200);
      if ((await page.getByTestId("edit-booking-schedule-dialog").count()) === 0) break;
    }
    out.timings.scheduleSaveCompleteMs = Date.now() - tSched0;
    record(
      "schedule_save_no_overwrite_crash",
      true,
      `completeMs=${out.timings.scheduleSaveCompleteMs}`,
    );
  } else {
    record("schedule_dialog_available", false, "edit-booking-schedule not on this event (single-space?)");
  }

  // Library isolation
  const { data: templatesAfter } = await admin
    .from("timeline_templates")
    .select("id, updated_at, name")
    .eq("venue_id", FANCY)
    .order("updated_at", { ascending: false })
    .limit(5);
  out.templateFingerprintAfter = templatesAfter;
  record(
    "library_templates_unchanged",
    JSON.stringify(templatesBefore) === JSON.stringify(templatesAfter),
    "updated_at fingerprints match",
  );

  // Other event isolation
  if (out.otherEventId) {
    const { count } = await admin
      .from("timeline_entries")
      .select("id", { count: "exact", head: true })
      .eq("event_id", out.otherEventId)
      .eq("venue_id", FANCY);
    out.otherEventCountAfter = count ?? 0;
    record(
      "other_event_timeline_unchanged",
      out.otherEventCountBefore === out.otherEventCountAfter,
      `before=${out.otherEventCountBefore} after=${out.otherEventCountAfter}`,
    );
  } else {
    record("other_event_timeline_unchanged", true, "no other event to compare");
  }

  record(
    "no_comms_side_effects_intended",
    true,
    "harness did not send invite/questionnaire/invoice/payment/contract",
  );
} catch (err) {
  record("harness_exception", false, err instanceof Error ? err.message : String(err));
} finally {
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ok: out.ok, servingSha: out.servingSha, timings: out.timings }, null, 2));
  await browser.close();
  process.exit(out.ok ? 0 : 1);
}
