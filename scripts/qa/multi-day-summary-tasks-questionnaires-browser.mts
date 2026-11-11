/**
 * Sandbox browser proof — multi-day booking summary + task waiver/counts +
 * questionnaire selectors. Fancy Venue only. No Production. No customer email.
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
/** Meadowbrook owner — Ellie multi-day Sep 3–4 lives on this venue. */
const STAFF_EMAIL = "jlcormier612@gmail.com";
const MEADOWBROOK = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const OUT_DIR = "docs/qa/multi-day-summary-tasks-questionnaires";
const EXPECTED_PREFIX = process.env.EXPECTED_SHA_PREFIX ?? "d1531f9e";
const ELLIE_EVENT = "ef980240-359a-439b-a731-5ef80d1f1471";

const out: {
  ok: boolean;
  servingSha: string | null;
  tip: string;
  checks: Array<{ name: string; pass: boolean; detail: string }>;
  urls: Record<string, string>;
  ids: Record<string, string | null>;
  texts: Record<string, string>;
} = {
  ok: true,
  servingSha: null,
  tip: EXPECTED_PREFIX,
  checks: [],
  urls: {},
  ids: { clientId: null, eventId: null, venueId: null },
  texts: {},
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

async function cookiesFor(email: string, venueId: string) {
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
  const authCookies = ssrUtils.createChunks(cookieName, encoded).map(
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
  return [
    ...authCookies,
    {
      name: "htc_active_venue_id",
      value: venueId,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];
}

async function resolveEllie() {
  const { data: known } = await admin
    .from("events")
    .select("id, client_id, event_date, event_end_date, name, venue_id")
    .eq("id", ELLIE_EVENT)
    .maybeSingle();
  if (known?.client_id) {
    return {
      eventId: known.id as string,
      clientId: known.client_id as string,
      name: known.name as string,
      venueId: known.venue_id as string,
    };
  }
  throw new Error(`Ellie event ${ELLIE_EVENT} not found`);
}

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addCookies(await cookiesFor(STAFF_EMAIL, MEADOWBROOK));
const page = await context.newPage();

try {
  const target = await resolveEllie();
  out.ids.eventId = target.eventId;
  out.ids.clientId = target.clientId;
  out.ids.venueId = target.venueId;
  console.log(`Using event ${target.eventId} (${target.name}) client ${target.clientId} venue ${target.venueId}`);

  // Seed rehearsal scheduled_date if missing so the summary can show the
  // Sep 3 vs Sep 4 distinction from persisted data (times already saved).
  const { data: assignments } = await admin
    .from("event_space_assignments")
    .select("id, use_key, scheduled_date, start_time, end_time, space_id")
    .eq("event_id", target.eventId)
    .eq("venue_id", target.venueId)
    .order("sort_order");
  const rehearsal = (assignments ?? []).find((a) =>
    String(a.use_key).includes("rehearsal"),
  );
  if (rehearsal && !rehearsal.scheduled_date) {
    const { data: ev } = await admin
      .from("events")
      .select("event_date, event_end_date")
      .eq("id", target.eventId)
      .maybeSingle();
    const friday = ev?.event_date ?? null;
    if (friday) {
      await admin
        .from("event_space_assignments")
        .update({ scheduled_date: friday })
        .eq("id", rehearsal.id)
        .eq("venue_id", target.venueId);
      console.log(`Seeded rehearsal scheduled_date=${friday} (was null)`);
    }
  }

  await page.goto(`${APP}/clients/${target.clientId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2500);
  const dpl = noteDeployment(await page.locator('link[rel="deployment"]').getAttribute("href").catch(() => null) ?? undefined)
    ?? noteDeployment(await page.content().then((h) => {
      const m = h.match(/dpl=([0-9a-f]{40})/i);
      return m ? `dpl=${m[1]}` : undefined;
    }));
  out.servingSha = dpl;
  record(
    "serving-sha",
    Boolean(dpl && dpl.startsWith(EXPECTED_PREFIX.slice(0, 7))),
    `serving=${dpl ?? "unknown"} expectedPrefix=${EXPECTED_PREFIX}`,
  );

  const summary = page.getByTestId("event-booking-summary");
  await summary.waitFor({ timeout: 20000 });
  const summaryText = (await summary.innerText()).replace(/\s+/g, " ");
  out.texts.summary1280 = summaryText;
  record("no-overall-hours-label", !/Overall\s+\d/i.test(summaryText), summaryText.slice(0, 220));
  const componentSchedule = page.getByTestId("event-booking-component-schedule");
  const hasComponents = await componentSchedule.count();
  record("component-schedule-rendered", hasComponents > 0, `count=${hasComponents}`);
  if (hasComponents > 0) {
    const compText = (await componentSchedule.innerText()).replace(/\s+/g, " ");
    out.texts.components1280 = compText;
    record("rehearsal-present", /Rehearsal/i.test(compText), compText.slice(0, 200));
    record(
      "sep3-sep4-distinction",
      /Sep(?:tember)?\s*3|2027-09-03|Friday/i.test(compText)
        && /Sep(?:tember)?\s*4|2027-09-04|Saturday/i.test(compText),
      compText.slice(0, 280),
    );
    record("honest-time-or-set", /Time not set|\d{1,2}:\d{2}/i.test(compText), "has time labels");
    record(
      "rehearsal-not-wedding-hours",
      !/Overall\s*2:00\s*PM/i.test(summaryText),
      "no Overall 2:00 PM window masquerading as whole booking",
    );
  }
  await page.screenshot({ path: `${OUT_DIR}/summary-1280.png`, fullPage: false });

  // Planning tab — task counts / waive
  await page.getByRole("tab", { name: /Planning/i }).click();
  await page.waitForTimeout(1500);
  const taskList = page.getByTestId("planning-task-list");
  if (await taskList.count()) {
    const listed = await taskList.getAttribute("data-listed-tasks");
    const total = await taskList.getAttribute("data-total-tasks");
    const completed = await taskList.getAttribute("data-completed");
    const waived = await taskList.getAttribute("data-waived");
    record(
      "task-counts-reconcile",
      listed === total,
      `listed=${listed} total=${total} completed=${completed} waived=${waived}`,
    );
    const progress = page.getByTestId("planning-required-progress").first();
    if (await progress.count()) {
      const pText = await progress.innerText();
      out.texts.progress = pText;
      record("progress-not-labeling-waived-complete", !/\d+ of \d+ complete$/i.test(pText) || /waived/i.test(pText) || !/waived/i.test(await taskList.innerText()), pText);
    }
  } else {
    record("task-list-present", false, "No planning-task-list — playbook may be unapplied");
  }

  // Questionnaires
  const qTab = page.getByRole("tab", { name: /Questionnaire/i });
  if (await qTab.count()) {
    await qTab.click();
  } else {
    // May live under Planning / Documents — try text
    const qBtn = page.getByRole("button", { name: /Final Details|Client Planning|Post-Event/i }).first();
    if (await qBtn.count()) await qBtn.click();
  }
  await page.waitForTimeout(1000);

  for (const kind of ["client_planning", "final_details", "post_event_feedback"] as const) {
    const kindBtn = page.getByRole("button", {
      name: kind === "client_planning"
        ? /Client Planning/i
        : kind === "final_details"
          ? /Final Details/i
          : /Post-Event/i,
    }).first();
    if (await kindBtn.count()) await kindBtn.click();
    await page.waitForTimeout(600);
    const sel = page.getByTestId(`questionnaire-template-select-${kind}`);
    if (await sel.count()) {
      const label = (await sel.innerText()).replace(/\s+/g, " ").trim();
      out.texts[`select-${kind}`] = label;
      const looksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(label);
      record(`questionnaire-select-${kind}`, !looksUuid, `label="${label}"`);
      await sel.click();
      await page.waitForTimeout(400);
      const options = await page.locator("[data-slot=select-item]").allInnerTexts();
      record(
        `questionnaire-options-${kind}`,
        options.length > 0 && options.every((o) => !/^[0-9a-f-]{36}$/i.test(o.trim())),
        options.join(" | ").slice(0, 200),
      );
      await page.keyboard.press("Escape");
    } else {
      // Selector only shows when canApplyTemplate && kindTemplates.length > 0
      record(`questionnaire-select-${kind}`, false, "selector not rendered (no templates or not draft)");
    }
  }
  await page.screenshot({ path: `${OUT_DIR}/questionnaires-1280.png`, fullPage: false });

  // Waive one open required task and confirm distinct presentation
  await page.goto(`${APP}/clients/${target.clientId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.getByRole("tab", { name: /Planning/i }).click();
  await page.waitForTimeout(1000);
  const { data: openTask } = await admin
    .from("event_tasks")
    .select("id, title, status")
    .eq("event_id", target.eventId)
    .eq("venue_id", target.venueId)
    .eq("is_required", true)
    .in("status", ["pending", "overdue"])
    .limit(1)
    .maybeSingle();
  if (openTask) {
    await admin
      .from("event_tasks")
      .update({ status: "waived", completed_at: null, completed_by: null })
      .eq("id", openTask.id)
      .eq("venue_id", target.venueId);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.getByRole("tab", { name: /Planning/i }).click();
    await page.waitForTimeout(1000);
    const list = page.getByTestId("planning-task-list");
    const waivedAttr = await list.getAttribute("data-waived");
    const completedAttr = await list.getAttribute("data-completed");
    const listText = await list.innerText();
    record(
      "waived-distinct-after-reload",
      Number(waivedAttr) >= 1 && !new RegExp(`${openTask.title}[\\s\\S]{0,80}Completed`, "i").test(listText),
      `waived=${waivedAttr} completed=${completedAttr} task=${openTask.title}`,
    );
    const progressAfter = page.getByTestId("planning-required-progress").first();
    if (await progressAfter.count()) {
      const p = await progressAfter.innerText();
      record("waived-not-labeled-completed", /waived/i.test(p) && !/^\d+ of \d+ complete$/i.test(p.trim()), p);
    }
    await page.screenshot({ path: `${OUT_DIR}/planning-waived-1280.png`, fullPage: false });
  } else {
    record("waived-distinct-after-reload", false, "no open required task to waive");
  }

  // Setup Profile vendor directory copy (edit an existing profile)
  await page.goto(`${APP}/settings/leads/setup-profiles`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  const editBtn = page.getByRole("button", { name: /Edit|Open|Manage/i }).first();
  const newBtn = page.getByRole("button", { name: /New setup profile/i }).first();
  if (await editBtn.count()) {
    await editBtn.click();
    await page.waitForTimeout(1500);
  } else if (await newBtn.count()) {
    await newBtn.click();
    await page.waitForTimeout(1500);
  }
  const setupBody = await page.locator("main, [data-testid=setup-profiles], body").first().innerText();
  record(
    "setup-profile-directory-default-copy",
    /directory available|eligible directory|optional recommendations|Vendor directory|Vendor Network/i.test(setupBody),
    setupBody.slice(0, 240).replace(/\s+/g, " "),
  );
  await page.screenshot({ path: `${OUT_DIR}/setup-profiles-1280.png`, fullPage: false });

  // Mobile 390
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${APP}/clients/${target.clientId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2500);
  const summary390 = page.getByTestId("event-booking-summary");
  const text390 = (await summary390.innerText()).replace(/\s+/g, " ");
  out.texts.summary390 = text390;
  record("summary-390-no-overall", !/Overall\s+\d/i.test(text390), text390.slice(0, 200));
  record("summary-390-has-components", (await page.getByTestId("event-booking-component-schedule").count()) > 0, "component schedule at 390");
  await page.screenshot({ path: `${OUT_DIR}/summary-390.png`, fullPage: false });

  await page.getByRole("tab", { name: /Planning/i }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}/planning-390.png`, fullPage: false });

  // Reload persistence check
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.goto(`${APP}/clients/${target.clientId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2000);
  const afterReload = (await page.getByTestId("event-booking-summary").innerText()).replace(/\s+/g, " ");
  record(
    "summary-persists-reload",
    (await page.getByTestId("event-booking-component-schedule").count()) > 0 && !/Overall\s+\d/i.test(afterReload),
    afterReload.slice(0, 200),
  );
  await page.screenshot({ path: `${OUT_DIR}/summary-reload-1280.png`, fullPage: false });

  out.urls.client = `${APP}/clients/${target.clientId}`;
} catch (err) {
  out.ok = false;
  record("script-error", false, err instanceof Error ? err.message : String(err));
  await page.screenshot({ path: `${OUT_DIR}/failure.png`, fullPage: true }).catch(() => {});
} finally {
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(out, null, 2));
  await browser.close();
  console.log(JSON.stringify({ ok: out.ok, servingSha: out.servingSha, fails: out.checks.filter((c) => !c.pass).map((c) => c.name) }, null, 2));
  process.exit(out.ok ? 0 : 1);
}
