/**
 * Bounded QuickBooks requests, and the distinction that matters for financial
 * writes: a read that times out may be retried, a write that times out may not.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  classifyTransportFailure,
  isMutatingRequest,
  isTimeoutError,
  QUICKBOOKS_REQUEST_TIMEOUT_MS,
} from "@/lib/quickbooks/request-timeout";
import { QUEUE_LEASE_MS } from "@/lib/quickbooks/queue-recovery";

const timeout = Object.assign(new Error("The operation was aborted due to timeout"), {
  name: "TimeoutError",
});
const aborted = Object.assign(new Error("aborted"), { name: "AbortError" });
const dropped = new Error("fetch failed");

describe("request budget", () => {
  it("is bounded and well under the claim lease", () => {
    assert.ok(QUICKBOOKS_REQUEST_TIMEOUT_MS > 0);
    assert.ok(
      QUICKBOOKS_REQUEST_TIMEOUT_MS < QUEUE_LEASE_MS,
      "an in-flight request must not outlive the lease that judges claims abandoned",
    );
  });

  it("classifies methods that can change QuickBooks state", () => {
    assert.equal(isMutatingRequest(undefined), false);
    assert.equal(isMutatingRequest({}), false);
    assert.equal(isMutatingRequest({ method: "GET" }), false);
    assert.equal(isMutatingRequest({ method: "get" }), false);
    assert.equal(isMutatingRequest({ method: "POST" }), true);
    assert.equal(isMutatingRequest({ method: "post" }), true);
  });

  it("recognises both timeout and abort signals", () => {
    assert.equal(isTimeoutError(timeout), true);
    assert.equal(isTimeoutError(aborted), true);
    assert.equal(isTimeoutError(dropped), false);
    assert.equal(isTimeoutError(null), false);
    assert.equal(isTimeoutError("nope"), false);
  });
});

describe("a read that fails may be retried", () => {
  for (const [label, err] of [["timeout", timeout], ["dropped connection", dropped]] as const) {
    it(`${label} stays retryable and certain`, () => {
      const verdict = classifyTransportFailure({ mutating: false, err });
      assert.equal(verdict.retryable, true);
      assert.equal(verdict.uncertain, false);
    });
  }
});

describe("a write that fails is never silently replayed", () => {
  for (const [label, err] of [["timeout", timeout], ["dropped connection", dropped]] as const) {
    it(`${label} is uncertain and not retryable`, () => {
      const verdict = classifyTransportFailure({ mutating: true, err });
      assert.equal(verdict.uncertain, true, "a write with no confirmation must be uncertain");
      assert.equal(verdict.retryable, false, "an uncertain write must not re-enter the retry path");
    });
  }

  it("says why it is being held, without guessing the outcome", () => {
    const verdict = classifyTransportFailure({ mutating: true, err: timeout });
    assert.match(verdict.error, /outcome unknown/i);
    assert.match(verdict.error, /review/i);
    assert.doesNotMatch(verdict.error, /succeeded|failed to create|was not created/i);
  });

  it("reports the budget it exceeded", () => {
    const verdict = classifyTransportFailure({ mutating: true, err: timeout, timeoutMs: 1234 });
    assert.match(verdict.error, /1234ms/);
  });
});

describe("the client applies the budget everywhere it calls Intuit", () => {
  const client = readFileSync(resolve("lib/quickbooks/client.ts"), "utf8");

  it("every outbound fetch carries a timeout signal", () => {
    const fetches = client.match(/await fetch\(|=> fetch\(/g) ?? [];
    const signals = client.match(/AbortSignal\.timeout\(QUICKBOOKS_REQUEST_TIMEOUT_MS\)/g) ?? [];
    assert.ok(fetches.length > 0, "client must call fetch");
    assert.equal(signals.length, fetches.length, "each fetch needs its own timeout signal");
  });

  it("token refresh and API calls both handle a transport failure", () => {
    assert.ok((client.match(/catch \(err\)/g) ?? []).length >= 3);
  });

  it("a failed token refresh is not treated as a dead connection", () => {
    const slice = client.slice(client.indexOf("grant_type: \"refresh_token\""));
    assert.match(slice, /refreshTokenDead: false/);
  });
});

describe("uncertainty survives the whole call chain", () => {
  it("every sync path forwards it rather than dropping it", () => {
    for (const file of [
      "lib/quickbooks/sync/customer.ts",
      "lib/quickbooks/sync/invoice.ts",
      "lib/quickbooks/sync/payment.ts",
      "lib/quickbooks/sync/refund.ts",
      "lib/quickbooks/items.ts",
    ]) {
      const src = readFileSync(resolve(file), "utf8");
      const forwarded = (src.match(/uncertain: \w+Result\.uncertain/g) ?? []).length;
      const creates = (src.match(/method: "POST"/g) ?? []).length;
      assert.ok(forwarded >= creates, `${file} must forward uncertainty from each write`);
    }
  });

  it("the processor holds an uncertain write instead of failing or retrying it", () => {
    const processor = readFileSync(resolve("lib/quickbooks/processor.ts"), "utf8");
    const branch = processor.slice(
      processor.indexOf("} else if (syncResult.uncertain) {"),
      processor.indexOf("result.uncertainWrites++"),
    );
    assert.ok(branch.length > 0, "processor must have an uncertain branch");
    assert.match(branch, /markQueueUncertain/);
    // Neither the retry path nor the dead-letter path may claim this item.
    assert.doesNotMatch(branch, /handleFailure|markQueueFailedRetrying|markQueueDeadLetter/);
  });

  it("a throw from dispatch is held as uncertain, not failed and not fatal", () => {
    const processor = readFileSync(resolve("lib/quickbooks/processor.ts"), "utf8");
    const guarded = processor.slice(
      processor.indexOf("syncResult = await dispatch("),
      processor.indexOf("if (syncResult.ok) {"),
    );
    // An aborted response body on a create that QuickBooks did apply must not
    // escape the loop and abort the remaining batch.
    assert.match(guarded, /catch \(err\)/);
    assert.match(guarded, /uncertain: true/);
    assert.match(guarded, /retryable: false/);
  });

  it("holding leaves the claim and attempt count untouched so the lease can surface it", () => {
    const repository = readFileSync(resolve("lib/quickbooks/repository.ts"), "utf8");
    const fn = repository.slice(
      repository.indexOf("export async function markQueueUncertain"),
      repository.indexOf("export async function releaseQueueItem"),
    );
    assert.doesNotMatch(fn, /status:/, "status must stay 'processing'");
    assert.doesNotMatch(fn, /attempt_count/);
    assert.doesNotMatch(fn, /last_attempted_at/, "the dispatch marker must survive");
  });
});
