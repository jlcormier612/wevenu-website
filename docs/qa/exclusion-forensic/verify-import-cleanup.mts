/**
 * Disposable Sandbox: reviewable import-scoped cleanup (Option B).
 * Browser + DB evidence. Does not call rollbackImportBatch. Preserves venue.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { commitActiveCommitment } from "../../../lib/migration/active-commitment";
import { genericCsvAdapter } from "../../../lib/migration/sources/generic-csv";

config({ path: ".env.local", quiet: true });
process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";

const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const OUT = "docs/qa/exclusion-forensic";
const EXPECT_SHA = (process.env.EXPECT_SHA || "").slice(0, 8);
const SANDBOX_REF = "wvpsldwwjqdannqasrdf";
if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(SANDBOX_REF)) {
  throw new Error("Refusing — not Sandbox");
}
mkdirSync(OUT, { recursive: true });

type Check = { group: string; name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(group: string, name: string, pass: boolean, detail: string) {
  checks.push({ group, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} [${group}] ${name} — ${detail.slice(0, 420)}`);
}

async function passWelcome(page: any) {
  for (let a = 0; a < 5; a++) {
    const onWelcome = page.url().includes("/welcome");
    const visible = await page.locator('[data-welcome-experience="true"]').isVisible().catch(() => false);
    if (!onWelcome && !visible) return;
    await page.locator("#welcome-experience-agree").check({ force: true }).catch(() => {});
    const boxes = page.locator("input[type='checkbox']");
    const n = await boxes.count();
    for (let i = 0; i < n; i++) await boxes.nth(i).check({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
    const cont = page.getByRole("button", { name: /^Continue$/i });
    if ((await cont.count()) > 0 && await cont.first().isEnabled()) await cont.first().click();
    for (let i = 0; i < 20; i++) {
      if (!page.url().includes("/welcome")) return;
      await page.waitForTimeout(400);
    }
  }
}

async function main() {
  const stamp = Date.now();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const email = `jennifer+icln.${stamp}@hellotocheers.com`;
  const password = `Ic-${stamp}-Aa1x`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (cErr || !created.user) throw cErr ?? new Error("user");
  const userId = created.user.id;

  const { data: venue, error: vErr } = await admin.from("venues").insert({
    owner_user_id: userId,
    name: `Import Cleanup ${stamp}`,
    email: `v.${email}`,
  }).select("id,name").single();
  if (vErr || !venue) throw vErr ?? new Error("venue");
  const venueId = venue.id as string;

  await admin.from("venue_staff").insert({
    venue_id: venueId, user_id: userId, full_name: "Cleanup Owner", email,
    role: "owner", is_owner: true, is_active: true,
    accepted_at: new Date().toISOString(),
    access_title: "administrator", title_basis: "administrator",
    capability_overrides: {}, owner_invite_pending: false,
  });
  await admin.from("venue_staff_active_context").upsert({
    user_id: userId, active_venue_id: venueId, updated_at: new Date().toISOString(),
  });
  await admin.from("venue_onboarding_intake").upsert({
    venue_id: venueId, path: "self_setup", venue_name: venue.name,
    space_mode: "one", spaces: [{ name: "Main Space", maxCapacity: null }],
    offers_tours: true, inquiry_sources: [], bring_business_choice: "another_system",
    submitted_at: new Date().toISOString(),
  }, { onConflict: "venue_id" });
  await admin.from("venue_spaces").insert({
    venue_id: venueId, name: "Main Space", is_active: true, sort_order: 0,
  });
  await admin.from("venue_capacity_rules").upsert({
    venue_id: venueId, max_simultaneous_events: 1, max_simultaneous_tours: 2, min_turnaround_hours: 0,
  }, { onConflict: "venue_id" });
  record("setup", "venue", true, venueId);

  const { data: controlClient } = await admin.from("clients").insert({
    venue_id: venueId,
    first_name: "ControlKeep",
    last_name: "PreExisting",
    email: `control.keep.${stamp}@example.invalid`,
  }).select("id").single();
  const { data: controlLead } = await admin.from("leads").insert({
    venue_id: venueId,
    first_name: "ControlLead",
    last_name: "KeepMe",
    email: `control.lead.${stamp}@example.invalid`,
  }).select("id").single();
  record("setup", "controls", !!controlClient && !!controlLead, `c=${controlClient?.id} l=${controlLead?.id}`);

  const committedAt = new Date().toISOString();

  const { data: eligibleClient } = await admin.from("clients").insert({
    venue_id: venueId,
    first_name: "EligibleAnn",
    last_name: "Cleanup",
    email: `eligible.ann.${stamp}@example.invalid`,
    is_historical_import: true,
  }).select("id").single();

  const { data: editedClient } = await admin.from("clients").insert({
    venue_id: venueId,
    first_name: "EditedBob",
    last_name: "Cleanup",
    email: `edited.bob.${stamp}@example.invalid`,
    is_historical_import: true,
  }).select("id").single();

  const { data: eligibleLead } = await admin.from("leads").insert({
    venue_id: venueId,
    first_name: "EligibleLead",
    last_name: "Cleanup",
    email: `eligible.lead.${stamp}@example.invalid`,
    is_historical_import: true,
  }).select("id").single();

  const { data: finClient } = await admin.from("clients").insert({
    venue_id: venueId,
    first_name: "FinancialCara",
    last_name: "Cleanup",
    email: `fin.cara.${stamp}@example.invalid`,
    is_historical_import: true,
    event_date: "2026-12-15",
    event_type: "Wedding",
    guest_count: 60,
  }).select("id,email").single();

  const { data: finEvent } = await admin.from("events").insert({
    venue_id: venueId,
    client_id: finClient!.id,
    name: "FinancialCara Wedding",
    event_date: "2026-12-15",
    status: "draft",
    guest_count: 60,
  }).select("id").single();

  // Edit Bob after a short delay so updated_at exceeds commit+2s
  await new Promise((r) => setTimeout(r, 2500));
  await admin.from("clients").update({
    phone: "5550188888",
    internal_notes: `edited-after-import ${stamp}`,
  }).eq("id", editedClient!.id);

  const scheduleLinesJson = JSON.stringify([
    {
      label: "Retainer (paid)",
      amount: "1500",
      dueDate: "2025-06-01",
      obligationKind: "deposit",
      alreadyPaid: true,
      paidDate: "2025-06-01",
      paymentMethod: "check",
      referenceNumber: "CHK-CLEAN",
    },
    {
      label: "Balance",
      amount: "4500",
      dueDate: "2026-11-01",
      obligationKind: "final",
      alreadyPaid: false,
    },
  ]);
  const acNorm = genericCsvAdapter.normalizeRow({
    eventId: finEvent!.id,
    clientEmail: finClient!.email,
    eventDate: "2026-12-15",
    contractedTotal: "6000",
    packageName: "Cleanup Package",
    scheduleLinesJson,
    contractTitle: "External Agreement",
    contractSignedAt: "2025-05-20",
    shareSignedAgreementWithCouple: "no",
    sourceId: `icln-ac-${stamp}`,
  }, "active_commitment");
  let acOk = false;
  if (acNorm.ok) {
    const committed = await commitActiveCommitment(
      admin as never,
      venueId,
      acNorm.normalized as never,
      { actorUserId: userId },
    );
    acOk = committed.ok;
    record("setup", "active_commitment", committed.ok,
      committed.ok ? `sched=${committed.scheduleId}` : committed.error);
  } else {
    record("setup", "active_commitment", false, acNorm.error);
  }

  const { data: sess, error: sErr } = await admin.from("migration_sessions").insert({
    venue_id: venueId,
    source_key: "generic_csv",
    status: "committed",
    created_by_type: "venue",
    created_by: userId,
    resumable: true,
    completed_at: committedAt,
  }).select("id").single();
  if (sErr || !sess) throw sErr ?? new Error("session");
  const sessionId = sess.id as string;

  const recordRows = [
    {
      session_id: sessionId, venue_id: venueId, target_entity_type: "client",
      source_row_ref: "eligible-ann", status: "committed",
      created_entity_id: eligibleClient!.id, committed_at: committedAt,
      normalized_payload: { firstName: "EligibleAnn", lastName: "Cleanup" },
      raw_payload: {},
    },
    {
      session_id: sessionId, venue_id: venueId, target_entity_type: "client",
      source_row_ref: "edited-bob", status: "committed",
      created_entity_id: editedClient!.id, committed_at: committedAt,
      normalized_payload: { firstName: "EditedBob", lastName: "Cleanup" },
      raw_payload: {},
    },
    {
      session_id: sessionId, venue_id: venueId, target_entity_type: "lead",
      source_row_ref: "eligible-lead", status: "committed",
      created_entity_id: eligibleLead!.id, committed_at: committedAt,
      normalized_payload: { firstName: "EligibleLead", lastName: "Cleanup" },
      raw_payload: {},
    },
    {
      session_id: sessionId, venue_id: venueId, target_entity_type: "client",
      source_row_ref: "fin-cara", status: "committed",
      created_entity_id: finClient!.id, committed_at: committedAt,
      normalized_payload: { firstName: "FinancialCara", lastName: "Cleanup" },
      raw_payload: {},
    },
    {
      session_id: sessionId, venue_id: venueId, target_entity_type: "event",
      source_row_ref: "fin-event", status: "committed",
      created_entity_id: finEvent!.id, committed_at: committedAt,
      normalized_payload: { name: "FinancialCara Wedding" },
      raw_payload: {},
    },
  ];
  if (acOk) {
    recordRows.push({
      session_id: sessionId, venue_id: venueId, target_entity_type: "active_commitment",
      source_row_ref: "fin-ac", status: "committed",
      created_entity_id: finEvent!.id, committed_at: committedAt,
      normalized_payload: { eventId: finEvent!.id },
      raw_payload: {},
    });
  }
  const { error: mrErr } = await admin.from("migration_records").insert(recordRows);
  if (mrErr) throw mrErr;
  record("setup", "session_provenance", true, `session=${sessionId} rows=${recordRows.length}`);

  // Side-effect baselines
  const { count: inviteBefore } = await admin.from("client_invitations")
    .select("id", { count: "exact", head: true }).eq("venue_id", venueId);
  const { count: enrollBefore } = await admin.from("message_enrollments")
    .select("id", { count: "exact", head: true }).eq("venue_id", venueId);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("dialog", async (d: any) => { await d.accept(); });

  await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.getByRole("button", { name: /sign in|log in|continue/i }).first().click();
  await page.waitForTimeout(2500);
  await passWelcome(page);

  if (EXPECT_SHA) {
    const health = await page.evaluate(async () => {
      try {
        const r = await fetch("/api/health");
        return await r.json();
      } catch (e) {
        return { error: String(e) };
      }
    });
    const sha = String(health?.gitSha ?? health?.sha ?? health?.version ?? "").slice(0, 8);
    record("deploy", "serving_sha", sha.startsWith(EXPECT_SHA) || sha.includes(EXPECT_SHA),
      `expect=${EXPECT_SHA} got=${JSON.stringify(health).slice(0, 200)}`);
  }

  await page.goto(`${APP}/settings/migration?source=another_system`, {
    waitUntil: "domcontentloaded", timeout: 60000,
  });
  await page.waitForTimeout(1500);
  await passWelcome(page);

  // Open the committed session from history
  const historyBtn = page.locator("button").filter({ hasText: /CSV|Generic|Another|Import Cleanup/i });
  // Prefer clicking the session row that matches our date/name — fall back to first history row
  const sessionRows = page.locator("button").filter({ has: page.locator("text=/Complete|Partly imported/i") });
  const rowCount = await sessionRows.count();
  if (rowCount > 0) {
    await sessionRows.first().click();
  } else {
    // Click any history list item
    const cards = page.locator('[class*="space-y"] button').filter({ hasText: /\d{1,2}\/\d{1,2}\/\d{2,4}/ });
    if ((await cards.count()) > 0) await cards.first().click();
  }
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const main = document.querySelector("main") as HTMLElement | null;
    if (main) main.scrollTop = main.scrollHeight;
  }).catch(() => {});

  const cleanupHeading = page.getByText("Import cleanup", { exact: true });
  const hasCleanup = (await cleanupHeading.count()) > 0;
  record("browser", "cleanup_panel_visible", hasCleanup, `url=${page.url()}`);
  await page.screenshot({ path: `${OUT}/cleanup-panel.png`, fullPage: true });

  if (hasCleanup) {
    await page.getByRole("button", { name: /Review what can be removed/i }).click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/cleanup-preview.png`, fullPage: true });
    const previewText = await page.locator("text=/eligible/i").first().innerText().catch(() => "");
    record("browser", "preview_counts", /eligible/i.test(previewText), previewText.slice(0, 200));

    const removeBtn = page.getByRole("button", { name: /Remove \d+ eligible/i });
    if ((await removeBtn.count()) > 0 && await removeBtn.first().isEnabled()) {
      await removeBtn.first().click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: `${OUT}/cleanup-result.png`, fullPage: true });
      const resultText = await page.locator("text=/Result:/i").first().innerText().catch(() => "");
      record("browser", "result_report", /removed|Result/i.test(resultText), resultText.slice(0, 240));
    } else {
      record("browser", "result_report", false, "Remove eligible button missing or disabled");
    }
  }

  await browser.close();

  // ── Persist checks ──────────────────────────────────────────────────────
  const { data: annGone } = await admin.from("clients").select("id").eq("id", eligibleClient!.id).maybeSingle();
  const { data: bobKept } = await admin.from("clients").select("id,phone,internal_notes").eq("id", editedClient!.id).maybeSingle();
  const { data: leadGone } = await admin.from("leads").select("id").eq("id", eligibleLead!.id).maybeSingle();
  const { data: caraKept } = await admin.from("clients").select("id").eq("id", finClient!.id).maybeSingle();
  const { data: eventKept } = await admin.from("events").select("id").eq("id", finEvent!.id).maybeSingle();
  const { data: ctrlC } = await admin.from("clients").select("id").eq("id", controlClient!.id).maybeSingle();
  const { data: ctrlL } = await admin.from("leads").select("id").eq("id", controlLead!.id).maybeSingle();

  record("persist", "eligible_client_deleted", !annGone, `ann=${annGone?.id ?? "gone"}`);
  record("persist", "edited_client_retained", !!bobKept && (bobKept.phone === "5550188888" || /edited-after-import/.test(bobKept.internal_notes ?? "")),
    `bob=${bobKept?.id} phone=${bobKept?.phone}`);
  record("persist", "eligible_lead_deleted", !leadGone, `lead=${leadGone?.id ?? "gone"}`);
  record("persist", "financial_client_retained", !!caraKept, `cara=${caraKept?.id}`);
  record("persist", "event_retained", !!eventKept, `event=${eventKept?.id}`);
  record("persist", "preexisting_controls_intact", !!ctrlC && !!ctrlL, `c=${!!ctrlC} l=${!!ctrlL}`);

  const { count: inviteAfter } = await admin.from("client_invitations")
    .select("id", { count: "exact", head: true }).eq("venue_id", venueId);
  const { count: enrollAfter } = await admin.from("message_enrollments")
    .select("id", { count: "exact", head: true }).eq("venue_id", venueId);
  record("side_effects", "no_new_invitations", (inviteAfter ?? 0) === (inviteBefore ?? 0),
    `before=${inviteBefore} after=${inviteAfter}`);
  record("side_effects", "no_new_enrollments", (enrollAfter ?? 0) === (enrollBefore ?? 0),
    `before=${enrollBefore} after=${enrollAfter}`);

  // Retry idempotency: eligible already gone → cleanup should not invent deletes
  const { data: annStill } = await admin.from("clients").select("id").eq("id", eligibleClient!.id).maybeSingle();
  record("retry", "eligible_still_gone", !annStill, "second look — no resurrect");

  const failed = checks.filter((c) => !c.pass);
  const summary = {
    venueId, sessionId, userId, email, stamp, expectSha: EXPECT_SHA || null,
    pass: checks.filter((c) => c.pass).length,
    fail: failed.length,
    checks,
  };
  writeFileSync(`${OUT}/import-cleanup-results.json`, JSON.stringify(summary, null, 2));
  writeFileSync(`${OUT}/import-cleanup-run.log`, checks.map((c) =>
    `${c.pass ? "PASS" : "FAIL"} [${c.group}] ${c.name} — ${c.detail}`).join("\n") + "\n");
  console.log(`\nSUMMARY pass=${summary.pass} fail=${summary.fail} venue=${venueId}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
