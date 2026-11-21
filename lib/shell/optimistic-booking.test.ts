import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isClientDetailPath,
  OPTIMISTIC_BOOKING_KEY,
  readOptimisticBooking,
  writeOptimisticBooking,
} from "@/lib/shell/optimistic-booking";

describe("optimistic booking chrome storage", () => {
  it("accepts only /clients/<uuid> paths", () => {
    assert.equal(
      isClientDetailPath("/clients/a415ac52-cd74-42a6-8df7-7a8f6e71d080"),
      true,
    );
    assert.equal(isClientDetailPath("/clients"), false);
    assert.equal(isClientDetailPath("/clients/new"), false);
    assert.equal(isClientDetailPath("/leads/a415ac52-cd74-42a6-8df7-7a8f6e71d080"), false);
  });

  it("round-trips a chrome-only title and rejects empty titles", () => {
    const g = globalThis as { sessionStorage?: Storage };
    const store = new Map<string, string>();
    g.sessionStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => {
        store.set(k, v);
      },
      removeItem: (k) => {
        store.delete(k);
      },
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    };

    writeOptimisticBooking({
      path: "/clients/a415ac52-cd74-42a6-8df7-7a8f6e71d080",
      title: "Alex & Jordan",
    });
    assert.deepEqual(readOptimisticBooking(), {
      path: "/clients/a415ac52-cd74-42a6-8df7-7a8f6e71d080",
      title: "Alex & Jordan",
    });
    assert.ok(store.has(OPTIMISTIC_BOOKING_KEY));

    writeOptimisticBooking({
      path: "/clients/a415ac52-cd74-42a6-8df7-7a8f6e71d080",
      title: "   ",
    });
    assert.equal(readOptimisticBooking(), null);

    writeOptimisticBooking(null);
    assert.equal(store.has(OPTIMISTIC_BOOKING_KEY), false);
  });
});
