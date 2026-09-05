/**
 * Phase 2A — fill-rate inventory fixture: documents expected keys + SQL shape.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it, type TestContext } from "node:test";

import { ATTRIBUTION_FILL_RATE_SQL, ATTRIBUTION_SOURCE_DATA_KEYS } from "@/lib/attribution/fill-rate";
import { applyLocalMigrationFiles } from "@/lib/test/apply-local-migrations";
import { withLocalDbSchemaLock } from "@/lib/test/local-db-schema-lock";
import { resolve } from "node:path";

const LOCAL_DB = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function localReady(): boolean {
  const probe = spawnSync("psql", [LOCAL_DB, "-c", "select 1"], { encoding: "utf8", timeout: 3000 });
  return probe.status === 0;
}

describe("attribution fill-rate inventory", () => {
  it("lists expected source_data keys and runnable fill-rate SQL", async (t: TestContext) => {
    assert.ok(ATTRIBUTION_SOURCE_DATA_KEYS.includes("utm_source"));
    assert.ok(ATTRIBUTION_SOURCE_DATA_KEYS.includes("qr_campaign_id"));
    assert.ok(ATTRIBUTION_SOURCE_DATA_KEYS.includes("leadgen_id"));
    assert.ok(ATTRIBUTION_SOURCE_DATA_KEYS.includes("htc_anon_id"));
    assert.match(ATTRIBUTION_FILL_RATE_SQL, /acquisition_source/);
    assert.match(ATTRIBUTION_FILL_RATE_SQL, /utm_source/);
    assert.match(ATTRIBUTION_FILL_RATE_SQL, /htc_anon_id/);

    if (!localReady()) {
      t.skip("local Postgres is not running");
      return;
    }

    await withLocalDbSchemaLock(async () => {
      applyLocalMigrationFiles([
        resolve("supabase/migrations/20261337000000_lifecycle_booking_events.sql"),
        resolve("supabase/migrations/20261338000000_acquisition_attribution_foundation.sql"),
        resolve("supabase/migrations/20261339000000_reporting_frozen_acquisition_source.sql"),
      ], { dbUrl: LOCAL_DB, alreadyHoldingLock: true });

      const result = spawnSync("psql", [LOCAL_DB, "-v", "ON_ERROR_STOP=1", "-c", ATTRIBUTION_FILL_RATE_SQL], {
        encoding: "utf8",
        timeout: 15_000,
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /leads_total/);
      assert.match(result.stdout, /leads_with_acquisition_source/);
    });
  });
});
