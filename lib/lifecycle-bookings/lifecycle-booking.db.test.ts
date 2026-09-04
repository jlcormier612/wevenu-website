/**
 * Lifecycle booking DB integration — idempotency, origins, first vs rebooked.
 */
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, it, type TestContext } from "node:test";

import { recordLifecycleBooking } from "@/lib/lifecycle-bookings/service";
import { applyLocalMigrationFiles } from "@/lib/test/apply-local-migrations";
import { withLocalDbSchemaLock } from "@/lib/test/local-db-schema-lock";

const LOCAL_DB = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_API = process.env.NEXT_PUBLIC_SUPABASE_URL
  ?? process.env.SUPABASE_URL
  ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const MIGRATION = resolve("supabase/migrations/20261337000000_lifecycle_booking_events.sql");

const venueId = "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeee01";
const ownerId = "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeee02";
const leadId = "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeee03";
const clientId = "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeee04";
const leadlessClientId = "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeee05";
const importClientId = "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeee06";

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

function adminClient(): SupabaseClient {
  return createClient(LOCAL_API, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe("Lifecycle booking DB", () => {
  it("first pipeline, rebook, direct, import idempotency; first date write-once", async (t: TestContext) => {
    if (!localReady()) {
      t.skip("local Postgres is not running");
      return;
    }

    await withLocalDbSchemaLock(async () => {
      applyLocalMigrationFiles([MIGRATION], { dbUrl: LOCAL_DB, alreadyHoldingLock: true });
      const supabase = adminClient();

      psql(`
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
          'lifecycle-owner@example.test', crypt('not-a-login', gen_salt('bf')),
          now(), '{"provider":"email","providers":["email"]}', '{}',
          now(), now(), '', '', '', ''
        );
        insert into public.venues (id, owner_user_id, name, timezone)
        values ('${venueId}', '${ownerId}', 'Lifecycle Venue', 'America/New_York');
        insert into public.leads (
          id, venue_id, first_name, last_name, email, status
        ) values (
          '${leadId}', '${venueId}', 'Pipe', 'Line', 'pipe-lifecycle@example.com', 'proposal_sent'
        );
        insert into public.clients (
          id, venue_id, first_name, last_name, email, status, lead_id
        ) values (
          '${clientId}', '${venueId}', 'Pipe', 'Line', 'pipe-lifecycle@example.com', 'planning', '${leadId}'
        );
        insert into public.clients (
          id, venue_id, first_name, last_name, email, status
        ) values (
          '${leadlessClientId}', '${venueId}', 'Direct', 'Add', 'direct-lifecycle@example.com', 'planning'
        );
        insert into public.clients (
          id, venue_id, first_name, last_name, email, status
        ) values (
          '${importClientId}', '${venueId}', 'Import', 'Ed', 'import-lifecycle@example.com', 'planning'
        );
      `);
      assert.equal(setup.status, 0, setup.stderr);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      const first = await recordLifecycleBooking(db, {
        venueId,
        leadId,
        clientId,
        origin: "pipeline",
        previousSalesStage: "proposal_sent",
        occurredAt: "2026-03-15",
      });
      assert.equal(first.ok, true, first.ok ? "" : first.message);
      if (!first.ok) return;
      assert.equal(first.wasFirst, true);
      assert.equal(first.event.eventKind, "first_booked");

      const { data: leadAfter } = await supabase.from("leads")
        .select("first_booked_at").eq("id", leadId).single();
      const stamped = leadAfter?.first_booked_at as string;
      assert.ok(stamped?.startsWith("2026-03-15"));

      const rebook = await recordLifecycleBooking(db, {
        venueId,
        leadId,
        clientId,
        origin: "pipeline",
        previousSalesStage: "lost",
      });
      assert.equal(rebook.ok, true);
      if (!rebook.ok) return;
      assert.equal(rebook.wasFirst, false);
      assert.equal(rebook.event.eventKind, "rebooked");

      const { data: leadStill } = await supabase.from("leads")
        .select("first_booked_at").eq("id", leadId).single();
      assert.equal(leadStill?.first_booked_at, stamped);

      const { data: pipelineEvents } = await supabase.from("lifecycle_booking_events")
        .select("event_kind")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true });
      assert.equal((pipelineEvents ?? []).length, 2);
      assert.equal(pipelineEvents![0].event_kind, "first_booked");
      assert.equal(pipelineEvents![1].event_kind, "rebooked");

      const direct = await recordLifecycleBooking(db, {
        venueId,
        clientId: leadlessClientId,
        origin: "direct",
        occurredAt: "2026-04-01",
      });
      assert.equal(direct.ok, true);
      if (!direct.ok) return;
      assert.equal(direct.event.origin, "direct");

      const directRetry = await recordLifecycleBooking(db, {
        venueId,
        clientId: leadlessClientId,
        origin: "direct",
      });
      assert.equal(directRetry.ok, true);
      if (!directRetry.ok) return;
      assert.equal(directRetry.wasFirst, false);

      const { count: directCount } = await supabase.from("lifecycle_booking_events")
        .select("id", { count: "exact", head: true })
        .eq("client_id", leadlessClientId);
      assert.equal(directCount, 1);

      // Without mark: no automatic event for this client (we never called record).
      const { count: beforeImport } = await supabase.from("lifecycle_booking_events")
        .select("id", { count: "exact", head: true })
        .eq("client_id", importClientId);
      assert.equal(beforeImport ?? 0, 0);

      const imported = await recordLifecycleBooking(db, {
        venueId,
        clientId: importClientId,
        origin: "import",
        occurredAt: "2025-11-20",
      });
      assert.equal(imported.ok, true);
      if (!imported.ok) return;
      assert.equal(imported.event.occurredAt.startsWith("2025-11-20"), true);

      const importRetry = await recordLifecycleBooking(db, {
        venueId,
        clientId: importClientId,
        origin: "import",
        occurredAt: "2024-01-01",
      });
      assert.equal(importRetry.ok, true);
      if (!importRetry.ok) return;
      assert.equal(importRetry.event.occurredAt.startsWith("2025-11-20"), true);

      const { data: importStamp } = await supabase.from("clients")
        .select("lifecycle_booked_at, lifecycle_booking_origin")
        .eq("id", importClientId).single();
      assert.equal(importStamp?.lifecycle_booking_origin, "import");
      assert.ok(String(importStamp?.lifecycle_booked_at).startsWith("2025-11-20"));

      // Unique index: second first_booked for same leadless client must not create a row.
      const { count: importCount } = await supabase.from("lifecycle_booking_events")
        .select("id", { count: "exact", head: true })
        .eq("client_id", importClientId)
        .eq("event_kind", "first_booked");
      assert.equal(importCount, 1);

      psql(`
        delete from public.venues where id = '${venueId}';
        delete from auth.users where id = '${ownerId}';
      `);
    });
  });
});
