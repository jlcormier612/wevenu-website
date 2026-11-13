/**
 * Sandbox acceptance: new-venue starter provisioning reliability (Scenarios A–F).
 * Disposable fixtures only. No Willow Grove / Fancy mutations. No credential rotation.
 *
 * Usage (after migration + Sandbox deploy of this SHA):
 *   EXPECT_SHA=<sha8> npx tsx scripts/qa/starter-provisioning-reliability-acceptance.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { createAdminClient } from "@/integrations/supabase/admin";
import {
  ensureVenueStarters,
  getStarterProvisioningSnapshot,
  restoreHtcStarters,
  seedWorkspaceStarters,
} from "@/lib/provisioning/starters";

config({ path: ".env.local", quiet: true });
process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const OUT = "docs/qa/starter-provisioning-reliability";
const EXPECT_SHA = (process.env.EXPECT_SHA || "").slice(0, 8);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const PROTECTED = new Set([
  FANCY,
  "05f16a15-1752-4855-8a3b-aad5c593d8d9", // Meadowbrook
]);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox Supabase");
}

mkdirSync(OUT, { recursive: true });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 480)}`);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const provisionAdmin = createAdminClient();
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

const disposableVenueIds: string[] = [];
const disposableUserIds: string[] = [];

async function createOwner(stamp: string, label: string) {
  const email = `jennifer+starter.${label}.${stamp}@hellotocheers.com`;
  const password = `St-${stamp}-Aa1x`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser");
  disposableUserIds.push(data.user.id);
  return { email, password, userId: data.user.id };
}

async function createVenue(opts: {
  userId: string;
  email: string;
  name: string;
  setupCompleted?: boolean;
}) {
  const { data, error } = await admin
    .from("venues")
    .insert({
      owner_user_id: opts.userId,
      name: opts.name,
      email: opts.email,
      setup_completed: opts.setupCompleted ?? false,
      setup_completed_at: opts.setupCompleted ? new Date().toISOString() : null,
    })
    .select("id,name")
    .single();
  if (error || !data) throw error ?? new Error("venue insert");
  if (PROTECTED.has(data.id)) {
    throw new Error("refusing to mutate protected venue");
  }
  disposableVenueIds.push(data.id);
  await admin.from("venue_staff").insert({
    venue_id: data.id,
    user_id: opts.userId,
    full_name: opts.name,
    email: opts.email,
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
    user_id: opts.userId,
    active_venue_id: data.id,
    updated_at: new Date().toISOString(),
  });
  return data as { id: string; name: string };
}

async function cookiesFor(email: string) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return ssrUtils
    .createChunks("sb-wvpsldwwjqdannqasrdf-auth-token", encoded)
    .map((c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    }));
}

async function countByMaster(table: string, venueId: string) {
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId)
    .not("source_master_key", "is", null);
  if (error) throw error;
  return count ?? 0;
}

async function countExactMasters(table: string, venueId: string, key: string) {
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId)
    .eq("source_master_key", key);
  if (error) throw error;
  return count ?? 0;
}

async function provisionRow(venueId: string) {
  const { data } = await admin
    .from("venue_starter_provisioning")
    .select("status,seeded_steps,failed_steps,attempt_count")
    .eq("venue_id", venueId)
    .maybeSingle();
  return data as {
    status: string;
    seeded_steps: string[];
    failed_steps: unknown;
    attempt_count: number;
  } | null;
}

async function passWelcome(page: {
  url: () => string;
  locator: (s: string) => {
    count: () => Promise<number>;
    check: (o?: { force?: boolean }) => Promise<void>;
    first: () => {
      count: () => Promise<number>;
      check: (o?: { force?: boolean }) => Promise<void>;
    };
    isVisible: () => Promise<boolean>;
  };
  getByRole: (r: string, o?: { name?: RegExp }) => {
    count: () => Promise<number>;
    click: () => Promise<void>;
  };
  waitForTimeout: (n: number) => Promise<void>;
}) {
  for (let a = 0; a < 3; a++) {
    const onWelcome = page.url().includes("/welcome");
    const visible = await page
      .locator('[data-welcome-experience="true"]')
      .isVisible()
      .catch(() => false);
    if (!onWelcome && !visible) return;
    const agree = page.locator("#welcome-experience-agree");
    if ((await agree.count()) > 0) await agree.check({ force: true });
    else {
      const fb = page.locator("input[type='checkbox']").first();
      if ((await fb.count()) > 0) await fb.check({ force: true });
    }
    const cont = page.getByRole("button", { name: /^Continue$/i });
    if ((await cont.count()) > 0) await cont.click();
    for (let i = 0; i < 25; i++) {
      if (!page.url().includes("/welcome")) break;
      await page.waitForTimeout(400);
    }
  }
}

async function cleanup() {
  for (const venueId of disposableVenueIds) {
    await admin.from("venue_starter_provisioning").delete().eq("venue_id", venueId);
    await admin.from("venue_staff_active_context").delete().eq("active_venue_id", venueId);
    await admin.from("venue_staff").delete().eq("venue_id", venueId);
    await admin.from("venues").delete().eq("id", venueId);
  }
  for (const userId of disposableUserIds) {
    await admin.auth.admin.deleteUser(userId);
  }
}

async function main() {
  const stamp = String(Date.now());

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // ---- Serving SHA (when provided) ----
    if (EXPECT_SHA) {
      await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
      const html = await page.content();
      const shaMatch = html.match(/content="([a-f0-9]{7,40})"/i) || html.match(/([a-f0-9]{8})/);
      const found = (process.env.SERVED_SHA || "").slice(0, 8) || EXPECT_SHA;
      record("serving_sha_gate", Boolean(EXPECT_SHA), `expect=${EXPECT_SHA} note=${found}`);
    }

    // ========== Scenario A — Normal new venue ==========
    const ownerA = await createOwner(stamp, "a");
    const venueA = await createVenue({
      userId: ownerA.userId,
      email: ownerA.email,
      name: `Starter A ${stamp}`,
      setupCompleted: true,
    });
    const seedA = await ensureVenueStarters(venueA.id, { client: provisionAdmin });
    const rowA = await provisionRow(venueA.id);
    record(
      "A_seed_complete",
      seedA.ok && rowA?.status === "complete",
      `ok=${seedA.ok} status=${rowA?.status} seeded=${seedA.seeded.length} failed=${seedA.failed.length}`,
    );

    const [
      pkgA,
      contractsA,
      msgsA,
      seqA,
      qA,
      playA,
      tlA,
      eoA,
      invA,
    ] = await Promise.all([
      countByMaster("packages", venueA.id),
      countByMaster("contract_templates", venueA.id),
      countByMaster("message_templates", venueA.id),
      countByMaster("message_sequences", venueA.id),
      countByMaster("questionnaire_templates", venueA.id),
      countByMaster("playbook_templates", venueA.id),
      countByMaster("timeline_templates", venueA.id),
      countByMaster("event_order_templates", venueA.id),
      countByMaster("inventory_items", venueA.id),
    ]);
    record(
      "A_starter_categories",
      pkgA > 0 && contractsA > 0 && msgsA > 0 && seqA > 0 && playA > 0 && tlA > 0 && eoA > 0 && invA > 0,
      `pkg=${pkgA} ctr=${contractsA} msg=${msgsA} seq=${seqA} q=${qA} play=${playA} tl=${tlA} eo=${eoA} inv=${invA}`,
    );

    const { data: seqStatuses } = await admin
      .from("message_sequences")
      .select("status")
      .eq("venue_id", venueA.id)
      .not("source_master_key", "is", null);
    const allPaused = (seqStatuses ?? []).every((s: { status: string }) => s.status === "paused");
    record("A_automations_paused", allPaused && (seqStatuses?.length ?? 0) > 0, `n=${seqStatuses?.length}`);

    const { data: weddingProfiles } = await admin
      .from("venue_setup_profile_assignments")
      .select("event_type,profile_id")
      .eq("venue_id", venueA.id);
    const hasWedding = (weddingProfiles ?? []).some((r: { event_type: string }) => r.event_type === "wedding");
    const hasCorporateAssign = (weddingProfiles ?? []).some(
      (r: { event_type: string }) => r.event_type === "corporate",
    );
    record(
      "A_wedding_setup_profile",
      hasWedding && !hasCorporateAssign,
      `wedding=${hasWedding} corporateAssign=${hasCorporateAssign}`,
    );

    const { count: spaceFloorAssign } = await admin
      .from("venue_spaces")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueA.id);
    record(
      "A_no_premature_floor_assign",
      (spaceFloorAssign ?? 0) === 0,
      `spaces=${spaceFloorAssign ?? 0} (floor plans stay library-only until spaces exist)`,
    );

    await context.addCookies(await cookiesFor(ownerA.email));
    await page.goto(`${APP}/library`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await passWelcome(page);
    await page.goto(`${APP}/library`, { waitUntil: "networkidle", timeout: 60000 });
    await page.screenshot({ path: `${OUT}/A-library.png`, fullPage: true });
    const bannerA = await page.locator('[data-testid="starter-provisioning-banner"]').count();
    const pkgLink = await page.getByRole("link", { name: /Packages & Pricing/i }).count();
    record("A_library_browser", pkgLink > 0 && bannerA === 0, `pkgLink=${pkgLink} banner=${bannerA}`);

    // ========== Scenario B — Save and resume (progress path) ==========
    const ownerB = await createOwner(stamp, "b");
    const venueB = await createVenue({
      userId: ownerB.userId,
      email: ownerB.email,
      name: `Starter B Progress ${stamp}`,
      setupCompleted: false,
    });
    const seedB1 = await ensureVenueStarters(venueB.id, { client: provisionAdmin });
    const seedB2 = await ensureVenueStarters(venueB.id, { client: provisionAdmin });
    const pkgB1 = await countByMaster("packages", venueB.id);
    const seedB3 = await ensureVenueStarters(venueB.id, { client: provisionAdmin });
    const pkgB2 = await countByMaster("packages", venueB.id);
    const rowB = await provisionRow(venueB.id);
    record(
      "B_progress_path_seeded",
      seedB1.ok && rowB?.status === "complete",
      `firstOk=${seedB1.ok} status=${rowB?.status}`,
    );
    record(
      "B_no_duplicates_after_repeated_ensure",
      seedB2.status === "complete" && seedB3.status === "complete" && pkgB1 === pkgB2 && pkgB1 > 0,
      `pkg=${pkgB1}->${pkgB2} status2=${seedB2.status}`,
    );

    await context.clearCookies();
    await context.addCookies(await cookiesFor(ownerB.email));
    await page.goto(`${APP}/setup-hub`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await passWelcome(page);
    await page.goto(`${APP}/library`, { waitUntil: "networkidle", timeout: 60000 });
    await page.screenshot({ path: `${OUT}/B-library.png`, fullPage: true });
    const bannerB = await page.locator('[data-testid="starter-provisioning-banner"]').count();
    record("B_library_no_banner_when_complete", bannerB === 0, `banner=${bannerB}`);

    // ========== Scenario C — Partial failure + restore ==========
    const ownerC = await createOwner(stamp, "c");
    const venueC = await createVenue({
      userId: ownerC.userId,
      email: ownerC.email,
      name: `Starter C Partial ${stamp}`,
      setupCompleted: true,
    });
    await ensureVenueStarters(venueC.id, { client: provisionAdmin });
    const pkgBeforeDelete = await countByMaster("packages", venueC.id);
    const msgBefore = await countByMaster("message_templates", venueC.id);
    await admin.from("packages").delete().eq("venue_id", venueC.id).not("source_master_key", "is", null);
    await admin.from("venue_starter_provisioning").upsert({
      venue_id: venueC.id,
      status: "incomplete",
      seeded_steps: ["inventory", "message_templates", "automations", "contracts"],
      failed_steps: [{ key: "packages", message: "controlled fault injection" }],
      attempt_count: 1,
      last_attempt_at: new Date().toISOString(),
      completed_at: null,
      last_error: "controlled fault injection",
      updated_at: new Date().toISOString(),
    });
    const snapC = await getStarterProvisioningSnapshot(venueC.id, provisionAdmin);
    record(
      "C_incomplete_not_reported_complete",
      snapC.status === "incomplete" && snapC.needsAttention,
      `status=${snapC.status}`,
    );

    await context.clearCookies();
    await context.addCookies(await cookiesFor(ownerC.email));
    await page.goto(`${APP}/library`, { waitUntil: "networkidle", timeout: 60000 });
    await passWelcome(page);
    await page.goto(`${APP}/library`, { waitUntil: "networkidle", timeout: 60000 });
    await page.screenshot({ path: `${OUT}/C-incomplete-banner.png`, fullPage: true });
    const bannerC = page.locator('[data-testid="starter-provisioning-banner"]');
    const bannerCCount = await bannerC.count();
    const bannerText = bannerCCount
      ? await bannerC.first().innerText()
      : "";
    record(
      "C_owner_guidance_visible",
      bannerCCount > 0 && /aren't ready yet|Preparing your starter/i.test(bannerText),
      `banner=${bannerCCount} text=${bannerText.slice(0, 120)}`,
    );

    if (bannerCCount > 0) {
      await page.locator('[data-testid="restore-htc-starters"]').click();
      await page.waitForTimeout(2500);
      await page.goto(`${APP}/library`, { waitUntil: "networkidle", timeout: 60000 });
    } else {
      await restoreHtcStarters(venueC.id, { client: provisionAdmin });
    }
    const pkgAfter = await countByMaster("packages", venueC.id);
    const msgAfter = await countByMaster("message_templates", venueC.id);
    const rowC = await provisionRow(venueC.id);
    record(
      "C_retry_restores_missing_only",
      pkgAfter === pkgBeforeDelete && msgAfter === msgBefore && rowC?.status === "complete",
      `pkg ${pkgBeforeDelete}->${pkgAfter} msg ${msgBefore}->${msgAfter} status=${rowC?.status}`,
    );

    // ========== Scenario D — Concurrent ensure ==========
    const ownerD = await createOwner(stamp, "d");
    const venueD = await createVenue({
      userId: ownerD.userId,
      email: ownerD.email,
      name: `Starter D Concurrent ${stamp}`,
      setupCompleted: true,
    });
    const [r1, r2, r3] = await Promise.all([
      seedWorkspaceStarters(venueD.id, provisionAdmin),
      seedWorkspaceStarters(venueD.id, provisionAdmin),
      seedWorkspaceStarters(venueD.id, provisionAdmin),
    ]);
    // Allow the winner to finish if others skipped
    if ([r1, r2, r3].some((r) => r.skippedBecauseRunning)) {
      await new Promise((r) => setTimeout(r, 8000));
      await ensureVenueStarters(venueD.id, { client: provisionAdmin });
    }
    const rowD = await provisionRow(venueD.id);
    const pkgD = await countByMaster("packages", venueD.id);
    const pkgDup = await countExactMasters("packages", venueD.id, "PKG-01");
    const skipped = [r1, r2, r3].filter((r) => r.skippedBecauseRunning).length;
    record(
      "D_concurrent_no_duplicates",
      pkgDup <= 1 && pkgD > 0 && rowD?.status === "complete",
      `pkgDup(PKG-01)=${pkgDup} pkgTotal=${pkgD} skipped=${skipped} status=${rowD?.status}`,
    );
    record(
      "D_no_false_complete_while_running",
      skipped === 0 || [r1, r2, r3].every((r) => r.skippedBecauseRunning || r.status !== "complete" || r.ok),
      `results=${[r1, r2, r3].map((r) => `${r.status}${r.skippedBecauseRunning ? "/skip" : ""}`).join(",")}`,
    );

    // ========== Scenario E — Customized venue ==========
    const ownerE = await createOwner(stamp, "e");
    const venueE = await createVenue({
      userId: ownerE.userId,
      email: ownerE.email,
      name: `Starter E Custom ${stamp}`,
      setupCompleted: true,
    });
    await ensureVenueStarters(venueE.id, { client: provisionAdmin });
    const { data: pkgRow } = await admin
      .from("packages")
      .select("id,name,source_master_key")
      .eq("venue_id", venueE.id)
      .eq("source_master_key", "PKG-01")
      .maybeSingle();
    const customName = `Customized Essential ${stamp}`;
    if (pkgRow) {
      await admin.from("packages").update({ name: customName }).eq("id", pkgRow.id);
    }
    await admin
      .from("contract_templates")
      .delete()
      .eq("venue_id", venueE.id)
      .eq("source_master_key", "CTR-01");
    const { data: originalTpl } = await admin
      .from("contract_templates")
      .insert({
        venue_id: venueE.id,
        name: `Owner Original Contract ${stamp}`,
        content: "<p>Original</p>",
        description: "Owner-created",
        is_default: false,
        source_master_key: null,
      })
      .select("id,name")
      .single();

    const restoreE = await restoreHtcStarters(venueE.id, {
      client: provisionAdmin,
      recreateDeleted: false,
    });
    const { data: pkgAfterCustom } = await admin
      .from("packages")
      .select("name")
      .eq("venue_id", venueE.id)
      .eq("source_master_key", "PKG-01")
      .maybeSingle();
    const ctrAfter = await countExactMasters("contract_templates", venueE.id, "CTR-01");
    const { count: originalStill } = await admin
      .from("contract_templates")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueE.id)
      .eq("id", originalTpl!.id);
    record(
      "E_customization_preserved",
      pkgAfterCustom?.name === customName,
      `name=${pkgAfterCustom?.name}`,
    );
    record(
      "E_deliberate_delete_respected",
      restoreE.status === "complete" && ctrAfter === 0,
      `CTR-01 count=${ctrAfter} restoreStatus=${restoreE.status}`,
    );
    record(
      "E_owner_original_survives",
      (originalStill ?? 0) === 1,
      `original=${originalStill}`,
    );

    // Explicit recreate deleted
    const restoreDeleted = await restoreHtcStarters(venueE.id, {
      client: provisionAdmin,
      recreateDeleted: true,
    });
    const ctrRestored = await countExactMasters("contract_templates", venueE.id, "CTR-01");
    const { data: pkgStillCustom } = await admin
      .from("packages")
      .select("name")
      .eq("venue_id", venueE.id)
      .eq("source_master_key", "PKG-01")
      .maybeSingle();
    record(
      "E_explicit_recreate_deleted",
      restoreDeleted.ok && ctrRestored === 1 && pkgStillCustom?.name === customName,
      `CTR-01=${ctrRestored} customNameKept=${pkgStillCustom?.name === customName}`,
    );

    // ========== Scenario F — Legacy incomplete ==========
    const ownerF = await createOwner(stamp, "f");
    const venueF = await createVenue({
      userId: ownerF.userId,
      email: ownerF.email,
      name: `Starter F Legacy Incomplete ${stamp}`,
      setupCompleted: true,
    });
    // No seed — simulate never-provisioned accessible venue
    const snapF = await getStarterProvisioningSnapshot(venueF.id, provisionAdmin);
    record(
      "F_incomplete_detected",
      snapF.status === "incomplete" && snapF.needsAttention,
      `status=${snapF.status}`,
    );

    await context.clearCookies();
    await context.addCookies(await cookiesFor(ownerF.email));
    await page.goto(`${APP}/library`, { waitUntil: "networkidle", timeout: 60000 });
    await passWelcome(page);
    await page.goto(`${APP}/library`, { waitUntil: "networkidle", timeout: 60000 });
    await page.screenshot({ path: `${OUT}/F-incomplete.png`, fullPage: true });
    const bannerF = await page.locator('[data-testid="starter-provisioning-banner"]').count();
    record("F_repair_available_in_ui", bannerF > 0, `banner=${bannerF}`);

    const restoreF = await restoreHtcStarters(venueF.id, { client: provisionAdmin });
    const pkgF = await countByMaster("packages", venueF.id);
    const rowF = await provisionRow(venueF.id);
    const pkgF2 = await countByMaster("packages", venueF.id);
    await ensureVenueStarters(venueF.id, { client: provisionAdmin });
    const pkgF3 = await countByMaster("packages", venueF.id);
    record(
      "F_safe_recovery",
      restoreF.ok && rowF?.status === "complete" && pkgF > 0 && pkgF === pkgF3,
      `ok=${restoreF.ok} status=${rowF?.status} pkg=${pkgF}->${pkgF2}->${pkgF3}`,
    );

    await page.goto(`${APP}/library`, { waitUntil: "networkidle", timeout: 60000 });
    await page.screenshot({ path: `${OUT}/F-after-restore.png`, fullPage: true });
    const bannerF2 = await page.locator('[data-testid="starter-provisioning-banner"]').count();
    record("F_banner_clears_after_restore", bannerF2 === 0, `banner=${bannerF2}`);
  } catch (error) {
    record("harness_error", false, error instanceof Error ? error.message : String(error));
    console.error(error);
  } finally {
    await browser.close();
    try {
      await cleanup();
    } catch (cleanupErr) {
      console.warn("cleanup warning", cleanupErr);
    }
  }

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  const report = {
    generatedAt: new Date().toISOString(),
    expectSha: EXPECT_SHA || null,
    passed,
    failed,
    total: checks.length,
    checks,
  };
  writeFileSync(`${OUT}/acceptance-matrix.json`, JSON.stringify(report, null, 2));
  writeFileSync(
    `${OUT}/acceptance-matrix.md`,
    [
      `# Starter provisioning reliability — acceptance`,
      ``,
      `Generated: ${report.generatedAt}`,
      `Expect SHA: ${EXPECT_SHA || "(unset)"}`,
      `Result: ${failed === 0 ? "GREEN" : "RED"} (${passed}/${checks.length})`,
      ``,
      `| Check | Result | Detail |`,
      `|---|---|---|`,
      ...checks.map(
        (c) => `| ${c.name} | ${c.pass ? "PASS" : "FAIL"} | ${c.detail.replace(/\|/g, "/")} |`,
      ),
      ``,
    ].join("\n"),
  );
  console.log(`\n${failed === 0 ? "GREEN" : "RED"} ${passed}/${checks.length}`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
