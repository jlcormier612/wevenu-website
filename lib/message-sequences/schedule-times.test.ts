/**
 * Venue-timezone Automation scheduling.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addCalendarDays,
  computeDelayedSendIso,
  computeEnrollmentStepScheduleIsos,
} from "@/lib/message-sequences/schedule-times";
import { utcToVenueLocalParts } from "@/lib/venue/timezone";

describe("addCalendarDays", () => {
  it("crosses month boundaries", () => {
    assert.equal(addCalendarDays("2026-01-30", 3), "2026-02-02");
  });
});

describe("computeDelayedSendIso", () => {
  it("offset 0 is immediate", () => {
    const from = new Date("2026-03-10T22:15:00.000Z");
    assert.equal(computeDelayedSendIso(from, 0, "America/New_York"), from.toISOString());
  });

  it("offset days land on venue calendar morning, not fixed 24h UTC chunks", () => {
    // 11:30pm Eastern on Mar 10 → venue date Mar 10. +1 day → Mar 11 at 10:00 Eastern.
    const from = new Date("2026-03-11T03:30:00.000Z");
    const iso = computeDelayedSendIso(from, 1, "America/New_York");
    const parts = utcToVenueLocalParts(iso, "America/New_York");
    assert.equal(parts.date, "2026-03-11");
    assert.equal(parts.time, "10:00");
  });

  it("differs from naive UTC + N*86400000 near evening", () => {
    const from = new Date("2026-03-11T03:30:00.000Z");
    const venueAware = computeDelayedSendIso(from, 1, "America/New_York");
    const naive = new Date(from.getTime() + 86_400_000).toISOString();
    assert.notEqual(venueAware, naive);
  });
});

describe("computeEnrollmentStepScheduleIsos", () => {
  it("chains offsets from prior step on the venue calendar", () => {
    const enrolledAt = new Date("2026-06-01T14:00:00.000Z"); // 10:00 Eastern
    const isos = computeEnrollmentStepScheduleIsos(
      [{ offsetDays: 0 }, { offsetDays: 3 }],
      enrolledAt,
      "America/New_York",
    );
    assert.equal(isos[0], enrolledAt.toISOString());
    const second = utcToVenueLocalParts(isos[1]!, "America/New_York");
    assert.equal(second.date, "2026-06-04");
    assert.equal(second.time, "10:00");
  });

  it("tour follow-up style: single delayed step", () => {
    const enrolledAt = new Date("2026-07-15T20:00:00.000Z");
    const isos = computeEnrollmentStepScheduleIsos(
      [{ offsetDays: 1 }],
      enrolledAt,
      "America/Chicago",
    );
    const parts = utcToVenueLocalParts(isos[0]!, "America/Chicago");
    assert.equal(parts.time, "10:00");
    const enrollParts = utcToVenueLocalParts(enrolledAt.toISOString(), "America/Chicago");
    assert.equal(parts.date, addCalendarDays(enrollParts.date, 1));
  });
});
