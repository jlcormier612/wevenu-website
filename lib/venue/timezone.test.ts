import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  formatVenueLocalTourDisplay,
  utcToVenueLocalParts,
  venueLocalToUtcIso,
  venueToday,
} from "@/lib/venue/timezone";

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

describe("public tour confirmation uses the venue clock, not the visitor clock", () => {
  it("shows 10:45 AM Eastern for the Nov 4 2026 15:45Z fixture", () => {
    const stored = "2026-11-04T15:45:00+00:00";
    assert.equal(venueLocalToUtcIso("2026-11-04", "10:45", "America/New_York"), "2026-11-04T15:45:00.000Z");
    const parts = utcToVenueLocalParts(stored, "America/New_York");
    assert.equal(parts.date, "2026-11-04");
    assert.equal(parts.time, "10:45");
    const display = formatVenueLocalTourDisplay(stored, "America/New_York");
    assert.equal(display.timeLabel, "10:45 AM");
    assert.match(display.dateLabel, /November 4, 2026/);
    const atlanticVisitor = new Date(stored).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Halifax",
    });
    assert.equal(atlanticVisitor, "11:45 AM");
  });

  it("still uses Eastern daylight time before the November fallback", () => {
    const stored = "2026-10-28T14:45:00+00:00";
    assert.equal(formatVenueLocalTourDisplay(stored, "America/New_York").timeLabel, "10:45 AM");
    assert.equal(utcToVenueLocalParts(stored, "America/New_York").time, "10:45");
  });

  it("formats the confirmation page through the venue-timezone helper", () => {
    const source = readFileSync(resolve("components/form/inquiry-confirmations.tsx"), "utf8");
    assert.match(source, /formatVenueLocalTourDisplay/);
    assert.doesNotMatch(source, /toLocaleTimeString\("en-US", \{\s*hour:/);
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

describe("lead TourPanel and Tours list render venue-local times", () => {
  it("formats Lead Overview appointment rows through formatVenueLocalTourDisplay", () => {
    const source = readFileSync(resolve("components/leads/tour-panel.tsx"), "utf8");
    assert.match(source, /formatVenueLocalTourDisplay/);
    assert.doesNotMatch(
      source,
      /d\.toLocaleTimeString\("en-US", \{\s*hour:/,
      "Lead Overview tour times must not use the browser clock",
    );
  });

  it("formats Tours list rows through formatVenueLocalTourDisplay", () => {
    const source = readFileSync(resolve("components/tours/tour-list.tsx"), "utf8");
    assert.match(source, /formatVenueLocalTourDisplay/);
    assert.doesNotMatch(
      source,
      /d\.toLocaleTimeString\("en-US", \{\s*hour:/,
      "Tours list times must not use the browser clock",
    );
  });
});
