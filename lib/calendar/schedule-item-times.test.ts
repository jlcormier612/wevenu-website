import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  displayScheduleItemTimes,
  formScheduleItemTimes,
  normalizeScheduleItemAllDay,
  persistScheduleItemTimes,
  validateScheduleItemTimes,
} from "@/lib/calendar/schedule-item-times";

const form = readFileSync(resolve("components/calendar/calendar-view.tsx"), "utf8");
const repo = readFileSync(resolve("lib/availability/repository.ts"), "utf8");

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

  it("persists null clock times for all-day items even if the form still holds values", () => {
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

  it("round-trips saved times through form load without inventing 09:00–17:00", () => {
    assert.deepEqual(
      formScheduleItemTimes(false, "14:00:00", "15:30:00"),
      { startTime: "14:00", endTime: "15:30" },
    );
    assert.deepEqual(
      formScheduleItemTimes(true, null, null),
      { startTime: "", endTime: "" },
    );
    // Missing times on a timed row stay blank — never fabricate a business day.
    assert.deepEqual(
      formScheduleItemTimes(false, null, null),
      { startTime: "", endTime: "" },
    );
  });

  it("treats only explicit true as all-day so DB default true cannot win on omit", () => {
    assert.equal(normalizeScheduleItemAllDay(true), true);
    assert.equal(normalizeScheduleItemAllDay(false), false);
    assert.equal(normalizeScheduleItemAllDay(undefined), false);
    assert.equal(normalizeScheduleItemAllDay(null), false);
  });

  it("persist + form load preserves a short appointment across edit", () => {
    const saved = persistScheduleItemTimes(false, "11:00", "11:45");
    const reopened = formScheduleItemTimes(false, saved.start_time, saved.end_time);
    assert.deepEqual(reopened, { startTime: "11:00", endTime: "11:45" });
    const rewritten = persistScheduleItemTimes(false, reopened.startTime, reopened.endTime);
    assert.deepEqual(rewritten, saved);
  });
});

describe("Add Schedule Item form exposes time fields", () => {
  it("defaults All day off so Start time and End time are visible on Add", () => {
    assert.match(form, /setBlockIsAllDay\] = React\.useState\(false\)/);
    assert.match(form, /setBlockIsAllDay\(false\)/);
  });

  it("does not invent 09:00–17:00 as create or edit defaults", () => {
    assert.doesNotMatch(form, /useState\("09:00"\)/);
    assert.doesNotMatch(form, /useState\("17:00"\)/);
    assert.doesNotMatch(form, /setBlockStartTime\("09:00"\)/);
    assert.doesNotMatch(form, /setBlockEndTime\("17:00"\)/);
    assert.doesNotMatch(form, /block\.startTime \?\? "09:00"/);
    assert.doesNotMatch(form, /block\.endTime \?\? "17:00"/);
  });

  it("loads form times through formScheduleItemTimes so reopen matches the DB", () => {
    assert.match(form, /formScheduleItemTimes\(block\.isAllDay, block\.startTime, block\.endTime\)/);
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

  it("clears clock inputs when All day is checked", () => {
    assert.match(form, /if \(next\) \{\s*setBlockStartTime\(""\);\s*setBlockEndTime\(""\);/s);
  });
});

describe("repository always sends an explicit is_all_day boolean", () => {
  it("normalizes is_all_day before insert/update", () => {
    assert.match(repo, /normalizeScheduleItemAllDay\(input\.isAllDay\)/);
    assert.match(repo, /is_all_day: normalizeScheduleItemAllDay/);
  });
});
