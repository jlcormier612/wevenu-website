import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { allocateIntegerPercents } from "@/lib/attribution/bookings-by-source";
import { UNKNOWN_SOURCE_KEY } from "@/lib/attribution/source";
import {
  COMPOSITION_MAX_INDIVIDUAL,
  COMPOSITION_PALETTE,
  NOT_RECORDED_COLOR,
  OTHER_COLOR,
  OTHER_SOURCE_KEY,
  assignUniqueCompositionColors,
  buildDisplayComposition,
  compositionPaletteIsUnique,
  groupCompositionSlicesForDisplay,
  type CompositionSlice,
} from "@/lib/reporting/composition-display";

function slicesFromCounts(rows: Array<{ key: string; label: string; count: number }>): CompositionSlice[] {
  const positive = rows.filter((r) => r.count > 0);
  const percents = allocateIntegerPercents(positive.map((r) => r.count));
  return positive.map((r, i) => ({ ...r, percent: percents[i]! }));
}

function makeN(n: number, opts?: { unknown?: number; even?: boolean }): CompositionSlice[] {
  const rows: Array<{ key: string; label: string; count: number }> = [];
  for (let i = 0; i < n; i++) {
    const count = opts?.even ? 10 : Math.max(1, n - i);
    rows.push({ key: `source_${i}`, label: `Source ${i}`, count });
  }
  if (opts?.unknown) {
    rows.push({ key: UNKNOWN_SOURCE_KEY, label: "Not recorded", count: opts.unknown });
  }
  return slicesFromCounts(rows);
}

describe("composition palette", () => {
  it("has unique entries and reserved neutrals are distinct", () => {
    assert.equal(compositionPaletteIsUnique(), true);
    assert.ok(COMPOSITION_PALETTE.length >= 20);
    assert.notEqual(NOT_RECORDED_COLOR, OTHER_COLOR);
    assert.ok(!COMPOSITION_PALETTE.includes(NOT_RECORDED_COLOR as (typeof COMPOSITION_PALETTE)[number]));
  });
});

describe("assignUniqueCompositionColors", () => {
  it("never reuses a color within one chart", () => {
    const keys = Array.from({ length: 20 }, (_, i) => ({ key: `src_${i}` }));
    const colors = assignUniqueCompositionColors(keys);
    assert.equal(new Set(colors).size, colors.length);
  });

  it("keeps Not recorded and Other on reserved colors", () => {
    const colors = assignUniqueCompositionColors([
      { key: "website" },
      { key: UNKNOWN_SOURCE_KEY },
      { key: OTHER_SOURCE_KEY },
      { key: "instagram" },
    ]);
    assert.equal(colors[1], NOT_RECORDED_COLOR);
    assert.equal(colors[2], OTHER_COLOR);
    assert.notEqual(colors[0], colors[3]);
    assert.notEqual(colors[0], NOT_RECORDED_COLOR);
  });

  it("is deterministic for the same keys in the same order", () => {
    const slices = [{ key: "website" }, { key: "instagram" }, { key: "the_knot" }];
    assert.deepEqual(assignUniqueCompositionColors(slices), assignUniqueCompositionColors(slices));
  });

  it("keeps website and instagram on different colors (the reported collision)", () => {
    const colors = assignUniqueCompositionColors([{ key: "website" }, { key: "instagram" }]);
    assert.notEqual(colors[0], colors[1]);
  });
});

describe("groupCompositionSlicesForDisplay", () => {
  it("preserves totals for 1, 2, 5, 8, 12, and 20+ sources", () => {
    for (const n of [1, 2, 5, 8, 12, 20, 30]) {
      const input = makeN(n);
      const inputTotal = input.reduce((a, s) => a + s.count, 0);
      const { display, membersByOther } = groupCompositionSlicesForDisplay(input);
      const displayTotal = display.reduce((a, s) => a + s.count, 0);
      const memberTotal = membersByOther.reduce((a, s) => a + s.count, 0);
      assert.equal(displayTotal, inputTotal, `n=${n} total`);
      const other = display.find((s) => s.key === OTHER_SOURCE_KEY);
      if (n > COMPOSITION_MAX_INDIVIDUAL) {
        assert.ok(other, `n=${n} expects Other`);
        assert.equal(other!.count, memberTotal);
        assert.equal(display.filter((s) => s.key !== OTHER_SOURCE_KEY && s.key !== UNKNOWN_SOURCE_KEY).length, COMPOSITION_MAX_INDIVIDUAL);
      } else {
        assert.equal(other, undefined);
        assert.equal(membersByOther.length, 0);
      }
      assert.equal(display.reduce((a, s) => a + s.percent, 0), 100);
    }
  });

  it("never folds Not recorded into Other", () => {
    const input = makeN(12, { unknown: 50 });
    const { display, membersByOther } = groupCompositionSlicesForDisplay(input);
    assert.ok(display.some((s) => s.key === UNKNOWN_SOURCE_KEY));
    assert.ok(!membersByOther.some((s) => s.key === UNKNOWN_SOURCE_KEY));
  });

  it("handles empty and zero-valued categories", () => {
    assert.deepEqual(groupCompositionSlicesForDisplay([]), { display: [], membersByOther: [] });
    const withZero = slicesFromCounts([
      { key: "website", label: "Website", count: 5 },
      { key: "dead", label: "Dead", count: 0 },
    ]);
    // slicesFromCounts already drops zeros; also tolerate zeros if passed
    const { display } = groupCompositionSlicesForDisplay([
      ...withZero,
      { key: "zero", label: "Zero", count: 0, percent: 0 },
    ]);
    assert.ok(display.every((s) => s.count > 0));
  });

  it("supports one dominant source and even distributions", () => {
    const dominant = slicesFromCounts([
      { key: "website", label: "Website", count: 100 },
      ...Array.from({ length: 10 }, (_, i) => ({ key: `s${i}`, label: `S${i}`, count: 1 })),
    ]);
    const { display } = groupCompositionSlicesForDisplay(dominant);
    assert.equal(display[0]?.key, "website");
    assert.ok(display.some((s) => s.key === OTHER_SOURCE_KEY));

    const even = makeN(15, { even: true });
    const g = groupCompositionSlicesForDisplay(even);
    assert.equal(g.display.reduce((a, s) => a + s.count, 0), even.reduce((a, s) => a + s.count, 0));
  });

  it("keeps custom / unknown source names without a hardcoded allowlist", () => {
    const input = slicesFromCounts([
      { key: "bridal_expo_custom", label: "Bridal Expo Custom", count: 4 },
      { key: "friend_of_owner", label: "Friend of Owner", count: 3 },
      { key: UNKNOWN_SOURCE_KEY, label: "Not recorded", count: 2 },
    ]);
    const { display } = groupCompositionSlicesForDisplay(input);
    assert.deepEqual(
      display.map((s) => s.key).sort(),
      ["bridal_expo_custom", "friend_of_owner", UNKNOWN_SOURCE_KEY].sort(),
    );
  });
});

describe("buildDisplayComposition", () => {
  it("attaches Other members and unique colors", () => {
    const input = makeN(12);
    const display = buildDisplayComposition(input);
    const colors = display.map((s) => s.color);
    assert.equal(new Set(colors).size, colors.length);
    const other = display.find((s) => s.key === OTHER_SOURCE_KEY);
    assert.ok(other?.members && other.members.length > 0);
    assert.equal(
      other!.count,
      other!.members!.reduce((a, m) => a + m.count, 0),
    );
  });

  it("stable preferred mapping for the same solo source across charts", () => {
    const a = buildDisplayComposition(makeN(1));
    const b = buildDisplayComposition(slicesFromCounts([{ key: "source_0", label: "Source 0", count: 99 }]));
    assert.equal(a[0]?.color, b[0]?.color);
  });
});
