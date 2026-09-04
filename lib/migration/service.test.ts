/**
 * Migration Center — resumability and partial-commit status logic.
 * Real calls against the two pure decision functions the resumable-UX
 * slice depends on (docs/migration-cutover-architecture.md follow-up:
 * File Retention, Resumability & Human-Friendly History) — not just
 * typechecking. These are exported specifically so this coverage doesn't
 * require a database.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeFinalSessionStatus, computeSessionResumeState } from "@/lib/migration/service";
import type { CommitOutcome, RecordStatus } from "@/lib/migration/types";

const ALL_STATUSES: RecordStatus[] = [
  "parsed", "normalized", "validated", "duplicate_exact", "duplicate_likely",
  "conflict", "needs_review", "approved", "rejected", "committed", "skipped",
];
function counts(overrides: Partial<Record<RecordStatus, number>>) {
  const base = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<RecordStatus, number>;
  return { ...base, ...overrides };
}
function outcome(o: Partial<CommitOutcome>): CommitOutcome {
  return { committed: 0, skipped: 0, failed: 0, ...o };
}

describe("computeSessionResumeState — Scenario A: upload and leave", () => {
  it("rows persisted but dedupe never ran (interrupted between addRows and runDedupe) resumes as needs_processing, not empty or lost", () => {
    const state = computeSessionResumeState(counts({ parsed: 3, normalized: 7 }));
    assert.equal(state, "needs_processing");
  });

  it("a session with literally nothing added yet is empty", () => {
    assert.equal(computeSessionResumeState(counts({})), "empty");
  });
});

describe("computeSessionResumeState — Scenario B: partial attention required", () => {
  it("valid records ready + some needing a decision is needs_review, not silently mixed", () => {
    const state = computeSessionResumeState(counts({ validated: 40, duplicate_likely: 2, needs_review: 1 }));
    assert.equal(state, "needs_review");
  });

  it("nothing needs review and nothing has been committed yet is ready_to_commit", () => {
    const state = computeSessionResumeState(counts({ validated: 42, duplicate_exact: 5 }));
    // duplicate_exact isn't "settled" until commit actually runs and marks it skipped —
    // before that it's neither unresolved (it needs no human decision) nor pending-commit.
    assert.equal(state, "ready_to_commit");
  });
});

describe("computeSessionResumeState — Scenario C: partial commit", () => {
  it("some committed, some still need a decision is partially_done — never silently 'complete'", () => {
    const state = computeSessionResumeState(counts({ committed: 42, duplicate_likely: 2, needs_review: 1 }));
    assert.equal(state, "partially_done");
  });

  it("everything resolved (committed + skipped, nothing pending) is done", () => {
    const state = computeSessionResumeState(counts({ committed: 42, skipped: 5 }));
    assert.equal(state, "done");
  });
});

describe("computeFinalSessionStatus — partial commit representation", () => {
  it("committing some records while others remain unresolved is partially_committed, not committed", () => {
    const status = computeFinalSessionStatus(outcome({ committed: 42, skipped: 5 }), /* stillUnresolved */ 3);
    assert.equal(status, "partially_committed");
  });

  it("everything committable succeeded and nothing remains unresolved is committed", () => {
    const status = computeFinalSessionStatus(outcome({ committed: 45, skipped: 5 }), 0);
    assert.equal(status, "committed");
  });

  it("commit called with nothing committable yet and unresolved records remain stays ready_for_review, not advanced", () => {
    const status = computeFinalSessionStatus(outcome({}), 3);
    assert.equal(status, "ready_for_review");
  });

  it("every committable record failed to create and nothing is unresolved is failed", () => {
    const status = computeFinalSessionStatus(outcome({ failed: 5 }), 0);
    assert.equal(status, "failed");
  });

  it("some creations failed but others succeeded, nothing left unresolved, is partially_committed", () => {
    const status = computeFinalSessionStatus(outcome({ committed: 40, failed: 2 }), 0);
    assert.equal(status, "partially_committed");
  });
});

describe("computeFinalSessionStatus / computeSessionResumeState — Scenario D: completed history stays accurate", () => {
  it("a fully committed session reports done/committed consistently across both functions", () => {
    const c = counts({ committed: 50 });
    assert.equal(computeSessionResumeState(c), "done");
    assert.equal(computeFinalSessionStatus(outcome({ committed: 50 }), 0), "committed");
  });

  it("intentional exclusion only (rejected, nothing left pending) is done — History must not stay Needs attention", () => {
    const c = counts({ rejected: 1 });
    assert.equal(computeSessionResumeState(c), "done");
    // Empty commit outcome with nothing unresolved advances to committed so
    // SessionListBadge shows Complete after Don't import settles the session.
    assert.equal(computeFinalSessionStatus(outcome({}), 0), "committed");
  });

  it("imported + intentionally excluded together is done", () => {
    assert.equal(computeSessionResumeState(counts({ committed: 5, rejected: 1 })), "done");
  });
});
