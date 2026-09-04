/**
 * Migration Center — commit-race protection (claimRecord/releaseStaleClaims/
 * releaseClaim/countInFlightClaims). Real calls against an in-memory fake
 * table that actually respects WHERE-clause semantics (unlike the simpler
 * canned-response mocks used elsewhere in this codebase) — this is the one
 * piece where the mock has to behave like a real conditional UPDATE, not
 * just return fixed data, or these tests couldn't prove anything about the
 * race guarantee.
 *
 * This proves the query/logic is correctly shaped — that a claim attempt
 * against an already-claimed row affects zero rows and returns null. It
 * does not, and cannot, prove Postgres's own MVCC/row-locking guarantee for
 * two truly concurrent connections; that guarantee is Postgres's own
 * well-established behavior for a conditional UPDATE, exercised here only
 * through this codebase's own query shape, not against a live database.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { claimRecord, claimUnresolvedRecord, countInFlightClaims, releaseClaim, releaseStaleClaims } from "@/lib/migration/repository";

type FakeRow = Record<string, unknown> & { id: string };

function makeRow(overrides: Partial<FakeRow>): FakeRow {
  return {
    id: "rec-1", session_id: "session-1", venue_id: "venue-1", source_row_ref: null,
    raw_payload: {}, target_entity_type: "client", normalized_payload: { firstName: "Jamie" },
    status: "validated", match_type: "none", matched_entity_id: null, match_confidence: null,
    conflict_fields: null, validation_errors: null, created_entity_id: null,
    reviewed_by: null, reviewed_at: null, committed_at: null, created_at: new Date().toISOString(),
    claimed_at: null, claimed_by: null,
    ...overrides,
  };
}

/**
 * A minimal fake `migration_records` table: filters (.eq/.in/.is/.not/.lt)
 * narrow an in-memory candidate set; `.update(patch)` stages a pending
 * patch; whichever terminal is called (`.select().maybeSingle()`, a bare
 * await, or `.select(cols,{count,head:true})`) applies the patch (if any)
 * to whatever the filters actually matched at that moment, and only that.
 */
function fakeTable(rows: FakeRow[]) {
  return {
    update(patch: Partial<FakeRow>) { return chain(patch, false); },
    select(_cols?: string, opts?: { count?: string; head?: boolean }) {
      return chain(null, opts?.count === "exact");
    },
  };

  // `countMode` has to live in this same closure for the whole chain, not
  // get lost after the first filter call — every intermediate .eq()/.in()/
  // etc. below returns this exact `api` object, so whichever terminal
  // (.then/.maybeSingle) eventually fires still knows whether this was a
  // count query.
  function chain(pendingPatch: Partial<FakeRow> | null, countMode: boolean) {
    let predicate: (r: FakeRow) => boolean = () => true;
    const withPredicate = (p: (r: FakeRow) => boolean) => { const prev = predicate; predicate = (r) => prev(r) && p(r); return api; };
    function currentMatches() { return rows.filter(predicate); }
    function applyPatchIfAny() {
      if (!pendingPatch) return;
      for (const r of currentMatches()) Object.assign(r, pendingPatch);
    }
    const api = {
      eq: (col: string, val: unknown) => withPredicate((r) => r[col] === val),
      in: (col: string, vals: unknown[]) => withPredicate((r) => vals.includes(r[col])),
      is: (col: string, val: null) => withPredicate((r) => r[col] === val),
      not: (col: string, _op: string, val: null) => withPredicate((r) => r[col] !== val),
      lt: (col: string, val: string) => withPredicate((r) => (r[col] as string) < val),
      select: (_cols?: string) => api,
      async maybeSingle() {
        const matches = currentMatches();
        applyPatchIfAny();
        return { data: matches.length > 0 ? { ...matches[0] } : null };
      },
      then(resolve: (v: { data: null } | { count: number }) => void) {
        if (countMode) { resolve({ count: currentMatches().length }); return; }
        applyPatchIfAny();
        resolve({ data: null });
      },
    };
    return api;
  }
}

function mockClientFor(rows: FakeRow[]) {
  const table = fakeTable(rows);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: (_name: string) => table } as any;
}

describe("claimRecord — commit-race protection", () => {
  it("claims an unclaimed validated record", async () => {
    const rows = [makeRow({ id: "rec-1", status: "validated", claimed_at: null })];
    const client = mockClientFor(rows);
    const claimed = await claimRecord(client, "rec-1", "user-1");
    assert.ok(claimed);
    assert.equal(claimed!.id, "rec-1");
    assert.ok(rows[0].claimed_at, "the underlying row should now be marked claimed");
    assert.equal(rows[0].claimed_by, "user-1");
  });

  it("a second claim attempt against an already-claimed record fails — the actual race guarantee", async () => {
    const rows = [makeRow({ id: "rec-1", status: "validated", claimed_at: new Date().toISOString(), claimed_by: "user-A" })];
    const client = mockClientFor(rows);
    const secondAttempt = await claimRecord(client, "rec-1", "user-B");
    assert.equal(secondAttempt, null, "a record already claimed by another request must not be claimable again");
    assert.equal(rows[0].claimed_by, "user-A", "the original claimant must not be overwritten by the losing request");
  });

  it("simulates two requests racing for the same record — at most one wins", async () => {
    const rows = [makeRow({ id: "rec-1", status: "validated", claimed_at: null })];
    const client = mockClientFor(rows);
    // Sequential (JS is single-threaded), but against genuinely shared,
    // mutated state — models exactly what a real conditional UPDATE
    // guarantees under concurrency: the first to commit its WHERE-matched
    // UPDATE wins, and the second's WHERE clause no longer matches.
    const [first, second] = await Promise.all([
      claimRecord(client, "rec-1", "user-A"),
      claimRecord(client, "rec-1", "user-B"),
    ]);
    const winners = [first, second].filter((r) => r !== null);
    assert.equal(winners.length, 1, "exactly one of the two racing claims must succeed");
  });

  it("cannot claim a record that isn't validated/approved (e.g. already committed)", async () => {
    const rows = [makeRow({ id: "rec-1", status: "committed", claimed_at: null })];
    const client = mockClientFor(rows);
    const claimed = await claimRecord(client, "rec-1", "user-1");
    assert.equal(claimed, null);
  });
});

describe("releaseClaim", () => {
  it("clears claimed_at/claimed_by", async () => {
    const rows = [makeRow({ id: "rec-1", claimed_at: new Date().toISOString(), claimed_by: "user-1" })];
    const client = mockClientFor(rows);
    await releaseClaim(client, "rec-1");
    assert.equal(rows[0].claimed_at, null);
    assert.equal(rows[0].claimed_by, null);
  });
});

describe("releaseStaleClaims — crash recovery", () => {
  it("releases a claim older than the threshold, leaving a fresh in-flight claim alone", async () => {
    const old = new Date(Date.now() - 10 * 60_000).toISOString();
    const fresh = new Date().toISOString();
    const rows = [
      makeRow({ id: "rec-old", session_id: "s1", status: "validated", claimed_at: old, claimed_by: "crashed-process" }),
      makeRow({ id: "rec-fresh", session_id: "s1", status: "validated", claimed_at: fresh, claimed_by: "still-running" }),
    ];
    const client = mockClientFor(rows);
    const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
    await releaseStaleClaims(client, "s1", cutoff);
    assert.equal(rows[0].claimed_at, null, "a stale (abandoned) claim should be released so it can be retried");
    assert.equal(rows[1].claimed_at, fresh, "a genuinely in-flight claim must not be touched");
  });

  it("never touches a record that already resolved (committed) even if its claim was never explicitly released", async () => {
    const old = new Date(Date.now() - 10 * 60_000).toISOString();
    const rows = [makeRow({ id: "rec-1", session_id: "s1", status: "committed", claimed_at: old })];
    const client = mockClientFor(rows);
    await releaseStaleClaims(client, "s1", new Date(Date.now() - 5 * 60_000).toISOString());
    assert.equal(rows[0].claimed_at, old, "a resolved record's claim history should not be rewritten by stale-claim recovery");
  });
});

describe("countInFlightClaims", () => {
  it("counts only claimed, still-pending records for the given session", async () => {
    const rows = [
      makeRow({ id: "r1", session_id: "s1", status: "validated", claimed_at: new Date().toISOString() }),
      makeRow({ id: "r2", session_id: "s1", status: "approved", claimed_at: new Date().toISOString() }),
      makeRow({ id: "r3", session_id: "s1", status: "validated", claimed_at: null }), // unclaimed — not in flight
      makeRow({ id: "r4", session_id: "s1", status: "committed", claimed_at: new Date().toISOString() }), // resolved — not pending
      makeRow({ id: "r5", session_id: "s2", status: "validated", claimed_at: new Date().toISOString() }), // different session
    ];
    const client = mockClientFor(rows);
    const count = await countInFlightClaims(client, "s1");
    assert.equal(count, 2);
  });

  it("returns 0 for a session with nothing claimed", async () => {
    const rows = [makeRow({ id: "r1", session_id: "s1", status: "validated", claimed_at: null })];
    const client = mockClientFor(rows);
    assert.equal(await countInFlightClaims(client, "s1"), 0);
  });
});

describe("claimUnresolvedRecord — retry of durable needs_review / conflict", () => {
  it("claims an unclaimed needs_review record for Try again", async () => {
    const rows = [makeRow({ id: "rec-1", status: "needs_review", claimed_at: null })];
    const client = mockClientFor(rows);
    const claimed = await claimUnresolvedRecord(client, "rec-1", "user-1");
    assert.ok(claimed);
    assert.equal(rows[0].claimed_by, "user-1");
  });

  it("does not claim validated rows (those use claimRecord)", async () => {
    const rows = [makeRow({ id: "rec-1", status: "validated", claimed_at: null })];
    const client = mockClientFor(rows);
    assert.equal(await claimUnresolvedRecord(client, "rec-1", "user-1"), null);
  });

  it("refuses a second concurrent retry claim", async () => {
    const rows = [makeRow({ id: "rec-1", status: "needs_review", claimed_at: new Date().toISOString(), claimed_by: "user-A" })];
    const client = mockClientFor(rows);
    assert.equal(await claimUnresolvedRecord(client, "rec-1", "user-B"), null);
  });
});
