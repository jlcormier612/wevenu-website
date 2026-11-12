import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

describe("Revenue breakdown alignment with Contracted headline", () => {
  it("by-category and by-source use events.booked_at population helper, not canonical_bookings alone", () => {
    const revenue = readFileSync(join(root, "lib/metrics/revenue.ts"), "utf8");
    const attribution = readFileSync(join(root, "lib/metrics/attribution.ts"), "utf8");
    assert.match(revenue, /listGrossBookedRevenueClientIds/);
    assert.match(revenue, /from\("events"\)/);
    assert.match(revenue, /getGrossBookedRevenueByCategory/);
    assert.match(
      revenue,
      /listGrossBookedRevenueClientIds\(window\)/,
      "category breakout must use the Contracted client set",
    );
    assert.doesNotMatch(
      revenue.slice(revenue.indexOf("getGrossBookedRevenueByCategory")),
      /from\("canonical_bookings"\)/,
      "category breakout must not window on canonical_bookings.booked_at",
    );
    assert.match(attribution, /listGrossBookedRevenueClientIds/);
    assert.match(
      attribution,
      /Do not window on `canonical_bookings\.booked_at`/,
    );
    const sourceFn = attribution.slice(
      attribution.indexOf("getGrossBookedRevenueByAcquisitionSource"),
    );
    assert.doesNotMatch(sourceFn, /getCanonicalBookings\(/);
  });

  it("Revenue page copy states breakdowns match the Contracted headline", () => {
    const page = readFileSync(join(root, "app/(app)/reporting/revenue/page.tsx"), "utf8");
    assert.match(page, /should sum to that headline|should sum to Contracted/);
  });
});
