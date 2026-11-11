import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { CALENDAR_MAX_YEAR, CALENDAR_MIN_YEAR } from "@/lib/calendar/types";
import { clampMonthYear, yearOptionsForRange } from "@/lib/calendar/month-year-range";

const picker = readFileSync(resolve("components/shared/month-year-picker.tsx"), "utf8");
const inquiry = readFileSync(resolve("components/form/inquiry-form.tsx"), "utf8");
const tourPanel = readFileSync(resolve("components/leads/tour-panel.tsx"), "utf8");
const calShared = readFileSync(resolve("components/calendar/calendar-shared.tsx"), "utf8");

describe("month-year picker range", () => {
  it("reuses venue Calendar year constants (current through 2040+)", () => {
    assert.equal(CALENDAR_MIN_YEAR, 2020);
    assert.equal(CALENDAR_MAX_YEAR, 2040);
    assert.ok(CALENDAR_MAX_YEAR - 2026 >= 4, "at least four years ahead of 2026");
    const years = yearOptionsForRange(2026, CALENDAR_MAX_YEAR);
    assert.ok(years.includes(2030));
    assert.equal(years[0], 2026);
    assert.equal(years[years.length - 1], 2040);
  });

  it("clampMonthYear does not wrap past min/max", () => {
    assert.deepEqual(clampMonthYear(0, 2025, 2026, 2040), { month: 0, year: 2026 });
    assert.deepEqual(clampMonthYear(11, 2041, 2026, 2040), { month: 11, year: 2040 });
    assert.deepEqual(clampMonthYear(12, 2030, 2026, 2040), { month: 0, year: 2031 });
    assert.deepEqual(clampMonthYear(-1, 2030, 2026, 2040), { month: 11, year: 2029 });
  });
});

describe("availability calendar month/year wiring", () => {
  it("public inquiry AvailabilityCalendar uses MonthYearPicker with chevrons", () => {
    assert.match(inquiry, /MonthYearPicker/);
    assert.match(inquiry, /clampMonthYear/);
    assert.match(inquiry, /CALENDAR_MAX_YEAR/);
    assert.match(inquiry, /aria-label="Previous month"/);
    assert.match(inquiry, /aria-label="Next month"/);
    assert.match(inquiry, /data-testid="availability-calendar"/);
    // Month change for preferred event date does not clear selection
    assert.match(
      inquiry,
      /onMonthChange=\{\(m, y\) => \{ setEventMonth\(m\); setEventYear\(y\); \}\}/,
    );
  });

  it("tour scheduling CalendarGrid uses the same picker", () => {
    assert.match(tourPanel, /MonthYearPicker/);
    assert.match(tourPanel, /data-testid="tour-availability-calendar"/);
  });

  it("venue Calendar MonthYearPicker re-exports the shared component", () => {
    assert.match(calShared, /export \{ MonthYearPicker \} from "@\/components\/shared\/month-year-picker"/);
    assert.match(picker, /aria-label="Month"/);
    assert.match(picker, /aria-label="Year"/);
    assert.match(picker, /data-testid="calendar-month-select"/);
    assert.match(picker, /data-testid="calendar-year-select"/);
  });

  it("does not introduce a second availability engine", () => {
    assert.match(inquiry, /availableDates\.has\(iso\)/);
    assert.doesNotMatch(inquiry, /from\("date_holds"\)|from\("events"\)/);
  });
});
