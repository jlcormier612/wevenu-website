import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("ComparisonCard equal KPI dimensions", () => {
  it("forces equal-height cards in the grid regardless of sub-copy length", () => {
    const src = readFileSync(resolve("components/dashboard-system/comparison-card.tsx"), "utf8");
    assert.match(src, /auto-rows-fr/);
    assert.match(src, /items-stretch/);
    assert.match(src, /className="h-full/);
    assert.match(src, /mt-auto/);
  });
});
