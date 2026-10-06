import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  blockedTimeDates,
  projectTourAvailabilityExceptions,
  type TourAvailabilityExceptionRow,
} from "@/lib/calendar/tour-exception-projection";
import { venueCalendarTaxonomyKey, venueCalendarTaxonomyLabel } from "@/lib/calendar/venue-calendar-scope";
import type { CalendarItem } from "@/lib/calendar/types";

const DEC_START = "2026-12-01";
const DEC_END = "2026-12-31";

const WILLOW_CHRISTMAS: TourAvailabilityExceptionRow = {
  id: "4c64cec4-7c9a-43d0-8d1f-7e85937939b4",
  start_date: "2026-12-25",
  end_date: "2026-12-25",
  label: "Christmas",
};

function project(
  exceptions: TourAvailabilityExceptionRow[],
  occupied: ReadonlySet<string> = new Set(),
  rangeStart = DEC_START,
  rangeEnd = DEC_END,
) {
  return projectTourAvailabilityExceptions({
    exceptions,
    rangeStart,
    rangeEnd,
    occupiedBlockedDates: occupied,
  });
}

describe("tour availability exception calendar projection", () => {
  it("projects a single-day exception as all-day Blocked Time", () => {
    const [item] = project([WILLOW_CHRISTMAS]);
    assert.equal(item.date, "2026-12-25");
    assert.equal(item.type, "calendar_block");
    assert.equal(item.manualType, "blocked_time");
    assert.equal(item.title, "Christmas");
    assert.equal(item.time, null);
    assert.equal(item.endTime, null);
    assert.equal(item.rawId, undefined);
    assert.equal(venueCalendarTaxonomyKey(item), "blocked_time");
    assert.equal(venueCalendarTaxonomyLabel("blocked_time"), "Blocked Time");
  });

  it("projects a multi-day exception onto every inclusive local date", () => {
    const items = project([{
      id: "span",
      start_date: "2026-12-24",
      end_date: "2026-12-26",
      label: "Closure",
    }]);
    assert.deepEqual(items.map((item) => item.date), [
      "2026-12-24",
      "2026-12-25",
      "2026-12-26",
    ]);
  });

  it("keeps Willow Christmas on December 25 2026 inside December", () => {
    const items = project([WILLOW_CHRISTMAS]);
    assert.deepEqual(items.map((item) => item.date), ["2026-12-25"]);
    assert.equal(items[0].id, "tour-exception-4c64cec4-7c9a-43d0-8d1f-7e85937939b4-2026-12-25");
  });

  it("does not shift a date column through a local timezone", () => {
    const items = project([{
      id: "nye",
      start_date: "2026-12-31",
      end_date: "2027-01-01",
      label: "New Year",
    }]);
    assert.deepEqual(items.map((item) => item.date), ["2026-12-31"]);
  });

  it("omits an exception that does not overlap the requested month", () => {
    assert.deepEqual(project([{
      id: "nov",
      start_date: "2026-11-25",
      end_date: "2026-11-25",
      label: "November",
    }]), []);
    assert.deepEqual(project([{
      id: "jan",
      start_date: "2027-01-02",
      end_date: "2027-01-02",
      label: "January",
    }]), []);
  });

  it("clips a multi-day exception to the requested range", () => {
    const items = project([{
      id: "edge",
      start_date: "2026-11-30",
      end_date: "2026-12-02",
      label: "Edge",
    }]);
    assert.deepEqual(items.map((item) => item.date), ["2026-12-01", "2026-12-02"]);
  });

  it("leaves an existing Blocked Time date to the real calendar block", () => {
    const existing: CalendarItem = {
      id: "block-real-2026-12-25",
      type: "calendar_block",
      date: "2026-12-25",
      title: "Private closure",
      subtitle: null,
      time: null,
      endTime: null,
      link: "/calendar",
      rawId: "real-block",
      manualType: "blocked_time",
    };
    const occupied = blockedTimeDates([existing]);
    const projected = project([WILLOW_CHRISTMAS], occupied);
    assert.deepEqual(projected, []);
    assert.equal(existing.title, "Private closure");
    assert.equal(existing.rawId, "real-block");
  });

  it("still projects an exception when the same date has a non-blocked calendar item", () => {
    const consultation: CalendarItem = {
      id: "block-consult",
      type: "calendar_block",
      date: "2026-12-25",
      title: "Tasting",
      subtitle: null,
      time: "10:00",
      endTime: "11:00",
      link: "/calendar",
      rawId: "consult",
      manualType: "consultation",
    };
    const projected = project([WILLOW_CHRISTMAS], blockedTimeDates([consultation]));
    assert.equal(projected.length, 1);
    assert.equal(projected[0].date, "2026-12-25");
    assert.equal(projected[0].title, "Christmas");
  });

  it("keeps other days of a multi-day exception when one day already has Blocked Time", () => {
    const items = project(
      [{ id: "span", start_date: "2026-12-24", end_date: "2026-12-26", label: "Closure" }],
      new Set(["2026-12-25"]),
    );
    assert.deepEqual(items.map((item) => item.date), ["2026-12-24", "2026-12-26"]);
  });

  it("uses Blocked Time when the exception has no label", () => {
    const [item] = project([{
      id: "blank",
      start_date: "2026-12-10",
      end_date: "2026-12-10",
      label: "   ",
    }]);
    assert.equal(item.title, "Blocked Time");
  });
});

describe("calendar service wires the projection without changing tour writes", () => {
  const service = readFileSync(resolve("lib/calendar/service.ts"), "utf8");
  const tourService = readFileSync(resolve("lib/tours/service.ts"), "utf8");
  const slotFn = readFileSync(
    resolve("supabase/migrations/20261410400000_tour_two_clock_schema.sql"),
    "utf8",
  );

  it("reads only the active venue's overlapping exceptions", () => {
    const query = service.slice(service.indexOf('from("tour_availability_exceptions")'));
    assert.match(query, /\.select\("id, start_date, end_date, label"\)/);
    assert.match(query, /\.eq\("venue_id", venue\.id\)/);
    assert.match(query, /\.lte\("start_date", end\)/);
    assert.match(query, /\.gte\("end_date", start\)/);
    assert.doesNotMatch(service, /from\("tour_availability_exceptions"\)[\s\S]{0,240}\.(insert|update|delete|upsert)\(/);
    assert.doesNotMatch(query, /owner_email|owner_user_id/);
    const blocksMapped = service.indexOf("rawId: b.id");
    const projected = service.indexOf("projectTourAvailabilityExceptions({");
    assert.ok(blocksMapped > 0 && projected > blocksMapped);
  });

  it("does not change tour slot rejection or exception writes", () => {
    assert.match(slotFn, /tae\.start_date <= \(p_slot_start at time zone v_tz\)::date/);
    assert.match(slotFn, /tae\.end_date\s+>= \(p_slot_start at time zone v_tz\)::date/);
    assert.match(tourService, /from\("tour_availability_exceptions"\)\.insert\(/);
    assert.doesNotMatch(service, /addTourAvailabilityException|removeTourAvailabilityException/);
    assert.match(service, /from\("events"\)/);
    assert.match(service, /getTourCalendarEntries/);
    assert.match(service, /from\("date_holds"\)/);
    assert.match(service, /from\("calendar_blocks"\)/);
  });
});
