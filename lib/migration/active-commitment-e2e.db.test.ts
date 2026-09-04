import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, type TestContext } from "node:test";

import { withLocalDbSchemaLockSync } from "@/lib/test/local-db-schema-lock";

const LOCAL_URL = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const MIGRATIONS = [
  resolve("supabase/migrations/20261323000000_bring_business_cutover.sql"),
  resolve("supabase/migrations/20261324000000_active_financial_cutover.sql"),
  resolve("supabase/migrations/20261328000000_event_booked_at.sql"),
];
const CASES = resolve("lib/migration/active-commitment-e2e.db.sql");

function psql(args: string[], extra?: { timeoutMs?: number }): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("psql", [LOCAL_URL, "-v", "ON_ERROR_STOP=1", ...args], {
    encoding: "utf8",
    timeout: extra?.timeoutMs ?? 90_000,
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

describe("Smith Wedding active commitment E2E", () => {
  it("reconstructs operable HTC financials, external contract, document, and portal visibility", (t: TestContext) => {
    if (!localDbAvailable()) {
      t.skip("local Postgres is not running");
      return;
    }
    withSchemaLock(() => {
      for (const file of MIGRATIONS) applySql(file);
      const cases = readFileSync(CASES, "utf8");
      const run = psql(["-c", `begin;\n${cases}\nrollback;`], { timeoutMs: 90_000 });
      assert.equal(run.status, 0, run.stderr || run.stdout);
      const notice = `${run.stderr}\n${run.stdout}`;
      assert.match(notice, /SMITH_OK/);
      assert.match(notice, /"balanceDue":\s*13500/);
      assert.match(notice, /"externalContract":\s*true/);
      assert.match(notice, /"noFabricatedSigners":\s*true/);
    });
  });
});
