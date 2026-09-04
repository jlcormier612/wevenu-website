/**
 * Full-stack Smith Wedding acceptance — calls commitActiveCommitment against
 * local Supabase (service role), uploads a retained signed file through the
 * same documents bucket the primary Smart Import path uses, then asserts
 * venue financial state + couple portal RPCs + idempotency + compensation.
 */
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, type TestContext } from "node:test";

import {
  commitActiveCommitment,
  HISTORICAL_PAYMENT_PROVENANCE,
  type NormalizedActiveCommitment,
} from "@/lib/migration/active-commitment";
import { shareExternallyExecutedAgreementWithCouple } from "@/lib/contracts/external-share";
import { extractTextFromCommitmentFile } from "@/lib/migration/smart-extract";
import { applyLocalMigrationFiles } from "@/lib/test/apply-local-migrations";
import { withLocalDbSchemaLock } from "@/lib/test/local-db-schema-lock";

const LOCAL_DB = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_API = process.env.NEXT_PUBLIC_SUPABASE_URL
  ?? process.env.SUPABASE_URL
  ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  // Local `supabase start` demo service-role JWT (safe; not a cloud secret).
  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const MIGRATION_PORTAL = resolve("supabase/migrations/20261325000000_active_commitment_portal_share.sql");
const MIGRATION = resolve("supabase/migrations/20261324000000_active_financial_cutover.sql");
const MIGRATION_BOOKED_AT = resolve("supabase/migrations/20261328000000_event_booked_at.sql");

function psql(sql: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("psql", [LOCAL_DB, "-v", "ON_ERROR_STOP=1", "-c", sql], {
    encoding: "utf8",
    timeout: 30_000,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function localReady(): boolean {
  const probe = spawnSync("psql", [LOCAL_DB, "-c", "select 1"], { encoding: "utf8", timeout: 3000 });
  return probe.status === 0;
}

function applyMigration(): void {
  applyLocalMigrationFiles([MIGRATION, MIGRATION_PORTAL, MIGRATION_BOOKED_AT], {
    dbUrl: LOCAL_DB,
    alreadyHoldingLock: true,
  });
}

function adminClient(): SupabaseClient {
  return createClient(LOCAL_API, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const smithCommitment = (
  eventId: string,
  doc: NormalizedActiveCommitment["documents"],
  share = true,
): NormalizedActiveCommitment => ({
  eventId,
  contractedTotal: "18500",
  packageName: "Full Service Wedding",
  lines: [{ description: "Full Service Wedding", quantity: "1", unitPrice: "18500" }],
  scheduleLines: [
    {
      label: "Deposit",
      amount: "5000",
      dueDate: "2026-06-01",
      obligationKind: "deposit",
      alreadyPaid: true,
      paidDate: "2026-06-01",
      paymentMethod: "other",
    },
    {
      label: "Second payment",
      amount: "5000",
      dueDate: "2026-09-15",
      obligationKind: "installment",
      alreadyPaid: false,
    },
    {
      label: "Final payment",
      amount: "8500",
      dueDate: "2026-10-01",
      obligationKind: "final",
      alreadyPaid: false,
    },
  ],
  contractTitle: "Smith Wedding Agreement",
  contractContent: "Externally executed Full Service Wedding agreement for $18,500.",
  contractSignedAt: "2026-05-20",
  contractSignerName: "Alex Smith",
  documents: doc,
  shareSignedAgreementWithCouple: share,
  sourceId: "smith-wedding-active-1",
});

describe("Smith Wedding full-stack commit + portal acceptance", () => {
  it("commits via canonical path with retained file, portal share, idempotency, and compensation", async (t: TestContext) => {
    if (!localReady()) {
      t.skip("local Postgres is not running");
      return;
    }
    await withLocalDbSchemaLock(async () => {
    applyMigration();
    const supabase = adminClient();

    const venueId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeea1";
    const ownerId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeea2";
    const cleanup = psql(`
      delete from public.venues where id = '${venueId}';
      delete from auth.users where id = '${ownerId}';
    `);
    assert.equal(cleanup.status, 0, cleanup.stderr);

    const clientId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeea3";
    const eventId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeea4";
    const setup = psql(`
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change,
        email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000', '${ownerId}', 'authenticated', 'authenticated',
        'smith-fullstack-owner@example.test', crypt('not-a-login', gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}', '{}',
        now(), now(), '', '', '', ''
      );
      insert into public.venues (id, owner_user_id, name, timezone)
      values ('${venueId}', '${ownerId}', 'Smith Fullstack Venue', 'America/New_York');
      insert into public.clients (
        id, venue_id, first_name, last_name, email, status
      ) values (
        '${clientId}', '${venueId}', 'Alex', 'Smith', 'smith-fullstack@example.com', 'confirmed'
      );
      insert into public.events (
        id, venue_id, client_id, name, event_date, guest_count, status
      ) values (
        '${eventId}', '${venueId}', '${clientId}', 'Smith Wedding', '2026-10-17', 150, 'confirmed'
      );
    `);
    assert.equal(setup.status, 0, setup.stderr);

    const event = { id: eventId, name: "Smith Wedding", event_date: "2026-10-17", status: "confirmed", client_id: clientId };
    assert.equal(event.name, "Smith Wedding");
    assert.equal(event.status, "confirmed");
    assert.equal(event.client_id, clientId);

    // Primary workflow: extract text from a real .txt stand-in for signed agreement,
    // retain file in documents bucket (same path shape Smart Import uses).
    const sourceBytes = Buffer.from(
      "Smith Wedding Agreement\nFull Service Wedding\nContracted total $18,500\nDeposit $5,000 paid June 1 2026\nDue Sep 15 $5,000\nDue Oct 1 $8,500\nSigned May 20 2026 Alex Smith\n",
      "utf8",
    );
    const extracted = await extractTextFromCommitmentFile(sourceBytes, "smith-signed.txt");
    assert.equal(extracted.ok, true);
    if (!extracted.ok) return;

    const storagePath = `${venueId}/migration/active-commitment/smith-fullstack-signed.txt`;
    await supabase.storage.from("documents").remove([storagePath]);
    const { error: uploadErr } = await supabase.storage.from("documents").upload(storagePath, sourceBytes, {
      contentType: "text/plain",
      upsert: true,
    });
    assert.ifError(uploadErr);
    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);

    const retainedDoc = {
      name: "Smith Wedding Agreement",
      fileName: "smith-signed.txt",
      storagePath,
      storageUrl: urlData.publicUrl,
      mimeType: "text/plain",
      fileSize: sourceBytes.length,
      category: "contract" as const,
      notes: "Original signed agreement retained from Smart Import.",
      entityType: "event" as const,
    };

    // Failure safety: mid-commit after invoice must not leave orphans.
    const failed = await commitActiveCommitment(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      venueId,
      smithCommitment(event.id, [retainedDoc]),
      { failAfter: "invoice" },
    );
    assert.equal(failed.ok, false);
    if (!failed.ok) assert.match(failed.error, /TEST_FAIL_AFTER_invoice/);

    const { count: orphanInvoices } = await supabase.from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId).eq("event_id", event.id);
    assert.equal(orphanInvoices ?? 0, 0, "compensating cleanup must remove invoice after mid-commit failure");

    const { count: orphanOrders } = await supabase.from("event_orders")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId).eq("event_id", event.id);
    assert.equal(orphanOrders ?? 0, 0, "compensating cleanup must remove event order after mid-commit failure");

    // Successful commit — private until explicit share (venue ops still see sent invoice).
    const committed = await commitActiveCommitment(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      venueId,
      smithCommitment(event.id, [retainedDoc], false),
    );
    assert.equal(committed.ok, true);
    if (!committed.ok) return;

    // 1–6, 11 — venue financial + native Event/Client
    const order = await supabase.from("event_orders")
      .select("id, status, shared_at").eq("id", committed.eventOrderId).single();
    assert.ifError(order.error);
    assert.equal((order.data as { status: string }).status, "open");
    assert.equal((order.data as { shared_at: string | null }).shared_at, null);

    const eventBooked = await supabase.from("events")
      .select("booked_at").eq("id", eventId).single();
    assert.ifError(eventBooked.error);
    // contractSignedAt alone must not become booked_at
    assert.equal((eventBooked.data as { booked_at: string | null }).booked_at, null);

    const { data: lines } = await supabase.from("event_order_lines")
      .select("description, amount").eq("event_order_id", committed.eventOrderId);
    assert.equal((lines ?? []).length, 1);
    assert.equal(Number((lines![0] as { amount: number }).amount), 18500);
    assert.equal((lines![0] as { description: string }).description, "Full Service Wedding");

    const invoiceRes = await supabase.from("invoices")
      .select("total, balance_due, status, is_couple_visible").eq("id", committed.invoiceId).single();
    assert.ifError(invoiceRes.error);
    const invoice = invoiceRes.data as { total: number; balance_due: number; status: string; is_couple_visible: boolean };
    assert.equal(Number(invoice.total), 18500);
    assert.equal(Number(invoice.balance_due), 13500);
    assert.equal(invoice.status, "sent");
    assert.equal(invoice.is_couple_visible, false);

    const { data: payLines } = await supabase.from("payment_line_items")
      .select("label, amount, due_date, status, notes, payment_method")
      .eq("schedule_id", committed.scheduleId)
      .order("sort_order");
    assert.equal((payLines ?? []).length, 3);
    const paid = (payLines as { status: string; notes: string | null; amount: number; due_date: string | null }[])
      .find((l) => l.status === "paid");
    assert.ok(paid);
    assert.equal(Number(paid!.amount), 5000);
    assert.match(paid!.notes ?? "", /outside Hello to Cheers/i);
    assert.match(HISTORICAL_PAYMENT_PROVENANCE, /outside Hello to Cheers/);
    const pending = (payLines as { status: string; amount: number; due_date: string | null }[])
      .filter((l) => l.status === "pending");
    assert.equal(pending.length, 2);
    assert.deepEqual(
      pending.map((l) => ({ amount: Number(l.amount), due: l.due_date })).sort((a, b) => (a.due ?? "").localeCompare(b.due ?? "")),
      [
        { amount: 5000, due: "2026-09-15" },
        { amount: 8500, due: "2026-10-01" },
      ],
    );

    // 7 — original agreement attached as real Event document
    assert.ok(committed.documentIds.length >= 1);
    const docRes = await supabase.from("documents")
      .select("id, event_id, category, file_name, storage_path, is_couple_visible")
      .eq("id", committed.documentIds[0]).single();
    assert.ifError(docRes.error);
    const doc = docRes.data as {
      event_id: string; category: string; file_name: string; storage_path: string; is_couple_visible: boolean;
    };
    assert.equal(doc.event_id, event.id);
    assert.equal(doc.category, "contract");
    assert.equal(doc.file_name, "smith-signed.txt");
    assert.equal(doc.storage_path, storagePath);
    assert.equal(doc.is_couple_visible, false);

    // External contract, no fabricated signers
    assert.ok(committed.contractId);
    const contractRes = await supabase.from("contracts")
      .select("status, execution_origin, is_couple_visible, title")
      .eq("id", committed.contractId!).single();
    assert.ifError(contractRes.error);
    const contract = contractRes.data as { status: string; execution_origin: string; is_couple_visible: boolean };
    assert.equal(contract.status, "signed");
    assert.equal(contract.execution_origin, "external");
    assert.equal(contract.is_couple_visible, false);
    const { count: signerCount } = await supabase.from("contract_signers")
      .select("id", { count: "exact", head: true })
      .eq("contract_id", committed.contractId!);
    assert.equal(signerCount ?? 0, 0);

    // 8–9 couple portal — private until share
    const token = "smith-fullstack-portal-token-0001";
    const portalSetup = psql(`
      delete from public.client_portal_sessions where access_token = '${token}';
      insert into public.client_portal_sessions (
        venue_id, client_id, event_id, access_token, access_level, expires_at
      ) values (
        '${venueId}', '${clientId}', '${eventId}', '${token}', 'couple', now() + interval '30 days'
      );
    `);
    assert.equal(portalSetup.status, 0, portalSetup.stderr);

    const { data: privatePayments, error: privatePayErr } = await supabase.rpc("get_portal_payments", { p_token: token });
    assert.ifError(privatePayErr);
    assert.equal(((privatePayments as { schedules: unknown[] }).schedules ?? []).length, 0);

    const { data: privateDocs, error: privateDocsErr } = await supabase.rpc("get_couple_documents", { p_token: token });
    assert.ifError(privateDocsErr);
    assert.equal(
      JSON.stringify(privateDocs).includes(committed.contractId!),
      false,
      "unshared external agreement must not appear in couple documents",
    );

    const shared = await shareExternallyExecutedAgreementWithCouple(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      venueId,
      {
        contractId: committed.contractId!,
        documentIds: committed.documentIds,
        invoiceId: committed.invoiceId,
      },
    );
    assert.equal(shared.ok, true);

    const { data: portalPayments, error: payRpcErr } = await supabase.rpc("get_portal_payments", { p_token: token });
    assert.ifError(payRpcErr);
    const schedules = (portalPayments as { schedules: unknown[] }).schedules;
    assert.ok(Array.isArray(schedules) && schedules.length >= 1);
    const schedule = schedules[0] as { totalAmount: number; lineItems: { status: string; amount: number }[] };
    assert.equal(Number(schedule.totalAmount), 18500);
    assert.ok(schedule.lineItems.some((l) => l.status === "paid" && Number(l.amount) === 5000));
    assert.ok(schedule.lineItems.filter((l) => l.status === "pending").length === 2);

    const { data: coupleDocs, error: docsRpcErr } = await supabase.rpc("get_couple_documents", { p_token: token });
    assert.ifError(docsRpcErr);
    const docsArr = (coupleDocs as { documents: { id: string; name: string; fileUrl: string | null; docType: string }[] }).documents;
    const contractDoc = docsArr.find((d) => d.id === committed.contractId);
    assert.ok(contractDoc, "couple portal must surface the shared agreement");
    assert.match(contractDoc!.name, /Smith Wedding Agreement/);
    assert.ok(contractDoc!.fileUrl, "signed file must be reachable via contract fileUrl");
    assert.match(contractDoc!.fileUrl!, /smith-fullstack-signed/);

    // 12 — idempotent retry does not duplicate
    const again = await commitActiveCommitment(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      venueId,
      smithCommitment(event.id, [retainedDoc]),
    );
    assert.equal(again.ok, true);
    if (again.ok) assert.equal(again.alreadyCommitted, true);

    const { count: orderCount } = await supabase.from("event_orders")
      .select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("venue_id", venueId);
    const { count: invoiceCount } = await supabase.from("invoices")
      .select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("venue_id", venueId).neq("status", "void");
    const { count: scheduleCount } = await supabase.from("payment_schedules")
      .select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("venue_id", venueId);
    const { count: contractCount } = await supabase.from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id).eq("execution_origin", "external").eq("status", "signed");
    const { count: docCount } = await supabase.from("documents")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id).eq("storage_path", storagePath);
    assert.equal(orderCount, 1);
    assert.equal(invoiceCount, 1);
    assert.equal(scheduleCount, 1);
    assert.equal(contractCount, 1);
    assert.equal(docCount, 1);

    // Cleanup fixture venue
    psql(`delete from public.venues where id = '${venueId}'; delete from auth.users where id = '${ownerId}';`);
    });
  });
});

describe("Smart Import file extract (primary workflow prerequisite)", () => {
  it("extracts text from txt and rejects unsupported types clearly", async () => {
    const ok = await extractTextFromCommitmentFile(Buffer.from("total $100"), "agreement.txt");
    assert.equal(ok.ok, true);
    const bad = await extractTextFromCommitmentFile(Buffer.from("x"), "agreement.xlsx");
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.match(bad.message, /PDF|DOCX/i);
  });
});
