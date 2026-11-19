import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RESEND_PACING_CRITICAL_RESERVED,
  RESEND_PACING_MAX_BULK,
  RESEND_PACING_MAX_TOTAL,
  RESEND_PACING_WINDOW_MS,
  RESEND_PROVIDER_RPS,
  acquireManySequential,
  maxGrantsInAnySlidingWindow,
  tryAcquireSlidingSlot,
  type SlidingAcquireEvent,
} from "./window-slot";

describe("Resend sliding-window slot pacing", () => {
  it("keeps operational target under the verified provider RPS", () => {
    assert.equal(RESEND_PROVIDER_RPS, 10);
    assert.equal(RESEND_PACING_MAX_TOTAL, 9);
    assert.ok(RESEND_PACING_MAX_TOTAL < RESEND_PROVIDER_RPS);
    assert.equal(RESEND_PACING_MAX_BULK, 6);
    assert.equal(RESEND_PACING_CRITICAL_RESERVED, 3);
    assert.equal(RESEND_PACING_WINDOW_MS, 1000);
  });

  it("two simulated services sharing one event log cannot exceed maxTotal", () => {
    const events: SlidingAcquireEvent[] = [];
    const nowMs = 1_700_000_000_500;
    let granted = 0;
    for (let i = 0; i < 20; i++) {
      const priority = i % 2 === 0 ? "critical" : "bulk";
      const r = tryAcquireSlidingSlot(events, priority, { nowMs });
      if (r.granted) granted += 1;
    }
    assert.equal(granted, RESEND_PACING_MAX_TOTAL);
    assert.equal(events.length, RESEND_PACING_MAX_TOTAL);
  });

  it("concurrent bulk senders cannot exceed bulk cap or total", () => {
    const { granted, denied, events } = acquireManySequential("bulk", 20, {
      nowMs: 1_700_000_001_500,
    });
    assert.equal(granted, RESEND_PACING_MAX_BULK);
    assert.equal(denied, 20 - RESEND_PACING_MAX_BULK);
    assert.ok(events.filter((e) => e.priority === "bulk").length <= RESEND_PACING_MAX_BULK);
  });

  it("reserves capacity for critical under bulk pressure", () => {
    const events: SlidingAcquireEvent[] = [];
    const nowMs = 1_700_000_002_100;
    for (let i = 0; i < RESEND_PACING_MAX_BULK + 5; i++) {
      tryAcquireSlidingSlot(events, "bulk", { nowMs });
    }
    assert.equal(events.filter((e) => e.priority === "bulk").length, RESEND_PACING_MAX_BULK);

    let criticalGranted = 0;
    for (let i = 0; i < 10; i++) {
      const r = tryAcquireSlidingSlot(events, "critical", { nowMs });
      if (r.granted) criticalGranted += 1;
    }
    assert.equal(criticalGranted, RESEND_PACING_CRITICAL_RESERVED);
    assert.equal(events.length, RESEND_PACING_MAX_TOTAL);
  });

  it("adjacent-second burst cannot exceed maxTotal in any sliding 1000ms", () => {
    const events: SlidingAcquireEvent[] = [];
    const tEndOfSecond = 1_700_000_003_999; // last ms of a unix second
    const tStartNext = 1_700_000_004_000; // first ms of next unix second

    // Fill nearly full at end of second N
    for (let i = 0; i < RESEND_PACING_MAX_TOTAL; i++) {
      const r = tryAcquireSlidingSlot(events, "critical", { nowMs: tEndOfSecond });
      assert.equal(r.granted, true);
    }

    // Immediate next-second acquires must be denied while prior grants remain in lookback
    let nextGranted = 0;
    for (let i = 0; i < RESEND_PACING_MAX_TOTAL; i++) {
      const r = tryAcquireSlidingSlot(events, "critical", { nowMs: tStartNext });
      if (r.granted) nextGranted += 1;
    }
    assert.equal(nextGranted, 0, "fixed-window would allow 9 more here — sliding must deny");

    const times = events.map((e) => e.atMs);
    assert.ok(maxGrantsInAnySlidingWindow(times) <= RESEND_PACING_MAX_TOTAL);

    // After the oldest ages out (>1000ms later), capacity returns
    const later = tEndOfSecond + RESEND_PACING_WINDOW_MS + 1;
    const recovered = tryAcquireSlidingSlot(events, "critical", { nowMs: later });
    assert.equal(recovered.granted, true);
  });

  it("spread grants across a boundary still respect sliding maxTotal", () => {
    const events: SlidingAcquireEvent[] = [];
    const base = 1_700_000_010_000;
    const grantTimes: number[] = [];
    // Attempt 9 at T, 9 at T+500 — second batch must be mostly denied
    for (let i = 0; i < 9; i++) {
      const r = tryAcquireSlidingSlot(events, "critical", { nowMs: base });
      if (r.granted) grantTimes.push(base);
    }
    for (let i = 0; i < 9; i++) {
      const r = tryAcquireSlidingSlot(events, "critical", { nowMs: base + 500 });
      if (r.granted) grantTimes.push(base + 500);
    }
    assert.equal(grantTimes.length, RESEND_PACING_MAX_TOTAL);
    assert.equal(maxGrantsInAnySlidingWindow(grantTimes), RESEND_PACING_MAX_TOTAL);
  });
});
