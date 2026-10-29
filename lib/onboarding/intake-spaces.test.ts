import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("intake space capacity updates", () => {
  it("updates capacity for an existing same-name space instead of only skipping", () => {
    const src = readFileSync(resolve("lib/onboarding/intake-service.ts"), "utf8");
    assert.match(src, /update\(\{ capacity: nextCapacity/);
    assert.match(src, /deterministic, not fuzzy/);
    assert.doesNotMatch(src, /if \(existingNames\.has\(key\)\) continue;/);
  });
});
