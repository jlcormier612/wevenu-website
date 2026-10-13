import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

import { buildDaySheetHeaderSummary } from "@/lib/events/day-sheet-header-summary";

describe("buildDaySheetHeaderSummary", () => {
  it("shows event type and guest count without a ceremony time", () => {
    assert.equal(
      buildDaySheetHeaderSummary({ eventType: "wedding", guestCount: 250 }),
      "Wedding · 250 guests",
    );
  });

  it("omits guests when count is null and never invents a ceremony segment", () => {
    assert.equal(
      buildDaySheetHeaderSummary({ eventType: "wedding", guestCount: null }),
      "Wedding",
    );
    assert.doesNotMatch(
      buildDaySheetHeaderSummary({ eventType: "wedding", guestCount: 250 }),
      /ceremony/i,
    );
  });

  it("day-sheet document uses the header helper and does not label startTime as ceremony", () => {
    const src = readFileSync("components/events/day-sheet/day-sheet-document.tsx", "utf8");
    assert.match(src, /buildDaySheetHeaderSummary/);
    assert.doesNotMatch(src, /\$\{formatTime\(startTime5\)\} ceremony/);
    // Timeline may still highlight occupancy start — out of scope for header copy.
    assert.match(src, /entry\.entryTime === startTime5/);
  });
});
