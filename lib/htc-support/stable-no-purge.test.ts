/**
 * Regression: STABLE support helpers must not call purge (DELETE).
 * That broke current_user_venue_id in PostgREST read-only transactions and
 * trapped multi-venue staff on /select-venue.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ROOT = join(process.cwd());

function extractPlpgsqlBody(sql: string, fnName: string): string {
  const start = sql.search(
    new RegExp(`create or replace function public\\.${fnName}\\(`, "i"),
  );
  assert.ok(start >= 0, `expected function ${fnName}`);
  const after = sql.slice(start);
  const open = after.indexOf("$$");
  assert.ok(open >= 0, `expected $$ open for ${fnName}`);
  const close = after.indexOf("$$;", open + 2);
  assert.ok(close > open, `expected $$; close for ${fnName}`);
  return after.slice(open + 2, close);
}

describe("HTC support STABLE helpers — no purge/DELETE", () => {
  const hotfix = readFileSync(
    join(ROOT, "supabase/migrations/20270310130100_htc_support_stable_no_purge.sql"),
    "utf8",
  );
  const stage1f = readFileSync(
    join(ROOT, "supabase/migrations/20270310120000_htc_support_context_stage1f.sql"),
    "utf8",
  );

  for (const [label, sql] of [
    ["hotfix migration", hotfix],
    ["stage1f source migration", stage1f],
  ] as const) {
    for (const fn of [
      "htc_support_mode",
      "htc_active_support_venue_id",
      "htc_get_support_context",
    ]) {
      it(`${label}: ${fn} does not purge`, () => {
        const body = extractPlpgsqlBody(sql, fn);
        assert.doesNotMatch(body, /htc_purge_expired_support_context/i);
        assert.doesNotMatch(body, /^\s*delete\b/im);
        assert.doesNotMatch(body, /perform\s+public\.htc_purge/i);
        assert.match(body, /expires_at\s*>\s*now\(\)/i);
      });
    }
  }
});
