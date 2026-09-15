import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { withTimeout } from "@/lib/async/with-timeout";

describe("withTimeout", () => {
  it("resolves when the promise settles in time", async () => {
    const value = await withTimeout(Promise.resolve(42), 100, "test");
    assert.equal(value, 42);
  });

  it("rejects when the promise exceeds the deadline", async () => {
    await assert.rejects(
      () =>
        withTimeout(
          new Promise<number>((resolve) => {
            setTimeout(() => resolve(1), 50);
          }),
          10,
          "slow load",
        ),
      /slow load timed out after 10ms/,
    );
  });
});
