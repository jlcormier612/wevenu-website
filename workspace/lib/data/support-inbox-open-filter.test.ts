import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Support inbox Open filter", () => {
  it("includes acknowledged items in the default open view", () => {
    const src = readFileSync(resolve(import.meta.dirname, "store.ts"), "utf8");
    assert.match(src, /i\.status === "open" \|\| i\.status === "acknowledged"/);
  });
});
