import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  datesInInclusiveRange,
  monthDateRange,
  recurringUnavailableDates,
} from "@/lib/vendor-availability/dates";

describe("vendor availability dates", () => {
  it("monthDateRange uses calendar month bounds including October", () => {
    assert.deepEqual(monthDateRange(2026, 9), { start: "2026-09-01", end: "2026-09-30" });
    assert.deepEqual(monthDateRange(2026, 10), { start: "2026-10-01", end: "2026-10-31" });
    assert.deepEqual(monthDateRange(2026, 2), { start: "2026-02-01", end: "2026-02-28" });
  });

  it("inclusive range includes start and end and nothing outside", () => {
    assert.deepEqual(datesInInclusiveRange("2026-10-01", "2026-10-02"), [
      "2026-10-01",
      "2026-10-02",
    ]);
    const oct = datesInInclusiveRange("2026-10-01", "2026-10-15");
    assert.equal(oct[0], "2026-10-01");
    assert.equal(oct[oct.length - 1], "2026-10-15");
    assert.equal(oct.length, 15);
    assert.ok(!oct.includes("2026-09-30"));
    assert.ok(!oct.includes("2026-10-16"));
  });

  it("rejects inverted ranges", () => {
    assert.deepEqual(datesInInclusiveRange("2026-10-15", "2026-10-01"), []);
  });

  it("weekly recurrence keeps dates inside the requested range", () => {
    const weekends = recurringUnavailableDates({
      start: "2026-10-01",
      end: "2026-12-31",
      weekdays: { kind: "weekends" },
    });
    assert.ok(weekends.includes("2026-10-03"));
    assert.ok(weekends.includes("2026-10-04"));
    assert.ok(!weekends.includes("2026-09-27"));
    assert.ok(!weekends.includes("2027-01-02"));
    for (const d of weekends) {
      const day = new Date(`${d}T12:00:00Z`).getUTCDay();
      assert.ok(day === 0 || day === 6, d);
      assert.ok(d >= "2026-10-01" && d <= "2026-12-31");
    }
  });

  it("custom days of week generate only those weekdays", () => {
    const mondays = recurringUnavailableDates({
      start: "2026-10-01",
      end: "2026-10-31",
      weekdays: { kind: "days", days: [1] },
    });
    assert.deepEqual(mondays, [
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ]);
  });
});
