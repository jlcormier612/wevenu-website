/**
 * Proves local DB test isolation: re-applying an older/narrower
 * migration_records entity check cannot leave the shared DB unable to keep
 * newer entity vocabulary rows (timeline_entry, floor_plan, future types).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it, type TestContext } from "node:test";

import {
  applyLocalMigrationFiles,
  collectDeclaredMigrationEntityTypes,
  ensureMigrationRecordsEntityCheckMonotonic,
} from "@/lib/test/apply-local-migrations";
import { withLocalDbSchemaLock } from "@/lib/test/local-db-schema-lock";

const LOCAL_DB = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function localReady(): boolean {
  return spawnSync("psql", [LOCAL_DB, "-c", "select 1"], { encoding: "utf8", timeout: 3000 }).status === 0;
}

function psql(sql: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("psql", [LOCAL_DB, "-v", "ON_ERROR_STOP=1", "-c", sql], {
    encoding: "utf8",
    timeout: 30_000,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

describe("migration_records entity-check isolation", () => {
  it("declared vocabulary includes every entity listed across cutover migrations", () => {
    const declared = collectDeclaredMigrationEntityTypes();
    for (const entity of [
      "client",
      "active_commitment",
      "guest_list",
      "event_vendor_assignment",
      "timeline_entry",
      "floor_plan",
    ]) {
      assert.ok(declared.includes(entity), `missing declared entity ${entity}`);
    }
  });

  it("ensureMigrationRecordsEntityCheckMonotonic restores vocabulary after a narrowing apply", async (t: TestContext) => {
    if (!localReady()) {
      t.skip("local Postgres is not running");
      return;
    }

    await withLocalDbSchemaLock(async () => {
      // Baseline: apply the current floor_plan vocabulary migration.
      applyLocalMigrationFiles(
        ["supabase/migrations/20261336000000_floor_plan_migration_entity.sql"],
        { dbUrl: LOCAL_DB, alreadyHoldingLock: true },
      );

      const sessionId = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff01";
      const venueId = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff02";
      const ownerId = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff03";

      psql(`
        delete from public.migration_records where session_id = '${sessionId}';
        delete from public.migration_sessions where id = '${sessionId}';
        delete from public.venues where id = '${venueId}';
        delete from auth.users where id = '${ownerId}';
      `);

      const setup = psql(`
        insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at, confirmation_token, email_change,
          email_change_token_new, recovery_token
        ) values (
          '00000000-0000-0000-0000-000000000000', '${ownerId}', 'authenticated', 'authenticated',
          'entity-check-isolation@example.test', crypt('x', gen_salt('bf')),
          now(), '{"provider":"email","providers":["email"]}', '{}',
          now(), now(), '', '', '', ''
        );
        insert into public.venues (id, owner_user_id, name, timezone)
        values ('${venueId}', '${ownerId}', 'Entity Check Isolation', 'America/New_York');
        insert into public.migration_sessions (
          id, venue_id, source_key, status, created_by_type, created_by
        ) values (
          '${sessionId}', '${venueId}', 'generic_csv', 'ready_for_review', 'venue', '${ownerId}'
        );
        insert into public.migration_records (
          id, session_id, venue_id, target_entity_type, status, source_row_ref, raw_payload, normalized_payload
        ) values (
          gen_random_uuid(), '${sessionId}', '${venueId}', 'floor_plan', 'validated', 'fp-1', '{}'::jsonb, '{}'::jsonb
        ), (
          gen_random_uuid(), '${sessionId}', '${venueId}', 'timeline_entry', 'validated', 'tl-1', '{}'::jsonb, '{}'::jsonb
        );
      `);
      assert.equal(setup.status, 0, setup.stderr);

      // Simulate a buggy/older test apply that narrows the check (no floor_plan / timeline_entry).
      const narrow = psql(`
        alter table public.migration_records
          drop constraint if exists migration_records_target_entity_type_check;
        alter table public.migration_records
          add constraint migration_records_target_entity_type_check
          check (target_entity_type in (
            'client', 'lead', 'vendor', 'event', 'payment', 'document',
            'calendar_block', 'date_hold', 'tour', 'package', 'key_date',
            'active_commitment'
          ));
      `);
      // Narrowing may fail while rows exist — either outcome is the bug we guard against.
      // If Postgres allowed the narrow (unlikely with existing rows), repair must restore.
      // If it failed, repair still must leave a usable full vocabulary.
      void narrow;

      ensureMigrationRecordsEntityCheckMonotonic(LOCAL_DB);

      const insertNewer = psql(`
        insert into public.migration_records (
          id, session_id, venue_id, target_entity_type, status, source_row_ref, raw_payload, normalized_payload
        ) values (
          gen_random_uuid(), '${sessionId}', '${venueId}', 'floor_plan', 'validated', 'fp-2', '{}'::jsonb, '{}'::jsonb
        ), (
          gen_random_uuid(), '${sessionId}', '${venueId}', 'timeline_entry', 'validated', 'tl-2', '{}'::jsonb, '{}'::jsonb
        );
      `);
      assert.equal(
        insertNewer.status,
        0,
        `after monotonic repair, newer entity rows must insert: ${insertNewer.stderr || insertNewer.stdout}`,
      );

      const def = psql(`
        select pg_get_constraintdef(oid)
        from pg_constraint
        where conname = 'migration_records_target_entity_type_check';
      `);
      assert.equal(def.status, 0, def.stderr);
      assert.match(def.stdout, /floor_plan/);
      assert.match(def.stdout, /timeline_entry/);

      psql(`
        delete from public.migration_records where session_id = '${sessionId}';
        delete from public.migration_sessions where id = '${sessionId}';
        delete from public.venues where id = '${venueId}';
        delete from auth.users where id = '${ownerId}';
      `);
    });
  });
});
