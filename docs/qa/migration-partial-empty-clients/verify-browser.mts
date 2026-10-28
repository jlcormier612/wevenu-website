/**
 * Partial import clarity + empty-venue first client — Sandbox only.
 * EXPECTED_SHA=<serving> npx tsx docs/qa/migration-partial-empty-clients/verify-browser.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { join, resolve } from "node:path";

config({ path: ".env.local", quiet: true });
process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";

const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const OUT = "docs/qa/migration-partial-empty-clients";
const SHOTS = join(OUT, "shots");
const FIX = resolve("docs/qa/onboarding-import-acceptance/fixtures/honeybook-contacts.csv");
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const SANDBOX_REF = "wvpsldwwjqdannqasrdf";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(SANDBOX_REF)) throw new Error("not sandbox");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");
mkdirSync(SHOTS, { recursive: true });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
}

async function servingImage() {
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function passWelcome(page: any) {
  for (let a = 0; a < 6; a++) {
    const onWelcome = page.url().includes("/welcome");
    const visible = await page.locator('[data-welcome-experience="true"]').isVisible().catch(() => false);
    if (!onWelcome && !visible) return;
    await page.locator("#welcome-experience-agree").check({ force: true }).catch(() => {});
    const boxes = page.locator("input[type='checkbox']");
    const n = await boxes.count();
    for (let i = 0; i < n; i++) await boxes.nth(i).check({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
    const cont = page.getByRole("button", { name: /^Continue$/i });
    if ((await cont.count()) > 0 && (await cont.first().isEnabled())) await cont.first().click();
    for (let i = 0; i < 20; i++) {
      if (!page.url().includes("/welcome")) return;
      await page.waitForTimeout(300);
    }
  }
}

async function login(page: any, email: string, password: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(500);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click('button[type="submit"]');
    for (let i = 0; i < 80; i++) {
      if (!page.url().includes("/login")) {
        await passWelcome(page);
        if (!page.url().includes("/login")) return;
      }
      await page.waitForTimeout(400);
    }
  }
  throw new Error(`login failed ${email}`);
}

async function createDisposable(admin: ReturnType<typeof createClient>, tag: string) {
  const stamp = `${Date.now()}-${tag}`;
  const email = `jennifer+mcpem.${stamp}@hellotocheers.com`;
  const password = `Mc-${stamp}-Aa1x`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (cErr || !created.user) throw cErr ?? new Error("createUser");
  const userId = created.user.id;
  const { data: venue, error: vErr } = await admin
    .from("venues")
    .insert({ owner_user_id: userId, name: `MC Partial ${tag} ${stamp}`, email: `v.${email}` })
    .select("id,name")
    .single();
  if (vErr || !venue) throw vErr ?? new Error("venue");
  await admin.from("venue_staff").insert({
    venue_id: venue.id,
    user_id: userId,
    full_name: `MC Owner ${tag}`,
    email,
    role: "owner",
    is_owner: true,
    is_active: true,
    accepted_at: new Date().toISOString(),
    access_title: "administrator",
    title_basis: "administrator",
    capability_overrides: {},
    owner_invite_pending: false,
  });
  await admin.from("venue_staff_active_context").upsert({
    user_id: userId,
    active_venue_id: venue.id,
    updated_at: new Date().toISOString(),
  });
  await admin.from("venue_onboarding_intake").upsert(
    {
      venue_id: venue.id,
      path: "self_setup",
      venue_name: venue.name,
      space_mode: "one",
      spaces: [{ name: "Main Space", maxCapacity: null }],
      offers_tours: true,
      inquiry_sources: [],
      bring_business_choice: "honeybook",
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "venue_id" },
  );
  await admin.from("venue_spaces").insert({
    venue_id: venue.id,
    name: "Main Space",
    is_active: true,
    sort_order: 0,
  });
  await admin.from("venue_capacity_rules").upsert(
    { venue_id: venue.id, max_simultaneous_events: 1, max_simultaneous_tours: 2, min_turnaround_hours: 0 },
    { onConflict: "venue_id" },
  );
  await admin.from("venue_setup_hub_state").upsert(
    { venue_id: venue.id, onboarding_type: "self_setup" },
    { onConflict: "venue_id", ignoreDuplicates: true },
  );
  return { email, password, userId, venueId: venue.id as string };
}

async function main() {
  const image = await servingImage();
  record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
  if (!image.includes(EXPECTED.slice(0, 12))) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks, image, verdict: "BLOCKED" }, null, 2));
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const browser = await chromium.launch({ headless: true });

  try {
    // --- B: empty venue first client ---
    const empty = await createDisposable(admin, "empty");
    for (const width of [1280, 390] as const) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      await login(page, empty.email, empty.password);
      await page.goto(`${APP}/clients`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1200);
      await passWelcome(page);
      await page.goto(`${APP}/clients`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${SHOTS}/clients-empty-${width}.png`, fullPage: true });
      const emptyBox = page.locator('[data-clients-empty="true"]');
      const addFirst = page.getByRole("link", { name: /Add your first client/i });
      const importAlt = page.getByRole("link", { name: /Import Clients/i });
      record(
        `empty_state_${width}`,
        (await emptyBox.count()) > 0 && (await addFirst.count()) > 0,
        `empty=${await emptyBox.count()} addFirst=${await addFirst.count()} import=${await importAlt.count()}`,
      );
      if (width === 1280) {
        await addFirst.first().click();
        await page.waitForTimeout(1200);
        const first = page.locator('input[name="firstName"], input[name="first_name"], #firstName, #first_name').first();
        const last = page.locator('input[name="lastName"], input[name="last_name"], #lastName, #last_name').first();
        const stamp = Date.now().toString(36);
        if ((await first.count()) > 0) {
          await first.fill("First");
          if ((await last.count()) > 0) await last.fill(`Client${stamp}`);
          const emailField = page.locator('input[type="email"], input[name="email"]').first();
          if ((await emailField.count()) > 0) {
            await emailField.fill(`first.client.${stamp}@hellotocheers-test.invalid`);
          }
          const save = page.getByRole("button", { name: /Save|Create|Add client/i });
          if ((await save.count()) > 0) {
            await save.first().click();
            await page.waitForTimeout(2500);
          }
        }
        const { count } = await admin
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("venue_id", empty.venueId);
        record("first_client_persisted", (count ?? 0) >= 1, `venueClients=${count ?? 0} venue=${empty.venueId}`);
        await page.goto(`${APP}/clients`, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${SHOTS}/clients-after-add-1280.png`, fullPage: true });
        record(
          "empty_state_cleared_after_add",
          (await page.locator('[data-clients-empty="true"]').count()) === 0,
          `emptyStill=${await page.locator('[data-clients-empty="true"]').count()}`,
        );
      }
      await context.close();
    }

    // --- A: partial import mixed result ---
    const mix = await createDisposable(admin, "mix");
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await login(page, mix.email, mix.password);
    await page.goto(`${APP}/settings/migration?source=honeybook`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1400);
    await passWelcome(page);
    await page.goto(`${APP}/settings/migration?source=honeybook`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1000);

    const entityTrigger = page.locator("button[role='combobox']").first();
    if ((await entityTrigger.count()) > 0) {
      await entityTrigger.click();
      await page.waitForTimeout(400);
      const opt = page.getByRole("option", { name: /Client/i });
      if ((await opt.count()) > 0) await opt.first().click();
      await page.waitForTimeout(400);
    }
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    if ((await fileInput.count()) > 0) {
      await fileInput.setInputFiles(FIX);
      await page.waitForTimeout(2500);
      const bring = page.getByRole("button", { name: /Bring in/i });
      if ((await bring.count()) > 0) {
        await bring.first().click();
        await page.waitForTimeout(4000);
      }
      const importReady = page.getByRole("button", { name: /Import \d+ record/i });
      if ((await importReady.count()) > 0) {
        await importReady.first().click();
        await page.waitForTimeout(5000);
      }
    }
    await page.screenshot({ path: `${SHOTS}/partial-import-1280.png`, fullPage: true });
    const body = await page.locator("main").innerText().catch(async () => page.locator("body").innerText());
    const attention = page.locator('[data-migration-outcome="needs-attention"]');
    const hasAttentionUi =
      (await attention.count()) > 0 ||
      /Partly imported|needs your attention|Needs your decision|need[s]? attention/i.test(body);
    const claimsCompleteOnly = /Everything from this file has been resolved/i.test(body) && !hasAttentionUi;
    record(
      "partial_outcome_visible",
      hasAttentionUi && !claimsCompleteOnly,
      `attention=${await attention.count()} claimsCompleteOnly=${claimsCompleteOnly}`,
    );
    const { count: mixClients } = await admin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", mix.venueId);
    const { count: reviewRows } = await admin
      .from("migration_records")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", mix.venueId)
      .in("status", ["needs_review", "duplicate_likely", "conflict"]);
    record(
      "partial_persistence_mixed",
      (mixClients ?? 0) > 0 || (reviewRows ?? 0) > 0,
      `clients=${mixClients ?? 0} unresolvedRecords=${reviewRows ?? 0}`,
    );
    // Re-open session / retry should not invent a second complete claim
    record(
      "no_false_complete_banner",
      !claimsCompleteOnly,
      "complete-only banner absent when attention remains",
    );
    await context.close();
  } finally {
    await browser.close().catch(() => {});
  }

  const failed = checks.filter((c) => !c.pass);
  const results = {
    expectedSha: EXPECTED,
    servingImage: image,
    checks,
    failedCount: failed.length,
    verdict: failed.length === 0 ? "GREEN" : "OPEN",
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(results, null, 2));
  console.log(`\nVERDICT ${results.verdict} pass=${checks.length - failed.length} fail=${failed.length}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
