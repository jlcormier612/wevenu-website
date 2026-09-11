import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defaultEqualLines,
  linesFromPreset,
  sumAmounts,
  syncAmountsFromPercentages,
  toCommitLines,
  validatePlanBuilderLines,
} from "@/lib/payments/plan-builder";

describe("Payment Plan Builder", () => {
  it("equal payments reconcile to invoice total", () => {
    const lines = defaultEqualLines(4, 8000);
    assert.equal(lines.length, 4);
    assert.equal(sumAmounts(lines.map((l) => l.amount)), 8000);
    assert.ok(lines.every((l) => l.amount === 2000));
  });

  it("1/3 preset reconciles cents on last line", () => {
    const lines = linesFromPreset("thirds", 8000);
    assert.equal(lines.length, 3);
    assert.equal(sumAmounts(lines.map((l) => l.amount)), 8000);
  });

  it("50/50 and four-payment presets equal invoice total", () => {
    for (const id of ["fifty_fifty", "wedding_four"] as const) {
      const lines = linesFromPreset(id, 8000);
      assert.equal(sumAmounts(lines.map((l) => l.amount)), 8000);
    }
  });

  it("rejects under-allocation", () => {
    const lines = defaultEqualLines(4, 8000).map((l, i) =>
      i === 3 ? { ...l, amount: 1500 } : l,
    );
    const v = validatePlanBuilderLines(lines, 8000, {
      eventDate: "2027-06-12",
      bookingDate: "2026-09-01",
    });
    assert.equal(v.ok, false);
    assert.equal(v.remaining, 500);
    assert.ok(v.errors.some((e) => e.includes("short")));
  });

  it("rejects over-allocation and zero amounts", () => {
    const lines = defaultEqualLines(2, 8000).map((l, i) =>
      i === 0 ? { ...l, amount: 5000 } : { ...l, amount: 4000 },
    );
    const v = validatePlanBuilderLines(lines, 8000, {
      eventDate: "2027-06-12",
      bookingDate: "2026-09-01",
    });
    assert.equal(v.ok, false);
    assert.ok(v.overAllocated > 0);

    const zero = defaultEqualLines(1, 8000).map((l) => ({ ...l, amount: 0 }));
    const zv = validatePlanBuilderLines(zero, 8000, {
      eventDate: "2027-06-12",
      bookingDate: "2026-09-01",
    });
    assert.equal(zv.ok, false);
  });

  it("syncAmountsFromPercentages keeps total exact", () => {
    const base = linesFromPreset("wedding_four", 8000);
    const synced = syncAmountsFromPercentages(
      base.map((l, i) => (i === 0 ? { ...l, pctOfTotal: 40 } : l)),
      8000,
    );
    // Still four lines; amounts from their pct — last absorbs remainder of whatever pct sum is.
    assert.equal(synced.length, 4);
    assert.equal(sumAmounts(synced.map((l) => l.amount)), 8000);
  });

  it("toCommitLines uses concrete due dates from timing", () => {
    const lines = linesFromPreset("fifty_fifty", 8000);
    const commit = toCommitLines(lines, {
      eventDate: "2027-06-12",
      bookingDate: "2026-09-01",
    });
    assert.equal(commit[0].dueDate, "2026-09-01");
    assert.ok(commit[1].dueDate.length === 10);
    assert.equal(sumAmounts(commit.map((c) => Number(c.amount))), 8000);
  });
});
