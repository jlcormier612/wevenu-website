/**
 * Migration Center — retry-own-record flow. Unresolved records must stay
 * actionable: the venue can see why a record needs attention, retry it
 * through the canonical commit path, or intentionally exclude it — and none
 * of that should look like a silent skip.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

describe("retryOwnRecord uses the canonical commit path, not a shortcut", () => {
  it("claims the unresolved record and re-runs commitOneRecord, never a parallel insert", () => {
    const src = readFileSync(resolve("lib/migration/service.ts"), "utf8");
    const fnStart = src.indexOf("export async function retryOwnRecord");
    assert.ok(fnStart >= 0, "retryOwnRecord must exist");
    const nextFnStart = src.indexOf("\nexport async function ", fnStart + 1);
    const body = src.slice(fnStart, nextFnStart > 0 ? nextFnStart : undefined);

    assert.match(body, /repo\.claimUnresolvedRecord/);
    assert.match(body, /commitOneRecord\(actor\.client, session, record\.targetEntityType, record\)/);
    assert.match(body, /repo\.releaseClaim/);
    // Session status is recomputed from real unresolved counts, never optimistically advanced.
    assert.match(body, /computeFinalSessionStatus/);
  });

  it("refuses to retry a record that was already resolved (committed/rejected/skipped/duplicate)", () => {
    const src = readFileSync(resolve("lib/migration/service.ts"), "utf8");
    const fnStart = src.indexOf("export async function retryOwnRecord");
    const nextFnStart = src.indexOf("\nexport async function ", fnStart + 1);
    const body = src.slice(fnStart, nextFnStart > 0 ? nextFnStart : undefined);
    assert.match(body, /rejected[\s\S]*skipped[\s\S]*duplicate_exact|duplicate_exact[\s\S]*rejected[\s\S]*skipped/);
    assert.match(body, /already resolved/);
  });
});

describe("Migration Center surfaces retry + explicit exclusion, not a silent skip", () => {
  const src = readFileSync(join(process.cwd(), "components/settings/migration-center.tsx"), "utf8");

  it("offers Try again for an unresolved record with something to retry", () => {
    assert.match(src, /Try again/);
    assert.match(src, /handleRetryRecord/);
    assert.match(src, /retryMigrationRecordAction/);
    assert.match(src, /canRetry/);
  });

  it("intentional exclusion reads as intentional, not a vague Skip", () => {
    assert.match(src, /Don&apos;t bring this over/);
    assert.doesNotMatch(src, />Skip</);
  });

  it("tells the venue unresolved records will not disappear", () => {
    assert.match(src, /will not disappear/);
  });
});
