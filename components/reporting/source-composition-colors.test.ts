import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { assignCompositionColors } from "@/components/reporting/source-composition-chart";
import {
  COMPOSITION_PALETTE,
  assignUniqueCompositionColors,
  buildDisplayComposition,
} from "@/lib/reporting/composition-display";
import { allocateIntegerPercents } from "@/lib/attribution/bookings-by-source";

describe("assignCompositionColors (chart re-export)", () => {
  it("never reuses a color and separates website / instagram", () => {
    const slices = [
      { key: "website" },
      { key: "instagram" },
      { key: "the_knot" },
      { key: "referral" },
      { key: "unknown" },
      { key: "other_custom" },
    ];
    const colors = assignCompositionColors(slices);
    assert.equal(colors.length, slices.length);
    assert.equal(new Set(colors).size, colors.length, "colors must be unique within the chart");
    assert.notEqual(colors[0], colors[1], "website and instagram must differ");
  });

  it("is deterministic for the same keys", () => {
    const slices = [{ key: "a" }, { key: "b" }, { key: "c" }];
    assert.deepEqual(assignCompositionColors(slices), assignCompositionColors(slices));
  });

  it("legend uses arc colors via buildDisplayComposition", () => {
    const src = readFileSync(resolve("components/reporting/source-composition-chart.tsx"), "utf8");
    assert.match(src, /buildDisplayComposition/);
    assert.match(src, /style=\{\{ backgroundColor: s\.color \}\}/);
    assert.doesNotMatch(src, /colorForIndex/);
    assert.match(src, /Sources included in Other/);
  });

  it("palette is large enough that 15 visible arcs stay unique before Other grouping", () => {
    assert.ok(COMPOSITION_PALETTE.length >= 20);
    const keys = Array.from({ length: 15 }, (_, i) => ({ key: `k${i}` }));
    assert.equal(new Set(assignUniqueCompositionColors(keys)).size, 15);
  });

  it("display path preserves input totals after Other grouping", () => {
    const counts = Array.from({ length: 20 }, (_, i) => Math.max(1, 20 - i));
    const percents = allocateIntegerPercents(counts);
    const slices = counts.map((count, i) => ({
      key: `s${i}`,
      label: `S${i}`,
      count,
      percent: percents[i]!,
    }));
    const inputTotal = slices.reduce((a, s) => a + s.count, 0);
    const display = buildDisplayComposition(slices);
    assert.equal(display.reduce((a, s) => a + s.count, 0), inputTotal);
    assert.equal(display.reduce((a, s) => a + s.percent, 0), 100);
    assert.equal(new Set(display.map((s) => s.color)).size, display.length);
  });
});
