import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, type TestContext } from "node:test";

import { withLocalDbSchemaLock, withLocalDbSchemaLockSync } from "@/lib/test/local-db-schema-lock";

const LOCAL_URL = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const MIGRATION = resolve("supabase/migrations/20261316000000_event_availability_assert.sql");
const TURNAROUND = resolve("supabase/migrations/20261319000000_event_turnaround_enforcement.sql");
const CORRECTION = resolve("supabase/migrations/20261320000000_availability_correction_pass.sql");
const RECURRENCE = resolve("supabase/migrations/20261321000000_calendar_block_recurrence_coverage.sql");
const CASES = resolve("lib/availability/assert-event-availability.db.sql");

function psql(args: string[], extra?: { timeoutMs?: number }): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("psql", [LOCAL_URL, "-v", "ON_ERROR_STOP=1", ...args], {
    encoding: "utf8",
    timeout: extra?.timeoutMs ?? 45_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: `${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`,
  };
}

function applyMigration(): void {
  let last = { status: 1 as number | null, stdout: "", stderr: "" };
  for (const file of [MIGRATION, TURNAROUND, CORRECTION, RECURRENCE]) {
    last = { status: 1, stdout: "", stderr: "" };
    for (let attempt = 0; attempt < 4; attempt++) {
      last = psql(["-f", file]);
      if (last.status === 0) break;
      if (!/tuple concurrently updated|deadlock detected/i.test(`${last.stderr}\n${last.stdout}`)) break;
    }
    assert.equal(last.status, 0, `${file}: ${last.stderr || last.stdout}`);
  }
}

function withSchemaLock<T>(fn: () => T): T {
  return withLocalDbSchemaLockSync(fn);
}

async function withSchemaLockAsync<T>(fn: () => Promise<T>): Promise<T> {
  return withLocalDbSchemaLock(fn);
}

function localDbAvailable(): boolean {
  const probe = psql(["-c", "select 1"], { timeoutMs: 3000 });
  return probe.status === 0;
}

describe("assert_event_availability live database", () => {
  it("applies the function and covers all four decisions plus multi-day occupancy", (t: TestContext) => {
    if (!localDbAvailable()) {
      t.skip("local Postgres is not running");
      return;
    }

    withSchemaLock(() => {
      applyMigration();
      const cases = readFileSync(CASES, "utf8");
      const run = psql(["-c", `begin;\n${cases}\nrollback;`]);
      assert.equal(run.status, 0, run.stderr || run.stdout);
    });
  });

  it("serializes concurrent occupancy checks with a transaction-scoped advisory lock", async (t: TestContext) => {
    if (!localDbAvailable()) {
      t.skip("local Postgres is not running");
      return;
    }

    await withSchemaLockAsync(async () => {
      applyMigration();

      const holder = spawn("psql", [
        LOCAL_URL,
        "-v", "ON_ERROR_STOP=1",
        "-c", `
          begin;
          select public.assert_event_availability(
            'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1'::uuid,
            '2027-09-01'::date, null, null, null, null, null, null, null
          );
          select pg_sleep(20);
          rollback;
        `,
      ], { stdio: ["ignore", "pipe", "pipe"] });

      const lockSql = `
        select count(*)::int
        from pg_locks
        where locktype = 'advisory'
          and granted
          and classid = hashtext('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1')
          and objid = hashtext('2027-09-01');
      `;
      const waitStarted = Date.now();
      let held = false;
      while (Date.now() - waitStarted < 5000) {
        const probe = psql(["-qAt", "-c", lockSql], { timeoutMs: 3000 });
        if (probe.status === 0 && Number.parseInt(probe.stdout.trim(), 10) >= 1) {
          held = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      assert.ok(held, "lock holder never published a venue-day advisory lock");

      const waiter = psql([
        "-c", `
          set lock_timeout = '2s';
          select public.assert_event_availability(
            'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1'::uuid,
            '2027-09-01'::date, null, null, null, null, null, null, null
          );
        `,
      ], { timeoutMs: 8000 });

      holder.kill("SIGTERM");
      await new Promise<void>((resolveWait) => {
        if (holder.exitCode != null) {
          resolveWait();
          return;
        }
        holder.once("exit", () => resolveWait());
        setTimeout(() => {
          holder.kill("SIGKILL");
          resolveWait();
        }, 2000);
      });

      const output = `${waiter.stdout}\n${waiter.stderr}`;
      assert.ok(
        waiter.status !== 0 && /lock timeout|canceling statement due to lock timeout/i.test(output),
        `second session must wait on the venue-day advisory lock, got status=${waiter.status} output=${output}`,
      );
    });
  });
});
