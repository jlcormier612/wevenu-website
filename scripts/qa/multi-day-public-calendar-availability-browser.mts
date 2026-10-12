/**
 * Public availability calendar — Ellie Sept 2027 dates remain Available
 * under simultaneous-venue rules; DB occupancy agrees.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const EMBED = "cd9e89529e65480ba8cfc6e154193d5a";
const MEADOW = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const OUT = resolve("docs/qa/multi-day-public-calendar-availability");
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

async function main() {
  const { data: cal } = await admin.rpc("get_public_availability_calendar", {
    p_embed_key: EMBED,
    p_start: "2027-09-01",
    p_end: "2027-09-30",
  });
  const dates = (cal?.dates ?? []).map(String);
  record("db_sept3_available", dates.includes("2027-09-03"), `in dates=${dates.includes("2027-09-03")}`);
  record("db_sept4_available", dates.includes("2027-09-04"), `in dates=${dates.includes("2027-09-04")}`);
  record("db_sept5_available", dates.includes("2027-09-05"), `unaffected date present=${dates.includes("2027-09-05")}`);

  const lawn = "56a70756-5ee3-4e08-8e1b-d1713c5bbbec";
  const barn = "6366187b-e7f5-45d0-b9bd-5534a48f6650";
  const bridge = "696791d8-0e6f-4a6c-b99e-031ee7237d38";
  const { data: lawnOk } = await admin.rpc("evaluate_event_availability", {
    p_venue_id: MEADOW, p_event_date: "2027-09-03", p_event_end_date: null,
    p_start_time: null, p_end_time: null, p_setup_time: null, p_teardown_time: null,
    p_space_id: lawn, p_exclude_event_id: null,
  });
  const { data: barnBlocked } = await admin.rpc("evaluate_event_availability", {
    p_venue_id: MEADOW, p_event_date: "2027-09-03", p_event_end_date: null,
    p_start_time: null, p_end_time: null, p_setup_time: null, p_teardown_time: null,
    p_space_id: barn, p_exclude_event_id: null,
  });
  const { data: bridgeFriOk } = await admin.rpc("evaluate_event_availability", {
    p_venue_id: MEADOW, p_event_date: "2027-09-03", p_event_end_date: null,
    p_start_time: "17:00", p_end_time: "18:00", p_setup_time: null, p_teardown_time: null,
    p_space_id: bridge, p_exclude_event_id: null,
  });
  record("lawn_keeps_date_open", lawnOk?.ok === true, JSON.stringify(lawnOk));
  record("barn_fri_full_blocked", barnBlocked?.ok === false, JSON.stringify(barnBlocked));
  record("bridge_fri_evening_ok_after_fix", bridgeFriOk?.ok === true, JSON.stringify(bridgeFriOk));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${APP}/availability/${EMBED}?year=2027&month=9`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForTimeout(1200);
  const body = await page.locator("body").innerText();
  const hasLegend = body.includes("Available dates can still be requested");
  const hasNotAvailableCopy = body.includes("Not available means this venue cannot take an event that day");
  await page.screenshot({ path: `${OUT}/public-calendar-sept-2027.png`, fullPage: true });
  record("public_calendar_loads", /September|2027|Available/i.test(body), "calendar page rendered");
  record("public_calendar_legend", hasLegend && hasNotAvailableCopy, "legend copy present");

  // Reload persistence
  await page.reload({ waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(800);
  const body2 = await page.locator("body").innerText();
  record("reload_stable", /September|2027/i.test(body2), "reload still shows September 2027");
  await page.screenshot({ path: `${OUT}/public-calendar-sept-2027-reload.png`, fullPage: true });

  await browser.close();

  const ok = checks.every((c) => c.pass);
  const result = {
    ok,
    migration: "20261418300000_schedule_overlap_same_calendar_day.sql",
    migrationRun: "https://github.com/jlcormier612/wevenu-website/actions/runs/38324248031",
    commit: "a5d36b9291285ec6bedaf18383635e2dba11d0cd",
    semantics: "Available when any active space can accept a full-day Event; Lawn free → Sept 3–4 Available",
    checks,
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(result, null, 2));
  console.log(ok ? "GREEN" : "NOT GREEN");
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
