import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { utcToVenueLocalParts, venueLocalToUtcIso, venueToday } from "@/lib/venue/timezone";

describe("venue-local rendering of stored timestamps", () => {
  // The exact row behind the reported Dashboard defect: one tour appointment,
  // scheduled_at = 2026-08-31 15:00:00+00. Read in the venue's timezone that is
  // 11:00; read on a UTC server it reads 15:00, i.e. "3:00 PM".
  it("reads a 15:00Z tour as 11:00 for an Eastern venue", () => {
    const { date, time } = utcToVenueLocalParts("2026-08-31T15:00:00+00:00", "America/New_York");
    assert.equal(date, "2026-08-31");
    assert.equal(time, "11:00");
  });

  it("round-trips a venue-local booking back to the same wall clock", () => {
    const utc = venueLocalToUtcIso("2026-08-31", "11:00", "America/New_York");
    assert.equal(utc, "2026-08-31T15:00:00.000Z");
    assert.equal(utcToVenueLocalParts(utc, "America/New_York").time, "11:00");
  });

  it("defaults to Eastern rather than the server clock when a venue has no timezone", () => {
    assert.equal(utcToVenueLocalParts("2026-08-31T15:00:00Z", null).time, "11:00");
  });

  it("keeps the venue's own calendar day across a UTC day boundary", () => {
    // 01:30Z on Sep 1 is still the evening of Aug 31 at the venue.
    const { date, time } = utcToVenueLocalParts("2026-09-01T01:30:00Z", "America/New_York");
    assert.equal(date, "2026-08-31");
    assert.equal(time, "21:30");
  });
});

describe("venueToday", () => {
  it("returns the venue's calendar date, not the UTC date, late in the evening", () => {
    // 01:30Z Sep 1 is Aug 31 in America/New_York.
    const today = venueToday("America/New_York", new Date("2026-09-01T01:30:00Z"));
    assert.equal(today, "2026-08-31");
  });

  it("matches UTC on a UTC noon instant", () => {
    assert.equal(venueToday("America/New_York", new Date("2026-08-31T16:00:00Z")), "2026-08-31");
  });
});

// Luv reported the tour time straight off the process clock, which is UTC on
// ECS, while lib/leads/repository.ts converted the same column properly — so
// the Dashboard row said 11:00 and Luv said 3:00 PM for one appointment.
describe("Luv observations render tour times in the venue's timezone", () => {
  const source = readFileSync(resolve("lib/luv/observations.ts"), "utf8");

  it("resolves the venue timezone rather than trusting the server clock", () => {
    assert.match(source, /getVenueTimezone\(supabase, venueId\)/);
  });

  it("does not format a stored timestamp with a bare toLocale call", () => {
    assert.doesNotMatch(
      source,
      /tourDate\.toLocale(TimeString|String)\(/,
      "tour times must go through the venue-timezone formatter",
    );
  });

  it("passes an explicit timeZone when formatting", () => {
    assert.match(source, /timeZone: timezone \|\| "America\/New_York"/);
  });
});

describe("dashboard today is the venue's calendar day", () => {
  const source = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");

  it("asks venueToday rather than slicing Date.now() in UTC", () => {
    assert.match(source, /venueToday\(venue\.timezone\)/);
    assert.doesNotMatch(
      source,
      /const today = new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/,
    );
  });
});
