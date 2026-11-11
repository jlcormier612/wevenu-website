import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bucketKeyForTimestamp,
  buildTrendBuckets,
  inclusiveDayCount,
  resolveTrendGranularity,
} from "@/lib/reporting/trend-buckets";

describe("resolveTrendGranularity", () => {
  it("uses day for This Month-sized windows", () => {
    assert.equal(resolveTrendGranularity("2026-11-01", "2026-11-30"), "day");
    assert.equal(resolveTrendGranularity("2026-11-01", "2026-11-11"), "day");
  });

  it("uses week for quarter-sized windows", () => {
    assert.equal(resolveTrendGranularity("2026-10-01", "2026-12-31"), "week");
  });

  it("uses month for year-sized windows", () => {
    assert.equal(resolveTrendGranularity("2026-01-01", "2026-12-31"), "month");
    assert.equal(resolveTrendGranularity("2025-11-12", "2026-11-11"), "month");
  });
});

describe("buildTrendBuckets", () => {
  it("includes every day with zero-activity slots available", () => {
    const buckets = buildTrendBuckets("2026-11-01", "2026-11-07", "day");
    assert.equal(buckets.length, 7);
    assert.equal(buckets[0]?.key, "2026-11-01");
    assert.equal(buckets[6]?.key, "2026-11-07");
  });

  it("does not collapse a month into a single bar", () => {
    const buckets = buildTrendBuckets("2026-11-01", "2026-11-30");
    assert.ok(buckets.length >= 28);
    assert.equal(buckets[0]?.granularity, "day");
  });

  it("builds weekly buckets for ~90 day windows", () => {
    const buckets = buildTrendBuckets("2026-09-01", "2026-11-30");
    assert.equal(resolveTrendGranularity("2026-09-01", "2026-11-30"), "week");
    assert.ok(buckets.length >= 12 && buckets.length <= 16);
    assert.equal(buckets[0]?.granularity, "week");
  });

  it("builds monthly buckets for a full year", () => {
    const buckets = buildTrendBuckets("2026-01-01", "2026-12-31");
    assert.equal(buckets.length, 12);
    assert.equal(buckets[0]?.key, "2026-01");
    assert.equal(buckets[11]?.key, "2026-12");
  });
});

describe("bucketKeyForTimestamp", () => {
  it("preserves day / week / month keys", () => {
    assert.equal(bucketKeyForTimestamp("2026-11-05T15:00:00.000Z", "day"), "2026-11-05");
    assert.equal(bucketKeyForTimestamp("2026-11-05T15:00:00.000Z", "month"), "2026-11");
    // 2026-11-05 is Thursday; week starts Sunday 2026-11-01
    assert.equal(bucketKeyForTimestamp("2026-11-05T12:00:00.000Z", "week"), "2026-11-01");
  });
});

describe("inclusiveDayCount", () => {
  it("counts inclusive calendar days", () => {
    assert.equal(inclusiveDayCount("2026-11-01", "2026-11-01"), 1);
    assert.equal(inclusiveDayCount("2026-11-01", "2026-11-30"), 30);
  });
});
