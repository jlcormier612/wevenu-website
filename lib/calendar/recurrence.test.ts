import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  describeRecurrence,
  durationInDays,
  expandOccurrenceStarts,
  occurrenceDates,
} from "@/lib/calendar/recurrence";
import type { RecurrenceSpec } from "@/lib/calendar/recurrence";

const spec = (over: Partial<RecurrenceSpec> = {}): RecurrenceSpec => ({
  rule: "none", interval: 1, endsOn: null, count: null, ...over,
});

describe("non-repeating schedule items", () => {
  it("returns the item when it falls inside the window", () => {
    assert.deepEqual(
      expandOccurrenceStarts("2026-03-14", spec(), "2026-03-01", "2026-03-31"),
      ["2026-03-14"],
    );
  });

  it("returns nothing when it falls outside the window", () => {
    assert.deepEqual(
      expandOccurrenceStarts("2026-05-02", spec(), "2026-03-01", "2026-03-31"),
      [],
    );
  });

  it("still returns a multi-day item that starts before the window but runs into it", () => {
    // Feb 27 → Mar 3. The start is in February; the item is very much in March.
    assert.deepEqual(
      expandOccurrenceStarts("2026-02-27", spec(), "2026-03-01", "2026-03-31", 4),
      ["2026-02-27"],
    );
  });
});

describe("interval", () => {
  it("repeats daily at interval 1", () => {
    assert.deepEqual(
      expandOccurrenceStarts("2026-03-01", spec({ rule: "daily" }), "2026-03-01", "2026-03-05"),
      ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05"],
    );
  });

  it("repeats every third day", () => {
    assert.deepEqual(
      expandOccurrenceStarts("2026-03-01", spec({ rule: "daily", interval: 3 }), "2026-03-01", "2026-03-10"),
      ["2026-03-01", "2026-03-04", "2026-03-07", "2026-03-10"],
    );
  });

  it("repeats every other week on the same weekday", () => {
    assert.deepEqual(
      expandOccurrenceStarts("2026-03-02", spec({ rule: "weekly", interval: 2 }), "2026-03-01", "2026-04-15"),
      ["2026-03-02", "2026-03-16", "2026-03-30", "2026-04-13"],
    );
  });

  it("treats a zero or negative interval as 1 rather than looping forever", () => {
    assert.deepEqual(
      expandOccurrenceStarts("2026-03-01", spec({ rule: "daily", interval: 0 }), "2026-03-01", "2026-03-03"),
      ["2026-03-01", "2026-03-02", "2026-03-03"],
    );
  });
});

describe("month and year steps clamp rather than overflow", () => {
  it("keeps a 31st monthly series on the last day of shorter months", () => {
    const got = expandOccurrenceStarts("2026-01-31", spec({ rule: "monthly" }), "2026-01-01", "2026-05-31");
    // February has 28 days in 2026 — the occurrence lands on the 28th, never
    // spilling into March 3rd the way naive month arithmetic would.
    assert.deepEqual(got, ["2026-01-31", "2026-02-28", "2026-03-28", "2026-04-28", "2026-05-28"]);
  });

  it("repeats every 3 months", () => {
    assert.deepEqual(
      expandOccurrenceStarts("2026-01-15", spec({ rule: "monthly", interval: 3 }), "2026-01-01", "2026-12-31"),
      ["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"],
    );
  });

  it("clamps a Feb 29 anniversary to Feb 28 in common years", () => {
    // 2028 is a leap year; 2029 is not.
    assert.deepEqual(
      expandOccurrenceStarts("2028-02-29", spec({ rule: "annual" }), "2029-01-01", "2029-12-31"),
      ["2029-02-28"],
    );
  });

  it("repeats annually on the same date", () => {
    assert.deepEqual(
      expandOccurrenceStarts("2026-06-10", spec({ rule: "annual" }), "2028-01-01", "2028-12-31"),
      ["2028-06-10"],
    );
  });
});

describe("end conditions", () => {
  it("stops on the end date, inclusive", () => {
    assert.deepEqual(
      expandOccurrenceStarts("2026-03-01", spec({ rule: "daily", endsOn: "2026-03-03" }), "2026-03-01", "2026-03-31"),
      ["2026-03-01", "2026-03-02", "2026-03-03"],
    );
  });

  it("stops after the requested number of occurrences", () => {
    assert.deepEqual(
      expandOccurrenceStarts("2026-03-01", spec({ rule: "weekly", count: 3 }), "2026-03-01", "2026-12-31"),
      ["2026-03-01", "2026-03-08", "2026-03-15"],
    );
  });

  it("counts occurrences that fall before the window, so a later window cannot resurrect the series", () => {
    // Five daily occurrences from Mar 1 — Mar 1..5. A window starting Mar 3
    // must show only the tail, not five fresh ones.
    assert.deepEqual(
      expandOccurrenceStarts("2026-03-01", spec({ rule: "daily", count: 5 }), "2026-03-03", "2026-03-31"),
      ["2026-03-03", "2026-03-04", "2026-03-05"],
    );
  });

  it("produces nothing in a window entirely after a finished series", () => {
    assert.deepEqual(
      expandOccurrenceStarts("2026-03-01", spec({ rule: "daily", count: 5 }), "2026-06-01", "2026-06-30"),
      [],
    );
  });

  it("repeats indefinitely when neither end condition is set", () => {
    const got = expandOccurrenceStarts("2020-01-01", spec({ rule: "annual" }), "2039-01-01", "2039-12-31");
    assert.deepEqual(got, ["2039-01-01"]);
  });
});

describe("timezone independence", () => {
  // The previous inline implementation parsed dates in the server's local zone
  // and read them back in UTC. These assertions are plain string comparisons,
  // so they would fail if any offset crept back in.
  it("returns the exact start date it was given", () => {
    assert.deepEqual(
      expandOccurrenceStarts("2026-01-01", spec(), "2026-01-01", "2026-01-01"),
      ["2026-01-01"],
    );
  });

  it("does not drift across a month boundary", () => {
    assert.deepEqual(
      expandOccurrenceStarts("2026-12-31", spec({ rule: "daily" }), "2026-12-31", "2027-01-02"),
      ["2026-12-31", "2027-01-01", "2027-01-02"],
    );
  });
});

describe("duration helpers", () => {
  it("counts a single-day item as zero days of span", () => {
    assert.equal(durationInDays("2026-03-01", "2026-03-01"), 0);
  });

  it("counts the span between start and end", () => {
    assert.equal(durationInDays("2026-03-01", "2026-03-04"), 3);
  });

  it("lists every date an occurrence covers", () => {
    assert.deepEqual(occurrenceDates("2026-03-01", 2), ["2026-03-01", "2026-03-02", "2026-03-03"]);
  });

  it("lists just the one date for a single-day item", () => {
    assert.deepEqual(occurrenceDates("2026-03-01", 0), ["2026-03-01"]);
  });
});

describe("plain-language summary", () => {
  it("describes a non-repeating item", () => {
    assert.equal(describeRecurrence(spec()), "Does not repeat");
  });

  it("describes a simple weekly series", () => {
    assert.equal(describeRecurrence(spec({ rule: "weekly" })), "Every week");
  });

  it("describes an interval series", () => {
    assert.equal(describeRecurrence(spec({ rule: "weekly", interval: 2 })), "Every 2 weeks");
  });

  it("describes a counted series", () => {
    assert.equal(
      describeRecurrence(spec({ rule: "monthly", interval: 3, count: 4 })),
      "Every 3 months, 4 times",
    );
  });

  it("describes a dated series", () => {
    assert.equal(
      describeRecurrence(spec({ rule: "daily", endsOn: "2026-12-31" })),
      "Every day, until 2026-12-31",
    );
  });

  it("uses the singular for a one-occurrence series", () => {
    assert.equal(describeRecurrence(spec({ rule: "daily", count: 1 })), "Every day, 1 time");
  });
});
