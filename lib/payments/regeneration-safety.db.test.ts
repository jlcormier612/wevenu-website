/**
 * Payment schedule regeneration safety — "Regenerate Schedule" must only
 * ever clear pending/overdue installments. Anything already collected,
 * refunded, or explicitly cancelled is a real, permanent decision and must
 * survive a regenerate untouched (lib/payments/repository.ts's
 * deleteUnresolvedLineItems is the exact function regeneratePaymentSchedule
 * calls for this — exercised directly here against real Postgres since the
 * service layer itself requires an authenticated request context).
 */
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { describe, it, type TestContext } from "node:test";

import * as repo from "@/lib/payments/repository";
import { withLocalDbSchemaLock } from "@/lib/test/local-db-schema-lock";

const LOCAL_DB = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_API = process.env.NEXT_PUBLIC_SUPABASE_URL
  ?? process.env.SUPABASE_URL
  ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

function psql(sql: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("psql", [LOCAL_DB, "-v", "ON_ERROR_STOP=1", "-c", sql], {
    encoding: "utf8",
    timeout: 30_000,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function localReady(): boolean {
  return spawnSync("psql", [LOCAL_DB, "-c", "select 1"], { encoding: "utf8", timeout: 3000 }).status === 0;
}

function adminClient(): SupabaseClient {
  return createClient(LOCAL_API, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe("Regenerate Schedule — paid/cancelled survive, only pending/overdue are cleared", () => {
  it("deleteUnresolvedLineItems preserves collected/cancelled lines and removes only pending/overdue ones", async (t: TestContext) => {
    if (!localReady()) {
      t.skip("local Postgres is not running");
      return;
    }
    await withLocalDbSchemaLock(async () => {
      const supabase = adminClient();
      const venueId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeed1";
      const ownerId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeed2";
      const clientId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeed3";
      const eventId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeed4";
      const invoiceId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeed5";

      psql(`delete from public.venues where id = '${venueId}'; delete from auth.users where id = '${ownerId}';`);
      const setup = psql(`
        insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at, confirmation_token, email_change,
          email_change_token_new, recovery_token
        ) values (
          '00000000-0000-0000-0000-000000000000', '${ownerId}', 'authenticated', 'authenticated',
          'regen-safety-owner@example.test', crypt('not-a-login', gen_salt('bf')),
          now(), '{"provider":"email","providers":["email"]}', '{}',
          now(), now(), '', '', '', ''
        );
        insert into public.venues (id, owner_user_id, name, timezone)
        values ('${venueId}', '${ownerId}', 'Regen Safety Venue', 'America/New_York');
        insert into public.clients (id, venue_id, first_name, last_name, email, status)
        values ('${clientId}', '${venueId}', 'Taylor', 'Reed', 'regen-safety@example.com', 'confirmed');
        insert into public.events (id, venue_id, client_id, name, event_date, guest_count, status)
        values ('${eventId}', '${venueId}', '${clientId}', 'Reed Wedding', '2027-06-12', 100, 'confirmed');
        insert into public.invoices (id, venue_id, client_id, event_id, invoice_number, status, total, balance_due)
        values ('${invoiceId}', '${venueId}', '${clientId}', '${eventId}', 'INV-REGEN-SAFETY-1', 'sent', 1000, 700);
      `);
      assert.equal(setup.status, 0, setup.stderr);

      const scheduleId = await repo.insertSchedule(supabase as never, venueId, {
        title: "Regen safety schedule", clientId, eventId, totalAmount: 1000, notes: "", invoiceId,
      });

      const paid = await repo.insertLineItem(supabase as never, venueId, scheduleId, {
        label: "Initial Payment", amount: "300", dueDate: "2026-06-01", obligationKind: "deposit",
      }, 0);
      const cancelled = await repo.insertLineItem(supabase as never, venueId, scheduleId, {
        label: "Cancelled Add-on", amount: "50", dueDate: "2026-07-01", obligationKind: "other",
      }, 1);
      const pending = await repo.insertLineItem(supabase as never, venueId, scheduleId, {
        label: "Planning Payment", amount: "350", dueDate: "2027-04-12", obligationKind: "installment",
      }, 2);
      const overdue = await repo.insertLineItem(supabase as never, venueId, scheduleId, {
        label: "Final Payment", amount: "300", dueDate: "2027-05-12", obligationKind: "final",
      }, 3);

      const marked = await repo.markItemPaid(supabase as never, venueId, paid.id, {
        paidAmount: "300", paidDate: "2026-06-01", paymentMethod: "stripe", referenceNumber: "", notes: "",
      });
      assert.equal(marked.ok, true);
      await (supabase.from("payment_line_items") as never as { update: (p: object) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<unknown> } } })
        .update({ status: "cancelled" }).eq("id", cancelled.id).eq("venue_id", venueId);
      await (supabase.from("payment_line_items") as never as { update: (p: object) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<unknown> } } })
        .update({ status: "overdue" }).eq("id", overdue.id).eq("venue_id", venueId);

      await repo.deleteUnresolvedLineItems(supabase as never, venueId, scheduleId);

      const { data: remaining } = await supabase.from("payment_line_items")
        .select("id, status, paid_amount, paid_at")
        .eq("schedule_id", scheduleId)
        .order("sort_order", { ascending: true });
      const remainingIds = (remaining ?? []).map((r) => (r as { id: string }).id);

      assert.ok(remainingIds.includes(paid.id), "the paid line must survive regeneration untouched");
      assert.ok(remainingIds.includes(cancelled.id), "the cancelled line must survive regeneration untouched");
      assert.ok(!remainingIds.includes(pending.id), "the pending line must be cleared by regeneration");
      assert.ok(!remainingIds.includes(overdue.id), "the overdue line must be cleared by regeneration");
      assert.equal(remainingIds.length, 2);

      const paidRow = (remaining ?? []).find((r) => (r as { id: string }).id === paid.id) as { paid_amount: string | number } | undefined;
      assert.equal(Number(paidRow?.paid_amount), 300, "the paid amount must not be altered by regeneration");

      // Regenerate's second half — new pending installments coexist with the untouched historical lines.
      const replacement = await repo.insertLineItem(supabase as never, venueId, scheduleId, {
        label: "Regenerated Planning Payment", amount: "400", dueDate: "2027-04-30", obligationKind: "installment",
      }, 2);
      const { count: finalCount } = await supabase.from("payment_line_items")
        .select("id", { count: "exact", head: true }).eq("schedule_id", scheduleId);
      assert.equal(finalCount, 3, "paid + cancelled + one freshly regenerated pending line");
      assert.ok(replacement.id);

      psql(`delete from public.venues where id = '${venueId}'; delete from auth.users where id = '${ownerId}';`);
    });
  });
});
