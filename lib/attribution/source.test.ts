/**
 * Unit tests — acquisition source normalization, coverage, time-to-book.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeSourceCoverage,
  groupCountsByReportingSource,
  isKnownAcquisitionSource,
  median,
  reportingSourceDisplayLabel,
  reportingSourceGroupKey,
  timeToBookDays,
  UNKNOWN_SOURCE_KEY,
  UNKNOWN_SOURCE_LABEL,
} from "@/lib/attribution/source";

describe("attribution source helpers", () => {
  it("treats other and empty as not known for coverage", () => {
    assert.equal(isKnownAcquisitionSource("website"), true);
    assert.equal(isKnownAcquisitionSource("tour_scheduling"), true);
    assert.equal(isKnownAcquisitionSource("other"), false);
    assert.equal(isKnownAcquisitionSource(null), false);
    assert.equal(isKnownAcquisitionSource(""), false);
  });

  it("rolls tour_scheduling into Website for reporting without inventing Organic", () => {
    assert.equal(reportingSourceGroupKey("tour_scheduling"), "website");
    assert.equal(reportingSourceGroupKey("website"), "website");
    assert.equal(reportingSourceDisplayLabel("tour_scheduling"), "Website");
    assert.equal(reportingSourceDisplayLabel("website"), "Website");
    assert.equal(reportingSourceGroupKey(null), UNKNOWN_SOURCE_KEY);
    assert.equal(reportingSourceDisplayLabel(null), UNKNOWN_SOURCE_LABEL);
    assert.equal(reportingSourceGroupKey("other"), UNKNOWN_SOURCE_KEY);
  });

  it("groups website + tour_scheduling together and keeps Unknown visible", () => {
    const rows = groupCountsByReportingSource([
      { source: "website" },
      { source: "tour_scheduling" },
      { source: null },
      { source: "instagram" },
    ]);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.count]));
    assert.equal(byKey.website, 2);
    assert.equal(byKey.instagram, 1);
    assert.equal(byKey[UNKNOWN_SOURCE_KEY], 1);
  });

  it("computes source coverage with Unknown in the denominator", () => {
    const cov = computeSourceCoverage(["website", null, "other", "instagram"]);
    assert.equal(cov.total, 4);
    assert.equal(cov.known, 2);
    assert.equal(cov.percent, 50);
  });

  it("time-to-book is lead created → first lifecycle booking in whole days", () => {
    assert.equal(
      timeToBookDays("2026-01-01T12:00:00.000Z", "2026-01-11T12:00:00.000Z"),
      10,
    );
    assert.equal(timeToBookDays(null, "2026-01-11T12:00:00.000Z"), null);
    assert.equal(timeToBookDays("2026-01-11T12:00:00.000Z", "2026-01-01T12:00:00.000Z"), null);
  });

  it("median handles odd and even lengths", () => {
    assert.equal(median([1, 3, 2]), 2);
    assert.equal(median([1, 2, 3, 4]), 2.5);
    assert.equal(median([]), null);
  });
});
