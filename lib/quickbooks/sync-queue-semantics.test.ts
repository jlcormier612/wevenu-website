/**
 * QuickBooks sync queue — characterization of the behaviour a queue-recovery
 * fix must not regress.
 *
 * Reclaiming an abandoned 'processing' claim is only safe because every
 * entity push reads QuickBooks before it writes. These tests pin that
 * property, the backoff/dead-letter ceiling, and the claim transitions, so a
 * lease/reaper change cannot silently introduce duplicate QBO objects or
 * break dependency ordering.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { computeBackoffMs, computeNextAttemptAt, MAX_ATTEMPTS } from "@/lib/quickbooks/backoff";
import { classifyClaim, QUEUE_LEASE_MS } from "@/lib/quickbooks/queue-recovery";

const processor = readFileSync(resolve("lib/quickbooks/processor.ts"), "utf8");
const repository = readFileSync(resolve("lib/quickbooks/repository.ts"), "utf8");

describe("QuickBooks backoff and dead-letter ceiling", () => {
  it("grows exponentially from one minute and caps at six hours", () => {
    assert.equal(computeBackoffMs(0), 60_000);
    assert.equal(computeBackoffMs(1), 120_000);
    assert.equal(computeBackoffMs(2), 240_000);
    assert.equal(computeBackoffMs(20), 6 * 60 * 60_000);
  });

  it("never returns a delay below the base or above the cap", () => {
    for (let attempt = 0; attempt <= 30; attempt++) {
      const ms = computeBackoffMs(attempt);
      assert.ok(ms >= 60_000, `attempt ${attempt} below base`);
      assert.ok(ms <= 6 * 60 * 60_000, `attempt ${attempt} above cap`);
    }
  });

  it("is monotonic until it saturates", () => {
    for (let attempt = 1; attempt <= 30; attempt++) {
      assert.ok(computeBackoffMs(attempt) >= computeBackoffMs(attempt - 1));
    }
  });

  it("gives up after eight attempts", () => {
    assert.equal(MAX_ATTEMPTS, 8);
  });

  it("computeNextAttemptAt returns a future ISO timestamp", () => {
    const at = computeNextAttemptAt(0);
    assert.match(at, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(new Date(at).getTime() > Date.now());
  });
});

describe("every entity push reads QuickBooks before it writes", () => {
  // This is what makes replaying an uncertain claim safe: a push that already
  // created its QBO object adopts that object's id instead of creating a second.
  const cases: Array<{ file: string; qboType: string; matchOn: RegExp }> = [
    { file: "lib/quickbooks/sync/customer.ts", qboType: "Customer", matchOn: /DisplayName = '/ },
    { file: "lib/quickbooks/sync/invoice.ts", qboType: "Invoice", matchOn: /DocNumber = '/ },
    // Payment.PrivateNote and RefundReceipt.PrivateNote are not queryable
    // (Intuit ValidationFault 4001). Recovery uses the verified-queryable
    // PaymentRefNum / DocNumber fields instead — see
    // lib/quickbooks/payment-refund-idempotency.test.ts.
    { file: "lib/quickbooks/sync/payment.ts", qboType: "Payment", matchOn: /PaymentRefNum = '/ },
    { file: "lib/quickbooks/sync/refund.ts", qboType: "RefundReceipt", matchOn: /DocNumber = '/ },
  ];

  for (const { file, qboType, matchOn } of cases) {
    it(`${qboType} is looked up by a deterministic key before create`, () => {
      const src = readFileSync(resolve(file), "utf8");
      assert.match(src, new RegExp(`select \\* from ${qboType} where`), file);
      assert.match(src, matchOn, file);
      // The adopted id short-circuits the create.
      assert.match(src, /existingId/, file);
      const lookupAt = src.indexOf(`select * from ${qboType} where`);
      const createAt = src.search(/method: "POST"/);
      assert.ok(lookupAt >= 0 && createAt >= 0, `${file} must both query and create`);
      assert.ok(lookupAt < createAt, `${file} must query before it creates`);
    });
  }

  it("quotes are escaped so a name cannot break out of the QBO query", () => {
    for (const { file } of cases) {
      assert.match(readFileSync(resolve(file), "utf8"), /escapeQboString/, file);
    }
  });
});

describe("queue claim and release transitions", () => {
  it("a claim only succeeds from pending or failed_retrying", () => {
    const claim = repository.slice(
      repository.indexOf("export async function claimQueueItem"),
      repository.indexOf("export async function markQueueSucceeded"),
    );
    assert.match(claim, /status: "processing"/);
    assert.match(claim, /\.in\("status", \["pending", "failed_retrying"\]\)/);
  });

  it("releasing returns an item to pending without burning an attempt", () => {
    const release = repository.slice(
      repository.indexOf("export async function releaseQueueItem"),
      repository.indexOf("// ── quickbooks_sync_log"),
    );
    assert.match(release, /status: "pending"/);
    assert.doesNotMatch(release, /attempt_count/);
  });

  it("a disconnected venue releases the item rather than failing it", () => {
    const slice = processor.slice(
      processor.indexOf("const connection = await repo.getConnection"),
      processor.indexOf("const dependency = await checkDependency"),
    );
    assert.match(slice, /releaseQueueItem/);
    assert.match(slice, /result\.skipped\+\+/);
    assert.doesNotMatch(slice, /handleFailure/);
  });
});

describe("abandoned-claim classification", () => {
  const now = Date.parse("2026-10-08T12:00:00.000Z");
  const atAge = (ms: number) => new Date(now - ms).toISOString();

  it("never reclaims a claim that is still inside the lease", () => {
    for (const age of [0, 1_000, QUEUE_LEASE_MS - 1]) {
      assert.equal(
        classifyClaim({ updatedAt: atAge(age), lastAttemptedAt: null, nowMs: now }),
        "fresh",
        `age ${age}ms must stay fresh`,
      );
    }
  });

  it("reclaims a stale claim only when no dispatch marker was written", () => {
    assert.equal(
      classifyClaim({ updatedAt: atAge(QUEUE_LEASE_MS), lastAttemptedAt: null, nowMs: now }),
      "reclaimable",
    );
    assert.equal(
      classifyClaim({ updatedAt: atAge(QUEUE_LEASE_MS * 100), lastAttemptedAt: null, nowMs: now }),
      "reclaimable",
    );
  });

  it("holds a stale claim that may have reached Intuit", () => {
    assert.equal(
      classifyClaim({
        updatedAt: atAge(QUEUE_LEASE_MS * 100),
        lastAttemptedAt: atAge(QUEUE_LEASE_MS * 100),
        nowMs: now,
      }),
      "needs_review",
    );
  });

  it("leaves a row alone when the claim time is missing or unreadable", () => {
    for (const updatedAt of [null, "", "not-a-date"]) {
      assert.equal(
        classifyClaim({ updatedAt, lastAttemptedAt: null, nowMs: now }),
        "fresh",
        `updatedAt=${JSON.stringify(updatedAt)}`,
      );
    }
  });

  it("the lease is longer than the five-minute cron period", () => {
    assert.ok(QUEUE_LEASE_MS > 5 * 60_000);
  });
});

describe("recovery and selection are wired safely", () => {
  const reclaim = repository.slice(
    repository.indexOf("export async function reclaimAbandonedClaims"),
    repository.indexOf("export type QueueSnapshot"),
  );

  it("the tested rule is the executed rule — no second copy in SQL", () => {
    assert.match(reclaim, /classifyClaim\(/, "the reaper must call the pure classifier");
    assert.match(reclaim, /verdict === "reclaimable"/);
    assert.match(reclaim, /verdict === "needs_review"/);
  });

  it("only undispatched stale claims are returned to the queue", () => {
    // Re-asserted at write time, so a row dispatched between read and update
    // cannot be reclaimed.
    assert.match(reclaim, /\.eq\("status", "processing"\)/);
    assert.match(reclaim, /\.is\("last_attempted_at", null\)/);
    // Nothing was attempted, so nothing may count toward the dead-letter ceiling.
    assert.doesNotMatch(reclaim, /attempt_count/);
  });

  it("the dispatch marker is written before dispatch, not after", () => {
    const markerAt = processor.indexOf("await repo.markDispatchStarted");
    const dispatchAt = processor.indexOf("syncResult = await dispatch(");
    assert.ok(markerAt > 0 && dispatchAt > 0);
    assert.ok(markerAt < dispatchAt, "marker must precede the Intuit call");
  });

  it("claiming clears the previous attempt's marker", () => {
    const claim = repository.slice(
      repository.indexOf("export async function claimQueueItem"),
      repository.indexOf("export async function markQueueSucceeded"),
    );
    assert.match(claim, /last_attempted_at: null/);
  });

  it("due work is selected per connected venue and an empty list selects nothing", () => {
    const due = repository.slice(
      repository.indexOf("export async function getDueBatch"),
      repository.indexOf("export async function getConnectedVenueIds"),
    );
    assert.match(due, /if \(venueIds\.length === 0\) return \[\];/);
    assert.match(due, /\.in\("venue_id", venueIds\)/);
  });

  it("recovery runs before work is selected so freed rows run this tick", () => {
    assert.ok(
      processor.indexOf("reclaimAbandonedClaims") < processor.indexOf("repo.getDueBatch"),
    );
  });

  it("disconnected venues' work is retained, never deleted or dead-lettered", () => {
    assert.doesNotMatch(repository, /\.delete\(\)[\s\S]{0,200}quickbooks_sync_queue/);
    const snapshot = repository.slice(repository.indexOf("export type QueueSnapshot"));
    assert.match(snapshot, /deferredNoConnection/);
  });
});

describe("health signal separates idle from stuck", () => {
  const route = readFileSync(resolve("app/api/quickbooks/sync/process/route.ts"), "utf8");

  it("reports reclaimed, review and deferred counts plus the oldest eligible age", () => {
    for (const field of [
      "reclaimed",
      "needsReview",
      "deferredNoConnection",
      "oldestEligiblePendingAgeMs",
    ]) {
      assert.match(route, new RegExp(field), field);
    }
  });

  it("only says idle when there is genuinely nothing held", () => {
    assert.match(route, /idle, nothing queued/);
    assert.match(route, /result\.deferredNoConnection > 0/);
  });

  it("exposes no venue, entity or customer identifiers", () => {
    const summary = route.slice(
      route.indexOf("function summarizeQueueTick"),
      route.indexOf("/** GET — cron trigger */"),
    );
    assert.doesNotMatch(summary, /venue_id|venueId|entity_id|entityId|email|DisplayName/);
  });
});

describe("dependency ordering survives", () => {
  it("an invoice waits for its customer, a payment and refund for their invoice", () => {
    assert.match(processor, /Waiting on Customer sync\./);
    assert.match(processor, /Waiting on Invoice sync\./);
  });

  it("a dependency miss is always retryable, never an immediate dead-letter", () => {
    assert.match(processor, /handleFailure\(admin, item, dependency\.error, true\)/);
  });

  it("a deleted source record is not retryable", () => {
    const customer = readFileSync(resolve("lib/quickbooks/sync/customer.ts"), "utf8");
    assert.match(customer, /"Client not found\.", retryable: false/);
  });
});
