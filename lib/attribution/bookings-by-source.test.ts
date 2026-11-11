/**
 * Bookings-by-Source pure aggregation — period vs cohort semantics stay in callers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allocateIntegerPercents,
  buildBookingsBySourceBreakdown,
  buildBookingsBySourceBreakdownFromCounts,
} from "@/lib/attribution/bookings-by-source";
import { UNKNOWN_SOURCE_KEY, UNKNOWN_SOURCE_LABEL } from "@/lib/attribution/source";

describe("Bookings by Source breakdown", () => {
  it("groups multiple sources with counts and percents that sum to 100", () => {
    const b = buildBookingsBySourceBreakdown([
      "the_knot",
      "the_knot",
      "wedding_wire",
      "website",
      "referral",
      "referral",
      "referral",
    ]);
    assert.equal(b.total, 7);
    const byKey = Object.fromEntries(b.slices.map((s) => [s.key, s]));
    assert.equal(byKey.referral?.count, 3);
    assert.equal(byKey.the_knot?.count, 2);
    assert.equal(byKey.wedding_wire?.count, 1);
    assert.equal(byKey.website?.count, 1);
    assert.equal(
      b.slices.reduce((a, s) => a + s.percent, 0),
      100,
    );
  });

  it("excludes leads that never booked when only booked sources are passed", () => {
    // Caller filters to booked only — unbooked leads never appear in sources[].
    const b = buildBookingsBySourceBreakdown(["website", "website"]);
    assert.equal(b.total, 2);
    assert.equal(b.slices.length, 1);
    assert.equal(b.slices[0]!.key, "website");
  });

  it("attributes leadless / missing / other as Not recorded", () => {
    const b = buildBookingsBySourceBreakdown([null, undefined, "", "other"]);
    assert.equal(b.total, 4);
    assert.equal(b.slices.length, 1);
    assert.equal(b.slices[0]!.key, UNKNOWN_SOURCE_KEY);
    assert.equal(b.slices[0]!.label, UNKNOWN_SOURCE_LABEL);
    assert.equal(b.slices[0]!.percent, 100);
  });

  it("keeps email_parsed_generic as its own vocabulary key (existing attribution rule)", () => {
    const b = buildBookingsBySourceBreakdown(["email_parsed_generic", "website"]);
    assert.equal(b.total, 2);
    assert.ok(b.slices.some((s) => s.key === "email_parsed_generic"));
    assert.ok(b.slices.some((s) => s.key === "website"));
  });

  it("preserves venue-defined custom source keys", () => {
    const b = buildBookingsBySourceBreakdown(["bridal_show_2026", "bridal_show_2026", "instagram"]);
    assert.equal(b.total, 3);
    const custom = b.slices.find((s) => s.key === "bridal_show_2026");
    assert.ok(custom);
    assert.equal(custom!.count, 2);
  });

  it("counts multiple bookings for the same source without collapsing to one", () => {
    const b = buildBookingsBySourceBreakdown(["website", "website", "website"]);
    assert.equal(b.total, 3);
    assert.equal(b.slices[0]!.count, 3);
  });

  it("rolls tour_scheduling into Website without inventing Organic", () => {
    const b = buildBookingsBySourceBreakdown(["website", "tour_scheduling", null]);
    const byKey = Object.fromEntries(b.slices.map((s) => [s.key, s.count]));
    assert.equal(byKey.website, 2);
    assert.equal(byKey[UNKNOWN_SOURCE_KEY], 1);
  });

  it("keeps The Knot and WeddingWire distinct", () => {
    const b = buildBookingsBySourceBreakdown(["the_knot", "wedding_wire"]);
    assert.equal(b.slices.length, 2);
    assert.ok(b.slices.some((s) => s.key === "the_knot"));
    assert.ok(b.slices.some((s) => s.key === "wedding_wire"));
  });

  it("handles empty results", () => {
    const b = buildBookingsBySourceBreakdown([]);
    assert.equal(b.total, 0);
    assert.deepEqual(b.slices, []);
  });

  it("uses largest-remainder percents so awkward ratios still sum to 100", () => {
    // 1,1,1 → 34+33+33 = 100
    assert.deepEqual(allocateIntegerPercents([1, 1, 1]), [34, 33, 33]);
    // 2,1 → 67+33
    assert.deepEqual(allocateIntegerPercents([2, 1]), [67, 33]);
    assert.deepEqual(allocateIntegerPercents([]), []);
    assert.deepEqual(allocateIntegerPercents([0, 0]), [0, 0]);
  });

  it("builds from cohort eventuallyBooked counts with Unknown last", () => {
    const b = buildBookingsBySourceBreakdownFromCounts([
      { key: "unknown", count: 1 },
      { key: "website", count: 4 },
      { key: "the_knot", count: 2 },
    ]);
    assert.equal(b.total, 7);
    assert.equal(b.slices[0]!.key, "website");
    assert.equal(b.slices.at(-1)!.key, UNKNOWN_SOURCE_KEY);
    assert.equal(
      b.slices.reduce((a, s) => a + s.percent, 0),
      100,
    );
  });

  it("period vs cohort can legitimately differ when fed different source lists", () => {
    const period = buildBookingsBySourceBreakdown(["website", "the_knot"]);
    const cohort = buildBookingsBySourceBreakdown(["website", "website", "referral"]);
    assert.notEqual(period.total, cohort.total);
    assert.notDeepEqual(
      period.slices.map((s) => s.key),
      cohort.slices.map((s) => s.key),
    );
  });
});
