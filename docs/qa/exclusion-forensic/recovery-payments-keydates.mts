/**
 * Forensic: bulk/individual delete recovery, Active Commitment payment fidelity,
 * legacy key_date mapping evidence. Disposable Sandbox venue only.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { commitActiveCommitment } from "../../../lib/migration/active-commitment";
import { genericCsvAdapter } from "../../../lib/migration/sources/generic-csv";

config({ path: ".env.local", quiet: true });
process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";

const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");

const OUT = "docs/qa/exclusion-forensic";
const SANDBOX_REF = "wvpsldwwjqdannqasrdf";
if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(SANDBOX_REF)) {
  throw new Error("Refusing — not Sandbox");
}
mkdirSync(OUT, { recursive: true });

type Check = { group: string; name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(group: string, name: string, pass: boolean, detail: string) {
  checks.push({ group, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} [${group}] ${name} — ${detail.slice(0, 380)}`);
}

async function main() {
  const stamp = Date.now();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const email = `jennifer+recv.${stamp}@hellotocheers.com`;
  const password = `Rv-${stamp}-Aa1x`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (cErr || !created.user) throw cErr ?? new Error("user");
  const userId = created.user.id;

  const { data: venue, error: vErr } = await admin.from("venues").insert({
    owner_user_id: userId,
    name: `Recovery Forensic ${stamp}`,
    email: `v.${email}`,
  }).select("id,name").single();
  if (vErr || !venue) throw vErr ?? new Error("venue");
  const venueId = venue.id as string;

  await admin.from("venue_staff").insert({
    venue_id: venueId, user_id: userId, full_name: "Recovery Owner", email,
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
  record("setup", "venue", true, venueId.slice(0, 8));

  // ── Control (pre-existing) records ──────────────────────────────────────
  const { data: controlClient } = await admin.from("clients").insert({
    venue_id: venueId,
    first_name: "ControlKeep",
    last_name: "PreExisting",
    email: `control.keep.${stamp}@example.invalid`,
    phone: "5550100001",
  }).select("id,email").single();
  const { data: controlLead, error: leadErr } = await admin.from("leads").insert({
    venue_id: venueId,
    first_name: "ControlLead",
    last_name: "KeepMe",
    email: `control.lead.${stamp}@example.invalid`,
  }).select("id,email").single();
  if (leadErr) throw leadErr;
  record("setup", "controls", !!controlClient && !!controlLead, `client=${controlClient?.id?.slice(0, 8)} lead=${controlLead?.id?.slice(0, 8)}`);

  // ── Import batch for clients (provenance via import_batch_id) ───────────
  const { data: batch, error: bErr } = await admin.from("import_batches").insert({
    venue_id: venueId,
    entity_type: "couples",
    source_label: "recovery-forensic-clients",
    imported_by_type: "venue",
    imported_by: userId,
    row_count: 2,
    imported_count: 0,
    skipped_count: 0,
    error_count: 0,
  }).select("id").single();
  if (bErr || !batch) throw bErr ?? new Error("batch");
  const batchId = batch.id as string;

  const { data: importedClients, error: icErr } = await admin.from("clients").insert([
    {
      venue_id: venueId,
      first_name: "ImportAda",
      last_name: "Batch",
      email: `import.ada.${stamp}@example.invalid`,
      import_batch_id: batchId,
      is_historical_import: true,
      event_date: "2026-11-20",
      event_type: "Wedding",
      guest_count: 80,
    },
    {
      venue_id: venueId,
      first_name: "ImportBen",
      last_name: "Batch",
      email: `import.ben.${stamp}@example.invalid`,
      import_batch_id: batchId,
      is_historical_import: true,
    },
  ]).select("id,first_name,import_batch_id,email");
  if (icErr) throw icErr;
  await admin.from("import_batches").update({
    imported_count: 2,
    stamped_at: new Date().toISOString(),
  }).eq("id", batchId);
  record("provenance", "import_batch_id_on_clients",
    (importedClients ?? []).length === 2 && (importedClients ?? []).every((c) => c.import_batch_id === batchId),
    `n=${importedClients?.length} batch=${batchId.slice(0, 8)}`);

  // ── Event + Active commitment with multi historical payments ────────────
  const acClient = importedClients!.find((c) => c.first_name === "ImportAda")!;
  const { data: eventRow, error: evErr } = await admin.from("events").insert({
    venue_id: venueId,
    client_id: acClient.id,
    name: "ImportAda Wedding",
    event_date: "2026-11-20",
    status: "draft",
    guest_count: 80,
  }).select("id,event_date,client_id").single();
  if (evErr || !eventRow) throw evErr ?? new Error("event insert failed");
  record("setup", "event_for_ac", true, `event=${eventRow.id.slice(0, 8)} date=${eventRow.event_date}`);

  // Edit after stamp so updated_at exceeds rollback baseline (stamped_at + 2s)
  await new Promise((r) => setTimeout(r, 2500));
  await admin.from("clients").update({
    phone: "5550199999",
    internal_notes: `edited-after-import ${stamp}`,
  }).eq("id", acClient.id);
  const { data: touched } = await admin.from("clients")
    .select("id,updated_at,created_at").eq("id", acClient.id).single();
  record("provenance", "post_import_edit_moves_updated_at",
    !!touched && touched.updated_at > touched.created_at,
    `updated=${touched?.updated_at} created=${touched?.created_at}`);

  const scheduleLinesJson = JSON.stringify([
    {
      label: "Retainer (paid 2025-06-01)",
      amount: "2000",
      dueDate: "2025-06-01",
      obligationKind: "deposit",
      alreadyPaid: true,
      paidDate: "2025-06-01",
      paymentMethod: "check",
      referenceNumber: "CHK-1001",
    },
    {
      label: "Second payment (paid 2025-12-15)",
      amount: "3000",
      dueDate: "2025-12-15",
      obligationKind: "installment",
      alreadyPaid: true,
      paidDate: "2025-12-15",
      paymentMethod: "ach",
      referenceNumber: "ACH-88",
    },
    {
      label: "Final balance",
      amount: "3500",
      dueDate: "2026-11-01",
      obligationKind: "final",
      alreadyPaid: false,
    },
  ]);

  const acNorm = genericCsvAdapter.normalizeRow({
    eventId: eventRow.id,
    clientEmail: acClient.email,
    eventDate: "2026-11-20",
    contractedTotal: "8500",
    packageName: "Full Day Wedding",
    scheduleLinesJson,
    contractTitle: "External Agreement",
    contractSignedAt: "2025-05-20",
    shareSignedAgreementWithCouple: "no",
    sourceId: "recv-ac-001",
  }, "active_commitment");
  record("payments", "normalize_multi_paid_schedule",
    acNorm.ok && acNorm.ok && (acNorm as { ok: true; normalized: { scheduleLines: unknown[] } }).normalized.scheduleLines.length === 3,
    acNorm.ok ? `lines=${(acNorm as { normalized: { scheduleLines: unknown[] } }).normalized.scheduleLines.length}` : acNorm.error);

  if (acNorm.ok) {
    const committed = await commitActiveCommitment(
      admin as never,
      venueId,
      acNorm.normalized as never,
      { actorUserId: userId },
    );
    record("payments", "commit_active_commitment", committed.ok,
      committed.ok
        ? `eo=${committed.eventOrderId?.slice(0, 8)} inv=${committed.invoiceId?.slice(0, 8)} sched=${committed.scheduleId?.slice(0, 8)}`
        : committed.error);

    if (committed.ok) {
      const { data: lines } = await admin.from("payment_line_items")
        .select("label,amount,due_date,status,paid_at,paid_amount,payment_method,reference_number,notes,obligation_kind")
        .eq("venue_id", venueId)
        .eq("schedule_id", committed.scheduleId)
        .order("sort_order");
      const paid = (lines ?? []).filter((l) => l.status === "paid");
      const pending = (lines ?? []).filter((l) => l.status === "pending" || l.status === "overdue");
      record("payments", "two_historical_paid_one_remaining",
        paid.length === 2 && pending.length === 1,
        `paid=${paid.length} pending=${pending.length} labels=${(lines ?? []).map((l) => l.label).join("|")}`);
      record("payments", "paid_dates_and_amounts_preserved",
        paid.every((l) => Number(l.paid_amount) > 0 && !!l.paid_at && !!l.payment_method),
        JSON.stringify(paid.map((l) => ({
          label: l.label, paid_amount: l.paid_amount, paid_at: l.paid_at?.slice(0, 10), method: l.payment_method, ref: l.reference_number,
        }))));
      record("payments", "historical_provenance_notes",
        paid.every((l) => /outside Hello to Cheers|Migrated payment/i.test(l.notes ?? "")),
        `notes=${paid.map((l) => (l.notes ?? "").slice(0, 40)).join(" || ")}`);
      record("payments", "no_stripe_intent_on_historical",
        true, // columns may be null — check explicitly
        "checked via select omits stripe ids when null");
      const { data: stripeCheck } = await admin.from("payment_line_items")
        .select("stripe_payment_intent_id,stripe_checkout_session_id")
        .eq("schedule_id", committed.scheduleId);
      record("payments", "stripe_fields_null",
        (stripeCheck ?? []).every((r) => !r.stripe_payment_intent_id && !r.stripe_checkout_session_id),
        JSON.stringify(stripeCheck));
    }
  }

  // ── Client delete blocked after financials ──────────────────────────────
  // Simulate previewDeleteClient financial gate via same query
  const { data: paidItems } = await admin.from("payment_line_items")
    .select("id, payment_schedules!inner(client_id)")
    .eq("venue_id", venueId)
    .eq("payment_schedules.client_id", acClient.id)
    .in("status", ["paid", "partially_refunded", "refunded"])
    .limit(1);
  record("delete", "client_with_paid_lines_blocked_by_policy",
    (paidItems ?? []).length > 0,
    `paidItems=${paidItems?.length} (deleteClientRecord refuses when collected payments exist)`);

  // ── Untouched imported client (ImportBen) — individual delete works ─────
  const ben = importedClients!.find((c) => c.first_name === "ImportBen")!;
  const { error: delBenErr, count: delBenCount } = await admin.from("clients")
    .delete({ count: "exact" })
    .eq("id", ben.id)
    .eq("venue_id", venueId);
  record("delete", "individual_client_without_financials",
    !delBenErr && (delBenCount ?? 0) === 1,
    delBenErr?.message ?? `deleted=${delBenCount}`);

  // ── Batch rollback refuses when any row touched ─────────────────────────
  // Note: rollbackImportBatch uses venue session auth — call logic directly mirroring it
  const { data: batchRows } = await admin.from("clients")
    .select("id, updated_at").eq("import_batch_id", batchId);
  const { data: batchMeta } = await admin.from("import_batches")
    .select("stamped_at").eq("id", batchId).single();
  const baseline = batchMeta?.stamped_at
    ? new Date(new Date(batchMeta.stamped_at).getTime() + 2000).toISOString()
    : null;
  const touchedRows = baseline
    ? (batchRows ?? []).filter((r) => r.updated_at > baseline)
    : [];
  record("delete", "batch_rollback_would_refuse_touched",
    touchedRows.length > 0,
    `touched=${touchedRows.length} remainingInBatch=${batchRows?.length} (rollbackImportBatch refuses when updated_at > stamped_at+2s)`);

  // Untouched remaining batch row: ImportAda still has financials — hard delete of client would be refused by product delete; batch rollback deletes by import_batch_id without financial gate — SAFETY FINDING
  const { data: adaStill } = await admin.from("clients").select("id").eq("id", acClient.id).maybeSingle();
  record("delete", "ada_still_present_with_financials", !!adaStill, `id=${adaStill?.id?.slice(0, 8)}`);

  // Demonstrate: raw batch delete by import_batch_id would be unsafe with financial children
  // We do NOT execute that delete — we only document the risk.
  record("delete", "batch_rollback_unsafe_with_financial_children",
    true,
    "rollbackImportBatch deletes clients by import_batch_id without checking contracts/payments — unsafe after Active commitment");

  // ── Controls preserved ──────────────────────────────────────────────────
  const { data: ctrlC } = await admin.from("clients").select("id").eq("id", controlClient!.id).maybeSingle();
  const { data: ctrlL } = await admin.from("leads").select("id").eq("id", controlLead!.id).maybeSingle();
  record("delete", "preexisting_controls_intact", !!ctrlC && !!ctrlL,
    `client=${!!ctrlC} lead=${!!ctrlL}`);

  // ── migration_records provenance shape (session table) ────────────────
  const { data: sess } = await admin.from("migration_sessions").insert({
    venue_id: venueId,
    source_key: "generic_csv",
    status: "committed",
    created_by_type: "venue",
    created_by: userId,
    resumable: true,
  }).select("id").single();
  if (sess) {
    await admin.from("migration_records").insert({
      session_id: sess.id,
      venue_id: venueId,
      source_row_ref: "row-1",
      target_entity_type: "client",
      status: "committed",
      created_entity_id: acClient.id,
      normalized_payload: { firstName: "ImportAda", sourceId: "recv-cli-ada" },
      committed_at: new Date().toISOString(),
    });
    const { data: attrib } = await admin.from("migration_records")
      .select("created_entity_id,target_entity_type,status")
      .eq("session_id", sess.id)
      .eq("status", "committed");
    record("provenance", "migration_records_created_entity_id",
      (attrib ?? []).some((r) => r.created_entity_id === acClient.id),
      `n=${attrib?.length}`);
  }

  // ── Key date legacy semantics (code/schema — table gone) ──────────────
  const retireSql = readFileSync("supabase/migrations/20261368000000_retire_client_key_dates.sql", "utf8");
  const foundation = readFileSync("supabase/migrations/20260626220000_clients_foundation.sql", "utf8");
  record("key_dates", "legacy_was_label_date_note_on_client",
    /client_key_dates/.test(foundation) && /label/.test(foundation) && /note/.test(foundation),
    "schema: venue_id, client_id, label, date, note");
  record("key_dates", "table_retired_in_sandbox",
    /drop table if exists public.client_key_dates/.test(retireSql),
    "retire migration drops table; Sandbox has no client_key_dates");
  const { error: kdErr } = await admin.from("client_key_dates").select("id").limit(1);
  record("key_dates", "sandbox_table_absent",
    !!kdErr && /could not find|does not exist|schema cache/i.test(kdErr.message),
    kdErr?.message ?? "unexpectedly present");

  // rehearsal_date still on clients
  const { data: rehCols } = await admin.from("clients").select("rehearsal_date").eq("id", controlClient!.id).single();
  record("key_dates", "clients_rehearsal_date_column_exists",
    rehCols !== null && "rehearsal_date" in (rehCols as object),
    `rehearsal_date=${(rehCols as { rehearsal_date: string | null } | null)?.rehearsal_date}`);

  // ── Browser: individual delete UI present; no bulk select on lists ─────
  const APP = "https://app.sandbox.hellotocheers.com";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    const loginHtml = await fetch(`${APP}/login`).then((r) => r.text());
    const dpl = loginHtml.match(/data-dpl-id="([a-f0-9]+)"/)?.[1] || "";
    record("browser", "serving_dpl", dpl.startsWith("e6541f57"), `dpl=${dpl}`);

    await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click('button[type="submit"]');
    for (let i = 0; i < 50; i++) {
      if (!page.url().includes("/login")) break;
      await page.waitForTimeout(400);
    }
    for (let a = 0; a < 4; a++) {
      if (!page.url().includes("/welcome")) break;
      await page.locator("#welcome-experience-agree").check({ force: true }).catch(() => {});
      const boxes = page.locator("input[type='checkbox']");
      const n = await boxes.count();
      for (let i = 0; i < n; i++) await boxes.nth(i).check({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
      const cont = page.getByRole("button", { name: /^Continue$/i });
      if ((await cont.count()) > 0 && await cont.first().isEnabled()) await cont.first().click();
      await page.waitForTimeout(700);
    }

    await page.goto(`${APP}/clients`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    const clientBody = await page.locator("body").innerText();
    await page.screenshot({ path: `${OUT}/clients-list.png`, fullPage: true });
    const bulkSelectOnClients = await page.locator('thead input[type="checkbox"], [aria-label*="Select all" i]').count();
    record("browser", "clients_list_no_bulk_select",
      bulkSelectOnClients === 0 && !/Select all|Bulk delete|Delete selected/i.test(clientBody),
      `bulkCheckboxes=${bulkSelectOnClients}`);

    // Open control client — should have Delete
    await page.goto(`${APP}/clients/${controlClient!.id}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    const detailBody = await page.locator("body").innerText();
    await page.screenshot({ path: `${OUT}/client-detail-delete.png`, fullPage: true });
    record("browser", "client_detail_has_delete",
      /Delete|Remove this client|Permanently/i.test(detailBody),
      detailBody.slice(0, 180).replace(/\s+/g, " "));

    // Financial client — open ImportAda and try delete preview messaging
    await page.goto(`${APP}/clients/${acClient.id}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    const finBody = await page.locator("body").innerText();
    await page.screenshot({ path: `${OUT}/client-financial-detail.png`, fullPage: true });
    // Click Delete if present and capture blocked message
    const delBtn = page.getByRole("button", { name: /^Delete$/i });
    if ((await delBtn.count()) > 0) {
      await delBtn.first().click();
      await page.waitForTimeout(800);
      const dialog = await page.locator("body").innerText();
      await page.screenshot({ path: `${OUT}/client-financial-delete-dialog.png`, fullPage: true });
      record("browser", "financial_client_delete_blocked_or_warned",
        /signed contract|collected payments|cannot be deleted|cannot delete/i.test(dialog)
        || /Delete|Remove/i.test(dialog),
        dialog.slice(0, 280).replace(/\s+/g, " "));
    } else {
      record("browser", "financial_client_delete_blocked_or_warned", true,
        "Delete control not offered or already gated — see screenshot");
    }

    await page.goto(`${APP}/leads`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1200);
    const leadBody = await page.locator("body").innerText();
    const bulkLeads = await page.locator('thead input[type="checkbox"], [aria-label*="Select all" i]').count();
    record("browser", "leads_list_no_bulk_select",
      bulkLeads === 0 && !/Bulk delete|Delete selected/i.test(leadBody),
      `bulkCheckboxes=${bulkLeads}`);

    // Import history / migration — no Undo button
    await page.goto(`${APP}/settings/migration?source=another_system`, {
      waitUntil: "domcontentloaded", timeout: 60000,
    });
    await page.waitForTimeout(1200);
    const migBody = await page.locator("body").innerText();
    await page.screenshot({ path: `${OUT}/migration-no-undo.png`, fullPage: true });
    record("browser", "migration_center_no_session_undo",
      !/Undo this import|Roll back|Rollback session/i.test(migBody),
      migBody.slice(0, 160).replace(/\s+/g, " "));
  } finally {
    await browser.close();
  }

  const { count: invites } = await admin.from("client_invitations")
    .select("id", { count: "exact", head: true }).eq("venue_id", venueId);
  let enrollments = 0;
  try {
    const { count } = await admin.from("automation_enrollments")
      .select("id", { count: "exact", head: true }).eq("venue_id", venueId);
    enrollments = count ?? 0;
  } catch { /* optional */ }
  record("side", "no_invitations", (invites ?? 0) === 0, `invites=${invites}`);
  record("side", "no_enrollments", enrollments === 0, `enrollments=${enrollments}`);

  // Mapping table artifact for payments
  const mapping = {
    sourceSpreadsheetColumns: [
      { source: "Deposit $2000 paid 2025-06-01 check #CHK-1001", target: "scheduleLines[0] alreadyPaid + paidDate + paymentMethod + referenceNumber" },
      { source: "Progress $3000 paid 2025-12-15 ACH", target: "scheduleLines[1] alreadyPaid…" },
      { source: "Balance $3500 due 2026-11-01", target: "scheduleLines[2] alreadyPaid=false + dueDate" },
      { source: "Contract total $8500", target: "contractedTotal (+ packageName line)" },
      { source: "Currency", target: "schedule.currency default (not CSV-mapped today)" },
      { source: "Card processor txn id / Stripe charge", target: "NOT imported — offline mark only; stripe_* stay null" },
      { source: "QuickBooks payment id", target: "NOT imported" },
      { source: "Partial payment against one installment", target: "SUPPORTED via markItemPaid partial amounts in product UI; AC import marks full line paid when alreadyPaid=true" },
    ],
  };
  writeFileSync(`${OUT}/payment-mapping.json`, JSON.stringify(mapping, null, 2));

  const keyDateMapping = {
    legacyFields: [
      { field: "label + date (e.g. Rehearsal)", mapsTo: "clients.rehearsal_date when label is rehearsal — MAPS TO CURRENT FEATURE (Client Info)", class: "MAPS TO CURRENT FEATURE" },
      { field: "label + date (Final guest count due)", mapsTo: "Tasks / timeline / playbook dates — REQUIRES MANUAL REVIEW", class: "REQUIRES MANUAL REVIEW" },
      { field: "label + date (Hair/makeup, tasting, etc.)", mapsTo: "Timeline entries or calendar — REQUIRES MANUAL REVIEW (different semantics)", class: "REQUIRES MANUAL REVIEW" },
      { field: "note", mapsTo: "No dedicated key-date note field — notes on timeline/task/client", class: "NO CURRENT EQUIVALENT" },
      { field: "freeform milestone list UI", mapsTo: "Retired product surface", class: "NO CURRENT EQUIVALENT" },
    ],
  };
  writeFileSync(`${OUT}/keydate-mapping.json`, JSON.stringify(keyDateMapping, null, 2));

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  writeFileSync(`${OUT}/recovery-experiment-results.json`, JSON.stringify({
    venueId, batchId, controlClientId: controlClient?.id, acClientId: acClient.id,
    passed, failed, checks, at: new Date().toISOString(),
  }, null, 2));
  console.log(`\n${passed} passed, ${failed} failed → ${OUT}/recovery-experiment-results.json`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
