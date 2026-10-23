/**
 * Sandbox E2E — date-hold current protection vs history + reactivation.
 * 1. Open lead; banner matches holdProtectsAvailability
 * 2. If unprotected via expired row: Reactivate with future auto-release
 * 3. Banner + DB show active protection; reload persists
 * 4. Release → DATE NOT CURRENTLY PROTECTED
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

async function main() {
  const image = await servingImage();
  const shaOk = EXPECTED_SHA.length >= 7 && image.includes(EXPECTED_SHA.slice(0, 12));
  record("serving-sha", shaOk || !EXPECTED_SHA, `expected=${EXPECTED_SHA.slice(0, 12)} ecs=${image}`);

  // Prefer a non-booked Fancy lead that already has holds; else any inquiry with event_date.
  const { data: holdRows } = await admin
    .from("date_holds")
    .select("id, lead_id, status, expires_at, hold_date, title")
    .eq("venue_id", FANCY)
    .order("updated_at", { ascending: false })
    .limit(40);

  let leadId: string | null = null;
  let seedHoldId: string | null = null;
  for (const h of holdRows ?? []) {
    const { data: lead } = await admin
      .from("leads")
      .select("id, event_date, booked_at, sales_stage")
      .eq("id", h.lead_id)
      .eq("venue_id", FANCY)
      .maybeSingle();
    if (!lead || lead.booked_at) continue;
    leadId = lead.id;
    seedHoldId = h.id;
    break;
  }

  if (!leadId || !seedHoldId) {
    record("seed-lead", false, "no suitable Fancy lead with holds");
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks }, null, 2));
    process.exit(1);
  }

  // Force a clear unprotected starting point: expire the seed hold (history),
  // so Reactivate path is exercised. Preserve other sibling holds' statuses.
  const pastIso = "2020-01-15T00:00:00.000Z";
  await admin
    .from("date_holds")
    .update({ status: "expired", expires_at: pastIso })
    .eq("id", seedHoldId)
    .eq("venue_id", FANCY);

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

  await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector('[data-testid="date-hold-protection-banner"]', { timeout: 30000 });
  await page.screenshot({ path: `${OUT}/shots/01-unprotected-1280.png`, fullPage: true });

  const banner1 = await page.locator('[data-testid="date-hold-protection-headline"]').innerText();
  record(
    "banner-unprotected",
    /DATE NOT CURRENTLY PROTECTED/i.test(banner1),
    banner1,
  );
  const historyVisible = await page.locator('[data-testid="date-hold-history"]').count();
  record("history-separate", historyVisible > 0, `historyBlocks=${historyVisible}`);

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
  record(
    "reactivate-form-copy",
    /reactivating/i.test(formCopy),
    formCopy.slice(0, 400),
  );

  const releaseYmd = futureYmd(14);
  await page.locator('[data-testid="date-hold-form"] input[type="date"]').nth(2).fill(releaseYmd);
  // Auto-release is the last date input in the form (after start/end).
  const dateInputs = page.locator('[data-testid="date-hold-form"] input[type="date"]');
  const dateCount = await dateInputs.count();
  await dateInputs.nth(dateCount - 1).fill(releaseYmd);

  await page.locator('[data-testid="date-hold-save"]').click();
  await page.waitForTimeout(2500);
  await page.waitForSelector('[data-testid="date-hold-protection-banner"]', { timeout: 30000 });
  await page.screenshot({ path: `${OUT}/shots/02-after-reactivate-1280.png`, fullPage: true });

  const banner2 = await page.locator('[data-testid="date-hold-protection-headline"]').innerText();
  record(
    "banner-protected-after-save",
    /DATE PROTECTED/i.test(banner2),
    banner2,
  );

  const { data: afterSave } = await admin
    .from("date_holds")
    .select("id, status, expires_at, hold_date")
    .eq("id", seedHoldId)
    .maybeSingle();
  const dbProtects = afterSave ? protects(afterSave) : false;
  record(
    "db-protects-after-reactivate",
    dbProtects,
    JSON.stringify(afterSave),
  );

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="date-hold-protection-banner"]', { timeout: 30000 });
  const banner3 = await page.locator('[data-testid="date-hold-protection-headline"]').innerText();
  record(
    "banner-persists-after-refresh",
    /DATE PROTECTED/i.test(banner3),
    banner3,
  );
  await page.screenshot({ path: `${OUT}/shots/03-after-refresh-1280.png`, fullPage: true });

  const releaseBtn = page.locator('[data-testid="date-hold-release"]').first();
  if ((await releaseBtn.count()) > 0) {
    await releaseBtn.click();
    await page.waitForTimeout(2000);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="date-hold-protection-banner"]', { timeout: 30000 });
    const banner4 = await page.locator('[data-testid="date-hold-protection-headline"]').innerText();
    record(
      "banner-unprotected-after-release",
      /DATE NOT CURRENTLY PROTECTED/i.test(banner4),
      banner4,
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
    await page.screenshot({ path: `${OUT}/shots/04-after-release-1280.png`, fullPage: true });
  } else {
    record("banner-unprotected-after-release", false, "no release button");
    record("db-no-protect-after-release", false, "skipped");
  }

  await browser.close();
  const passed = checks.filter((c) => c.pass).length;
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify({ expectedSha: EXPECTED_SHA, leadId, seedHoldId, checks, passed, total: checks.length }, null, 2),
  );
  console.log(`\n${passed}/${checks.length} passed; → ${OUT}/browser-results.json`);
  process.exit(passed === checks.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
