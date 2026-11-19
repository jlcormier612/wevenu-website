import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  acquireResendSendSlot,
  createMemoryResendSlotStore,
  setResendSlotStoreForTests,
} from "./acquire";
import { RESEND_PACING_MAX_BULK, RESEND_PACING_MAX_TOTAL } from "./window-slot";

describe("acquireResendSendSlot", () => {
  it("two services sharing one memory store share one limiter", async () => {
    const shared = createMemoryResendSlotStore();
    setResendSlotStoreForTests(shared);
    const nowMs = 1_800_000_000_100;

    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        acquireResendSendSlot({
          priority: "critical",
          maxWaitMs: 0,
          nowMs,
        }),
      ),
    );

    const ok = results.filter((r) => r.ok).length;
    assert.equal(ok, RESEND_PACING_MAX_TOTAL);
    setResendSlotStoreForTests(null);
  });

  it("bulk defers immediately when capacity is full (no unbounded wait)", async () => {
    const shared = createMemoryResendSlotStore(
      Array.from({ length: RESEND_PACING_MAX_BULK }, () => ({
        atMs: 1_800_000_001_050,
        priority: "bulk" as const,
      })),
    );
    setResendSlotStoreForTests(shared);

    const result = await acquireResendSendSlot({
      priority: "bulk",
      maxWaitMs: 0,
      nowMs: 1_800_000_001_100,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "capacity");
      assert.equal(result.retryUnsafe, true);
    }
    setResendSlotStoreForTests(null);
  });

  it("critical can wait until oldest event ages out of the sliding window", async () => {
    const nowMs = 1_800_000_002_000;
    const shared = createMemoryResendSlotStore(
      Array.from({ length: RESEND_PACING_MAX_TOTAL }, () => ({
        atMs: nowMs - 50,
        priority: "critical" as const,
      })),
    );
    setResendSlotStoreForTests(shared);

    let slept = 0;
    const result = await acquireResendSendSlot({
      priority: "critical",
      maxWaitMs: 2000,
      nowMs,
      sleep: async (ms) => {
        slept += ms;
        // Age out prior events by advancing clock via mutating event times relative
        // to the next acquire's nowMs (handled by acquire loop incrementing nowMs).
        for (const e of shared.events) {
          e.atMs = nowMs - 2000;
        }
      },
    });

    assert.equal(result.ok, true);
    assert.ok(slept > 0);
    setResendSlotStoreForTests(null);
  });

  it("store/RPC failures fail closed (no silent bypass)", async () => {
    setResendSlotStoreForTests({
      async acquire() {
        throw new Error("db_down");
      },
    });
    const result = await acquireResendSendSlot({
      priority: "critical",
      maxWaitMs: 0,
      nowMs: Date.now(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "pacing_unavailable");
      assert.equal(result.retryUnsafe, true);
    }
    setResendSlotStoreForTests(null);
  });
});
