import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  holdCoversDate,
  holdDateRangesOverlap,
  holdDateSpan,
  holdsConflictWithEachOther,
  otherActiveHoldsForPlacement,
} from "@/lib/availability/hold-occupancy";
import { holdDateRangeLabel, holdWindowLabel } from "@/lib/availability/hold-presentation";

describe("hold date ranges", () => {
  it("treats Fri–Sun as inclusive three-day span", () => {
    const span = holdDateSpan({ holdDate: "2027-09-03", endDate: "2027-09-05" });
    assert.deepEqual(span, { start: "2027-09-03", end: "2027-09-05" });
    assert.equal(holdCoversDate({ holdDate: "2027-09-03", endDate: "2027-09-05" }, "2027-09-03"), true);
    assert.equal(holdCoversDate({ holdDate: "2027-09-03", endDate: "2027-09-05" }, "2027-09-04"), true);
    assert.equal(holdCoversDate({ holdDate: "2027-09-03", endDate: "2027-09-05" }, "2027-09-05"), true);
    assert.equal(holdCoversDate({ holdDate: "2027-09-03", endDate: "2027-09-05" }, "2027-09-06"), false);
    assert.equal(holdCoversDate({ holdDate: "2027-09-03", endDate: "2027-09-05" }, "2027-09-02"), false);
  });

  it("defaults missing endDate to single-day legacy behavior", () => {
    assert.deepEqual(holdDateSpan({ holdDate: "2027-09-04" }), {
      start: "2027-09-04",
      end: "2027-09-04",
    });
  });

  it("detects overlapping ranges at inclusive boundaries", () => {
    assert.equal(
      holdDateRangesOverlap(
        { holdDate: "2027-09-03", endDate: "2027-09-05" },
        { holdDate: "2027-09-05", endDate: "2027-09-05" },
      ),
      true,
    );
    assert.equal(
      holdDateRangesOverlap(
        { holdDate: "2027-09-03", endDate: "2027-09-04" },
        { holdDate: "2027-09-05", endDate: "2027-09-06" },
      ),
      false,
    );
  });

  it("conflicts two holds when date ranges and spaces overlap", () => {
    const a = {
      holdDate: "2027-09-03",
      endDate: "2027-09-05",
      startTime: null,
      endTime: null,
      spaceIds: ["barn"],
    };
    const b = {
      holdDate: "2027-09-04",
      endDate: "2027-09-04",
      startTime: null,
      endTime: null,
      spaceIds: ["barn"],
    };
    assert.equal(holdsConflictWithEachOther(a, b, 2), true);
  });

  it("allows different spaces on overlapping dates when max ≥ 2", () => {
    const a = {
      holdDate: "2027-09-03",
      endDate: "2027-09-04",
      startTime: null,
      endTime: null,
      spaceIds: ["barn"],
    };
    const b = {
      holdDate: "2027-09-04",
      endDate: "2027-09-04",
      startTime: null,
      endTime: null,
      spaceIds: ["bridge"],
    };
    assert.equal(holdsConflictWithEachOther(a, b, 2), false);
  });

  it("lists other holds that overlap a multi-day candidate", () => {
    const others = otherActiveHoldsForPlacement(
      [
        { id: "a", holdDate: "2027-09-03", endDate: "2027-09-05" },
        { id: "b", holdDate: "2027-09-10", endDate: "2027-09-10" },
      ],
      "2027-09-04",
      null,
      "2027-09-04",
    );
    assert.equal(others.length, 1);
    assert.equal(others[0]?.id, "a");
  });

  it("labels multi-day holds and all-day windows", () => {
    assert.match(
      holdDateRangeLabel({ holdDate: "2027-09-03", endDate: "2027-09-05" }),
      /–/,
    );
    assert.equal(
      holdWindowLabel({
        holdDate: "2027-09-03",
        endDate: "2027-09-05",
        startTime: null,
        endTime: null,
      }),
      "All day (date range)",
    );
    assert.equal(
      holdWindowLabel({
        holdDate: "2027-09-04",
        endDate: "2027-09-04",
        startTime: null,
        endTime: null,
      }),
      null,
    );
  });
});
