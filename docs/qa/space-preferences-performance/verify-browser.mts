/**
 * Baseline + post-fix timings for Space Preferences on Sandbox lead detail.
 * Measures nav, section paint, interactivity, dropdown open, select, save.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED_SHA = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/space-preferences-performance";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

async function cookiesFor() {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
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
      value: FANCY,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];
}

async function servingImage(): Promise<string> {
  try {
    const { execSync } = await import("node:child_process");
    const taskArn = execSync(
      "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
      { encoding: "utf8" },
    ).trim();
    if (!taskArn || taskArn === "None") return "";
    return execSync(
      `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

async function findMultiModeLead(): Promise<string | null> {
  const { data: venue } = await admin
    .from("venues")
    .select("id, space_operating_mode")
    .eq("id", FANCY)
    .maybeSingle();
  record("venue-multi-mode", venue?.space_operating_mode === "multi", JSON.stringify(venue));

  const { data: prefs } = await admin
    .from("lead_event_space_preferences")
    .select("lead_id")
    .eq("venue_id", FANCY)
    .limit(20);
  for (const row of prefs ?? []) {
    const { data: lead } = await admin
      .from("leads")
      .select("id, booked_at, sales_stage")
      .eq("id", row.lead_id)
      .eq("venue_id", FANCY)
      .maybeSingle();
    if (lead && !lead.booked_at) return lead.id;
  }
  // Fallback: any recent Fancy lead
  const { data: leads } = await admin
    .from("leads")
    .select("id")
    .eq("venue_id", FANCY)
    .is("booked_at", null)
    .order("updated_at", { ascending: false })
    .limit(5);
  return leads?.[0]?.id ?? null;
}

type TimingRun = {
  label: string;
  navMs: number;
  sectionVisibleMs: number;
  firstCheckboxEnabledMs: number;
  dropdownOpenMs: number | null;
  selectChangeMs: number | null;
  saveRoundTripMs: number | null;
  networkDuringOpen: number;
  spacePrefRequests: string[];
};

async function measureOnce(
  page: import("playwright").Page,
  leadId: string,
  label: string,
): Promise<TimingRun> {
  const requests: string[] = [];
  const onReq = (req: import("playwright").Request) => {
    const u = req.url();
    if (/space|preferen|availability|holds/i.test(u) || u.includes("/leads/")) {
      requests.push(`${req.method()} ${u.replace(APP, "")}`);
    }
  };
  page.on("request", onReq);

  const t0 = Date.now();
  await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const navMs = Date.now() - t0;

  const tSection = Date.now();
  await page.waitForSelector('[data-testid="lead-space-preferences"]', { timeout: 60000 });
  const sectionVisibleMs = Date.now() - tSection;

  const tReady = Date.now();
  await page.waitForFunction(() => {
    const cb = document.querySelector('[data-testid^="space-pref-applicable-"]') as HTMLInputElement | null;
    return cb && !cb.disabled;
  }, { timeout: 60000 });
  const firstCheckboxEnabledMs = Date.now() - tReady;

  // Ensure at least one applicable so a select exists
  const firstCb = page.locator('[data-testid^="space-pref-applicable-"]').first();
  const checked = await firstCb.isChecked();
  if (!checked) {
    await firstCb.check();
    await page.waitForTimeout(800);
  }

  const trigger = page.locator('[data-testid="lead-space-preferences"] [data-slot="select-trigger"]').first();
  await trigger.waitFor({ state: "visible", timeout: 15000 });

  const reqBeforeOpen = requests.length;
  const tOpen = Date.now();
  await trigger.click();
  let dropdownOpenMs: number | null = null;
  try {
    await page.waitForSelector('[data-slot="select-content"], [role="listbox"], [data-slot="select-item"]', {
      timeout: 10000,
      state: "visible",
    });
    dropdownOpenMs = Date.now() - tOpen;
  } catch {
    dropdownOpenMs = null;
  }
  const networkDuringOpen = requests.length - reqBeforeOpen;

  let selectChangeMs: number | null = null;
  let saveRoundTripMs: number | null = null;
  const items = page.locator('[data-slot="select-item"], [role="option"]');
  const itemCount = await items.count();
  if (itemCount > 1) {
    const tSel = Date.now();
    // Prefer a space: option if present (skip undecided)
    let picked = false;
    for (let i = 0; i < itemCount; i++) {
      const text = (await items.nth(i).innerText()).trim();
      if (/not decided/i.test(text)) continue;
      await items.nth(i).click();
      picked = true;
      break;
    }
    if (!picked) await items.nth(0).click();
    selectChangeMs = Date.now() - tSel;

    // Wait for pending save to clear (checkboxes re-enable)
    const tSave = Date.now();
    try {
      await page.waitForFunction(() => {
        const cb = document.querySelector('[data-testid^="space-pref-applicable-"]') as HTMLInputElement | null;
        return cb && !cb.disabled;
      }, { timeout: 30000 });
      saveRoundTripMs = Date.now() - tSave;
    } catch {
      saveRoundTripMs = null;
    }
  }

  page.off("request", onReq);
  const spacePrefRequests = requests.filter((r) => /preferen|space_prefer|saveLead/i.test(r) || r.includes("leads/"));

  await page.screenshot({ path: `${OUT}/shots/${label}-1280.png`, fullPage: false });
  return {
    label,
    navMs,
    sectionVisibleMs,
    firstCheckboxEnabledMs,
    dropdownOpenMs,
    selectChangeMs,
    saveRoundTripMs,
    networkDuringOpen,
    spacePrefRequests: spacePrefRequests.slice(0, 40),
  };
}

async function main() {
  const image = await servingImage();
  record(
    "serving-sha",
    !EXPECTED_SHA || image.includes(EXPECTED_SHA.slice(0, 12)),
    `expected=${EXPECTED_SHA.slice(0, 12)} ecs=${image}`,
  );

  const leadId = await findMultiModeLead();
  if (!leadId) {
    record("lead", false, "no Fancy lead found");
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks }, null, 2));
    process.exit(1);
  }
  record("lead", true, leadId);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor());
  const page = await context.newPage();

  const runs: TimingRun[] = [];
  runs.push(await measureOnce(page, leadId, "cold-1"));
  runs.push(await measureOnce(page, leadId, "warm-2"));
  runs.push(await measureOnce(page, leadId, "warm-3"));

  // Narrow
  await page.setViewportSize({ width: 390, height: 844 });
  runs.push(await measureOnce(page, leadId, "warm-390"));

  await browser.close();

  const openTimes = runs.map((r) => r.dropdownOpenMs).filter((n): n is number => n != null);
  const saveTimes = runs.map((r) => r.saveRoundTripMs).filter((n): n is number => n != null);
  const pct = (arr: number[], p: number) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
  };

  const summary = {
    expectedSha: EXPECTED_SHA,
    leadId,
    runs,
    dropdownOpenMs: { p50: pct(openTimes, 50), p95: pct(openTimes, 95), samples: openTimes },
    saveRoundTripMs: { p50: pct(saveTimes, 50), p95: pct(saveTimes, 95), samples: saveTimes },
    networkOnOpenMax: Math.max(...runs.map((r) => r.networkDuringOpen)),
  };

  // Soft gates for baseline capture (always record; fail only if section missing)
  record("section-rendered", runs.every((r) => r.sectionVisibleMs >= 0), JSON.stringify(summary.runs.map((r) => ({
    label: r.label,
    navMs: r.navMs,
    sectionVisibleMs: r.sectionVisibleMs,
    firstCheckboxEnabledMs: r.firstCheckboxEnabledMs,
    dropdownOpenMs: r.dropdownOpenMs,
    saveRoundTripMs: r.saveRoundTripMs,
    networkDuringOpen: r.networkDuringOpen,
  }))));
  record(
    "dropdown-open-under-100ms-warm",
    openTimes.slice(1).every((t) => t < 100),
    `warmOpen=${JSON.stringify(openTimes.slice(1))} p50=${summary.dropdownOpenMs.p50}`,
  );
  record(
    "no-network-on-dropdown-open",
    runs.every((r) => r.networkDuringOpen === 0),
    `max=${summary.networkOnOpenMax}`,
  );

  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks, summary }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  const failed = checks.filter((c) => !c.pass).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
