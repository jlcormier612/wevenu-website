/**
 * Sandbox: Meadowbrook annual Christmas must not be selectable on inquiry.
 * Also proves create_public_lead rejects Dec 25 in choose_available mode.
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

const APP = "https://app.sandbox.hellotocheers.com";
const FORM_KEY = "cd9e89529e65480ba8cfc6e154193d5a";
const FORM = `${APP}/form/${FORM_KEY}`;
const OUT = "docs/qa/availability-integrity";
const EXPECT_SHA = (process.env.EXPECT_SHA || "").slice(0, 8);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox");
}
mkdirSync(OUT, { recursive: true });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 400)}`);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function availableDates(start: string, end: string): Promise<string[]> {
  const res = await fetch(
    `${APP}/api/public/inquiry-available-dates?key=${FORM_KEY}&start=${start}&end=${end}`,
  );
  const body = (await res.json()) as { dates?: string[] };
  return body.dates ?? [];
}

async function main() {
  const stamp = Date.now();
  const { data: venue } = await admin
    .from("venues")
    .select("id,inquiry_event_date_mode")
    .eq("embed_key", FORM_KEY)
    .single();
  record(
    "venue_choose_available",
    venue?.inquiry_event_date_mode === "choose_available",
    `mode=${venue?.inquiry_event_date_mode}`,
  );

  const { data: christmas } = await admin
    .from("tour_availability_exceptions")
    .select("id,start_date,recurrence_rule,label")
    .eq("venue_id", venue!.id)
    .eq("label", "Christmas")
    .maybeSingle();
  record(
    "christmas_rule_intact",
    christmas?.recurrence_rule === "annual" && christmas?.start_date === "2026-12-25",
    JSON.stringify(christmas),
  );

  const d2026 = await availableDates("2026-12-01", "2026-12-31");
  const d2027 = await availableDates("2027-12-01", "2027-12-31");
  record("api_2026_no_christmas", !d2026.includes("2026-12-25"), `n=${d2026.length}`);
  record("api_2027_no_christmas", !d2027.includes("2027-12-25"), `n=${d2027.length}`);
  record("api_2026_has_other_day", d2026.includes("2026-12-24"), "Dec 24 open");

  // Direct submit bypass
  const leadCountBefore = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venue!.id)
    .eq("email", `qa.blocked.${stamp}@example.test`);
  const { data: rejectBody, error: rejectErr } = await admin.rpc("create_public_lead", {
    p_embed_key: FORM_KEY,
    p_first_name: "QA",
    p_last_name: "Blocked",
    p_email: `qa.blocked.${stamp}@example.test`,
    p_phone: null,
    p_partner_first: null,
    p_partner_last: null,
    p_partner_email: null,
    p_event_type: "wedding",
    p_event_date: "2026-12-25",
    p_guest_count: 50,
    p_estimated_budget: null,
    p_message: "Should be rejected — Christmas",
    p_source_data: { qa: "recurring_blocked_date" },
  });
  const rejectOk =
    !rejectErr &&
    rejectBody &&
    (rejectBody as { ok?: boolean; error?: string }).ok === false &&
    (rejectBody as { error?: string }).error === "date_unavailable";
  record("server_reject_christmas", Boolean(rejectOk), JSON.stringify(rejectBody ?? rejectErr?.message));

  const { count: leadCountAfter } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venue!.id)
    .eq("email", `qa.blocked.${stamp}@example.test`);
  record(
    "no_lead_created_on_reject",
    (leadCountAfter ?? 0) === (leadCountBefore.count ?? 0),
    `before=${leadCountBefore.count} after=${leadCountAfter}`,
  );

  // Legitimate date still works
  const okEmail = `qa.open.${stamp}@example.test`;
  const { data: acceptBody, error: acceptErr } = await admin.rpc("create_public_lead", {
    p_embed_key: FORM_KEY,
    p_first_name: "QA",
    p_last_name: "Open",
    p_email: okEmail,
    p_phone: null,
    p_partner_first: null,
    p_partner_last: null,
    p_partner_email: null,
    p_event_type: "wedding",
    p_event_date: "2026-12-24",
    p_guest_count: 40,
    p_estimated_budget: null,
    p_message: "Legitimate available date",
    p_source_data: { qa: "recurring_blocked_date_ok" },
  });
  const acceptOk =
    !acceptErr && (acceptBody as { ok?: boolean })?.ok === true;
  record("server_accept_open_date", Boolean(acceptOk), JSON.stringify(acceptBody ?? acceptErr?.message));
  const leadId = (acceptBody as { lead_id?: string } | null)?.lead_id;
  if (leadId) {
    await admin.from("leads").delete().eq("id", leadId).eq("venue_id", venue!.id);
  }

  // Tour slot blocked on Christmas (same exception authority)
  const { data: tourBlocked } = await admin.rpc("tour_availability_exception_covers_date", {
    p_venue_id: venue!.id,
    p_date: "2026-12-25",
  });
  record("tour_exception_covers_christmas", tourBlocked === true, `covers=${tourBlocked}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(FORM, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2500);
    const html = await page.content();
    const dpl =
      html.match(/data-dpl-id="([a-f0-9]+)"/)?.[1] ||
      html.match(/[?&]dpl=([a-f0-9]{8,})/)?.[1] ||
      "";
    if (EXPECT_SHA) {
      record("runtime_dpl", dpl.startsWith(EXPECT_SHA), `dpl=${dpl}`);
    } else {
      record("runtime_dpl", Boolean(dpl), `dpl=${dpl || "missing"}`);
    }

    // Open date picker if present
    const dateTrigger = page
      .locator(
        'button:has-text("Preferred"), [data-testid*="date"], input[type="date"], button:has-text("Select"), button:has-text("event date")',
      )
      .first();
    if ((await dateTrigger.count()) > 0) {
      await dateTrigger.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(800);
    }

    // Prefer calendar day cells
    const day25 = page.locator(
      '[data-day="2026-12-25"], [aria-label*="December 25"], button:has-text("25")',
    );
    // Navigate to Dec 2026 if needed
    for (let i = 0; i < 24; i++) {
      const body = await page.locator("body").innerText();
      if (/December\s+2026/i.test(body)) break;
      const next = page.getByRole("button", { name: /next|›|>/i }).first();
      if ((await next.count()) > 0) await next.click().catch(() => undefined);
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `${OUT}/form-dec-2026.png`, fullPage: false });
    const bodyDec = await page.locator("body").innerText();
    // Day 25 should be disabled or absent from available selection — check network list as primary
    const disabled25 =
      (await page.locator('[data-day="2026-12-25"][disabled], [data-day="2026-12-25"][aria-disabled="true"]').count()) >
        0 ||
      (await page.locator('button[disabled]:has-text("25"), [aria-disabled="true"]:has-text("25")').count()) >
        0;
    record(
      "ui_dec_2026_christmas_not_selectable",
      !d2026.includes("2026-12-25") || disabled25 || /unavailable|blocked/i.test(bodyDec),
      `apiExcluded=${!d2026.includes("2026-12-25")} disabledCell=${disabled25}`,
    );

    // Refresh cache
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    const afterReload = await availableDates("2026-12-01", "2026-12-31");
    record(
      "after_refresh_still_excluded",
      !afterReload.includes("2026-12-25"),
      `n=${afterReload.length}`,
    );
  } finally {
    await browser.close();
  }

  const required = [
    "venue_choose_available",
    "christmas_rule_intact",
    "api_2026_no_christmas",
    "api_2027_no_christmas",
    "api_2026_has_other_day",
    "server_reject_christmas",
    "no_lead_created_on_reject",
    "server_accept_open_date",
    "tour_exception_covers_christmas",
    "runtime_dpl",
    "ui_dec_2026_christmas_not_selectable",
    "after_refresh_still_excluded",
  ];
  const report = {
    observedAt: new Date().toISOString(),
    expectSha: EXPECT_SHA || null,
    form: FORM,
    checks,
    hardFail: checks.filter((c) => required.includes(c.name) && !c.pass).map((c) => c.name),
    ok: required.every((n) => checks.find((c) => c.name === n)?.pass),
  };
  writeFileSync(`${OUT}/recurring-blocked-browser-results.json`, JSON.stringify(report, null, 2));
  console.log(report.ok ? "GREEN recurring blocked date inquiry" : "NOT GREEN");
  console.log(JSON.stringify({ ok: report.ok, hardFail: report.hardFail }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
