import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it, type TestContext } from "node:test";

import { withLocalDbSchemaLockSync } from "@/lib/test/local-db-schema-lock";

const LOCAL_URL = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const MIGRATION = resolve("supabase/migrations/20261413300000_book_relationship_confirmed_occupancy.sql");
const CASES = resolve("lib/booking-journey/confirmed-occupancy.db.sql");

function psql(args: string[], extra?: { timeoutMs?: number }) {
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

describe("confirmed booking occupancy live writes", () => {
  it("rejects incomplete occupancy, writes the confirmed event, and rolls conflicts back", (t: TestContext) => {
    const probe = psql(["-c", "select 1"], { timeoutMs: 3000 });
    if (probe.status !== 0) {
      t.skip("local Postgres is not running");
      return;
    }
    withLocalDbSchemaLockSync(() => {
      const applied = psql(["-f", MIGRATION]);
      assert.equal(applied.status, 0, applied.stderr || applied.stdout);
      const cases = readFileSync(CASES, "utf8");
      const run = psql(["-c", `begin; ${cases}; rollback;`]);
      assert.equal(run.status, 0, run.stderr || run.stdout);
    });
  });
});
