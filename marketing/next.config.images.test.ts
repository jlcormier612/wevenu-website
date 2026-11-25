import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

describe("marketing next.config image sizes", () => {
  const src = readFileSync(join(__dirname, "next.config.ts"), "utf8");

  it("caps deviceSizes at 1920 (no 2048/3840 srcset candidates)", () => {
    assert.match(src, /deviceSizes:\s*\[[^\]]*1920[^\]]*\]/);
    assert.doesNotMatch(src, /deviceSizes:\s*\[[^\]]*3840/);
    assert.doesNotMatch(src, /deviceSizes:\s*\[[^\]]*2048/);
  });
});
