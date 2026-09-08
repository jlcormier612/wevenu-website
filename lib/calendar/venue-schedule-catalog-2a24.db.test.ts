/**
 * Calendar Slice 2A.2.4 — custom FK invariant live DB checks.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, type TestContext } from "node:test";
import { spawnSync } from "node:child_process";

import { withLocalDbSchemaLockSync } from "@/lib/test/local-db-schema-lock";

const LOCAL_URL = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const CATALOG = resolve("supabase/migrations/20261352000000_venue_schedule_item_types_catalog.sql");
const LABEL_UNIQUE = resolve("supabase/migrations/20261353000000_venue_schedule_item_types_custom_label_unique.sql");
const CUSTOM_FK = resolve("supabase/migrations/20261354000000_calendar_blocks_custom_requires_catalog_fk.sql");
const CASES = resolve("lib/calendar/venue-schedule-catalog-2a24.db.sql");

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
  return psql(["-c", "select 1"], { timeoutMs: 3000 }).status === 0;
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

describe("calendar_blocks custom catalog FK invariant", () => {
  it("accepts valid custom FK and rejects null / cross-venue; non-custom keep nullable FK", (t: TestContext) => {
    if (!localDbAvailable()) {
      t.skip("local Postgres is not running");
      return;
    }
    const hasCatalog = psql([
      "-tAc",
      "select to_regclass('public.venue_schedule_item_types') is not null",
    ], { timeoutMs: 5000 });
    if (hasCatalog.status !== 0 || !/t/.test(hasCatalog.stdout)) {
      applySql(CATALOG);
      applySql(LABEL_UNIQUE);
    }
    withLocalDbSchemaLockSync(() => {
      applySql(CUSTOM_FK);
      const cases = readFileSync(CASES, "utf8");
      const run = psql(["-c", `begin;\n${cases}\nrollback;`]);
      assert.equal(run.status, 0, run.stderr || run.stdout);
    });
  });
});
