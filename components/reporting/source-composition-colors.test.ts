import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { assignCompositionColors } from "@/components/reporting/source-composition-chart";

describe("assignCompositionColors", () => {
  it("keeps adjacent slices on different colors and avoids adjacent dark greens", () => {
    const slices = [
      { key: "website" },
      { key: "instagram" },
      { key: "the_knot" },
      { key: "referral" },
      { key: "unknown" },
      { key: "other" },
    ];
    const colors = assignCompositionColors(slices);
    assert.equal(colors.length, slices.length);
    for (let i = 1; i < colors.length; i++) {
      assert.notEqual(colors[i], colors[i - 1], `adjacent colors collide at ${i}`);
    }
    const dark = new Set(["var(--chart-1)", "var(--chart-2)"]);
    for (let i = 1; i < colors.length; i++) {
      if (dark.has(colors[i]!) && dark.has(colors[i - 1]!)) {
        assert.fail(`adjacent dark greens at ${i}: ${colors[i - 1]} / ${colors[i]}`);
      }
    }
  });

  it("is deterministic for the same keys", () => {
    const slices = [{ key: "a" }, { key: "b" }, { key: "c" }];
    assert.deepEqual(assignCompositionColors(slices), assignCompositionColors(slices));
  });

  it("legend uses arc colors (shared assignment path)", () => {
    const src = readFileSync(resolve("components/reporting/source-composition-chart.tsx"), "utf8");
    assert.match(src, /assignCompositionColors/);
    assert.match(src, /style=\{\{ backgroundColor: s\.color \}\}/);
    assert.doesNotMatch(src, /colorForIndex/);
  });
});
