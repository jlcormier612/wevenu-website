import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calendarBlockCoversInterval,
  coveringCalendarBlockTitle,
  eventCoverageInterval,
  inquiryDateCoverageInterval,
  tourCoverageInterval,
  TOUR_CLOSING_CALENDAR_BLOCK_TYPES,
} from "@/lib/availability/calendar-block-coverage";
import { buildAvailabilityConflicts } from "@/lib/availability/precheck";

const sundayWeekly = {
  title: "Every Sunday 9–5",
  type: "blocked_time",
  startDate: "2099-06-14",
  endDate: "2099-06-14",
  isAllDay: false,
  startTime: "09:00",
  endTime: "17:00",
  recurrenceRule: "weekly" as const,
  recurrenceInterval: 1,
  recurrenceEndsOn: null,
  recurrenceCount: null,
};

describe("calendar block coverage", () => {
  it("a matching weekly Sunday occurrence blocks an overlapping Event", () => {
    assert.equal(
      calendarBlockCoversInterval(sundayWeekly, eventCoverageInterval({
        eventDate: "2099-06-21",
        startTime: "10:00",
        endTime: "12:00",
      })),
      true,
    );
  });

  it("a non-matching weekday does not block", () => {
    assert.equal(
      calendarBlockCoversInterval(sundayWeekly, eventCoverageInterval({
        eventDate: "2099-06-15",
        startTime: "10:00",
        endTime: "12:00",
      })),
      false,
    );
  });

  it("respects the recurrence start boundary", () => {
    assert.equal(
      calendarBlockCoversInterval(sundayWeekly, eventCoverageInterval({
        eventDate: "2099-06-07",
        startTime: "10:00",
        endTime: "12:00",
      })),
      false,
    );
    assert.equal(
      calendarBlockCoversInterval(sundayWeekly, eventCoverageInterval({
        eventDate: "2099-06-14",
        startTime: "10:00",
        endTime: "12:00",
      })),
      true,
    );
  });

  it("respects recurrence ends_on as an inclusive last occurrence start", () => {
    const bounded = { ...sundayWeekly, recurrenceEndsOn: "2099-06-21" };
    assert.equal(
      calendarBlockCoversInterval(bounded, eventCoverageInterval({
        eventDate: "2099-06-21",
        startTime: "10:00",
        endTime: "12:00",
      })),
      true,
    );
    assert.equal(
      calendarBlockCoversInterval(bounded, eventCoverageInterval({
        eventDate: "2099-06-28",
        startTime: "10:00",
        endTime: "12:00",
      })),
      false,
    );
  });

  it("respects recurrence count", () => {
    const twice = { ...sundayWeekly, recurrenceCount: 2 };
    assert.equal(
      calendarBlockCoversInterval(twice, eventCoverageInterval({
        eventDate: "2099-06-21",
        startTime: "10:00",
        endTime: "12:00",
      })),
      true,
    );
    assert.equal(
      calendarBlockCoversInterval(twice, eventCoverageInterval({
        eventDate: "2099-06-28",
        startTime: "10:00",
        endTime: "12:00",
      })),
      false,
    );
  });

  it("a date outside the recurrence range is not blocked", () => {
    assert.equal(
      calendarBlockCoversInterval(sundayWeekly, eventCoverageInterval({
        eventDate: "2099-07-04",
        startTime: "10:00",
        endTime: "12:00",
      })),
      false,
    );
  });

  it("interprets weekday/time as venue-local calendar dates, not UTC wall-clock", () => {
    // 2099-06-14 is Sunday as a date column, independent of process timezone.
    assert.equal(
      calendarBlockCoversInterval(sundayWeekly, eventCoverageInterval({
        eventDate: "2099-06-14",
        startTime: "09:00",
        endTime: "10:00",
      })),
      true,
    );
    assert.equal(
      calendarBlockCoversInterval(sundayWeekly, eventCoverageInterval({
        eventDate: "2099-06-13",
        startTime: "09:00",
        endTime: "10:00",
      })),
      false,
    );
  });

  it("timed blocks overlap Event windows; touching endpoints are allowed", () => {
    const evening = eventCoverageInterval({
      eventDate: "2099-06-21",
      startTime: "17:00",
      endTime: "22:00",
    });
    const overlapping = eventCoverageInterval({
      eventDate: "2099-06-21",
      startTime: "16:00",
      endTime: "18:00",
    });
    assert.equal(calendarBlockCoversInterval(sundayWeekly, evening), false);
    assert.equal(calendarBlockCoversInterval(sundayWeekly, overlapping), true);
  });

  it("a full-day Event overlaps a timed Sunday block", () => {
    assert.equal(
      calendarBlockCoversInterval(sundayWeekly, eventCoverageInterval({
        eventDate: "2099-06-21",
      })),
      true,
    );
  });

  it("a multi-day Event is blocked when a later protected day hits an occurrence", () => {
    assert.equal(
      calendarBlockCoversInterval(sundayWeekly, eventCoverageInterval({
        eventDate: "2099-06-19",
        eventEndDate: "2099-06-22",
      })),
      true,
    );
    assert.equal(
      calendarBlockCoversInterval(sundayWeekly, eventCoverageInterval({
        eventDate: "2099-06-19",
        eventEndDate: "2099-06-22",
        startTime: "18:00",
        endTime: "22:00",
      })),
      false,
    );
  });

  it("inquiry date-only uses a conservative full-day window", () => {
    assert.equal(
      calendarBlockCoversInterval(sundayWeekly, inquiryDateCoverageInterval("2099-06-21")),
      true,
    );
    assert.equal(
      calendarBlockCoversInterval(sundayWeekly, inquiryDateCoverageInterval("2099-06-22")),
      false,
    );
  });

  it("Tour closing types cover; non-closing types do not", () => {
    const tourSundayMorning = tourCoverageInterval({
      date: "2099-06-21",
      startTime: "10:00",
      durationMinutes: 60,
    });
    assert.equal(
      coveringCalendarBlockTitle([sundayWeekly], tourSundayMorning, {
        types: TOUR_CLOSING_CALENDAR_BLOCK_TYPES,
      }),
      "Every Sunday 9–5",
    );
    assert.equal(
      coveringCalendarBlockTitle(
        [{ ...sundayWeekly, type: "consultation" }],
        tourSundayMorning,
        { types: TOUR_CLOSING_CALENDAR_BLOCK_TYPES },
      ),
      null,
    );
    assert.equal(
      coveringCalendarBlockTitle([sundayWeekly], tourCoverageInterval({
        date: "2099-06-21",
        startTime: "18:00",
        durationMinutes: 60,
      }), { types: TOUR_CLOSING_CALENDAR_BLOCK_TYPES }),
      null,
    );
  });

  it("daily / monthly / annual patterns the schema actually supports", () => {
    const daily = {
      title: "Daily close",
      type: "blocked_time",
      startDate: "2099-06-14",
      endDate: "2099-06-14",
      isAllDay: true,
      recurrenceRule: "daily" as const,
      recurrenceInterval: 1,
      recurrenceEndsOn: "2099-06-16",
      recurrenceCount: null,
    };
    assert.equal(calendarBlockCoversInterval(daily, eventCoverageInterval({ eventDate: "2099-06-16" })), true);
    assert.equal(calendarBlockCoversInterval(daily, eventCoverageInterval({ eventDate: "2099-06-17" })), false);

    const monthly = {
      title: "Month-end",
      type: "blocked_time",
      startDate: "2099-01-31",
      endDate: "2099-01-31",
      isAllDay: true,
      recurrenceRule: "monthly" as const,
      recurrenceInterval: 1,
      recurrenceEndsOn: null,
      recurrenceCount: 3,
    };
    assert.equal(calendarBlockCoversInterval(monthly, eventCoverageInterval({ eventDate: "2099-02-28" })), true);
    assert.equal(calendarBlockCoversInterval(monthly, eventCoverageInterval({ eventDate: "2099-02-27" })), false);

    const annual = {
      title: "Anniversary close",
      type: "blocked_time",
      startDate: "2098-06-14",
      endDate: "2098-06-14",
      isAllDay: true,
      recurrenceRule: "annual" as const,
      recurrenceInterval: 1,
      recurrenceEndsOn: null,
      recurrenceCount: null,
    };
    assert.equal(calendarBlockCoversInterval(annual, eventCoverageInterval({ eventDate: "2099-06-14" })), true);
    assert.equal(calendarBlockCoversInterval(annual, eventCoverageInterval({ eventDate: "2099-06-15" })), false);
  });

  it("precheck agrees with covering evaluation for a recurring Sunday block", () => {
    const snapshot = {
      calendarBlocks: [sundayWeekly],
      holdCount: 0,
      rules: { maxSimultaneousEvents: 1 },
      events: [],
      activeSpaceIds: [] as string[],
      allSpaceIds: [] as string[],
      tours: [],
    };
    const blocked = buildAvailabilityConflicts(
      { date: "2099-06-21", type: "event", startTime: "10:00", endTime: "12:00" },
      snapshot,
    );
    const evening = buildAvailabilityConflicts(
      { date: "2099-06-21", type: "event", startTime: "18:00", endTime: "22:00" },
      snapshot,
    );
    const monday = buildAvailabilityConflicts(
      { date: "2099-06-22", type: "event", startTime: "10:00", endTime: "12:00" },
      snapshot,
    );
    assert.equal(blocked.available, false);
    assert.equal(blocked.conflicts.some((c) => c.type === "calendar_blocked"), true);
    assert.equal(evening.available, true);
    assert.equal(monday.available, true);
  });
});
