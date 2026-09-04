/**
 * In-batch duplicate detection — dedupe previously only ever checked
 * live/committed data, so two identical rows in the SAME source file (no
 * prior committed record for either) both sailed through as "validated"
 * and would both commit as separate canonical records. This proves the
 * fix: a later sibling row with the same identity signal as an earlier,
 * still-uncommitted row in the same session is flagged durable
 * needs-review (duplicate_likely), never silently discarded, never
 * auto-skipped (that's reserved for a real live/committed match).
 */
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { describe, it, type TestContext } from "node:test";

import { addRows, runDedupe } from "@/lib/migration/service";
import * as repo from "@/lib/migration/repository";
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

describe("In-batch duplicate detection (clients, events, retry safety)", () => {
  it("flags duplicate clients/events within one file, leaves distinct rows alone, and stays correct across a rerun", async (t: TestContext) => {
    if (!localReady()) {
      t.skip("local Postgres is not running");
      return;
    }
    await withLocalDbSchemaLock(async () => {
      const supabase = adminClient();
      const venueId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeef1";
      const ownerId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeef2";

      psql(`delete from public.venues where id = '${venueId}'; delete from auth.users where id = '${ownerId}';`);
      const setup = psql(`
        insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at, confirmation_token, email_change,
          email_change_token_new, recovery_token
        ) values (
          '00000000-0000-0000-0000-000000000000', '${ownerId}', 'authenticated', 'authenticated',
          'in-batch-dedupe-owner@example.test', crypt('not-a-login', gen_salt('bf')),
          now(), '{"provider":"email","providers":["email"]}', '{}',
          now(), now(), '', '', '', ''
        );
        insert into public.venues (id, owner_user_id, name, timezone)
        values ('${venueId}', '${ownerId}', 'In-Batch Dedupe Venue', 'America/New_York');
      `);
      assert.equal(setup.status, 0, setup.stderr);

      const session = await repo.createSession(supabase as never, venueId, "generic_csv", "venue", ownerId, null);
      assert.ok(session);
      if (!session) return;

      // --- Two identical client rows, one genuinely different, in one file ---
      await addRows(supabase as never, session, "client", [
        { firstName: "Jordan", lastName: "Reed", email: "jordan.reed@example.com" },
        { firstName: "Jordan", lastName: "Reed", email: "jordan.reed@example.com" },
        { firstName: "Sam", lastName: "Lee", email: "sam.lee@example.com" },
      ]);
      await runDedupe(supabase as never, session);

      const afterFirstPass = await repo.listRecords(supabase as never, session.id);
      const clientRecords = afterFirstPass.filter((r) => r.targetEntityType === "client")
        .sort((a, b) => (a.sourceRowRef ?? "").localeCompare(b.sourceRowRef ?? ""));
      const [row1, row2, row3] = clientRecords;

      assert.equal(row1.status, "validated", "the first Jordan Reed row commits normally");
      assert.equal(row2.status, "duplicate_likely", "the second, identical Jordan Reed row must not also validate");
      assert.match(row2.validationErrors?.[0] ?? "", /duplicate of row 1/i);
      assert.equal(row2.matchedEntityId, null, "no canonical entity exists yet for either row");
      assert.equal(row3.status, "validated", "a genuinely different person is untouched");

      // --- Two identical event rows for the same (not-yet-existing) client ---
      await addRows(supabase as never, session, "event", [
        { clientEmail: "taylor@example.com", eventDate: "2027-06-12", name: "Taylor Wedding" },
        { clientEmail: "taylor@example.com", eventDate: "2027-06-12", name: "Taylor Wedding (dup)" },
        { clientEmail: "taylor@example.com", eventDate: "2027-09-01", name: "Taylor Rehearsal Dinner" },
      ]);
      await runDedupe(supabase as never, session);

      const afterSecondPass = await repo.listRecords(supabase as never, session.id);
      const eventRecords = afterSecondPass.filter((r) => r.targetEntityType === "event")
        .sort((a, b) => (a.sourceRowRef ?? "").localeCompare(b.sourceRowRef ?? ""));
      const [ev1, ev2, ev3] = eventRecords;
      assert.equal(ev1.status, "validated");
      assert.equal(ev2.status, "duplicate_likely", "same client + same event date in one file must be flagged");
      assert.match(ev2.validationErrors?.[0] ?? "", /duplicate of/i);
      assert.equal(ev3.status, "validated", "a different date for the same couple is a genuinely different event");

      // --- Idempotent rerun: calling runDedupe again with nothing new added must not reprocess or flip any status ---
      await runDedupe(supabase as never, session);
      const afterRerun = await repo.listRecords(supabase as never, session.id);
      const statusesById = new Map(afterRerun.map((r) => [r.id, r.status]));
      for (const r of [...clientRecords, ...eventRecords]) {
        assert.equal(statusesById.get(r.id), r.status, `rerun must not change status of ${r.sourceRowRef}`);
      }

      // --- Cross-call detection: a new row added in a LATER batch must still be caught against an earlier, already-validated sibling ---
      await addRows(supabase as never, session, "client", [
        { firstName: "Jordan", lastName: "Reed", email: "jordan.reed@example.com" },
      ]);
      await runDedupe(supabase as never, session);
      const afterThirdBatch = await repo.listRecords(supabase as never, session.id);
      const lateJordan = afterThirdBatch.find((r) => r.targetEntityType === "client" && !clientRecords.some((c) => c.id === r.id));
      assert.ok(lateJordan);
      assert.equal(lateJordan?.status, "duplicate_likely", "a duplicate added in a later batch must still be caught against the earlier validated row");

      psql(`delete from public.venues where id = '${venueId}'; delete from auth.users where id = '${ownerId}';`);
    });
  });
});
