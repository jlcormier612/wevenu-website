import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it, type TestContext } from "node:test";

import { withLocalDbSchemaLockSync } from "@/lib/test/local-db-schema-lock";

const LOCAL_URL = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const LOST = resolve("supabase/migrations/20261400400000_lead_lost_reason.sql");
const CELEBRATION = resolve("supabase/migrations/20261402500000_booking_celebration_pending.sql");
const BOOK = resolve("supabase/migrations/20261408300000_book_relationship_consumes_date_holds.sql");
const USES = resolve("supabase/migrations/20261405900000_invoice_name_and_venue_spaces_uses.sql");
const SPACES = resolve("supabase/migrations/20261410500000_lead_event_space_preferences.sql");
const CASES = resolve("lib/leads/space-preferences.db.sql");

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

describe("spaces + Booking-E1 live writes", () => {
  it("seeds venue_space/external/undecided, skips inactive, rolls back with the booking", (t: TestContext) => {
    if (!localDbAvailable()) {
      t.skip("local Postgres is not running");
      return;
    }
    withLocalDbSchemaLockSync(() => {
      applySql(LOST);
      applySql(CELEBRATION);
      applySql(BOOK);
      applySql(USES);
      applySql(SPACES);
      const cases = readFileSync(CASES, "utf8");
      let run = { status: 1 as number | null, stdout: "", stderr: "" };
      for (let attempt = 0; attempt < 6; attempt++) {
        run = psql(["-c", `begin; ${cases}; rollback;`]);
        if (run.status === 0) break;
        if (!/deadlock detected/i.test(`${run.stderr}\n${run.stdout}`)) break;
      }
      assert.equal(run.status, 0, run.stderr || run.stdout);
      assert.match(`${run.stdout}\n${run.stderr}`, /spaces_booking_e1_ok/);
    });
  });
});
