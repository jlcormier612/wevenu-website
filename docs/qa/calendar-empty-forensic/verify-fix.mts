/**
 * Sandbox browser acceptance — calendar filter fix (venue-wide + taxonomy).
 * Read-only against persisted Meadowbrook records. Does not mutate data.
 */
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = process.env.EXPECTED_SHA ?? "727a92caf62af61fd05c7f9c8d5b3d1727a2ff1e";
const EMAIL = "jlcormier612@gmail.com";
const VENUE = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const OUT = "docs/qa/calendar-empty-forensic";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

const checks: Array<{ name: string; pass: boolean; detail: unknown }> = [];
function record(name: string, pass: boolean, detail: unknown = null) {
  checks.push({ name, pass, detail });
  const rendered =
    typeof detail === "string"
      ? detail.slice(0, 220)
      : JSON.stringify(detail ?? null)?.slice(0, 220) ?? "null";
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${rendered}`);
}

const tip = (await fetch(`${APP}/login`, { method: "HEAD" }).then((r) => r.headers.get("link")))?.match(
  /dpl=([0-9a-f]{40})/,
)?.[1];
record("serving_commit", tip === EXPECTED, { tip, EXPECTED });

const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
const { data: otpData } = await anon.auth.verifyOtp({
  type: "email",
  token_hash: linkData.properties!.hashed_token!,
});
const userSb = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
await userSb.auth.setSession(otpData.session!);
await userSb.rpc("set_active_venue", { p_venue_id: VENUE });

// DB unchanged proof (read-only)
const { data: lucy } = await admin
  .from("tour_appointments")
  .select("id,status,scheduled_at,actual_occurred_at,venue_id")
  .eq("id", "061714de-b785-4b47-ad3e-ecc53616e853")
  .maybeSingle();
const { data: xmas } = await admin
  .from("tour_availability_exceptions")
  .select("id,label,start_date,recurrence_rule,venue_id")
  .eq("id", "a32242fa-852b-4b34-85c8-8db9f879517d")
  .maybeSingle();
record("db_lucy_unchanged", lucy?.status === "confirmed" && Boolean(lucy?.scheduled_at?.startsWith("2026-10-15")), lucy);
record("db_christmas_unchanged", /christmas/i.test(xmas?.label ?? "") && xmas?.recurrence_rule === "annual", xmas);

const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
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
      if (/calendar|filter/i.test(k)) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
});
const page = await context.newPage();

async function clearFilters() {
  const clear = page.getByText("Clear filters");
  if (await clear.count()) await clear.first().click().catch(() => {});
  const space = page.locator('select[aria-label="Space"]');
  if (await space.count()) await space.selectOption({ index: 0 });
  await page.waitForTimeout(500);
}

async function setSpace(label: string | null) {
  const space = page.locator('select[aria-label="Space"]');
  if (!(await space.count())) return "missing";
  if (!label) await space.selectOption({ index: 0 });
  else await space.selectOption({ label });
  await page.waitForTimeout(700);
  return await space.inputValue();
}

async function ensureDaySelected(dayNum: string, monthName: string) {
  const body = await page.locator("body").innerText();
  // Month grid toggles selection off when the same day is clicked again —
  // only click when the Schedule panel is not already on that day.
  if (new RegExp(`${monthName}\\s+${dayNum}\\b`, "i").test(body)) return true;
  const buttons = page.locator("button");
  for (let i = 0; i < await buttons.count(); i++) {
    const el = buttons.nth(i);
    const t = (await el.innerText().catch(() => "")).trim();
    const box = await el.boundingBox();
    if ((t === dayNum || t.startsWith(`${dayNum}\n`)) && box && box.y > 400) {
      await el.click();
      await page.waitForTimeout(700);
      return true;
    }
  }
  return false;
}

try {
  const head = await page.goto(`${APP}/calendar?year=2026&month=10`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  const dpl = (head?.headers()?.link ?? "").match(/dpl=([0-9a-f]{40})/)?.[1];
  record("browser_dpl", dpl === EXPECTED, dpl);
  await page.waitForTimeout(1500);
  await clearFilters();
  await page.waitForTimeout(800);

  let body = await page.locator("body").innerText();
  const html = await page.content();
  const glance = body.match(/at a glance[^\n]*/i)?.[0] ?? null;
  record("oct_cleared_glance_has_tours", /4 items/i.test(glance ?? "") && /4 Tours/i.test(body), glance);
  await ensureDaySelected("15", "October");
  body = await page.locator("body").innerText();
  record("oct_cleared_lucy_visible", /Lucy/i.test(body) || /Lucy/i.test(html), body.match(/Thursday, October 15[\s\S]{0,300}/)?.[0] ?? body.match(/Venue Tour[^\n]*/g)?.slice(0, 6));
  await page.screenshot({ path: `${OUT}/fix-oct-cleared-month.png`, fullPage: true });

  // Tour + Barn — venue-wide tour must remain
  const tourChip = page.getByRole("button", { name: /^Tour$/i });
  // Isolate to Tour if multiple present: deselect others by clicking them when active
  // Safer path: clear then click each non-tour to deselect from all-on
  const presentChips = ["Event", "Appointment", "Hold", "Blocked Time"];
  for (const name of presentChips) {
    const btn = page.getByRole("button", { name: new RegExp(`^${name}$`, "i") });
    if (await btn.count()) {
      // When all selected (null filters), chips look active — click to deselect
      await btn.last().click().catch(() => {});
      await page.waitForTimeout(200);
    }
  }
  await setSpace("Meadowbrook Barn");
  await page.waitForTimeout(800);
  await ensureDaySelected("15", "October");
  body = await page.locator("body").innerText();
  record("oct_tour_barn_lucy_visible", /Lucy/i.test(body) || /Venue Tour/i.test(body), {
    hasLucy: /Lucy/i.test(body),
    glance: body.match(/at a glance[^\n]*/i)?.[0],
  });
  record(
    "oct15_panel_lucy_under_barn",
    /Lucy/i.test(body) && /October 15/i.test(body),
    body.match(/Thursday, October 15[\s\S]{0,350}/)?.[0] ?? body.match(/Venue Tour[^\n]*/)?.[0] ?? body.slice(0, 400),
  );
  await page.screenshot({ path: `${OUT}/fix-oct-tour-barn.png`, fullPage: true });

  // Click Tour chip again — must NOT blank
  if (await tourChip.count()) {
    await tourChip.last().click();
    await page.waitForTimeout(700);
  }
  body = await page.locator("body").innerText();
  record("oct_tour_chip_no_blank", /Venue Tour|Lucy|at a glance/i.test(body) && !/at a glance — 0 item/i.test(body), {
    glance: body.match(/at a glance[^\n]*/i)?.[0],
    hasTour: /Venue Tour/i.test(body),
  });
  await page.screenshot({ path: `${OUT}/fix-oct-tour-chip-rebounce.png`, fullPage: true });

  await clearFilters();
  await page.waitForTimeout(700);
  await ensureDaySelected("15", "October");
  body = await page.locator("body").innerText();
  record("oct_after_clear_tours_return", /Lucy/i.test(body) && /4 items/i.test(body), body.match(/at a glance[^\n]*/i)?.[0]);

  // Completed tours on actual dates (Oct 11 Ellie, Oct 12 Nicole/Lydia)
  await ensureDaySelected("11", "October");
  body = await page.locator("body").innerText();
  const hasEllie = /Ellie/i.test(body);
  await ensureDaySelected("12", "October");
  body = await page.locator("body").innerText();
  const hasNicole = /Nicole/i.test(body);
  const hasLydia = /Lydia/i.test(body);
  record("oct_completed_on_actual_dates", hasEllie && (hasNicole || hasLydia), {
    hasEllie,
    hasNicole,
    hasLydia,
  });

  // Day / Week / Month list
  await page.goto(`${APP}/calendar?view=day&date=2026-10-15`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1200);
  await clearFilters();
  await setSpace("Meadowbrook Barn");
  await page.waitForTimeout(700);
  body = await page.locator("body").innerText();
  record("day_oct15_barn_lucy", /Lucy/i.test(body), body.match(/Venue Tour[^\n]*/)?.[0]);
  await page.screenshot({ path: `${OUT}/fix-day-oct15-barn.png` });

  await page.goto(`${APP}/calendar?view=week&date=2026-10-15`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1200);
  await clearFilters();
  await setSpace("Meadowbrook Barn");
  await page.waitForTimeout(700);
  body = await page.locator("body").innerText();
  record("week_barn_shows_tours", /Venue Tour/i.test(body), body.match(/Venue Tour[^\n]*/g)?.slice(0, 5));
  await page.screenshot({ path: `${OUT}/fix-week-barn.png` });

  await page.goto(`${APP}/calendar?view=agenda&year=2026&month=10`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1200);
  await clearFilters();
  await setSpace("Meadowbrook Barn");
  await page.waitForTimeout(700);
  body = await page.locator("body").innerText();
  record("agenda_barn_lucy", /Lucy/i.test(body), body.match(/Venue Tour[^\n]*/g)?.slice(0, 5));
  await page.screenshot({ path: `${OUT}/fix-agenda-barn.png` });

  // December Christmas
  await page.goto(`${APP}/calendar?year=2026&month=12`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1500);
  await clearFilters();
  await setSpace(null);
  await ensureDaySelected("25", "December");
  body = await page.locator("body").innerText();
  record("dec25_all_spaces_christmas", /Christmas/i.test(body), body.match(/Christmas[^\n]*/)?.[0] ?? "");
  await page.screenshot({ path: `${OUT}/fix-dec25-all-spaces.png`, fullPage: true });

  await setSpace("Meadowbrook Barn");
  await page.waitForTimeout(800);
  await ensureDaySelected("25", "December");
  body = await page.locator("body").innerText();
  const decPanel = body.match(/Friday, December 25[\s\S]{0,300}/)?.[0] ?? body.match(/Christmas[^\n]*/)?.[0] ?? body.slice(0, 500);
  record("dec25_barn_christmas", /Christmas/i.test(body), decPanel);
  await page.screenshot({ path: `${OUT}/fix-dec25-barn.png`, fullPage: true });

  // Blocked Time sole chip — deselect others then try to clear Blocked Time
  for (const name of ["Event", "Tour", "Appointment", "Hold"]) {
    const btn = page.getByRole("button", { name: new RegExp(`^${name}$`, "i") });
    if (await btn.count()) await btn.last().click().catch(() => {});
    await page.waitForTimeout(150);
  }
  const blocked = page.getByRole("button", { name: /^Blocked Time$/i });
  if (await blocked.count()) {
    // Attempt to deselect the sole remaining chip — must not blank the calendar
    await blocked.last().click();
    await page.waitForTimeout(700);
  }
  await ensureDaySelected("25", "December");
  body = await page.locator("body").innerText();
  record("dec_blocked_chip_no_blank", /Christmas/i.test(body) || /1 item/i.test(body), {
    hasChristmas: /Christmas/i.test(body),
    glance: body.match(/at a glance[^\n]*/i)?.[0] ?? null,
  });
  await page.screenshot({ path: `${OUT}/fix-dec-blocked-chip.png`, fullPage: true });
} catch (e) {
  record("harness_error", false, e instanceof Error ? e.message : String(e));
  await page.screenshot({ path: `${OUT}/fix-failure.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

const out = { checks, tip, EXPECTED, ok: checks.every((c) => c.pass) };
writeFileSync(`${OUT}/fix-browser-results.json`, JSON.stringify(out, null, 2));
console.log(out.ok ? "VERIFY_GREEN" : "VERIFY_NOT_GREEN");
console.log(JSON.stringify(checks, null, 2));
process.exit(out.ok ? 0 : 1);
