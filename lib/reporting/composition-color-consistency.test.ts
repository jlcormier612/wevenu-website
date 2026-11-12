import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { allocateIntegerPercents } from "@/lib/attribution/bookings-by-source";
import { UNKNOWN_SOURCE_KEY } from "@/lib/attribution/source";
import {
  OTHER_SOURCE_KEY,
  buildDisplayComposition,
  type CompositionSlice,
} from "@/lib/reporting/composition-display";

function slices(
  rows: Array<{ key: string; label: string; count: number }>,
): CompositionSlice[] {
  const positive = rows.filter((r) => r.count > 0);
  const percents = allocateIntegerPercents(positive.map((r) => r.count));
  return positive.map((r, i) => ({ ...r, percent: percents[i]! }));
}

function colorOf(display: ReturnType<typeof buildDisplayComposition>, key: string) {
  return display.find((s) => s.key === key)?.color ?? null;
}

describe("cross-chart composition color consistency", () => {
  it("keeps Website and Instagram distinct and stable when both are present", () => {
    const leads = slices([
      { key: "website", label: "Website", count: 40 },
      { key: "instagram", label: "Instagram", count: 25 },
      { key: "referral", label: "Referral", count: 10 },
    ]);
    const bookings = slices([
      { key: "website", label: "Website", count: 8 },
      { key: "instagram", label: "Instagram", count: 5 },
      { key: "referral", label: "Referral", count: 2 },
    ]);
    const a = buildDisplayComposition(leads);
    const b = buildDisplayComposition(bookings);
    assert.notEqual(colorOf(a, "website"), colorOf(a, "instagram"));
    assert.equal(colorOf(a, "website"), colorOf(b, "website"));
    assert.equal(colorOf(a, "instagram"), colorOf(b, "instagram"));
  });

  it("keeps Website color when Instagram is absent from the other chart", () => {
    const withIg = buildDisplayComposition(
      slices([
        { key: "website", label: "Website", count: 30 },
        { key: "instagram", label: "Instagram", count: 20 },
      ]),
    );
    const withoutIg = buildDisplayComposition(
      slices([
        { key: "website", label: "Website", count: 30 },
        { key: "the_knot", label: "The Knot", count: 12 },
      ]),
    );
    assert.equal(colorOf(withIg, "website"), colorOf(withoutIg, "website"));
  });

  it("preserves preferred colors across rank changes when no palette collision", () => {
    const periodA = buildDisplayComposition(
      slices([
        { key: "website", label: "Website", count: 50 },
        { key: "instagram", label: "Instagram", count: 10 },
        { key: "referral", label: "Referral", count: 5 },
      ]),
    );
    const periodB = buildDisplayComposition(
      slices([
        { key: "instagram", label: "Instagram", count: 50 },
        { key: "website", label: "Website", count: 10 },
        { key: "referral", label: "Referral", count: 5 },
      ]),
    );
    assert.equal(colorOf(periodA, "website"), colorOf(periodB, "website"));
    assert.equal(colorOf(periodA, "instagram"), colorOf(periodB, "instagram"));
  });

  it("documents collision behavior: second assignee may walk when preferred slots clash", () => {
    // Force many sources so preferred indices collide; uniqueness wins.
    const keys = Array.from({ length: 12 }, (_, i) => `src_${i}`);
    const a = buildDisplayComposition(
      slices(keys.map((key, i) => ({ key, label: key, count: 20 - i }))),
    );
    const b = buildDisplayComposition(
      slices(
        [...keys]
          .reverse()
          .map((key, i) => ({ key, label: key, count: 20 - i })),
      ),
    );
    assert.equal(new Set(a.map((s) => s.color)).size, a.length);
    assert.equal(new Set(b.map((s) => s.color)).size, b.length);
    // Some keys may differ between charts when rank/order changes collide —
    // acceptable; document how many stay stable.
    const shared = keys.filter((k) => colorOf(a, k) && colorOf(b, k) && colorOf(a, k) === colorOf(b, k));
    assert.ok(
      shared.length >= 1,
      `expected at least one stable key across reorder; stable=${shared.length}`,
    );
  });

  it("sources folded into Other lose individual arcs but totals stay reconciled", () => {
    const many = slices(
      Array.from({ length: 12 }, (_, i) => ({
        key: `s${i}`,
        label: `Very Long Custom Source Name ${i} WeddingWire Style`,
        count: 12 - i,
      })),
    );
    const display = buildDisplayComposition(many);
    const other = display.find((s) => s.key === OTHER_SOURCE_KEY);
    assert.ok(other?.members && other.members.length > 0);
    assert.equal(
      display.reduce((a, s) => a + s.count, 0),
      many.reduce((a, s) => a + s.count, 0),
    );
    // A folded member is not a top-level colored arc
    const foldedKey = other!.members![0]!.key;
    assert.equal(colorOf(display, foldedKey), null);
  });

  it("never places Not recorded inside Other members", () => {
    const input = slices([
      ...Array.from({ length: 10 }, (_, i) => ({
        key: `s${i}`,
        label: `S${i}`,
        count: 10 - i,
      })),
      { key: UNKNOWN_SOURCE_KEY, label: "Not recorded", count: 99 },
    ]);
    const display = buildDisplayComposition(input);
    const other = display.find((s) => s.key === OTHER_SOURCE_KEY);
    assert.ok(display.some((s) => s.key === UNKNOWN_SOURCE_KEY));
    assert.ok(!(other?.members ?? []).some((m) => m.key === UNKNOWN_SOURCE_KEY));
  });
});
