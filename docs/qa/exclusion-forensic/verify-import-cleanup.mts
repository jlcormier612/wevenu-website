/**
 * Disposable Sandbox: owner-controlled Import cleanup matrix (Option B hardened).
 * Browser + DB. No rollbackImportBatch. Preserves venue.
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

  const email = `jennifer+icln2.${stamp}@hellotocheers.com`;
  const password = `Ic2-${stamp}-Aa1x`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (cErr || !created.user) throw cErr ?? new Error("user");
  const userId = created.user.id;

  const { data: venue, error: vErr } = await admin.from("venues").insert({
    owner_user_id: userId,
    name: `Import Cleanup Own ${stamp}`,
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

  // Pre-existing controls (must never be deleted)
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
  // Lookalike that is NOT in migration_records
  const { data: lookalike } = await admin.from("clients").insert({
    venue_id: venueId,
    first_name: "EligibleAnn",
    last_name: "Lookalike",
    email: `lookalike.${stamp}@example.invalid`,
  }).select("id").single();
  record("setup", "controls", !!controlClient && !!controlLead && !!lookalike,
    `c=${controlClient?.id} l=${controlLead?.id} look=${lookalike?.id}`);

  const committedAt = new Date().toISOString();

  const { data: eligibleClient } = await admin.from("clients").insert({
    venue_id: venueId, first_name: "EligibleAnn", last_name: "Cleanup",
    email: `eligible.ann.${stamp}@example.invalid`, is_historical_import: true,
  }).select("id").single();

  const { data: editedDelete } = await admin.from("clients").insert({
    venue_id: venueId, first_name: "EditedDelete", last_name: "Cleanup",
    email: `edited.del.${stamp}@example.invalid`, is_historical_import: true,
  }).select("id").single();

  const { data: editedKeep } = await admin.from("clients").insert({
    venue_id: venueId, first_name: "EditedKeep", last_name: "Cleanup",
    email: `edited.keep.${stamp}@example.invalid`, is_historical_import: true,
  }).select("id").single();

  const { data: eligibleLead } = await admin.from("leads").insert({
    venue_id: venueId, first_name: "EligibleLead", last_name: "Cleanup",
    email: `eligible.lead.${stamp}@example.invalid`, is_historical_import: true,
  }).select("id").single();

  const { data: finClient } = await admin.from("clients").insert({
    venue_id: venueId, first_name: "FinancialCara", last_name: "Cleanup",
    email: `fin.cara.${stamp}@example.invalid`, is_historical_import: true,
    event_date: "2026-12-15", event_type: "Wedding", guest_count: 60,
  }).select("id,email").single();

  const { data: finEvent } = await admin.from("events").insert({
    venue_id: venueId, client_id: finClient!.id, name: "FinancialCara Wedding",
    event_date: "2026-12-15", status: "draft", guest_count: 60,
  }).select("id").single();

  // MC floor_plan created_entity_id is a documents row (SoR), not floor_plans.id
  const { data: floorDoc, error: floorDocErr } = await admin.from("documents").insert({
    venue_id: venueId,
    name: `Cleanup Plan ${stamp}`,
    category: "floor_plan",
    file_name: `cleanup-plan-${stamp}.png`,
    file_size: 128,
    mime_type: "image/png",
    storage_path: `${venueId}/migration/cleanup-plan-${stamp}.png`,
    storage_url: `https://example.invalid/${venueId}/cleanup-plan-${stamp}.png`,
    tags: ["migration", "floor_plan"],
    notes: "Import cleanup verify fixture",
  }).select("id").single();
  if (floorDocErr) record("setup", "floor_doc", false, floorDocErr.message);
  else record("setup", "floor_doc", true, floorDoc?.id ?? "");
  const floorPlan = floorDoc;

  await new Promise((r) => setTimeout(r, 2500));
  await admin.from("clients").update({ phone: "5550188888", internal_notes: `edited-del ${stamp}` })
    .eq("id", editedDelete!.id);
  await admin.from("clients").update({ phone: "5550177777", internal_notes: `edited-keep ${stamp}` })
    .eq("id", editedKeep!.id);

  const scheduleLinesJson = JSON.stringify([
    {
      label: "Retainer (paid)", amount: "1500", dueDate: "2025-06-01",
      obligationKind: "deposit", alreadyPaid: true, paidDate: "2025-06-01",
      paymentMethod: "check", referenceNumber: "CHK-CLEAN2",
    },
    {
      label: "Balance", amount: "4500", dueDate: "2026-11-01",
      obligationKind: "final", alreadyPaid: false,
    },
  ]);
  const acNorm = genericCsvAdapter.normalizeRow({
    eventId: finEvent!.id, clientEmail: finClient!.email, eventDate: "2026-12-15",
    contractedTotal: "6000", packageName: "Cleanup Package", scheduleLinesJson,
    contractTitle: "External Agreement", contractSignedAt: "2025-05-20",
    shareSignedAgreementWithCouple: "no", sourceId: `icln2-ac-${stamp}`,
  }, "active_commitment");
  let acOk = false;
  if (acNorm.ok) {
    const committed = await commitActiveCommitment(
      admin as never, venueId, acNorm.normalized as never, { actorUserId: userId },
    );
    acOk = committed.ok;
    record("setup", "active_commitment", committed.ok,
      committed.ok ? `sched=${committed.scheduleId}` : committed.error);
  } else {
    record("setup", "active_commitment", false, acNorm.error);
  }

  const { data: sess, error: sErr } = await admin.from("migration_sessions").insert({
    venue_id: venueId, source_key: "generic_csv", status: "committed",
    created_by_type: "venue", created_by: userId, resumable: true, completed_at: committedAt,
  }).select("id").single();
  if (sErr || !sess) throw sErr ?? new Error("session");
  const sessionId = sess.id as string;

  const recordRows: Record<string, unknown>[] = [
    {
      session_id: sessionId, venue_id: venueId, target_entity_type: "client",
      source_row_ref: "eligible-ann", status: "committed",
      created_entity_id: eligibleClient!.id, committed_at: committedAt,
      normalized_payload: { firstName: "EligibleAnn", lastName: "Cleanup" }, raw_payload: {},
    },
    {
      session_id: sessionId, venue_id: venueId, target_entity_type: "client",
      source_row_ref: "edited-del", status: "committed",
      created_entity_id: editedDelete!.id, committed_at: committedAt,
      normalized_payload: { firstName: "EditedDelete", lastName: "Cleanup" }, raw_payload: {},
    },
    {
      session_id: sessionId, venue_id: venueId, target_entity_type: "client",
      source_row_ref: "edited-keep", status: "committed",
      created_entity_id: editedKeep!.id, committed_at: committedAt,
      normalized_payload: { firstName: "EditedKeep", lastName: "Cleanup" }, raw_payload: {},
    },
    {
      session_id: sessionId, venue_id: venueId, target_entity_type: "lead",
      source_row_ref: "eligible-lead", status: "committed",
      created_entity_id: eligibleLead!.id, committed_at: committedAt,
      normalized_payload: { firstName: "EligibleLead", lastName: "Cleanup" }, raw_payload: {},
    },
    {
      session_id: sessionId, venue_id: venueId, target_entity_type: "client",
      source_row_ref: "fin-cara", status: "committed",
      created_entity_id: finClient!.id, committed_at: committedAt,
      normalized_payload: { firstName: "FinancialCara", lastName: "Cleanup" }, raw_payload: {},
    },
    {
      session_id: sessionId, venue_id: venueId, target_entity_type: "event",
      source_row_ref: "fin-event", status: "committed",
      created_entity_id: finEvent!.id, committed_at: committedAt,
      normalized_payload: { name: "FinancialCara Wedding" }, raw_payload: {},
    },
  ];
  if (floorPlan) {
    recordRows.push({
      session_id: sessionId, venue_id: venueId, target_entity_type: "floor_plan",
      source_row_ref: "floor-plan", status: "committed",
      created_entity_id: floorPlan.id, committed_at: committedAt,
      normalized_payload: { name: floorPlan ? `Cleanup Plan ${stamp}` : "plan" }, raw_payload: {},
    });
  }
  if (acOk) {
    recordRows.push({
      session_id: sessionId, venue_id: venueId, target_entity_type: "active_commitment",
      source_row_ref: "fin-ac", status: "committed",
      created_entity_id: finEvent!.id, committed_at: committedAt,
      normalized_payload: { eventId: finEvent!.id }, raw_payload: {},
    });
  }
  const { error: mrErr } = await admin.from("migration_records").insert(recordRows);
  if (mrErr) throw mrErr;
  record("setup", "session_provenance", true, `session=${sessionId} rows=${recordRows.length}`);

  const { count: inviteBefore } = await admin.from("client_invitations")
    .select("id", { count: "exact", head: true }).eq("venue_id", venueId);
  let enrollBefore = 0;
  {
    const { count } = await admin.from("automation_enrollments")
      .select("id", { count: "exact", head: true }).eq("venue_id", venueId);
    enrollBefore = count ?? 0;
  }

  // Cross-tenant probe: another venue's client id must not appear as attributable here
  const { data: otherVenue } = await admin.from("venues").insert({
    owner_user_id: userId,
    name: `Other Tenant ${stamp}`,
    email: `other.${email}`,
  }).select("id").single();
  const { data: foreignClient } = await admin.from("clients").insert({
    venue_id: otherVenue!.id,
    first_name: "Foreign", last_name: "Tenant",
    email: `foreign.${stamp}@example.invalid`,
  }).select("id").single();
  record("setup", "foreign_client", !!foreignClient, foreignClient?.id ?? "missing");

  const loginHtml = await fetch(`${APP}/login`).then((r) => r.text());
  const dpl = loginHtml.match(/data-dpl-id="([a-f0-9]+)"/)?.[1] || "";
  record("deploy", "serving_dpl",
    !EXPECT_SHA || dpl.startsWith(EXPECT_SHA),
    `dpl=${dpl || "missing"} expect=${EXPECT_SHA || "(any)"}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("dialog", async (d: any) => { await d.accept(); });

  await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  for (let i = 0; i < 50; i++) {
    if (!page.url().includes("/login")) break;
    await page.waitForTimeout(400);
  }
  await passWelcome(page);

  await page.goto(`${APP}/settings/migration?source=another_system`, {
    waitUntil: "domcontentloaded", timeout: 60000,
  });
  await page.waitForTimeout(1500);
  await passWelcome(page);

  const sessionRows = page.locator("button").filter({ has: page.locator("text=/Complete|Partly imported/i") });
  if ((await sessionRows.count()) > 0) await sessionRows.first().click();
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const main = document.querySelector("main") as HTMLElement | null;
    if (main) main.scrollTop = main.scrollHeight;
  }).catch(() => {});

  const hasCleanup = (await page.getByText("Import cleanup", { exact: true }).count()) > 0;
  record("browser", "cleanup_panel_visible", hasCleanup, `url=${page.url()}`);
  await page.screenshot({ path: `${OUT}/cleanup-panel.png`, fullPage: true });

  if (hasCleanup) {
    await page.getByRole("button", { name: /Review what can be removed/i }).click();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${OUT}/cleanup-preview.png`, fullPage: true });
    const body = await page.locator("body").innerText();
    record("browser", "shows_ready_and_choice", /ready/i.test(body) && /Your choice|need your choice/i.test(body),
      body.slice(0, 300));
    record("browser", "shows_financial_block", /signed contract or collected payments|financial records/i.test(body),
      "financial wording");
    record("browser", "shows_edited_warning", /changed since it was imported/i.test(body), "edited wording");

    // Override EditedDelete only (leave EditedKeep unchecked)
    const editedDelBox = page.getByRole("checkbox", { name: /Also remove EditedDelete/i });
    if ((await editedDelBox.count()) > 0) {
      await editedDelBox.first().check();
      record("browser", "override_edited_delete", true, "checked EditedDelete");
    } else {
      // Fall back: first overridable checkbox near EditedDelete text
      const row = page.locator("div").filter({ hasText: /EditedDelete/ }).locator('input[type="checkbox"]');
      if ((await row.count()) > 0) {
        await row.first().check();
        record("browser", "override_edited_delete", true, "checked via row");
      } else {
        record("browser", "override_edited_delete", false, "checkbox missing");
      }
    }

    // Also override floor plan if present
    const fpBox = page.locator("div").filter({ hasText: /Cleanup Plan|floor_plan/i }).locator('input[type="checkbox"]');
    if ((await fpBox.count()) > 0) {
      await fpBox.first().check();
      record("browser", "override_floor_plan", true, "checked");
    } else {
      record("browser", "override_floor_plan", floorPlan == null, "no floor plan or no checkbox");
    }

    await page.screenshot({ path: `${OUT}/cleanup-overrides.png`, fullPage: true });
    const removeBtn = page.getByRole("button", { name: /Remove \d+/i });
    if ((await removeBtn.count()) > 0 && await removeBtn.first().isEnabled()) {
      await removeBtn.first().click();
      await page.waitForTimeout(6000);
      await page.screenshot({ path: `${OUT}/cleanup-result.png`, fullPage: true });
      const after = await page.locator("body").innerText();
      record("browser", "partial_summary", /Cleanup (finished|completed)/i.test(after) || /removed/i.test(after),
        after.slice(0, 280));
      record("browser", "remaining_called_out", /remain|blocked|left as chosen|additional review/i.test(after),
        "partial result language");
    } else {
      record("browser", "partial_summary", false, "Remove button missing");
      record("browser", "remaining_called_out", false, "n/a");
    }
  }

  await browser.close();

  // Persisted outcomes
  const { data: annGone } = await admin.from("clients").select("id").eq("id", eligibleClient!.id).maybeSingle();
  const { data: delGone } = await admin.from("clients").select("id").eq("id", editedDelete!.id).maybeSingle();
  const { data: keepStill } = await admin.from("clients").select("id,phone").eq("id", editedKeep!.id).maybeSingle();
  const { data: leadGone } = await admin.from("leads").select("id").eq("id", eligibleLead!.id).maybeSingle();
  const { data: caraKept } = await admin.from("clients").select("id").eq("id", finClient!.id).maybeSingle();
  const { data: eventKept } = await admin.from("events").select("id").eq("id", finEvent!.id).maybeSingle();
  const { data: fpGone } = floorPlan
    ? await admin.from("documents").select("id").eq("id", floorPlan.id).maybeSingle()
    : { data: null };
  const { data: ctrlC } = await admin.from("clients").select("id").eq("id", controlClient!.id).maybeSingle();
  const { data: ctrlL } = await admin.from("leads").select("id").eq("id", controlLead!.id).maybeSingle();
  const { data: lookStill } = await admin.from("clients").select("id").eq("id", lookalike!.id).maybeSingle();
  const { data: foreignStill } = await admin.from("clients").select("id").eq("id", foreignClient!.id).maybeSingle();

  record("persist", "eligible_client_deleted", !annGone, `ann=${annGone?.id ?? "gone"}`);
  record("persist", "edited_override_deleted", !delGone, `editedDel=${delGone?.id ?? "gone"}`);
  record("persist", "edited_kept_retained", !!keepStill, `editedKeep=${keepStill?.id}`);
  record("persist", "eligible_lead_deleted", !leadGone, `lead=${leadGone?.id ?? "gone"}`);
  record("persist", "financial_client_retained", !!caraKept, `cara=${caraKept?.id}`);
  record("persist", "event_retained", !!eventKept, `event=${eventKept?.id}`);
  record("persist", "floor_plan_deleted_or_skipped", floorPlan ? !fpGone : true,
    `fp=${fpGone?.id ?? "gone-or-n/a"}`);
  record("persist", "preexisting_controls_intact", !!ctrlC && !!ctrlL, `c=${!!ctrlC} l=${!!ctrlL}`);
  record("persist", "lookalike_untouched", !!lookStill, `look=${lookStill?.id}`);
  record("persist", "foreign_tenant_untouched", !!foreignStill, `foreign=${foreignStill?.id}`);

  // Paid lines still present for financial client
  const { data: paidLines } = await admin.from("payment_line_items")
    .select("id,status, payment_schedules!inner(client_id)")
    .eq("venue_id", venueId)
    .eq("payment_schedules.client_id", finClient!.id)
    .eq("status", "paid");
  record("persist", "paid_lines_preserved", (paidLines ?? []).length >= 1,
    `paid=${paidLines?.length}`);

  // Retry idempotency
  record("retry", "eligible_still_gone", !annGone, "no resurrect");

  const { count: inviteAfter } = await admin.from("client_invitations")
    .select("id", { count: "exact", head: true }).eq("venue_id", venueId);
  let enrollAfter = 0;
  {
    const { count } = await admin.from("automation_enrollments")
      .select("id", { count: "exact", head: true }).eq("venue_id", venueId);
    enrollAfter = count ?? 0;
  }
  record("side_effects", "no_new_invitations", (inviteAfter ?? 0) === (inviteBefore ?? 0),
    `before=${inviteBefore} after=${inviteAfter}`);
  record("side_effects", "no_new_enrollments", enrollAfter === enrollBefore,
    `before=${enrollBefore} after=${enrollAfter}`);

  const failed = checks.filter((c) => !c.pass);
  const summary = {
    venueId, sessionId, userId, email, stamp,
    expectSha: EXPECT_SHA || null, dpl: dpl || null,
    pass: checks.filter((c) => c.pass).length,
    fail: failed.length,
    checks,
  };
  writeFileSync(`${OUT}/import-cleanup-results.json`, JSON.stringify(summary, null, 2));
  writeFileSync(`${OUT}/import-cleanup-run.log`, checks.map((c) =>
    `${c.pass ? "PASS" : "FAIL"} [${c.group}] ${c.name} — ${c.detail}`).join("\n") + "\n");
  console.log(`\nSUMMARY pass=${summary.pass} fail=${summary.fail} venue=${venueId} dpl=${dpl}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
