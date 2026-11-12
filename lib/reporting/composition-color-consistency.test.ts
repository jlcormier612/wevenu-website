import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { allocateIntegerPercents } from "@/lib/attribution/bookings-by-source";
import { UNKNOWN_SOURCE_KEY } from "@/lib/attribution/source";
import {
  NOT_RECORDED_COLOR,
  OTHER_SOURCE_KEY,
  STANDARD_SOURCE_COLORS,
  assignUniqueCompositionColors,
  buildDisplayComposition,
  compositionColorForSourceKey,
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

describe("permanent standard source color identity", () => {
  it("locks exact mandatory assignments", () => {
    assert.equal(STANDARD_SOURCE_COLORS.website, "#F0DFA6");
    assert.equal(STANDARD_SOURCE_COLORS.instagram, "#A9C9DA");
    assert.equal(STANDARD_SOURCE_COLORS.the_knot, "#D8A7AA");
    assert.equal(STANDARD_SOURCE_COLORS.referral, "#5D6F5D");
    assert.equal(STANDARD_SOURCE_COLORS.facebook, "#7B5EA0");
    assert.equal(STANDARD_SOURCE_COLORS.google, "#A7C2AF");
    assert.equal(STANDARD_SOURCE_COLORS.phone, "#63819A");
    assert.equal(NOT_RECORDED_COLOR, "#C9C0B3");
  });

  it("keeps Website and Referral identical across Leads and Bookings (Willow Grove)", () => {
    const leads = slices([
      { key: "website", label: "Website", count: 29 },
      { key: "referral", label: "Referral", count: 1 },
      { key: "phone", label: "Phone Call", count: 1 },
      { key: "facebook", label: "Facebook", count: 1 },
      { key: "google", label: "Google", count: 1 },
      { key: UNKNOWN_SOURCE_KEY, label: "Not recorded", count: 25 },
    ]);
    const bookings = slices([
      { key: "website", label: "Website", count: 2 },
      { key: "instagram", label: "Instagram", count: 2 },
      { key: "the_knot", label: "The Knot", count: 2 },
      { key: "referral", label: "Referral", count: 1 },
      { key: UNKNOWN_SOURCE_KEY, label: "Not recorded", count: 1 },
    ]);
    const a = buildDisplayComposition(leads);
    const b = buildDisplayComposition(bookings);
    assert.equal(colorOf(a, "website"), "#F0DFA6");
    assert.equal(colorOf(b, "website"), "#F0DFA6");
    assert.equal(colorOf(a, "referral"), "#5D6F5D");
    assert.equal(colorOf(b, "referral"), "#5D6F5D");
    assert.equal(colorOf(b, "instagram"), "#A9C9DA");
    assert.equal(colorOf(b, "the_knot"), "#D8A7AA");
    assert.equal(colorOf(a, UNKNOWN_SOURCE_KEY), NOT_RECORDED_COLOR);
    assert.equal(colorOf(b, UNKNOWN_SOURCE_KEY), NOT_RECORDED_COLOR);
  });

  it("does not recolor Website when Instagram is absent", () => {
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
    assert.equal(colorOf(withIg, "website"), "#F0DFA6");
    assert.equal(colorOf(withoutIg, "website"), "#F0DFA6");
  });

  it("does not recolor any standard source when counts change", () => {
    const high = buildDisplayComposition(
      slices([
        { key: "website", label: "Website", count: 50 },
        { key: "instagram", label: "Instagram", count: 10 },
        { key: "referral", label: "Referral", count: 5 },
      ]),
    );
    const low = buildDisplayComposition(
      slices([
        { key: "instagram", label: "Instagram", count: 50 },
        { key: "website", label: "Website", count: 10 },
        { key: "referral", label: "Referral", count: 5 },
      ]),
    );
    assert.equal(colorOf(high, "website"), colorOf(low, "website"));
    assert.equal(colorOf(high, "instagram"), colorOf(low, "instagram"));
    assert.equal(colorOf(high, "referral"), colorOf(low, "referral"));
    assert.equal(colorOf(high, "website"), "#F0DFA6");
    assert.equal(colorOf(high, "referral"), "#5D6F5D");
  });

  it("does not recolor when row order changes", () => {
    const a = assignUniqueCompositionColors([
      { key: "website" },
      { key: "referral" },
      { key: "instagram" },
    ]);
    const b = assignUniqueCompositionColors([
      { key: "instagram" },
      { key: "website" },
      { key: "referral" },
    ]);
    assert.equal(a[0], "#F0DFA6");
    assert.equal(a[1], "#5D6F5D");
    assert.equal(a[2], "#A9C9DA");
    assert.equal(b[0], "#A9C9DA");
    assert.equal(b[1], "#F0DFA6");
    assert.equal(b[2], "#5D6F5D");
  });

  it("keeps custom sources stable across reports and never steals Website yellow", () => {
    const custom = "willow_bridal_show";
    const a = compositionColorForSourceKey(custom);
    const b = compositionColorForSourceKey(custom);
    assert.equal(a, b);
    assert.notEqual(a, "#F0DFA6");
    assert.notEqual(a, STANDARD_SOURCE_COLORS.referral);

    const chart = buildDisplayComposition(
      slices([
        { key: "website", label: "Website", count: 10 },
        { key: custom, label: "Bridal Show", count: 99 },
      ]),
    );
    assert.equal(colorOf(chart, "website"), "#F0DFA6");
    assert.notEqual(colorOf(chart, custom), "#F0DFA6");
  });

  it("keeps custom source color when ranks and companions change", () => {
    const key = "custom_partner_network";
    const periodA = buildDisplayComposition(
      slices([
        { key, label: "Partner", count: 40 },
        { key: "website", label: "Website", count: 5 },
      ]),
    );
    const periodB = buildDisplayComposition(
      slices([
        { key: "website", label: "Website", count: 40 },
        { key, label: "Partner", count: 5 },
        { key: "instagram", label: "Instagram", count: 3 },
      ]),
    );
    assert.equal(colorOf(periodA, key), colorOf(periodB, key));
    assert.equal(colorOf(periodA, "website"), "#F0DFA6");
    assert.equal(colorOf(periodB, "website"), "#F0DFA6");
  });

  it("preserves totals/percents and Other expandability under high cardinality", () => {
    const many = slices(
      Array.from({ length: 12 }, (_, i) => ({
        key: `custom_source_${i}`,
        label: `Custom ${i}`,
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
    assert.equal(display.reduce((a, s) => a + s.percent, 0), 100);
    assert.equal(colorOf(display, OTHER_SOURCE_KEY)?.startsWith("color-mix"), true);
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
    assert.equal(colorOf(display, UNKNOWN_SOURCE_KEY), NOT_RECORDED_COLOR);
    assert.ok(!(other?.members ?? []).some((m) => m.key === UNKNOWN_SOURCE_KEY));
  });

  it("maps phone_call alias to the Phone Call identity", () => {
    assert.equal(compositionColorForSourceKey("phone_call"), "#63819A");
    assert.equal(compositionColorForSourceKey("phone"), "#63819A");
  });
});
