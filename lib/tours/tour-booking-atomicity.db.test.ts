import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, type TestContext } from "node:test";

import { withLocalDbSchemaLockSync } from "@/lib/test/local-db-schema-lock";

const LOCAL_URL = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const PHASE2 = resolve("supabase/migrations/20261316000000_event_availability_assert.sql");
const PHASE3 = resolve("supabase/migrations/20261317000000_event_availability_write_enforcement.sql");
const PHASE4 = resolve("supabase/migrations/20261318000000_tour_capacity_enforcement.sql");
const TURNAROUND = resolve("supabase/migrations/20261319000000_event_turnaround_enforcement.sql");
const CORRECTION = resolve("supabase/migrations/20261320000000_availability_correction_pass.sql");
const RECURRENCE = resolve("supabase/migrations/20261321000000_calendar_block_recurrence_coverage.sql");
const ATOMICITY = resolve("supabase/migrations/20261322000000_tour_booking_atomicity.sql");
const CASES = resolve("lib/tours/tour-booking-atomicity.db.sql");

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

function localDbAvailable(): boolean {
  const probe = psql(["-c", "select 1"], { timeoutMs: 3000 });
  return probe.status === 0;
}

function applySql(file: string): void {
  let last = { status: 1 as number | null, stdout: "", stderr: "" };
  for (let attempt = 0; attempt < 6; attempt++) {
    last = psql(["-f", file]);
    if (last.status === 0) return;
    if (!/tuple concurrently updated|deadlock detected/i.test(`${last.stderr}\n${last.stdout}`)) break;
  }
  assert.equal(last.status, 0, last.stderr || last.stdout);
}

function withSchemaLock<T>(fn: () => T): T {
  return withLocalDbSchemaLockSync(fn);
}

function applyTourMigrations(): void {
  applySql(PHASE2);
  applySql(PHASE3);
  applySql(PHASE4);
  applySql(TURNAROUND);
  applySql(CORRECTION);
  applySql(RECURRENCE);
  applySql(ATOMICITY);
}

describe("tour booking atomicity live database", () => {
  it("rolls back orphan Leads and enforces recurring calendar blocks on book_tour", (t: TestContext) => {
    if (!localDbAvailable()) {
      t.skip("local Postgres is not running");
      return;
    }
    withSchemaLock(() => {
      applyTourMigrations();
      const cases = readFileSync(CASES, "utf8");
      let run = { status: 1 as number | null, stdout: "", stderr: "" };
      for (let attempt = 0; attempt < 6; attempt++) {
        run = psql(["-c", "begin;", "-c", cases, "-c", "rollback;"]);
        if (run.status === 0) break;
        if (!/deadlock detected/i.test(`${run.stderr}\n${run.stdout}`)) break;
      }
      assert.equal(run.status, 0, run.stderr || run.stdout);
    });
  });
});
