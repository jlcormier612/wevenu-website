import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  effectiveMaxSimultaneousTours,
  evaluateTourCapacity,
  occupyingTour,
  tourFitsAvailabilityWindow,
  tourIntervalsOverlap,
  type TourInterval,
} from "@/lib/tours/occupancy";

function tour(partial: Partial<TourInterval> & Pick<TourInterval, "scheduledAtMs">): TourInterval {
  return {
    id: partial.id,
    status: partial.status ?? "scheduled",
    scheduledAtMs: partial.scheduledAtMs,
    durationMinutes: partial.durationMinutes ?? 60,
  };
}

const TEN = Date.parse("2099-06-15T10:00:00Z");
const ELEVEN = Date.parse("2099-06-15T11:00:00Z");
const NOON = Date.parse("2099-06-15T12:00:00Z");
const TWO = Date.parse("2099-06-15T14:00:00Z");

describe("effectiveMaxSimultaneousTours", () => {
  it("treats a missing rules row as 1, never unlimited", () => {
    assert.equal(effectiveMaxSimultaneousTours(null), 1);
    assert.equal(effectiveMaxSimultaneousTours(undefined), 1);
    assert.equal(effectiveMaxSimultaneousTours({}), 1);
  });

  it("uses the stored max when present", () => {
    assert.equal(effectiveMaxSimultaneousTours({ maxSimultaneousTours: 2 }), 2);
    assert.equal(effectiveMaxSimultaneousTours({ maxSimultaneousTours: 1 }), 1);
  });

  it("does not treat zero or garbage as unlimited", () => {
    assert.equal(effectiveMaxSimultaneousTours({ maxSimultaneousTours: 0 }), 1);
    assert.equal(effectiveMaxSimultaneousTours({ maxSimultaneousTours: -3 }), 1);
    assert.equal(effectiveMaxSimultaneousTours({ maxSimultaneousTours: Number.NaN }), 1);
  });
});

describe("tour interval overlap", () => {
  it("counts a shared interior as overlap", () => {
    assert.equal(
      tourIntervalsOverlap(tour({ scheduledAtMs: TEN }), tour({ scheduledAtMs: TEN, durationMinutes: 30 })),
      true,
    );
    assert.equal(
      tourIntervalsOverlap(tour({ scheduledAtMs: TEN, durationMinutes: 90 }), tour({ scheduledAtMs: ELEVEN })),
      true,
    );
  });

  it("treats touching endpoints as sequential, not overlapping", () => {
    assert.equal(
      tourIntervalsOverlap(tour({ scheduledAtMs: TEN }), tour({ scheduledAtMs: ELEVEN })),
      false,
    );
  });

  it("does not overlap a later non-adjacent window", () => {
    assert.equal(
      tourIntervalsOverlap(tour({ scheduledAtMs: TEN }), tour({ scheduledAtMs: TWO })),
      false,
    );
  });
});

describe("evaluateTourCapacity", () => {
  it("allows one tour when max is 1 and nothing occupies the interval", () => {
    const result = evaluateTourCapacity({
      rules: null,
      existing: [],
      candidate: tour({ scheduledAtMs: TEN }),
    });
    assert.equal(result.ok, true);
  });

  it("allows simultaneous tours up to capacity", () => {
    const result = evaluateTourCapacity({
      rules: { maxSimultaneousTours: 2 },
      existing: [tour({ id: "a", scheduledAtMs: TEN })],
      candidate: tour({ id: "b", scheduledAtMs: TEN }),
    });
    assert.equal(result.ok, true);
  });

  it("rejects a tour that would exceed capacity", () => {
    const result = evaluateTourCapacity({
      rules: { maxSimultaneousTours: 1 },
      existing: [tour({ id: "a", scheduledAtMs: TEN })],
      candidate: tour({ id: "b", scheduledAtMs: TEN }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "tour_at_capacity");
  });

  it("allows sequential non-overlapping tours at max 1", () => {
    const result = evaluateTourCapacity({
      rules: { maxSimultaneousTours: 1 },
      existing: [tour({ id: "a", scheduledAtMs: TEN })],
      candidate: tour({ id: "b", scheduledAtMs: ELEVEN }),
    });
    assert.equal(result.ok, true);
  });

  it("ignores cancelled tours", () => {
    assert.equal(occupyingTour("cancelled"), false);
    const result = evaluateTourCapacity({
      rules: { maxSimultaneousTours: 1 },
      existing: [tour({ id: "a", scheduledAtMs: TEN, status: "cancelled" })],
      candidate: tour({ id: "b", scheduledAtMs: TEN }),
    });
    assert.equal(result.ok, true);
  });

  it("excludes the appointment being edited", () => {
    const result = evaluateTourCapacity({
      rules: { maxSimultaneousTours: 1 },
      existing: [tour({ id: "self", scheduledAtMs: TEN })],
      candidate: tour({ id: "self", scheduledAtMs: NOON }),
      excludeId: "self",
    });
    assert.equal(result.ok, true);
  });

  it("rejects a conflicting reschedule", () => {
    const result = evaluateTourCapacity({
      rules: { maxSimultaneousTours: 1 },
      existing: [
        tour({ id: "a", scheduledAtMs: TEN }),
        tour({ id: "b", scheduledAtMs: TWO }),
      ],
      candidate: tour({ id: "b", scheduledAtMs: TEN }),
      excludeId: "b",
    });
    assert.equal(result.ok, false);
  });
});

describe("tourFitsAvailabilityWindow", () => {
  // 2099-06-15 is a Monday (dow 1), matching Postgres extract(dow).
  const monday = { dayOfWeek: 1, startTime: "10:00", endTime: "12:00" };

  it("allows a Tour entirely inside the weekly window", () => {
    assert.equal(
      tourFitsAvailabilityWindow({
        date: "2099-06-15", startTime: "10:00", durationMinutes: 60, windows: [monday],
      }),
      true,
    );
  });

  it("rejects a Tour outside the weekly window", () => {
    assert.equal(
      tourFitsAvailabilityWindow({
        date: "2099-06-15", startTime: "13:00", durationMinutes: 60, windows: [monday],
      }),
      false,
    );
  });

  it("rejects a Tour that starts inside the window but overruns the end", () => {
    assert.equal(
      tourFitsAvailabilityWindow({
        date: "2099-06-15", startTime: "11:30", durationMinutes: 60, windows: [monday],
      }),
      false,
    );
  });

  it("rejects a Tour on a weekday with no window", () => {
    assert.equal(
      tourFitsAvailabilityWindow({
        date: "2099-06-16", startTime: "10:00", durationMinutes: 60, windows: [monday],
      }),
      false,
    );
  });

  it("rejects when no windows are configured", () => {
    assert.equal(
      tourFitsAvailabilityWindow({
        date: "2099-06-15", startTime: "10:00", durationMinutes: 60, windows: [],
      }),
      false,
    );
  });
});
