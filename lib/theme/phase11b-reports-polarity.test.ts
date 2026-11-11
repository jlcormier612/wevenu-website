/**
 * Phase 11B final polish — comparison polarity display (Outstanding ≠ growth).
 * Does not change calculation formulas; asserts presentation helper only.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { comparisonDirectionClass } from "@/components/dashboard-system/comparison-card";
import { percentChange } from "@/lib/reporting/date-range";

describe("Phase 11B — comparisonDirectionClass polarity", () => {
  it("up-good: increase success, decrease destructive", () => {
    assert.equal(comparisonDirectionClass("up", "up-good"), "text-success");
    assert.equal(comparisonDirectionClass("down", "up-good"), "text-destructive");
  });

  it("up-bad (Outstanding): increase destructive, decrease success", () => {
    assert.equal(comparisonDirectionClass("up", "up-bad"), "text-destructive");
    assert.equal(comparisonDirectionClass("down", "up-bad"), "text-success");
  });

  it("flat and neutral stay muted", () => {
    assert.equal(comparisonDirectionClass("flat", "up-good"), "text-muted-foreground");
    assert.equal(comparisonDirectionClass("flat", "up-bad"), "text-muted-foreground");
    assert.equal(comparisonDirectionClass("up", "neutral"), "text-muted-foreground");
    assert.equal(comparisonDirectionClass("down", "neutral"), "text-muted-foreground");
  });
});

describe("Phase 11B — percentChange directions used by KPI cards", () => {
  it("increase / decrease / flat / prior-zero / both-zero", () => {
    assert.deepEqual(percentChange(120, 100), { pct: 20, direction: "up" });
    assert.deepEqual(percentChange(80, 100), { pct: -20, direction: "down" });
    assert.deepEqual(percentChange(100, 100), { pct: 0, direction: "flat" });
    assert.deepEqual(percentChange(50, 0), { pct: null, direction: "up" });
    assert.deepEqual(percentChange(0, 0), { pct: null, direction: "flat" });
    assert.deepEqual(percentChange(0, 100), { pct: -100, direction: "down" });
  });

  it("Outstanding decrease is direction down — polarity maps it to success", () => {
    const { direction } = percentChange(5_000, 8_000);
    assert.equal(direction, "down");
    assert.equal(comparisonDirectionClass(direction, "up-bad"), "text-success");
  });

  it("Outstanding increase is direction up — polarity maps it to destructive", () => {
    const { direction } = percentChange(12_000, 8_000);
    assert.equal(direction, "up");
    assert.equal(comparisonDirectionClass(direction, "up-bad"), "text-destructive");
  });
});
