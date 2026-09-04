/**
 * Migration tour safety — proves the timezone-safe date resolution and the
 * unchanged native capacity/availability protections work together through
 * the real commit pipeline (addRows -> runDedupe -> commitSession), against
 * real Postgres and the real book_tour_for_migration RPC.
 */
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, it, type TestContext } from "node:test";

import { addRows, commitSession, runDedupe } from "@/lib/migration/service";
import * as repo from "@/lib/migration/repository";
import { withLocalDbSchemaLock } from "@/lib/test/local-db-schema-lock";
import { applyLocalMigrationFiles } from "@/lib/test/apply-local-migrations";

const LOCAL_DB = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_API = process.env.NEXT_PUBLIC_SUPABASE_URL
  ?? process.env.SUPABASE_URL
  ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Local dev DBs can drift from the migrations folder between resets — this
// test depends specifically on bring_business_cutover.sql's
// tour_appointments_enforce_availability (the version that skips the
// occupancy check for a completed/no_show INSERT), so it's re-applied here
// the same way other migration DB tests pin their own dependencies, rather
// than assuming ambient schema state.
const MIGRATIONS = [
  resolve("supabase/migrations/20261323000000_bring_business_cutover.sql"),
];

function applyMigrations(): void {
  applyLocalMigrationFiles(MIGRATIONS, { dbUrl: LOCAL_DB, alreadyHoldingLock: true });
}

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

describe("Migration tour safety — timezone-correct dates, no availability bypass", () => {
  it("resolves valid tours correctly, refuses unsafe dates, and keeps real capacity enforcement", async (t: TestContext) => {
    if (!localReady()) {
      t.skip("local Postgres is not running");
      return;
    }
    await withLocalDbSchemaLock(async () => {
      applyMigrations();
      const supabase = adminClient();
      const venueId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee11";
      const ownerId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee12";
      const lead1 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee13";
      const lead2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee14";
      const lead3 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee15";
      const lead4 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee16";
      const lead5 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee17";
      const lead6 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee18";

      psql(`delete from public.venues where id = '${venueId}'; delete from auth.users where id = '${ownerId}';`);
      const setup = psql(`
        insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at, confirmation_token, email_change,
          email_change_token_new, recovery_token
        ) values (
          '00000000-0000-0000-0000-000000000000', '${ownerId}', 'authenticated', 'authenticated',
          'tour-migration-safety-owner@example.test', crypt('not-a-login', gen_salt('bf')),
          now(), '{"provider":"email","providers":["email"]}', '{}',
          now(), now(), '', '', '', ''
        );
        insert into public.venues (id, owner_user_id, name, timezone)
        values ('${venueId}', '${ownerId}', 'Tour Migration Safety Venue', 'America/New_York');
        insert into public.leads (id, venue_id, first_name, last_name, email, status)
        values
          ('${lead1}', '${venueId}', 'Future', 'Tourer', 'future.tourer@example.com', 'new'),
          ('${lead2}', '${venueId}', 'Past', 'Tourer', 'past.tourer@example.com', 'new'),
          ('${lead3}', '${venueId}', 'Malformed', 'Datetourer', 'malformed.tourer@example.com', 'new'),
          ('${lead4}', '${venueId}', 'Ambiguous', 'Datetourer', 'ambiguous.tourer@example.com', 'new'),
          ('${lead5}', '${venueId}', 'Second', 'Futuretourer', 'second.future.tourer@example.com', 'new'),
          ('${lead6}', '${venueId}', 'Second', 'Pasttourer', 'second.past.tourer@example.com', 'new');
        insert into public.tour_availability_windows (venue_id, day_of_week, start_time, end_time)
        select '${venueId}', d, '00:00', '23:59' from generate_series(0, 6) as d;
      `);
      assert.equal(setup.status, 0, setup.stderr);

      const session = await repo.createSession(supabase as never, venueId, "generic_csv", "venue", ownerId, null);
      assert.ok(session);
      if (!session) return;

      await addRows(supabase as never, session, "tour", [
        { scheduledAt: "2027-06-12 14:00", leadEmail: "future.tourer@example.com", sourceId: "future-valid" },
        { scheduledAt: "2020-01-10 09:30", leadEmail: "past.tourer@example.com", sourceId: "past-valid" },
        { scheduledAt: "not-a-real-date", leadEmail: "malformed.tourer@example.com", sourceId: "malformed" },
        { scheduledAt: "2027-06-12", leadEmail: "ambiguous.tourer@example.com", sourceId: "ambiguous-no-time" },
        // Same instant as the first future tour — must conflict under real capacity enforcement.
        { scheduledAt: "2027-06-12 14:00", leadEmail: "second.future.tourer@example.com", sourceId: "future-conflict" },
        // Same instant as the past tour — must NOT conflict, since a completed/historical tour never occupies capacity.
        { scheduledAt: "2020-01-10 09:30", leadEmail: "second.past.tourer@example.com", sourceId: "past-no-conflict" },
      ]);
      await runDedupe(supabase as never, session);
      const outcome = await commitSession(supabase as never, session, ownerId);

      const records = await repo.listRecords(supabase as never, session.id);
      const bySource = new Map(records.map((r) => [(r.normalizedPayload as { sourceId?: string } | null)?.sourceId, r]));

      // --- Valid future tour: committed, scheduled, correct UTC instant ---
      const futureValid = bySource.get("future-valid");
      assert.equal(futureValid?.status, "committed");
      const { data: futureRow } = await supabase.from("tour_appointments")
        .select("status, scheduled_at").eq("id", futureValid!.createdEntityId!).maybeSingle();
      assert.equal((futureRow as { status: string })?.status, "scheduled");
      assert.equal((futureRow as { scheduled_at: string })?.scheduled_at, "2027-06-12T18:00:00+00:00");

      // --- Valid past tour: committed, completed, no live capacity consumed ---
      const pastValid = bySource.get("past-valid");
      assert.equal(pastValid?.status, "committed");
      const { data: pastRow } = await supabase.from("tour_appointments")
        .select("status, scheduled_at").eq("id", pastValid!.createdEntityId!).maybeSingle();
      assert.equal((pastRow as { status: string })?.status, "completed");

      // --- Malformed date: never reaches the RPC, never becomes any tour row, durable needs_review ---
      const malformed = bySource.get("malformed");
      assert.equal(malformed?.status, "needs_review");
      assert.equal(malformed?.createdEntityId, null);
      assert.match(malformed?.validationErrors?.[0] ?? "", /ambiguous or malformed/);

      // --- Ambiguous (no time component): same treatment, never guessed ---
      const ambiguous = bySource.get("ambiguous-no-time");
      assert.equal(ambiguous?.status, "needs_review");
      assert.equal(ambiguous?.createdEntityId, null);

      // --- Future tour capacity is still enforced: a second tour at the identical live instant conflicts ---
      const futureConflict = bySource.get("future-conflict");
      assert.equal(futureConflict?.status, "needs_review", "a genuinely conflicting future tour must not commit");
      assert.match(futureConflict?.validationErrors?.[0] ?? "", /not available/i);

      // --- Past tours never consume capacity: an identical-instant second PAST tour does not conflict ---
      const pastNoConflict = bySource.get("past-no-conflict");
      assert.equal(pastNoConflict?.status, "committed", "two historical tours at the same instant must not conflict — neither occupies live capacity");

      assert.equal(outcome.committed, 3);
      assert.equal(outcome.failed, 3);

      psql(`delete from public.venues where id = '${venueId}'; delete from auth.users where id = '${ownerId}';`);
    });
  });
});
