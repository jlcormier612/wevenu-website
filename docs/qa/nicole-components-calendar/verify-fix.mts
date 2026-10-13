/**
 * Sandbox acceptance — Nicole components + availability card placement.
 * Read-only; does not mutate schedule records.
 */
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { evaluateEventOccupancy } from "@/lib/availability/event-occupancy";
import { projectAssignmentWindowsOntoCalendarDates } from "@/lib/calendar/event-assignment-projection";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = process.env.EXPECTED_SHA ?? "c7e1fcf4a085c04400c19bb60c6a7a58eca01d5d";
const EMAIL = "jlcormier612@gmail.com";
const VENUE = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const EVENT = "e15869c8-736d-42cc-a00a-4b4bbdadc0f1";
const BARN = "6366187b-e7f5-45d0-b9bd-5534a48f6650";
const VILLA = "e11e9e2f-1930-464d-b9e7-d0c61c30b221";
const BRIDGE = "696791d8-0e6f-4a6c-b99e-031ee7237d38";
const LAWN = "56a70756-5ee3-4e08-8e1b-d1713c5bbbec";
const OUT = "docs/qa/nicole-components-calendar";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

const checks: Array<{ name: string; pass: boolean; detail: unknown }> = [];
function record(name: string, pass: boolean, detail: unknown = null) {
  checks.push({ name, pass, detail });
  const rendered = typeof detail === "string" ? detail.slice(0, 220) : JSON.stringify(detail ?? null)?.slice(0, 220);
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${rendered}`);
}

const tip = (await fetch(`${APP}/login`, { method: "HEAD" }).then((r) => r.headers.get("link")))?.match(/dpl=([0-9a-f]{40})/)?.[1];
record("serving_commit", tip === EXPECTED, { tip, EXPECTED });

const { data: assigns } = await admin
  .from("event_space_assignments")
  .select("space_id,use_label,start_time,end_time,scheduled_date")
  .eq("event_id", EVENT);
record("db_five_components_unchanged", (assigns ?? []).length === 5, assigns);

const windows = (assigns ?? []).map((a) => ({
  spaceId: a.space_id,
  useLabel: a.use_label,
  startTime: a.start_time?.slice(0, 5) ?? null,
  endTime: a.end_time?.slice(0, 5) ?? null,
  scheduledDate: a.scheduled_date,
}));
const projected = projectAssignmentWindowsOntoCalendarDates({
  protectedDates: ["2027-05-08", "2027-05-09"],
  windows,
});
record(
  "projection_may8_may9",
  projected !== "untimed" &&
    (projected as any[]).filter((p) => p.date === "2027-05-08").length === 1 &&
    (projected as any[]).filter((p) => p.date === "2027-05-09").length === 4,
  projected,
);

const nicoleEvent = {
  id: EVENT,
  status: "confirmed",
  eventDate: "2027-05-08",
  eventEndDate: "2027-05-09",
  spaceId: BARN,
  spaceIds: [BARN, VILLA, BRIDGE, LAWN],
  windows: windows.map((w) => ({
    spaceId: w.spaceId,
    startTime: w.startTime,
    endTime: w.endTime,
    scheduledDate: w.scheduledDate,
  })),
  setupTime: null,
  startTime: null,
  endTime: null,
  teardownTime: null,
};
const venueOcc = {
  effectiveMax: 4,
  minTurnaroundHours: 0,
  activeSpaceIds: [BARN, VILLA, BRIDGE, LAWN],
  allSpaceIds: [BARN, VILLA, BRIDGE, LAWN],
};
function overlap(spaceId: string, date: string, startTime: string, endTime: string) {
  return evaluateEventOccupancy(
    {
      eventDate: date,
      spaceId,
      startTime,
      endTime,
      windows: [{ spaceId, startTime, endTime, scheduledDate: date }],
    },
    venueOcc,
    [nicoleEvent],
  );
}
record("occ_barn_reception", !overlap(BARN, "2027-05-09", "18:30", "20:00").ok, null);
record("occ_villa_getting_ready", !overlap(VILLA, "2027-05-09", "14:30", "15:30").ok, null);
record("occ_bridge_ceremony", !overlap(BRIDGE, "2027-05-09", "16:15", "16:45").ok, null);
record("occ_lawn_cocktail", !overlap(LAWN, "2027-05-09", "17:15", "17:45").ok, null);
record("occ_barn_rehearsal", !overlap(BARN, "2027-05-08", "18:30", "20:00").ok, null);
record("occ_barn_during_villa_ok", overlap(BARN, "2027-05-09", "14:00", "16:00").ok, null);
record("occ_barn_morning_ok", overlap(BARN, "2027-05-09", "10:00", "12:00").ok, null);

const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
const { data: otpData } = await anon.auth.verifyOtp({ type: "email", token_hash: linkData.properties!.hashed_token! });
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
    for (const k of Object.keys(localStorage)) if (/calendar|filter/i.test(k)) localStorage.removeItem(k);
  } catch { /* ignore */ }
});
const page = await context.newPage();

async function ensureDay(dayNum: string, monthName: string) {
  const body = await page.locator("body").innerText();
  if (new RegExp(`${monthName}\\s+${dayNum}\\b`, "i").test(body)) return;
  const buttons = page.locator("button");
  for (let i = 0; i < await buttons.count(); i++) {
    const el = buttons.nth(i);
    const t = (await el.innerText().catch(() => "")).trim();
    const box = await el.boundingBox();
    if ((t === dayNum || t.startsWith(`${dayNum}\n`)) && box && box.y > 250) {
      await el.click();
      await page.waitForTimeout(700);
      return;
    }
  }
}

try {
  const head = await page.goto(`${APP}/calendar?year=2027&month=5`, { waitUntil: "networkidle", timeout: 90000 });
  const dpl = (head?.headers()?.link ?? "").match(/dpl=([0-9a-f]{40})/)?.[1];
  record("browser_dpl", dpl === EXPECTED, dpl);
  await page.waitForTimeout(1500);

  // Layout: calendar grid/controls above availability cards (cards moved below)
  await page.waitForSelector("text=May", { timeout: 30000 });
  const positions = await page.evaluate(() => {
    const monthCtrl = Array.from(document.querySelectorAll("button, a, [role='tab']"))
      .find((el) => /^Month$/i.test((el.textContent || "").trim()));
    const avail = Array.from(document.querySelectorAll("body *"))
      .find((el) => /PUBLIC AVAILABILITY/i.test(el.textContent || "") && (el.textContent || "").length < 80);
    const tour = Array.from(document.querySelectorAll("body *"))
      .find((el) => /TOUR AVAILABILITY/i.test(el.textContent || "") && (el.textContent || "").length < 80);
    return {
      monthY: monthCtrl?.getBoundingClientRect().top ?? null,
      availY: avail?.getBoundingClientRect().top ?? null,
      tourY: tour?.getBoundingClientRect().top ?? null,
      viewportH: window.innerHeight,
    };
  });
  record("layout_calendar_above_availability", Boolean(
    positions.monthY != null &&
    positions.availY != null &&
    positions.monthY < positions.availY,
  ), positions);
  record("layout_cards_below_fold_or_below_calendar", Boolean(
    positions.availY != null &&
    positions.monthY != null &&
    positions.availY > positions.monthY,
  ), positions);
  await page.screenshot({ path: `${OUT}/fix-layout-top.png` });

  // Clear filters
  const clear = page.getByText("Clear filters");
  if (await clear.count()) await clear.first().click().catch(() => {});
  const space = page.locator('select[aria-label="Space"]');
  if (await space.count()) await space.selectOption({ index: 0 });
  await page.waitForTimeout(500);

  await ensureDay("8", "May");
  let body = await page.locator("body").innerText();
  record("may8_rehearsal", /Rehearsal Dinner/i.test(body) && /Meadowbrook Barn/i.test(body), body.match(/Saturday, May 8[\s\S]{0,500}/)?.[0]);
  await page.screenshot({ path: `${OUT}/fix-may8-all-spaces.png`, fullPage: true });

  await ensureDay("9", "May");
  body = await page.locator("body").innerText();
  record("may9_all_four", /Getting Ready/i.test(body) && /Ceremony/i.test(body) && /Cocktail Hour/i.test(body) && /Reception/i.test(body), body.match(/Sunday, May 9[\s\S]{0,1400}/)?.[0]);
  record("may9_spaces_named", /Meadowbrook Villa/i.test(body) && /Brook Bridge/i.test(body) && /Meadow Lawn/i.test(body) && /Meadowbrook Barn/i.test(body), null);
  await page.screenshot({ path: `${OUT}/fix-may9-all-spaces.png`, fullPage: true });

  // Barn filter — only Barn components
  await space.selectOption({ label: "Meadowbrook Barn" });
  await page.waitForTimeout(800);
  await ensureDay("9", "May");
  body = await page.locator("body").innerText();
  record("may9_barn_only_reception", /Reception/i.test(body) && !/Ceremony/i.test(body) && !/Getting Ready/i.test(body) && !/Cocktail Hour/i.test(body), body.match(/Sunday, May 9[\s\S]{0,600}/)?.[0]);
  await page.screenshot({ path: `${OUT}/fix-may9-barn.png`, fullPage: true });

  await space.selectOption({ index: 0 });
  await page.waitForTimeout(500);

  // Day / Week / Agenda
  await page.goto(`${APP}/calendar?view=day&date=2027-05-09`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1200);
  if (await space.count()) await space.selectOption({ index: 0 });
  body = await page.locator("body").innerText();
  record("day_may9_four", /Getting Ready/i.test(body) && /Ceremony/i.test(body) && /Cocktail/i.test(body) && /Reception/i.test(body), null);
  await page.screenshot({ path: `${OUT}/fix-day-may9.png` });

  await page.goto(`${APP}/calendar?view=week&weekStart=2027-05-09`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1500);
  const weekSpace = page.locator('select[aria-label="Space"]');
  if (await weekSpace.count()) await weekSpace.selectOption({ index: 0 });
  // Clear taxonomy to show events if a sole Tour chip is active from prior views
  const weekClear = page.getByText("Clear filters");
  if (await weekClear.count()) await weekClear.first().click().catch(() => {});
  await page.waitForTimeout(700);
  body = await page.locator("body").innerText();
  record("week_has_components", /Rehearsal Dinner|Getting Ready|Ceremony|Reception/i.test(body), body.match(/May[\s\S]{0,80}/)?.[0] ?? body.slice(0, 300));
  await page.screenshot({ path: `${OUT}/fix-week.png` });

  await page.goto(`${APP}/calendar?view=agenda&year=2027&month=5`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1200);
  if (await space.count()) await space.selectOption({ index: 0 });
  body = await page.locator("body").innerText();
  record("agenda_has_components", /Getting Ready/i.test(body) && /Reception/i.test(body), null);
  await page.screenshot({ path: `${OUT}/fix-agenda.png` });

  // Availability card actions (no messages)
  await page.goto(`${APP}/calendar?year=2027&month=5`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1200);
  const copyAvail = page.getByRole("button", { name: /Copy availability link/i });
  const copyTour = page.getByRole("button", { name: /Copy tour link/i });
  const previewAvail = page.getByRole("link", { name: /^Preview$/i }).first();
  record("copy_availability_present", (await copyAvail.count()) > 0, null);
  record("copy_tour_present", (await copyTour.count()) > 0, null);
  if (await copyAvail.count()) {
    await copyAvail.first().click();
    await page.waitForTimeout(400);
  }
  if (await copyTour.count()) {
    await copyTour.first().click();
    await page.waitForTimeout(400);
  }
  const previewHref = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll("a")).find((a) =>
      /Preview/i.test(a.textContent || "") && /availability/i.test(a.getAttribute("href") || ""),
    );
    return el?.getAttribute("href") ?? null;
  });
  const tourPreviewHref = await page.evaluate(() => {
    const byAria = document.querySelector('a[aria-label="Preview tour scheduling"]') as HTMLAnchorElement | null;
    if (byAria?.href) return byAria.href;
    const previews = Array.from(document.querySelectorAll("a")).filter((a) =>
      /^Preview$/i.test((a.textContent || "").trim()),
    );
    return previews[1]?.getAttribute("href") ?? previews.find((a) => !(a.getAttribute("href") || "").includes("/availability/"))?.getAttribute("href") ?? null;
  });
  record("preview_availability_href", Boolean(previewHref && previewHref.includes("/availability/")), previewHref);
  record("preview_tour_href", Boolean(tourPreviewHref && tourPreviewHref.length > 8), tourPreviewHref);
  await page.screenshot({ path: `${OUT}/fix-cards-below.png`, fullPage: true });
} catch (e) {
  record("harness_error", false, e instanceof Error ? e.message : String(e));
  await page.screenshot({ path: `${OUT}/fix-failure.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

const out = { checks, tip, EXPECTED, ok: checks.every((c) => c.pass) };
writeFileSync(`${OUT}/fix-browser-results.json`, JSON.stringify(out, null, 2));
console.log(out.ok ? "VERIFY_GREEN" : "VERIFY_NOT_GREEN");
process.exit(out.ok ? 0 : 1);
