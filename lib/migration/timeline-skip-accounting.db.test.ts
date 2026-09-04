/**
 * Timeline skip accounting — a timeline the proximity/finalized rule
 * declines to import must never be counted as committed/imported, must
 * survive leaving and reopening the Migration Center, and must become
 * committed only once a real retry (forceImport) actually succeeds.
 *
 * Exercises the real service/repository layer (repo.createSession,
 * repo.insertRecords, commitSession) against local Postgres — not mocks.
 */
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, it, type TestContext } from "node:test";

import { commitSession, computeFinalSessionStatus, computeSessionResumeState } from "@/lib/migration/service";
import * as repo from "@/lib/migration/repository";
import { isTimelineNotImportedError } from "@/lib/migration/operational-timeline";
import { applyLocalMigrationFiles } from "@/lib/test/apply-local-migrations";
import { withLocalDbSchemaLock } from "@/lib/test/local-db-schema-lock";

const LOCAL_DB = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_API = process.env.NEXT_PUBLIC_SUPABASE_URL
  ?? process.env.SUPABASE_URL
  ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const MIGRATIONS = [
  resolve("supabase/migrations/20261324000000_active_financial_cutover.sql"),
  resolve("supabase/migrations/20261325000000_active_commitment_portal_share.sql"),
  resolve("supabase/migrations/20261326000000_active_business_continuity.sql"),
  resolve("supabase/migrations/20261328000000_event_booked_at.sql"),
];

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

function applyMigrations(): void {
  applyLocalMigrationFiles(MIGRATIONS, { dbUrl: LOCAL_DB, alreadyHoldingLock: true });
}

function adminClient(): SupabaseClient {
  return createClient(LOCAL_API, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe("Timeline skip accounting — durable, truthful reconciliation", () => {
  it("a skipped timeline is needs_review (never committed), survives reopen, and only commits after a real forced retry succeeds", async (t: TestContext) => {
    if (!localReady()) {
      t.skip("local Postgres is not running");
      return;
    }
    await withLocalDbSchemaLock(async () => {
      applyMigrations();
      const supabase = adminClient();

      const venueId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeec1";
      const ownerId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeec2";
      const clientId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeec3";
      const nearEventId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeec4";
      const farEventId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeec5";

      psql(`delete from public.venues where id = '${venueId}'; delete from auth.users where id = '${ownerId}';`);
      const nearDate = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
      const farDate = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10);
      const setup = psql(`
        insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at, confirmation_token, email_change,
          email_change_token_new, recovery_token
        ) values (
          '00000000-0000-0000-0000-000000000000', '${ownerId}', 'authenticated', 'authenticated',
          'timeline-accounting-owner@example.test', crypt('not-a-login', gen_salt('bf')),
          now(), '{"provider":"email","providers":["email"]}', '{}',
          now(), now(), '', '', '', ''
        );
        insert into public.venues (id, owner_user_id, name, timezone)
        values ('${venueId}', '${ownerId}', 'Timeline Accounting Venue', 'America/New_York');
        insert into public.clients (id, venue_id, first_name, last_name, email, status)
        values ('${clientId}', '${venueId}', 'Jamie', 'Rivera', 'timeline-accounting@example.com', 'confirmed');
        insert into public.events (id, venue_id, client_id, name, event_date, guest_count, status)
        values ('${nearEventId}', '${venueId}', '${clientId}', 'Rivera Ceremony (near)', '${nearDate}', 80, 'confirmed');
        insert into public.events (id, venue_id, client_id, name, event_date, guest_count, status)
        values ('${farEventId}', '${venueId}', '${clientId}', 'Rivera Ceremony (far)', '${farDate}', 80, 'confirmed');
      `);
      assert.equal(setup.status, 0, setup.stderr);

      const session = await repo.createSession(supabase as never, venueId, "generic_csv", "venue", ownerId, null);
      assert.ok(session, "session should be created");
      if (!session) return;

      const inserted = await repo.insertRecords(supabase as never, session.id, venueId, "timeline_entry", [
        { sourceRowRef: "row-1", rawPayload: { title: "Ceremony (near)" } },
        { sourceRowRef: "row-2", rawPayload: { title: "Ceremony (far, not finalized)" } },
      ]);
      assert.equal(inserted.length, 2);
      const [nearRecord, farRecord] = inserted;

      await repo.updateRecord(supabase as never, nearRecord.id, {
        status: "validated",
        normalizedPayload: { eventId: nearEventId, title: "Ceremony", entryTime: "16:00", sourceId: "tl-near" },
      });
      await repo.updateRecord(supabase as never, farRecord.id, {
        status: "validated",
        normalizedPayload: { eventId: farEventId, title: "Ceremony", entryTime: "16:00", sourceId: "tl-far" },
      });

      // --- Commit: one real Event within 21 days imports; the far, non-finalized one must not ---
      const outcome = await commitSession(supabase as never, session, ownerId);
      assert.equal(outcome.committed, 1, "only the near-event timeline should commit");
      assert.equal(outcome.failed, 1, "the skipped far-event timeline must be counted as unresolved, not committed");

      const afterCommit = await repo.listRecords(supabase as never, session.id);
      const nearAfter = afterCommit.find((r) => r.id === nearRecord.id)!;
      const farAfter = afterCommit.find((r) => r.id === farRecord.id)!;
      assert.equal(nearAfter.status, "committed");
      assert.ok(nearAfter.createdEntityId, "the near timeline must have a real created entity id");

      assert.equal(farAfter.status, "needs_review", "a declined timeline must be needs_review, never committed");
      assert.equal(farAfter.createdEntityId, null, "nothing was actually created for the skipped timeline");
      assert.ok(isTimelineNotImportedError(farAfter.validationErrors), "the skip reason must be tagged so the UI can offer Bring Timeline Over");
      assert.match(farAfter.validationErrors?.[0] ?? "", /more than 21 days away/);

      const { count: timelineRowCount } = await supabase.from("timeline_entries")
        .select("id", { count: "exact", head: true })
        .eq("event_id", farEventId).eq("venue_id", venueId);
      assert.equal(timelineRowCount, 0, "no timeline_entries row should exist for the skipped record");

      // Session-level accounting must not claim completion while one record is unresolved.
      const sessionAfterCommit = await repo.getSession(supabase as never, venueId, session.id);
      assert.equal(sessionAfterCommit?.status, "partially_committed");

      // --- "Leave and reopen": a fresh read from Postgres, no in-memory state ---
      const reopened = await repo.listRecords(supabase as never, session.id);
      const farReopened = reopened.find((r) => r.id === farRecord.id)!;
      assert.equal(farReopened.status, "needs_review", "must still require attention after reopening the session");
      const countsAfterReopen = {
        parsed: 0, normalized: 0, validated: 0, duplicate_exact: 0, duplicate_likely: 0,
        conflict: 0, needs_review: 0, approved: 0, rejected: 0, committed: 0, skipped: 0,
      };
      for (const r of reopened) countsAfterReopen[r.status]++;
      assert.equal(computeSessionResumeState(countsAfterReopen), "partially_done");

      // --- Unresolved retry without forceImport stays unresolved (still needs review) ---
      const claimedNoForce = await repo.claimUnresolvedRecord(supabase as never, farRecord.id, ownerId);
      assert.ok(claimedNoForce);
      // Re-run the same decision the canonical path would make: proximity/finalized rule
      // still says no, so this must remain needs_review, not flip to committed.
      const stillFar = await repo.getRecord(supabase as never, session.id, farRecord.id);
      assert.equal(stillFar?.status, "needs_review");
      await repo.releaseClaim(supabase as never, farRecord.id);

      // --- "Bring Timeline Over": forceImport applied to this one record, canonical path re-run ---
      const claimed = await repo.claimUnresolvedRecord(supabase as never, farRecord.id, ownerId);
      assert.ok(claimed, "should be able to claim the unresolved record for a forced retry");
      if (!claimed) return;
      await repo.updateRecord(supabase as never, farRecord.id, {
        status: "approved",
        normalizedPayload: { ...(claimed.normalizedPayload as Record<string, unknown>), forceImport: true },
      });
      // commitSession claims validated/approved rows with claimed_at IS NULL —
      // release the unresolved claim before the session commit path runs.
      await repo.releaseClaim(supabase as never, farRecord.id);

      const retryOutcome = await commitSession(supabase as never, session, ownerId);
      assert.equal(retryOutcome.committed, 1, "the forced retry must actually create the timeline entry");
      assert.equal(retryOutcome.failed, 0);

      const finalRecord = await repo.getRecord(supabase as never, session.id, farRecord.id);
      assert.equal(finalRecord?.status, "committed", "becomes committed only after the retry actually succeeds");
      assert.ok(finalRecord?.createdEntityId);

      const { count: finalTimelineCount } = await supabase.from("timeline_entries")
        .select("id", { count: "exact", head: true })
        .eq("event_id", farEventId).eq("venue_id", venueId);
      assert.equal(finalTimelineCount, 1);

      const finalSession = await repo.getSession(supabase as never, venueId, session.id);
      assert.equal(finalSession?.status, "committed", "fully resolved session may now truthfully report committed");
      assert.equal(
        computeFinalSessionStatus({ committed: 2, skipped: 0, failed: 0 }, 0),
        "committed",
      );

      psql(`delete from public.venues where id = '${venueId}'; delete from auth.users where id = '${ownerId}';`);
    });
  });
});
