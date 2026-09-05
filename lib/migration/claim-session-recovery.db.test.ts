/**
 * Migration claim / session recovery (Item 4).
 *
 * An unexpected exception during commitOneRecord (not an availability/
 * validation failure it already classifies as ok:false) must not permanently
 * strand a record's claim or leave the session stuck at "committing".
 * Uses a genuinely malformed calendar_block end date (a realistic CSV typo,
 * not a synthetic hook) to trigger a real, unclassified Postgres exception
 * through the actual commit pipeline — commitOneRecord rethrows non-occupancy
 * errors, and commitSession must catch them.
 *
 * retryOwnRecord resolves its actor from request cookies (resolveVenueActor),
 * so it is not callable with an admin client outside a real request. This
 * suite proves the same recovery contract at the directly exercisable layer:
 * releaseStaleClaims + commitSession (the path retryOwnRecord also sweeps
 * before claimUnresolvedRecord, and the path a reviewer uses after approving
 * a fixed row back to a committable status).
 */
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { describe, it, type TestContext } from "node:test";

import { addRows, commitSession, runDedupe } from "@/lib/migration/service";
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

async function seedVenue(
  venueId: string,
  ownerId: string,
  email: string,
  venueName: string,
): Promise<void> {
  psql(`delete from public.venues where id = '${venueId}'; delete from auth.users where id = '${ownerId}';`);
  const setup = psql(`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', '${ownerId}', 'authenticated', 'authenticated',
      '${email}', crypt('not-a-login', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', ''
    );
    insert into public.venues (id, owner_user_id, name, timezone)
    values ('${venueId}', '${ownerId}', '${venueName}', 'America/New_York');
    -- Venue commit path uses an authenticated client (INSERT granted). These
    -- DB tests drive commitSession with the service_role key; grant the same
    -- write privileges so the test exercises commit behavior, not an ambient
    -- local-grant gap on calendar_blocks.
    grant insert, update, delete on public.calendar_blocks to service_role;
  `);
  assert.equal(setup.status, 0, setup.stderr);
}

function cleanupVenue(venueId: string, ownerId: string): void {
  psql(`delete from public.venues where id = '${venueId}'; delete from auth.users where id = '${ownerId}';`);
}

async function forceStaleClaim(
  supabase: SupabaseClient,
  recordId: string,
  staleMs = 10 * 60 * 1000,
): Promise<void> {
  const { error } = await supabase
    .from("migration_records")
    .update({ claimed_at: new Date(Date.now() - staleMs).toISOString() })
    .eq("id", recordId);
  assert.equal(error, null, error?.message ?? "failed to age claimed_at");
}

describe("Item 4 — claim / session recovery", () => {
  it("A+C: unexpected commit failure → needs_review, claim released, session not committing; fixed retry commits once with no duplicate", async (t: TestContext) => {
    if (!localReady()) {
      t.skip("local Postgres is not running");
      return;
    }
    await withLocalDbSchemaLock(async () => {
      const supabase = adminClient();
      const venueId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee21";
      const ownerId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee22";
      await seedVenue(venueId, ownerId, "claim-recovery-owner@example.test", "Claim Recovery Venue");

      const session = await repo.createSession(supabase as never, venueId, "generic_csv", "venue", ownerId, null);
      assert.ok(session);
      if (!session) return;

      await addRows(supabase as never, session, "calendar_block", [
        { title: "Good Block", type: "blocked_time", startDate: "2027-03-01", sourceId: "good-block" },
        // Passes normalize (endDate isn't format-checked there) but raises a
        // genuine Postgres "invalid input syntax for type date" at insert —
        // exactly the unclassified failure class Item 4 hardens.
        { title: "Bad Block", type: "blocked_time", startDate: "2027-03-05", endDate: "not-a-real-date", sourceId: "bad-block" },
      ]);
      await runDedupe(supabase as never, session);
      const outcome = await commitSession(supabase as never, session, ownerId);

      assert.equal(outcome.committed, 1, "the well-formed block still commits");
      assert.equal(outcome.failed, 1, "the malformed block is counted as failed, not silently dropped");

      const records = await repo.listRecords(supabase as never, session.id);
      const bySource = new Map(records.map((r) => [(r.normalizedPayload as { sourceId?: string } | null)?.sourceId, r]));
      const badBlock = bySource.get("bad-block");
      assert.ok(badBlock, "bad-block record must exist");
      assert.equal(badBlock.status, "needs_review", "unexpected exception must resolve to durable needs_review");
      assert.match(badBlock.validationErrors?.[0] ?? "", /unexpected error/i);
      assert.equal(badBlock.claimedAt, null, "claim must be released after the unexpected failure");
      assert.equal(badBlock.createdEntityId, null, "failed attempt must not leave a created entity id");

      // Reclaimable via the retry claim path (needs_review).
      const reclaimed = await repo.claimUnresolvedRecord(supabase as never, badBlock.id, ownerId);
      assert.ok(reclaimed, "fresh claimUnresolvedRecord must succeed after release");
      await repo.releaseClaim(supabase as never, badBlock.id);

      const sessionAfter = await repo.getSession(supabase as never, venueId, session.id);
      assert.notEqual(sessionAfter?.status, "committing", "session must not remain stranded at committing");
      assert.equal(sessionAfter?.status, "partially_committed");

      // C — successful recovery through the canonical commit path a reviewer
      // reaches after approving a fixed row (same commitOneRecord as retryOwnRecord).
      await repo.updateRecord(supabase as never, badBlock.id, {
        status: "approved",
        normalizedPayload: { ...(badBlock.normalizedPayload as Record<string, unknown>), endDate: "2027-03-05" },
      });
      const retryOutcome = await commitSession(supabase as never, session, ownerId);
      assert.equal(retryOutcome.committed, 1, "fixed row must commit once the underlying problem is gone");
      assert.equal(retryOutcome.failed, 0);

      const { count: blockCount } = await supabase.from("calendar_blocks")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", venueId).eq("title", "Bad Block");
      assert.equal(blockCount, 1, "exactly one calendar_blocks row — no duplicate from the failed attempt");

      const afterCommit = await repo.getRecord(supabase as never, session.id, badBlock.id);
      assert.equal(afterCommit?.status, "committed");
      assert.equal(afterCommit?.claimedAt, null);

      // Idempotent: a second commitSession must not create another block.
      const secondPass = await commitSession(supabase as never, session, ownerId);
      assert.equal(secondPass.committed, 0, "already-committed row must not be re-committed");
      const { count: blockCountAfter } = await supabase.from("calendar_blocks")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", venueId).eq("title", "Bad Block");
      assert.equal(blockCountAfter, 1, "second commitSession must not duplicate the domain entity");

      const finalSession = await repo.getSession(supabase as never, venueId, session.id);
      assert.equal(finalSession?.status, "committed");
      assert.notEqual(finalSession?.status, "committing");

      cleanupVenue(venueId, ownerId);
    });
  });

  it("B+C: stale needs_review claim blocks reclaim until releaseStaleClaims; then normal recovery commits once", async (t: TestContext) => {
    if (!localReady()) {
      t.skip("local Postgres is not running");
      return;
    }
    await withLocalDbSchemaLock(async () => {
      const supabase = adminClient();
      const venueId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee23";
      const ownerId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee24";
      await seedVenue(venueId, ownerId, "stale-claim-owner@example.test", "Stale Claim Venue");

      const session = await repo.createSession(supabase as never, venueId, "generic_csv", "venue", ownerId, null);
      assert.ok(session);
      if (!session) return;

      await addRows(supabase as never, session, "calendar_block", [
        { title: "Stuck Block", type: "blocked_time", startDate: "2027-04-01", endDate: "not-a-real-date", sourceId: "stuck-block" },
      ]);
      await runDedupe(supabase as never, session);
      await commitSession(supabase as never, session, ownerId);

      const records = await repo.listRecords(supabase as never, session.id);
      const stuck = records.find((r) => (r.normalizedPayload as { sourceId?: string } | null)?.sourceId === "stuck-block");
      assert.equal(stuck?.status, "needs_review");
      assert.equal(stuck?.claimedAt, null);

      // Simulate a crashed retry: take the retry claim, then age claimed_at
      // past the staleness threshold without releasing it.
      const claimed = await repo.claimUnresolvedRecord(supabase as never, stuck!.id, ownerId);
      assert.ok(claimed, "should be claimable before simulating a crash");
      await forceStaleClaim(supabase, stuck!.id);

      const blockedAttempt = await repo.claimUnresolvedRecord(supabase as never, stuck!.id, ownerId);
      assert.equal(blockedAttempt, null, "stale but unswept claim must still block a naive re-claim");

      // Same sweep retryOwnRecord and commitSession run before taking a claim.
      await repo.releaseStaleClaims(
        supabase as never,
        session.id,
        new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      );
      const afterSweep = await repo.getRecord(supabase as never, session.id, stuck!.id);
      assert.equal(afterSweep?.status, "needs_review", "sweep clears claim only — must not change status");
      assert.equal(afterSweep?.claimedAt, null, "stale claim must be released by the sweep");

      const reclaimed = await repo.claimUnresolvedRecord(supabase as never, stuck!.id, ownerId);
      assert.ok(reclaimed, "record must be reclaimable after the sweep");
      await repo.releaseClaim(supabase as never, stuck!.id);

      // C — recover normally: approve fixed payload, commit once, no duplicate.
      await repo.updateRecord(supabase as never, stuck!.id, {
        status: "approved",
        normalizedPayload: { ...(stuck!.normalizedPayload as Record<string, unknown>), endDate: "2027-04-01" },
      });
      // commitSession itself runs releaseStaleClaims first — prove end-to-end.
      const recovery = await commitSession(supabase as never, session, ownerId);
      assert.equal(recovery.committed, 1);
      assert.equal(recovery.failed, 0);

      const { count: blockCount } = await supabase.from("calendar_blocks")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", venueId).eq("title", "Stuck Block");
      assert.equal(blockCount, 1, "recovery must create exactly one domain row");

      const recovered = await repo.getRecord(supabase as never, session.id, stuck!.id);
      assert.equal(recovered?.status, "committed");
      assert.equal(recovered?.claimedAt, null);

      const sessionFinal = await repo.getSession(supabase as never, venueId, session.id);
      assert.equal(sessionFinal?.status, "committed");
      assert.notEqual(sessionFinal?.status, "committing");

      cleanupVenue(venueId, ownerId);
    });
  });

  it("B: stale conflict claim is swept the same way as needs_review (claimUnresolvedRecord status)", async (t: TestContext) => {
    if (!localReady()) {
      t.skip("local Postgres is not running");
      return;
    }
    await withLocalDbSchemaLock(async () => {
      const supabase = adminClient();
      const venueId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee25";
      const ownerId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee26";
      await seedVenue(venueId, ownerId, "stale-conflict-owner@example.test", "Stale Conflict Venue");

      const session = await repo.createSession(supabase as never, venueId, "generic_csv", "venue", ownerId, null);
      assert.ok(session);
      if (!session) return;

      // conflict is never written by current dedupe (Item 5), but claim/
      // recovery still treats it as a recoverable retry status — prove the
      // sweep covers it without inventing a writer.
      await addRows(supabase as never, session, "calendar_block", [
        { title: "Conflict Block", type: "blocked_time", startDate: "2027-05-01", sourceId: "conflict-block" },
      ]);
      await runDedupe(supabase as never, session);
      const [row] = await repo.listRecords(supabase as never, session.id);
      assert.ok(row);
      await repo.updateRecord(supabase as never, row.id, { status: "conflict" });

      const claimed = await repo.claimUnresolvedRecord(supabase as never, row.id, ownerId);
      assert.ok(claimed, "conflict rows must be claimable for retry");
      await forceStaleClaim(supabase, row.id);

      assert.equal(
        await repo.claimUnresolvedRecord(supabase as never, row.id, ownerId),
        null,
        "stale conflict claim must block until swept",
      );

      await repo.releaseStaleClaims(
        supabase as never,
        session.id,
        new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      );
      const swept = await repo.getRecord(supabase as never, session.id, row.id);
      assert.equal(swept?.status, "conflict", "sweep must not reopen or rewrite conflict status");
      assert.equal(swept?.claimedAt, null);

      const again = await repo.claimUnresolvedRecord(supabase as never, row.id, ownerId);
      assert.ok(again, "conflict claim must be reclaimable after sweep");
      await repo.releaseClaim(supabase as never, row.id);

      cleanupVenue(venueId, ownerId);
    });
  });
});
