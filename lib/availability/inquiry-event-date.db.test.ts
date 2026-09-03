import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it, type TestContext } from "node:test";

const LOCAL_URL = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const PHASE2 = resolve("supabase/migrations/20261316000000_event_availability_assert.sql");
const PHASE3 = resolve("supabase/migrations/20261317000000_event_availability_write_enforcement.sql");
const TURNAROUND = resolve("supabase/migrations/20261319000000_event_turnaround_enforcement.sql");
const CORRECTION = resolve("supabase/migrations/20261320000000_availability_correction_pass.sql");
const RECURRENCE = resolve("supabase/migrations/20261321000000_calendar_block_recurrence_coverage.sql");
const CASES = resolve("lib/availability/inquiry-event-date.db.sql");

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
  for (let attempt = 0; attempt < 4; attempt++) {
    last = psql(["-f", file]);
    if (last.status === 0) return;
    if (!/tuple concurrently updated|deadlock detected/i.test(`${last.stderr}\n${last.stdout}`)) break;
  }
  assert.equal(last.status, 0, `${file}: ${last.stderr || last.stdout}`);
}

function withSchemaLock<T>(fn: () => T): T {
  const dir = join(tmpdir(), "wevenu-k7-avail-schema.lock");
  const started = Date.now();
  while (true) {
    try {
      mkdirSync(dir);
      break;
    } catch {
      if (Date.now() - started > 90_000) throw new Error("timed out waiting for k7 availability schema lock");
      spawnSync("sleep", ["0.2"]);
    }
  }
  try {
    return fn();
  } finally {
    try { rmdirSync(dir); } catch { /* ignore */ }
  }
}

describe("inquiry event-date availability live database", () => {
  it("choose_available uses evaluate_event_availability (full-day occupancy)", (t: TestContext) => {
    if (!localDbAvailable()) {
      t.skip("local Postgres is not running");
      return;
    }
    withSchemaLock(() => {
      applySql(PHASE2);
      applySql(PHASE3);
      applySql(TURNAROUND);
      applySql(CORRECTION);
      applySql(RECURRENCE);
      const cases = readFileSync(CASES, "utf8");
      const run = psql(["-c", `begin;\n${cases}\nrollback;`]);
      assert.equal(run.status, 0, run.stderr || run.stdout);
    });
  });
});
