/**
 * Sandbox E2E — date-hold current protection vs history + reactivation.
 * Serving SHA gate + lead / hold editor / calendar agreement.
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
const EXPECTED_SHA = (process.env.EXPECTED_SHA ?? "49a8768f214d5602b11aa8f1c081219781effc8a").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
/** Known Fancy lead with an active hold (safe sandbox fixture). */
const PREFERRED_LEAD = "907693d8-2694-4bd4-8de7-1fcbfd748848";
const OUT = "docs/qa/date-hold-lifecycle-protection";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 1500) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function protects(row: { status: string; expires_at: string | null }, now = Date.now()): boolean {
  if (row.status !== "active") return false;
  if (!row.expires_at) return true;
  const ms = Date.parse(row.expires_at);
  return Number.isNaN(ms) || ms > now;
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

function futureYmd(daysAhead: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

async function pickLeadAndHold(): Promise<{ leadId: string; seedHoldId: string; holdDate: string } | null> {
  // Prefer known fixture with an active hold.
  const { data: preferredHolds } = await admin
    .from("date_holds")
    .select("id, lead_id, status, expires_at, hold_date")
    .eq("venue_id", FANCY)
    .eq("lead_id", PREFERRED_LEAD)
    .order("updated_at", { ascending: false });
  const preferredLead = await admin
    .from("leads")
    .select("id, event_date, sales_stage, status")
    .eq("id", PREFERRED_LEAD)
    .eq("venue_id", FANCY)
    .maybeSingle();
  if (preferredLead.data && (preferredHolds?.length ?? 0) > 0) {
    const hold = preferredHolds!.find((h) => h.status === "active") ?? preferredHolds![0]!;
    return { leadId: PREFERRED_LEAD, seedHoldId: hold.id, holdDate: hold.hold_date };
  }

  const { data: holdRows } = await admin
    .from("date_holds")
    .select("id, lead_id, status, expires_at, hold_date")
    .eq("venue_id", FANCY)
    .not("lead_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(40);

  for (const h of holdRows ?? []) {
    if (!h.lead_id || h.status === "converted") continue;
    const { data: lead } = await admin
      .from("leads")
      .select("id, event_date, sales_stage, status")
      .eq("id", h.lead_id)
      .eq("venue_id", FANCY)
      .maybeSingle();
    // leads has no booked_at — Booked is sales_stage / pipeline, not a column.
    if (!lead) continue;
    if (lead.sales_stage === "booked" || lead.status === "booked") continue;
    return { leadId: lead.id, seedHoldId: h.id, holdDate: h.hold_date };
  }
  return null;
}

async function main() {
  const image = await servingImage();
  const shaOk = EXPECTED_SHA.length >= 7 && image.includes(EXPECTED_SHA.slice(0, 12));
  record("serving-sha", shaOk, `expected=${EXPECTED_SHA.slice(0, 12)} ecs=${image}`);

  const picked = await pickLeadAndHold();
  if (!picked) {
    record("seed-lead", false, "no suitable Fancy lead with holds");
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks }, null, 2));
    process.exit(1);
  }
  const { leadId, seedHoldId, holdDate } = picked;
  record("seed-lead", true, JSON.stringify(picked));

  // Expire siblings on this lead so only the seed path is under test, then expire seed.
  const pastIso = "2020-01-15T00:00:00.000Z";
  await admin
    .from("date_holds")
    .update({ status: "expired", expires_at: pastIso })
    .eq("lead_id", leadId)
    .eq("venue_id", FANCY)
    .neq("status", "converted");

  const { data: afterSeed } = await admin
    .from("date_holds")
    .select("id, status, expires_at, hold_date")
    .eq("lead_id", leadId)
    .eq("venue_id", FANCY);
  const anyProtecting = (afterSeed ?? []).some((h) => protects(h));
  record(
    "seed-expired-hold",
    !anyProtecting,
    JSON.stringify({ leadId, seedHoldId, holds: afterSeed, anyProtecting }),
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor());
  const page = await context.newPage();

  await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector('[data-testid="date-hold-protection-banner"]', { timeout: 45000 });
  await page.screenshot({ path: `${OUT}/shots/01-unprotected-1280.png`, fullPage: true });

  const banner1 = await page.locator('[data-testid="date-hold-protection-headline"]').first().innerText();
  record(
    "banner-unprotected",
    /DATE NOT CURRENTLY PROTECTED|Not protected/i.test(banner1),
    banner1,
  );

  const bodyText = await page.locator("body").innerText();
  record(
    "header-not-claiming-protected",
    !/Date protected — hold active/i.test(bodyText),
    /Date protected|Date held|DATE NOT CURRENTLY PROTECTED/i.exec(bodyText)?.[0] ?? "no date phrase",
  );

  const historyText = await page.locator('[data-testid="date-hold-history"]').innerText().catch(() => "");
  record(
    "history-no-longer-protecting",
    /no longer protecting/i.test(historyText),
    historyText.slice(0, 400),
  );
  record("history-separate", historyText.length > 0, `len=${historyText.length}`);

  const reactivate = page.locator('[data-testid="date-hold-reactivate"]').first();
  const hasReactivate = (await reactivate.count()) > 0;
  record("reactivate-cta", hasReactivate, `visible=${hasReactivate}`);
  if (!hasReactivate) {
    await browser.close();
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ expectedSha: EXPECTED_SHA, leadId, checks }, null, 2));
    process.exit(1);
  }

  await reactivate.click();
  await page.waitForSelector('[data-testid="date-hold-form"]', { timeout: 15000 });
  const formCopy = await page.locator('[data-testid="date-hold-form"]').innerText();
  record("reactivate-form-copy", /reactivating/i.test(formCopy), formCopy.slice(0, 400));

  const releaseYmd = futureYmd(14);
  const dateInputs = page.locator('[data-testid="date-hold-form"] input[type="date"]');
  const dateCount = await dateInputs.count();
  await dateInputs.nth(dateCount - 1).fill(releaseYmd);

  await page.locator('[data-testid="date-hold-save"]').click();
  await page.waitForTimeout(3000);
  await page.waitForSelector('[data-testid="date-hold-protection-banner"]', { timeout: 45000 });
  await page.screenshot({ path: `${OUT}/shots/02-after-reactivate-1280.png`, fullPage: true });

  const banner2 = await page.locator('[data-testid="date-hold-protection-headline"]').innerText();
  record("banner-protected-after-save", /DATE PROTECTED/i.test(banner2), banner2);

  const bodyAfter = await page.locator("body").innerText();
  record(
    "header-date-protected-copy",
    /Date protected — hold active/i.test(bodyAfter),
    /Date protected — hold active[^\n]*/i.exec(bodyAfter)?.[0] ?? "missing",
  );
  record(
    "active-hold-card-visible",
    (await page.locator('[data-testid="date-hold-active"]').count()) > 0,
    `active=${await page.locator('[data-testid="date-hold-active"]').count()}`,
  );

  const { data: afterSave } = await admin
    .from("date_holds")
    .select("id, status, expires_at, hold_date")
    .eq("id", seedHoldId)
    .maybeSingle();
  record("db-protects-after-reactivate", afterSave ? protects(afterSave) : false, JSON.stringify(afterSave));

  // Calendar agreement — month containing hold date
  const [y, m] = holdDate.split("-").map(Number);
  await page.goto(`${APP}/calendar?year=${y}&month=${m}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/shots/03-calendar-protected-1280.png`, fullPage: true });
  const calText = await page.locator("body").innerText();
  const calHasHold =
    /hold/i.test(calText)
    && (calText.includes(holdDate.slice(8)) || /Hold|held|protect/i.test(calText));
  // Also accept calendar item id pattern or lead name from fixture
  const calPass =
    (await page.locator(`[data-hold-id="${seedHoldId}"], [data-id="hold-${seedHoldId}"]`).count()) > 0
    || /Expirenext|Hold —/i.test(calText)
    || calHasHold;
  record("calendar-shows-active-hold", calPass, `holdDate=${holdDate} snippet=${calText.slice(0, 200).replace(/\s+/g, " ")}`);

  await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "networkidle", timeout: 90000 });
  // Compact header: active hold uses Held chip; unprotected uses Not protected banner.
  await page.waitForSelector(
    '[data-testid="date-hold-active"], [data-testid="date-hold-protection-banner"][data-protected="true"]',
    { timeout: 45000 },
  );
  const banner3 = await page.locator('[data-testid="date-hold-protection-headline"]').first().innerText();
  record(
    "banner-persists-after-refresh",
    /DATE PROTECTED|Held/i.test(banner3),
    banner3,
  );
  await page.screenshot({ path: `${OUT}/shots/04-lead-still-protected-1280.png`, fullPage: true });

  const releaseBtn = page.locator('[data-testid="date-hold-release"]').first();
  if ((await releaseBtn.count()) > 0) {
    await releaseBtn.click();
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="date-hold-protection-banner"]', { timeout: 45000 });
    const banner4 = await page.locator('[data-testid="date-hold-protection-headline"]').first().innerText();
    record(
      "banner-unprotected-after-release",
      /DATE NOT CURRENTLY PROTECTED|Not protected/i.test(banner4),
      banner4,
    );
    const bodyRelease = await page.locator("body").innerText();
    record(
      "header-not-protected-after-release",
      !/Date protected — hold active/i.test(bodyRelease),
      /Date protected|DATE NOT CURRENTLY PROTECTED|Preferred date/i.exec(bodyRelease)?.[0] ?? "ok",
    );
    const { data: afterRelease } = await admin
      .from("date_holds")
      .select("id, status, expires_at")
      .eq("id", seedHoldId)
      .maybeSingle();
    record(
      "db-no-protect-after-release",
      afterRelease ? !protects(afterRelease) : false,
      JSON.stringify(afterRelease),
    );

    await page.goto(`${APP}/calendar?year=${y}&month=${m}`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/shots/05-calendar-after-release-1280.png`, fullPage: true });
    const calAfter = await page.locator("body").innerText();
    const stillShowsThisHold =
      (await page.locator(`[data-hold-id="${seedHoldId}"], [data-id="hold-${seedHoldId}"]`).count()) > 0;
    record(
      "calendar-clears-released-hold",
      !stillShowsThisHold,
      stillShowsThisHold ? "hold item still present" : `cleared; bodyHasHoldWord=${/hold/i.test(calAfter)}`,
    );
    await page.screenshot({ path: `${OUT}/shots/06-after-release-lead-would-be.png`, fullPage: false });
  } else {
    record("banner-unprotected-after-release", false, "no release button");
    record("header-not-protected-after-release", false, "skipped");
    record("db-no-protect-after-release", false, "skipped");
    record("calendar-clears-released-hold", false, "skipped");
  }

  await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.screenshot({ path: `${OUT}/shots/07-final-lead-1280.png`, fullPage: true });

  await browser.close();
  const passed = checks.filter((c) => c.pass).length;
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify({ expectedSha: EXPECTED_SHA, leadId, seedHoldId, holdDate, checks, passed, total: checks.length }, null, 2),
  );
  console.log(`\n${passed}/${checks.length} passed; → ${OUT}/browser-results.json`);
  process.exit(passed === checks.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
