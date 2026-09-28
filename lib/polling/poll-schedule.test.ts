/**
 * Regression tests for the 2026-09-28 Sandbox refresh storm.
 *
 * The notification bells polled on a fixed 60s interval and ignored failures,
 * so a failing Supabase never saw offered load decay. These lock in that a
 * failing poller backs off, stays capped, and de-synchronises from other tabs.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_MAX_POLL_MS,
  DEFAULT_POLL_MS,
  nextPollDelayMs,
} from "./poll-schedule.ts";

// Pin jitter so the assertions below describe the schedule, not the RNG.
const noJitter = () => 0;
const fullJitter = () => 1;

describe("nextPollDelayMs", () => {
  it("holds the steady cadence while the poll is succeeding", () => {
    assert.equal(
      nextPollDelayMs({ consecutiveFailures: 0, jitter: noJitter }),
      DEFAULT_POLL_MS,
    );
  });

  it("backs off exponentially once polls start failing", () => {
    const delays = [1, 2, 3].map((failures) =>
      nextPollDelayMs({ consecutiveFailures: failures, jitter: noJitter }),
    );
    assert.deepEqual(delays, [120_000, 240_000, 480_000]);
  });

  it("never retries faster than the steady cadence after a failure", () => {
    for (let failures = 1; failures <= 12; failures += 1) {
      for (const jitter of [noJitter, fullJitter]) {
        const delay = nextPollDelayMs({ consecutiveFailures: failures, jitter });
        assert.ok(
          delay > DEFAULT_POLL_MS,
          `failure ${failures} produced ${delay}ms, which is not slower than the healthy cadence`,
        );
      }
    }
  });

  it("caps the backoff so a long outage still leaves tabs recovering", () => {
    // A tab left open through a multi-hour outage must not drift to hours
    // between retries, and must not overflow to Infinity.
    for (const failures of [8, 20, 500, 10_000]) {
      const delay = nextPollDelayMs({ consecutiveFailures: failures, jitter: noJitter });
      assert.ok(Number.isFinite(delay), `failure ${failures} produced ${delay}`);
      assert.ok(
        delay <= DEFAULT_MAX_POLL_MS,
        `failure ${failures} produced ${delay}ms, above the ${DEFAULT_MAX_POLL_MS}ms cap`,
      );
    }
  });

  it("jitters retries so many tabs do not retry in lockstep", () => {
    const earliest = nextPollDelayMs({ consecutiveFailures: 4, jitter: fullJitter });
    const latest = nextPollDelayMs({ consecutiveFailures: 4, jitter: noJitter });
    assert.ok(
      earliest < latest,
      "jitter must spread retries across a window, not collapse to one instant",
    );
    // Still a meaningful backoff at the earliest end of the window.
    assert.ok(earliest > DEFAULT_POLL_MS);
  });

  it("treats negative or fractional failure counts as the healthy cadence", () => {
    assert.equal(
      nextPollDelayMs({ consecutiveFailures: -3, jitter: noJitter }),
      DEFAULT_POLL_MS,
    );
    assert.equal(
      nextPollDelayMs({ consecutiveFailures: 0.7, jitter: noJitter }),
      DEFAULT_POLL_MS,
    );
  });
});
