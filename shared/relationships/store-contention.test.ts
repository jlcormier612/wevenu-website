/**
 * Regression: CRM optimistic writes must not tight-loop replace_store on
 * version conflicts / timeouts (2026-10-11 Sandbox htc_crm_version_conflict storm),
 * and stale/busy replace must not block until the ~125s gateway timeout.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { fingerprintLiveStore, emptyLiveStore } from "./store.ts";
import type { LiveRelationshipStore } from "./types.ts";

const REPLACE_LOCK_MIGRATION =
  "supabase/migrations/20261414500000_htc_crm_replace_store_bounded_lock.sql";

describe("fingerprintLiveStore", () => {
  it("is stable for identical store contents", () => {
    const a = emptyLiveStore();
    const b = emptyLiveStore();
    assert.equal(fingerprintLiveStore(a), fingerprintLiveStore(b));
  });

  it("changes when a relationship is added", () => {
    const a = emptyLiveStore();
    const b: LiveRelationshipStore = emptyLiveStore();
    b.relationships.push({
      id: "rel_test",
      venue: { name: "Test" },
      owner: { email: "t@example.com" },
    } as LiveRelationshipStore["relationships"][number]);
    assert.notEqual(fingerprintLiveStore(a), fingerprintLiveStore(b));
  });
});

describe("contention helpers (source contract)", () => {
  it("store.ts treats timeouts and store_busy as retryable and skips no-op replaces", () => {
    const src = readFileSync(join(process.cwd(), "shared/relationships/store.ts"), "utf8");
    assert.match(src, /fingerprintLiveStore/);
    assert.match(src, /before === after/);
    assert.match(src, /isRetryableStoreContention/);
    assert.match(src, /upstream request timeout/);
    assert.match(src, /htc_crm_store_busy/);
    assert.match(src, /55P03/);
    assert.match(src, /backoffBeforeRetry/);
    assert.match(src, /CONFLICT_BACKOFF_BASE_MS/);
    assert.match(src, /MAX_OPTIMISTIC_RETRIES/);
    assert.doesNotMatch(src, /console\.(log|info|debug)\([^)]*p_store/);
    assert.doesNotMatch(src, /JSON\.stringify\(\s*normalized\s*\)/);
  });

  it("tickPaymentDunning no longer N+1 calls recordPaymentFailed", () => {
    const src = readFileSync(join(process.cwd(), "shared/relationships/lifecycle.ts"), "utf8");
    const tickFn = src.slice(src.indexOf("export async function tickPaymentDunning"));
    const body = tickFn.slice(0, tickFn.indexOf("export async function refreshRelationshipHealth"));
    assert.doesNotMatch(body, /recordPaymentFailed\(/);
    assert.match(body, /withLiveStore/);
  });

  it("replace_store migration rejects stale versions before lock and uses try-lock", () => {
    const sql = readFileSync(join(process.cwd(), REPLACE_LOCK_MIGRATION), "utf8");
    const bodyStart = sql.indexOf("as $$");
    const body = sql.slice(bodyStart);
    const tryLockAt = body.indexOf("pg_try_advisory_xact_lock(87201401)");
    const blockingLockAt = body.indexOf("pg_advisory_xact_lock(87201401)");
    const preCheckRaise = body.indexOf("htc_crm_version_conflict");
    const busyAt = body.indexOf("htc_crm_store_busy");
    assert.ok(tryLockAt > 0, "must use try_advisory_xact_lock");
    assert.equal(blockingLockAt, -1, "must not use blocking pg_advisory_xact_lock");
    assert.ok(preCheckRaise > 0 && preCheckRaise < tryLockAt, "version_conflict raise before try-lock");
    assert.ok(busyAt > tryLockAt, "store_busy after failed try-lock");
    assert.match(body, /errcode = '40001'/);
    assert.match(body, /errcode = '55P03'/);
    assert.match(body, /for update/);
  });
});
