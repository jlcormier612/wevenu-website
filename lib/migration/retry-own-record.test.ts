/**
 * Migration Center — retry-own-record flow. Unresolved records must stay
 * actionable: the venue can see why a record needs attention, retry it
 * through the canonical commit path, or intentionally exclude it — and none
 * of that should look like a silent skip.
 *
 * Item 6: duplicate_likely is review-only (Import anyway / Don't bring this
 * over). retryOwnRecord must refuse it before claimUnresolvedRecord — never
 * misreport it as a concurrent-retry conflict.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

import { DUPLICATE_LIKELY_RETRY_REFUSAL } from "@/lib/migration/service";

function retryOwnRecordBody(): string {
  const src = readFileSync(resolve("lib/migration/service.ts"), "utf8");
  const fnStart = src.indexOf("export async function retryOwnRecord");
  assert.ok(fnStart >= 0, "retryOwnRecord must exist");
  const nextFnStart = src.indexOf("\nexport async function ", fnStart + 1);
  return src.slice(fnStart, nextFnStart > 0 ? nextFnStart : undefined);
}

describe("retryOwnRecord uses the canonical commit path, not a shortcut", () => {
  it("claims the unresolved record and re-runs commitOneRecord, never a parallel insert", () => {
    const body = retryOwnRecordBody();

    assert.match(body, /repo\.claimUnresolvedRecord/);
    assert.match(body, /commitOneRecord\(actor\.client, session, record\.targetEntityType, record\)/);
    assert.match(body, /repo\.releaseClaim/);
    // Item 4: retry must sweep stale needs_review/conflict claims itself —
    // it has no "committing" phase that would otherwise run releaseStaleClaims.
    assert.match(body, /repo\.releaseStaleClaims/);
    assert.match(body, /unexpectedCommitErrorMessage|unexpected error interrupted/i);
    // Session status is recomputed from real unresolved counts, never optimistically advanced.
    assert.match(body, /computeFinalSessionStatus/);
  });

  it("refuses to retry a record that was already resolved (committed/rejected/skipped/duplicate)", () => {
    const body = retryOwnRecordBody();
    assert.match(body, /rejected[\s\S]*skipped[\s\S]*duplicate_exact|duplicate_exact[\s\S]*rejected[\s\S]*skipped/);
    assert.match(body, /already resolved/);
  });

  it("refuses duplicate_likely before claim — review/Import anyway path, not concurrent-retry conflict", () => {
    const body = retryOwnRecordBody();
    const likelyGate = body.indexOf('existing.status === "duplicate_likely"');
    const claimCall = body.indexOf("repo.claimUnresolvedRecord");
    assert.ok(likelyGate >= 0, "retryOwnRecord must explicitly gate duplicate_likely");
    assert.ok(claimCall >= 0, "claimUnresolvedRecord must still exist for needs_review/conflict");
    assert.ok(likelyGate < claimCall, "duplicate_likely must be refused before the claim attempt");

    assert.match(body, /DUPLICATE_LIKELY_RETRY_REFUSAL/);
    assert.match(
      DUPLICATE_LIKELY_RETRY_REFUSAL,
      /Import anyway|Don't bring this over/i,
    );
    assert.match(DUPLICATE_LIKELY_RETRY_REFUSAL, /duplicate|review/i);
    assert.doesNotMatch(
      DUPLICATE_LIKELY_RETRY_REFUSAL,
      /Someone else is already retrying/i,
    );
    // The concurrent-retry message remains for genuine claim races only —
    // after the duplicate_likely gate, not as the duplicate_likely response.
    const afterGate = body.slice(likelyGate);
    const refusalUse = afterGate.indexOf("DUPLICATE_LIKELY_RETRY_REFUSAL");
    const someoneElse = afterGate.indexOf("Someone else is already retrying");
    assert.ok(refusalUse >= 0, "duplicate_likely branch must return DUPLICATE_LIKELY_RETRY_REFUSAL");
    assert.ok(someoneElse > refusalUse, "claim-conflict copy must not be the duplicate_likely response");
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

  it("does not treat duplicate_likely as Try again — Import anyway / Don't bring this over only", () => {
    assert.match(
      src,
      /canRetry = !!r\.normalizedPayload && \(r\.status === "needs_review" \|\| r\.status === "conflict"\)/,
    );
    assert.match(src, /Import anyway/);
    assert.match(src, /Don&apos;t bring this over/);
  });

  it("intentional exclusion reads as intentional, not a vague Skip", () => {
    assert.match(src, /Don&apos;t bring this over/);
    assert.doesNotMatch(src, />Skip</);
  });

  it("tells the venue unresolved records will not disappear", () => {
    assert.match(src, /will not disappear/);
  });
});
