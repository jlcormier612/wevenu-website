import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

describe("Stage 1E founder-review: manual subscription alerts", () => {
  it("records manual subscription on the timeline without a persistent Alert notification", () => {
    const src = readFileSync(
      path.join(__dirname, "lifecycle.ts"),
      "utf8",
    );
    const start = src.indexOf("export async function createManualSubscription");
    assert.ok(start >= 0);
    const slice = src.slice(start, start + 3500);
    assert.match(slice, /type: "manual_subscription"/);
    assert.doesNotMatch(
      slice,
      /notification:\s*\{\s*type:\s*"subscription_purchased"/,
    );
    assert.match(
      slice,
      /Manual subscription stays on the relationship timeline/,
    );
  });
});
