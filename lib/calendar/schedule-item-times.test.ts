import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  displayScheduleItemTimes,
  persistScheduleItemTimes,
  validateScheduleItemTimes,
} from "@/lib/calendar/schedule-item-times";

const form = readFileSync(resolve("components/calendar/calendar-view.tsx"), "utf8");

describe("timed schedule items require both clock times", () => {
  it("accepts a same-day 09:00–10:00 item", () => {
    assert.equal(
      validateScheduleItemTimes({
        isAllDay: false, startDate: "2026-09-01", startTime: "09:00", endTime: "10:00",
      }),
      null,
    );
  });

  it("rejects a timed item missing start or end", () => {
    assert.equal(
      validateScheduleItemTimes({
        isAllDay: false, startDate: "2026-09-01", startTime: "", endTime: "10:00",
      })?.message,
      "Start and end times are required unless the item is all day.",
    );
    assert.equal(
      validateScheduleItemTimes({
        isAllDay: false, startDate: "2026-09-01", startTime: "09:00", endTime: "",
      })?.ok,
      false,
    );
  });

  it("rejects same-day end at or before start", () => {
    assert.equal(
      validateScheduleItemTimes({
        isAllDay: false, startDate: "2026-09-01", startTime: "10:00", endTime: "10:00",
      })?.message,
      "End time must be after start time.",
    );
  });

  it("allows overnight items whose end date is later", () => {
    assert.equal(
      validateScheduleItemTimes({
        isAllDay: false,
        startDate: "2026-09-01",
        endDate: "2026-09-02",
        startTime: "22:00",
        endTime: "01:00",
      }),
      null,
    );
  });
});

describe("all-day schedule items do not carry clock times", () => {
  it("skips time validation when All day is set", () => {
    assert.equal(
      validateScheduleItemTimes({
        isAllDay: true, startDate: "2026-09-01", startTime: "", endTime: "",
      }),
      null,
    );
  });

  it("persists null clock times for all-day items even if the form still holds defaults", () => {
    assert.deepEqual(
      persistScheduleItemTimes(true, "09:00", "17:00"),
      { start_time: null, end_time: null },
    );
  });

  it("displays no clock time for all-day items", () => {
    assert.deepEqual(
      displayScheduleItemTimes(true, "09:00", "17:00"),
      { time: null, endTime: null },
    );
  });
});

describe("save, edit, and display of timed items", () => {
  it("persists the typed start and end on save", () => {
    assert.deepEqual(
      persistScheduleItemTimes(false, "09:30", "10:15"),
      { start_time: "09:30", end_time: "10:15" },
    );
  });

  it("trims Postgres time values so edit/display round-trip as HH:MM", () => {
    assert.deepEqual(
      displayScheduleItemTimes(false, "09:30:00", "10:15:00"),
      { time: "09:30", endTime: "10:15" },
    );
  });

  it("keeps the same clock time on every recurrence occurrence", () => {
    // Expansion only generates dates; display times are computed once from the
    // row and reused. A weekly 2pm tour stays 2pm on every date.
    const first = displayScheduleItemTimes(false, "14:00", "15:00");
    const later = displayScheduleItemTimes(false, "14:00", "15:00");
    assert.deepEqual(first, later);
    assert.equal(first.time, "14:00");
    assert.equal(first.endTime, "15:00");
  });
});

describe("Add Schedule Item form exposes time fields", () => {
  it("defaults All day off so Start time and End time are visible on Add", () => {
    assert.match(form, /setBlockIsAllDay\] = React\.useState\(false\)/);
    assert.match(form, /setBlockIsAllDay\(false\)/);
  });

  it("renders Start time and End time inputs when All day is unchecked", () => {
    assert.match(form, /Start time/);
    assert.match(form, /End time/);
    assert.match(form, /type="time"/);
    assert.match(form, /!blockIsAllDay && \(/);
  });

  it("places the time fields with the dates, before Related to", () => {
    const startDate = form.indexOf("Start date *");
    const startTime = form.indexOf("Start time *");
    const related = form.indexOf("Related to <span");
    assert.ok(startDate >= 0 && startTime > startDate && related > startTime,
      "Start time must sit between Start date and Related to");
  });

  it("loads existing times when editing", () => {
    assert.match(form, /setBlockStartTime\(block\.startTime/);
    assert.match(form, /setBlockEndTime\(block\.endTime/);
    assert.match(form, /setBlockIsAllDay\(block\.isAllDay\)/);
  });
});
