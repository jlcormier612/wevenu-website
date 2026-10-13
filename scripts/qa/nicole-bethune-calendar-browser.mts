/**
 * Sandbox proof for Nicole Bethune May 8–9 calendar integrity.
 * Does NOT declare GREEN on deploy alone — asserts DB assignments, projection,
 * All-spaces day views, Barn filter isolation, and reload stability.
 * Read-only: does not mutate booking rows.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { projectAssignmentWindowsOntoCalendarDates } from "@/lib/calendar/event-assignment-projection";
import { calendarItemMatchesSpace } from "@/lib/calendar/space-filter";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = process.env.EXPECTED_SHA ?? "d753eafb4c24b918a682736f119674ec4bd18585";
const MEAD_EMAIL = "jlcormier612@gmail.com";
const MEAD = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const EVENT = "e15869c8-736d-42cc-a00a-4b4bbdadc0f1";
const OUT_DIR = "docs/qa/nicole-bethune-calendar-integrity";
const OUT = `${OUT_DIR}/browser-results.json`;

/** Expected fixture labels; times/spaces come from live DB (SoR). */
const EXPECTED_ORDER = [
  "Rehearsal Dinner",
  "Getting Ready",
  "Ceremony",
  "Cocktail Hour",
  "Reception",
] as const;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
const deploymentIds = new Set<string>();
const evidence: Record<string, unknown> = {};

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function noteDeployment(linkHeader: string | undefined) {
  const match = linkHeader?.match(/dpl=([0-9a-f]{40})/);
  if (match) deploymentIds.add(match[1]);
  return match?.[1] ?? null;
}

function hhmm(t: string | null | undefined): string | null {
  if (!t) return null;
  return t.slice(0, 5);
}

/** UI may show 18:00 or 6:00 PM — accept either for a given HH:MM. */
function textHasTime(text: string, hhmm24: string): boolean {
  const [hStr, m] = hhmm24.split(":");
  const h = Number(hStr);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  const patterns = [
    hhmm24,
    `${h12}:${m}`,
    `${h12}:${m} ${ampm}`,
    `${h12}:${m}${ampm}`,
    `${h12}:${m}\u202f${ampm}`,
  ];
  return patterns.some((p) => text.includes(p));
}

async function authCookies() {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: MEAD_EMAIL,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const userSb = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  await userSb.auth.setSession(otpData.session);
  const { data, error } = await userSb.rpc("set_active_venue", { p_venue_id: MEAD });
  if (error || !(data as { ok?: boolean } | null)?.ok) {
    throw new Error(`set_active_venue: ${error?.message ?? JSON.stringify(data)}`);
  }
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
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
      value: MEAD,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];
}

async function openDay(page: import("playwright").Page, date: string) {
  const resp = await page.goto(`${APP}/calendar?view=day&date=${date}`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  noteDeployment(resp?.headers()?.link);
  await page.getByRole("heading", { level: 2 }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1200);
  return page.locator("body").innerText();
}

async function setSpaceFilter(page: import("playwright").Page, spaceId: string | "") {
  const select = page.locator('select[aria-label="Space"]');
  await select.waitFor({ state: "visible", timeout: 20_000 });
  await select.selectOption(spaceId);
  await page.waitForTimeout(600);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addCookies(await authCookies());
const page = await context.newPage();

try {
  const head = await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const serving = noteDeployment(head?.headers()?.link);
  record("serving_commit", serving === EXPECTED, serving ?? "missing");
  if (serving !== EXPECTED) {
    throw new Error(`wrong runtime ${serving}; expected ${EXPECTED} — not declaring GREEN`);
  }

  // —— 1. DB source of truth ——
  const { data: assigns, error: aErr } = await admin
    .from("event_space_assignments")
    .select("id,use_key,use_label,scheduled_date,start_time,end_time,space_id")
    .eq("event_id", EVENT)
    .eq("venue_id", MEAD)
    .order("scheduled_date")
    .order("start_time");
  if (aErr) throw aErr;
  const spaceIds = [...new Set((assigns ?? []).map((a) => a.space_id))];
  const { data: spaces } = await admin.from("venue_spaces").select("id,name").in("id", spaceIds);
  const spaceName = new Map((spaces ?? []).map((s) => [s.id, s.name]));
  const rows = (assigns ?? []).map((a) => ({
    ...a,
    spaceName: spaceName.get(a.space_id) ?? "?",
    start: hhmm(a.start_time),
    end: hhmm(a.end_time),
  }));
  evidence.dbAssignments = rows;
  record("db_five_components", rows.length === 5, `count=${rows.length}`);
  for (const label of EXPECTED_ORDER) {
    record(`db_has_${label.replace(/\s+/g, "_")}`, rows.some((r) => r.use_label === label), label);
  }

  const byLabel = Object.fromEntries(rows.map((r) => [r.use_label!, r]));
  record(
    "db_rehearsal_may8_barn_1800_2100",
    byLabel["Rehearsal Dinner"]?.scheduled_date === "2027-05-08"
      && byLabel["Rehearsal Dinner"]?.start === "18:00"
      && byLabel["Rehearsal Dinner"]?.end === "21:00"
      && /Barn/i.test(byLabel["Rehearsal Dinner"]?.spaceName ?? ""),
    JSON.stringify(byLabel["Rehearsal Dinner"]),
  );
  record(
    "db_getting_ready_may9_villa_1400_1600",
    byLabel["Getting Ready"]?.scheduled_date === "2027-05-09"
      && byLabel["Getting Ready"]?.start === "14:00"
      && byLabel["Getting Ready"]?.end === "16:00"
      && /Villa/i.test(byLabel["Getting Ready"]?.spaceName ?? ""),
    JSON.stringify(byLabel["Getting Ready"]),
  );
  record(
    "db_ceremony_may9_bridge_1600_1700",
    byLabel["Ceremony"]?.scheduled_date === "2027-05-09"
      && byLabel["Ceremony"]?.start === "16:00"
      && byLabel["Ceremony"]?.end === "17:00"
      && /Bridge/i.test(byLabel["Ceremony"]?.spaceName ?? ""),
    JSON.stringify(byLabel["Ceremony"]),
  );
  record(
    "db_cocktail_may9_lawn_1700_1800",
    byLabel["Cocktail Hour"]?.scheduled_date === "2027-05-09"
      && byLabel["Cocktail Hour"]?.start === "17:00"
      && byLabel["Cocktail Hour"]?.end === "18:00"
      && /Lawn/i.test(byLabel["Cocktail Hour"]?.spaceName ?? ""),
    JSON.stringify(byLabel["Cocktail Hour"]),
  );
  record(
    "db_reception_may9_barn_1800_2200",
    byLabel["Reception"]?.scheduled_date === "2027-05-09"
      && byLabel["Reception"]?.start === "18:00"
      && byLabel["Reception"]?.end === "22:00"
      && /Barn/i.test(byLabel["Reception"]?.spaceName ?? ""),
    JSON.stringify(byLabel["Reception"]),
  );

  // —— 2. Deterministic projection vs DB (same helper the calendar uses) ——
  const windows = rows.map((r) => ({
    spaceId: r.space_id as string,
    useLabel: r.use_label,
    startTime: r.start,
    endTime: r.end,
    scheduledDate: r.scheduled_date,
  }));
  const projected = projectAssignmentWindowsOntoCalendarDates({
    protectedDates: ["2027-05-08", "2027-05-09"],
    windows,
  });
  evidence.projected = projected;
  record("projection_not_untimed", projected !== "untimed", typeof projected);
  if (projected !== "untimed") {
    const sat = projected.filter((p) => p.date === "2027-05-08");
    const sun = projected.filter((p) => p.date === "2027-05-09");
    record("projection_sat_only_rehearsal", sat.length === 1 && sat[0]?.useLabel === "Rehearsal Dinner", JSON.stringify(sat));
    record("projection_sun_no_rehearsal", !sun.some((p) => p.useLabel === "Rehearsal Dinner"), JSON.stringify(sun.map((p) => p.useLabel)));
    record(
      "projection_sun_four_components",
      sun.length === 4
        && ["Getting Ready", "Ceremony", "Cocktail Hour", "Reception"].every((l) => sun.some((p) => p.useLabel === l)),
      JSON.stringify(sun.map((p) => `${p.useLabel}@${p.startTime}-${p.endTime}`)),
    );
    const barnId = byLabel["Rehearsal Dinner"]!.space_id as string;
    const barnSat = sat.filter((p) => calendarItemMatchesSpace({ spaceId: p.spaceId, spaceIds: [p.spaceId] }, barnId));
    const barnSun = sun.filter((p) => calendarItemMatchesSpace({ spaceId: p.spaceId, spaceIds: [p.spaceId] }, barnId));
    record("projection_barn_sat_rehearsal_only", barnSat.length === 1 && barnSat[0]?.useLabel === "Rehearsal Dinner", JSON.stringify(barnSat));
    record("projection_barn_sun_reception_only", barnSun.length === 1 && barnSun[0]?.useLabel === "Reception", JSON.stringify(barnSun));
    record(
      "projection_barn_hides_other_spaces",
      !barnSun.some((p) => /Getting Ready|Ceremony|Cocktail/i.test(p.useLabel ?? "")),
      "ok",
    );
  }

  // —— 3. Browser: All spaces, May 8 ——
  await openDay(page, "2027-05-08");
  await setSpaceFilter(page, "");
  const satText = await page.locator("body").innerText();
  evidence.satAllSpaces = satText.slice(0, 2500);
  record("ui_sat_heading", /Saturday.*May.*8.*2027/i.test(satText), "day heading");
  record("ui_sat_rehearsal_label", /Rehearsal Dinner/i.test(satText), "label");
  record(
    "ui_sat_rehearsal_times",
    textHasTime(satText, "18:00") && textHasTime(satText, "21:00"),
    "18:00–21:00 cues",
  );
  record("ui_sat_no_getting_ready", !/Getting Ready/i.test(satText), "absent");
  record("ui_sat_no_cocktail", !/Cocktail Hour/i.test(satText), "absent");
  record("ui_sat_no_reception_component", !/\bReception\b/i.test(satText), "reception not on Sat");
  // Ceremony subtitle/type may appear in wedding copy — require it not as a timed Nicole component row.
  // If "Ceremony" appears without a 4:00–5:00 window on Saturday, still fail if Getting Ready is present.

  // —— 4. Browser: All spaces, May 9 ——
  await openDay(page, "2027-05-09");
  await setSpaceFilter(page, "");
  let sunText = await page.locator("body").innerText();
  evidence.sunAllSpaces = sunText.slice(0, 2500);
  record("ui_sun_heading", /Sunday.*May.*9.*2027/i.test(sunText), "day heading");
  record("ui_sun_no_rehearsal", !/Rehearsal Dinner/i.test(sunText), "rehearsal not misplaced");
  record("ui_sun_getting_ready", /Getting Ready/i.test(sunText) && textHasTime(sunText, "14:00") && textHasTime(sunText, "16:00"), "14:00–16:00");
  record("ui_sun_ceremony", /Ceremony/i.test(sunText) && textHasTime(sunText, "16:00") && textHasTime(sunText, "17:00"), "16:00–17:00");
  record("ui_sun_cocktail", /Cocktail Hour/i.test(sunText) && textHasTime(sunText, "17:00") && textHasTime(sunText, "18:00"), "17:00–18:00");
  record("ui_sun_reception", /Reception/i.test(sunText) && textHasTime(sunText, "18:00") && textHasTime(sunText, "22:00"), "18:00–22:00");

  // —— 5. Barn filter: must not hide/misplace other-space components incorrectly ——
  const barnId = byLabel["Rehearsal Dinner"]!.space_id as string;
  await openDay(page, "2027-05-08");
  await setSpaceFilter(page, barnId);
  const satBarn = await page.locator("body").innerText();
  evidence.satBarn = satBarn.slice(0, 2000);
  record("ui_barn_sat_shows_rehearsal", /Rehearsal Dinner/i.test(satBarn), "barn sat");
  record("ui_barn_sat_hides_non_barn", !/Getting Ready|Cocktail Hour/i.test(satBarn), "non-barn hidden");

  await openDay(page, "2027-05-09");
  await setSpaceFilter(page, barnId);
  const sunBarn = await page.locator("body").innerText();
  evidence.sunBarn = sunBarn.slice(0, 2000);
  record("ui_barn_sun_shows_reception", /Reception/i.test(sunBarn), "barn sun");
  record("ui_barn_sun_hides_villa_bridge_lawn", !/Getting Ready|Ceremony|Cocktail Hour/i.test(sunBarn), "other spaces filtered out — not misplaced onto Barn");
  record("ui_barn_sun_no_rehearsal", !/Rehearsal Dinner/i.test(sunBarn), "rehearsal stays Saturday");

  // Clear filter — non-Barn Sunday components must return (not permanently hidden)
  await setSpaceFilter(page, "");
  const sunCleared = await page.locator("body").innerText();
  record(
    "ui_clear_filter_restores_sunday_components",
    /Getting Ready/i.test(sunCleared) && /Ceremony/i.test(sunCleared) && /Cocktail Hour/i.test(sunCleared) && /Reception/i.test(sunCleared),
    "all four back",
  );

  // —— 6. Reload stability ——
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { level: 2 }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1000);
  await setSpaceFilter(page, "");
  const sunReload = await page.locator("body").innerText();
  record("reload_sun_no_rehearsal", !/Rehearsal Dinner/i.test(sunReload), "stable");
  record(
    "reload_sun_components_intact",
    /Getting Ready/i.test(sunReload) && /Ceremony/i.test(sunReload) && /Cocktail Hour/i.test(sunReload) && /Reception/i.test(sunReload),
    "stable",
  );

  await openDay(page, "2027-05-08");
  await setSpaceFilter(page, "");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const satReload = await page.locator("body").innerText();
  record("reload_sat_rehearsal_intact", /Rehearsal Dinner/i.test(satReload) && textHasTime(satReload, "18:00") && textHasTime(satReload, "21:00"), "stable");
  record("reload_sat_still_no_sunday_components", !/Getting Ready|Cocktail Hour/i.test(satReload), "stable");

  const end = await page.goto(`${APP}/calendar?view=day&date=2027-05-09`, { waitUntil: "domcontentloaded" });
  const endDpl = noteDeployment(end?.headers()?.link);
  record(
    "runtime_stayed_expected",
    endDpl === EXPECTED && [...deploymentIds].every((d) => d === EXPECTED),
    [...deploymentIds].join(","),
  );
} catch (err) {
  record("script_error", false, err instanceof Error ? err.message : String(err));
} finally {
  await browser.close();
  mkdirSync(OUT_DIR, { recursive: true });
  const failed = checks.filter((c) => !c.pass);
  const verdic = failed.length === 0 ? "GREEN" : "NOT_GREEN";
  writeFileSync(
    OUT,
    JSON.stringify({
      verdict: verdic,
      expected: EXPECTED,
      note: "GREEN only when all checks pass — deploy success alone is insufficient",
      checks,
      evidence,
      deploymentIds: [...deploymentIds],
    }, null, 2),
  );
  console.log(`\n${verdic}: ${checks.length - failed.length}/${checks.length} passed → ${OUT}`);
  process.exit(failed.length ? 1 : 0);
}
