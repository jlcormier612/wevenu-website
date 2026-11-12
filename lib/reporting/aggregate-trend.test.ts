import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { observationsToTrend, timestampsToTrend } from "@/lib/reporting/aggregate-trend";

describe("observationsToTrend", () => {
  const window = { from: "2026-11-01", to: "2026-11-30" };

  it("preserves total across day/week/month grains", () => {
    const observations = [
      { at: "2026-11-02T12:00:00.000Z", amount: 100 },
      { at: "2026-11-10T12:00:00.000Z", amount: 250 },
      { at: "2026-11-22T12:00:00.000Z", amount: 50 },
    ];
    const day = observationsToTrend(observations, window, "day");
    const week = observationsToTrend(observations, window, "week");
    const month = observationsToTrend(observations, window, "month");
    const sum = (pts: { value: number }[]) => pts.reduce((a, p) => a + p.value, 0);
    assert.equal(sum(day.points), 400);
    assert.equal(sum(week.points), 400);
    assert.equal(sum(month.points), 400);
  });

  it("timestampsToTrend counts each event once", () => {
    const series = timestampsToTrend(
      ["2026-11-05", "2026-11-05", "2026-11-20"],
      window,
      "month",
    );
    assert.equal(series.points.reduce((a, p) => a + p.value, 0), 3);
  });
});
