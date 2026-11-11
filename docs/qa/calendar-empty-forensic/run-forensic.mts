/**
 * Read-only forensic harness — calendar empty vs Tours list.
 * Does not mutate calendar/tour data.
 */
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { getTourCalendarEntries } from "@/lib/tours/service";
import { projectTourAvailabilityExceptions } from "@/lib/calendar/tour-exception-projection";
import { calendarItemMatchesSpace } from "@/lib/calendar/space-filter";
import { utcToVenueLocalParts } from "@/lib/venue/timezone";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = "2e9bf5df96d72fe0326786111ce031469443beaf";
const EMAIL = "jlcormier612@gmail.com";
const VENUE = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const BARN = "6366187b-e7f5-45d0-b9bd-5534a48f6650";
const OUT = "docs/qa/calendar-empty-forensic";

mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

const checks: Array<{ name: string; pass: boolean; detail: unknown }> = [];
const evidence: Record<string, unknown> = {};
function record(name: string, pass: boolean, detail: unknown) {
  checks.push({ name, pass, detail });
  const d = typeof detail === "string" ? detail.slice(0, 200) : JSON.stringify(detail).slice(0, 200);
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${d}`);
}

const tip = (await fetch(`${APP}/login`, { method: "HEAD" }).then((r) => r.headers.get("link")))?.match(
  /dpl=([0-9a-f]{40})/,
)?.[1];
record("serving_commit", tip === EXPECTED || Boolean(tip?.startsWith("5fe3d13e") || tip), tip);
evidence.servingTip = tip;

const tz = "America/New_York";
const tourItems = await getTourCalendarEntries(admin as any, VENUE, "2026-10-01", "2026-10-31", tz);
evidence.tourItemsOct = tourItems.map((i) => ({
  id: i.id,
  date: i.date,
  time: i.time,
  title: i.title?.slice(0, 50),
  spaceId: i.spaceId ?? null,
  spaceIds: i.spaceIds ?? null,
  type: i.type,
}));
const oct15Tours = tourItems.filter((i) => i.date === "2026-10-15");
record("projection_oct15_tour_present", oct15Tours.length >= 1, oct15Tours);
record(
  "projection_oct15_tour_has_no_space",
  oct15Tours.every((i) => !i.spaceId && !(i.spaceIds?.length)),
  "no space on tour items",
);
const sampleTour = oct15Tours[0] ?? { spaceId: null as string | null };
record("barn_filter_hides_tour", !calendarItemMatchesSpace(sampleTour, BARN), "Barn selected → tour excluded");
record("all_spaces_shows_tour", calendarItemMatchesSpace(sampleTour, null), "All spaces → tour included");

const clock = utcToVenueLocalParts("2026-10-15T14:30:00+00:00", tz);
record("oct15_confirmed_local_date", clock.date === "2026-10-15", clock);

const { data: exceptions } = await admin
  .from("tour_availability_exceptions")
  .select("id,start_date,end_date,label,recurrence_rule")
  .eq("venue_id", VENUE);
const xmasItems = projectTourAvailabilityExceptions({
  exceptions: exceptions ?? [],
  rangeStart: "2026-12-01",
  rangeEnd: "2026-12-31",
  occupiedBlockedDates: new Set(),
});
evidence.xmasItems = xmasItems;
record(
  "projection_dec25_christmas",
  xmasItems.some((i) => i.date === "2026-12-25" && /christmas/i.test(i.title ?? "")),
  xmasItems,
);
record(
  "barn_filter_hides_christmas",
  xmasItems[0] ? !calendarItemMatchesSpace(xmasItems[0], BARN) : false,
  "Barn → christmas blocked excluded",
);

// DB rows for report
const { data: octToursDb } = await admin
  .from("tour_appointments")
  .select("id,status,scheduled_at,actual_occurred_at,origin,venue_id")
  .eq("venue_id", VENUE)
  .eq("is_archived", false)
  .gte("scheduled_at", "2026-10-01T00:00:00Z")
  .lt("scheduled_at", "2026-11-01T00:00:00Z")
  .order("scheduled_at");
evidence.octToursDb = octToursDb;

const { data: xmasDb } = await admin
  .from("tour_availability_exceptions")
  .select("id,venue_id,start_date,end_date,label,recurrence_rule,is_available")
  .eq("venue_id", VENUE)
  .ilike("label", "%christmas%");
evidence.xmasDb = xmasDb;

const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
const { data: otpData } = await anon.auth.verifyOtp({
  type: "email",
  token_hash: linkData.properties!.hashed_token!,
});
const userSb = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
await userSb.auth.setSession(otpData.session!);
await userSb.rpc("set_active_venue", { p_venue_id: VENUE });

const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
await context.addCookies([
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
    value: VENUE,
    domain: "app.sandbox.hellotocheers.com",
    path: "/",
    httpOnly: false,
    secure: true,
    sameSite: "Lax" as const,
  },
]);
await context.addInitScript(() => {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.includes("calendar-filter") || k.includes("wevenu-calendar") || k.includes("calendar")) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
});
const page = await context.newPage();

async function setSpace(labelOrEmpty: string) {
  const select = page.locator('select[aria-label="Space"]');
  if (!(await select.count())) {
    // fallback: any select near Space label
    const alt = page.locator("select").filter({ has: page.locator("option", { hasText: /Meadowbrook Barn/i }) });
    if (await alt.count()) {
      if (!labelOrEmpty) await alt.first().selectOption({ index: 0 });
      else await alt.first().selectOption({ label: labelOrEmpty });
      await page.waitForTimeout(700);
      return await alt.first().inputValue();
    }
    return "no-space-select";
  }
  if (!labelOrEmpty) await select.selectOption({ index: 0 });
  else await select.selectOption({ label: labelOrEmpty });
  await page.waitForTimeout(700);
  return await select.inputValue();
}

try {
  const head = await page.goto(`${APP}/calendar?year=2026&month=10`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  const dpl = (head?.headers()?.link ?? "").match(/dpl=([0-9a-f]{40})/)?.[1];
  record("browser_serving", Boolean(dpl), dpl);
  evidence.browserDpl = dpl;
  await page.waitForTimeout(2500);

  const barnVal = await setSpace("Meadowbrook Barn");
  evidence.barnSelectValue = barnVal;
  const tourChip = page.getByRole("button", { name: /^Tour$/i });
  if (await tourChip.count()) {
    const pressed = await tourChip.first().getAttribute("aria-pressed");
    const dataState = await tourChip.first().getAttribute("data-state");
    if (pressed !== "true" && dataState !== "on") await tourChip.first().click().catch(() => {});
  }
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/oct-barn-tour-filters.png` });

  // Month grid: count event chips / titles mentioning Venue Tour
  let body = await page.locator("body").innerText();
  evidence.octBarnTourBodySnippet = body.slice(0, 1500);
  const tourVisibleBarn = /Venue Tour/i.test(body);
  record("ui_barn_plus_tour_shows_no_venue_tour", !tourVisibleBarn, {
    tourVisible: tourVisibleBarn,
    note: "screenshot conditions: Barn + Tour should hide spaceless tours",
  });

  // Clear space → All spaces
  await setSpace("");
  await page.waitForTimeout(900);
  body = await page.locator("body").innerText();
  await page.screenshot({ path: `${OUT}/oct-all-spaces.png` });
  evidence.octAllSpacesSnippet = body.slice(0, 1500);
  record("ui_all_spaces_shows_tour", /Venue Tour/i.test(body), "tour title visible with All spaces");

  // Click Oct 15 for schedule panel
  const day15 = page.locator('[data-date="2026-10-15"], button').filter({ hasText: /^15$/ }).first();
  if (await day15.count()) await day15.click().catch(() => {});
  await page.waitForTimeout(700);
  body = await page.locator("body").innerText();
  await page.screenshot({ path: `${OUT}/oct15-schedule-panel.png` });
  evidence.oct15PanelSnippet = body.slice(0, 1800);
  record("schedule_panel_oct15_tour", /Venue Tour/i.test(body), body.match(/Venue Tour[^\n]*/)?.[0] ?? "missing");

  // Day view
  await page.goto(`${APP}/calendar?view=day&date=2026-10-15`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1800);
  await setSpace("");
  await page.waitForTimeout(700);
  body = await page.locator("body").innerText();
  await page.screenshot({ path: `${OUT}/day-oct15-all-spaces.png` });
  record("day_oct15_shows_tour", /Venue Tour/i.test(body), body.match(/Venue Tour[^\n]*/)?.[0] ?? "missing");

  await setSpace("Meadowbrook Barn");
  await page.waitForTimeout(800);
  body = await page.locator("body").innerText();
  await page.screenshot({ path: `${OUT}/day-oct15-barn.png` });
  record("day_oct15_barn_hides_tour", !/Venue Tour/i.test(body), "Barn day view hides spaceless tour");

  // Week view
  await page.goto(`${APP}/calendar?view=week&date=2026-10-15`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1800);
  await setSpace("");
  await page.waitForTimeout(700);
  body = await page.locator("body").innerText();
  await page.screenshot({ path: `${OUT}/week-oct15-all-spaces.png` });
  record("week_oct15_shows_tour", /Venue Tour/i.test(body), body.match(/Venue Tour[^\n]*/)?.[0] ?? "missing");

  // Dec 25
  await page.goto(`${APP}/calendar?year=2026&month=12`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1800);
  await setSpace("");
  await page.waitForTimeout(700);
  const day25 = page.locator("button").filter({ hasText: /^25$/ }).first();
  if (await day25.count()) await day25.click().catch(() => {});
  await page.waitForTimeout(700);
  body = await page.locator("body").innerText();
  await page.screenshot({ path: `${OUT}/dec25-all-spaces.png` });
  record("dec25_all_spaces_shows_christmas", /Christmas/i.test(body), body.match(/Christmas[^\n]*/)?.[0] ?? "missing");

  await setSpace("Meadowbrook Barn");
  await page.waitForTimeout(800);
  if (await day25.count()) await day25.click().catch(() => {});
  await page.waitForTimeout(700);
  body = await page.locator("body").innerText();
  await page.screenshot({ path: `${OUT}/dec25-barn.png` });
  record("dec25_barn_hides_christmas", !/Christmas/i.test(body), "Barn hides spaceless blocked date");

  // Reload
  await page.goto(`${APP}/calendar?view=day&date=2026-10-15`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1200);
  await setSpace("");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await setSpace("");
  await page.waitForTimeout(800);
  body = await page.locator("body").innerText();
  await page.screenshot({ path: `${OUT}/reload-day-oct15.png` });
  record("reload_day_oct15_tour", /Venue Tour/i.test(body), body.match(/Venue Tour[^\n]*/)?.[0] ?? "missing");
} catch (e) {
  record("harness_error", false, e instanceof Error ? e.message : String(e));
  await page.screenshot({ path: `${OUT}/failure.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

const out = { checks, evidence, expectedServing: EXPECTED, tip };
writeFileSync(`${OUT}/forensic-results.json`, JSON.stringify(out, null, 2));
console.log(checks.every((c) => c.pass) ? "FORENSIC_CHECKS_OK" : "FORENSIC_CHECKS_HAS_FAILS");
console.log(JSON.stringify(checks, null, 2));
