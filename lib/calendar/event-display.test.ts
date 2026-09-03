import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calendarDatesForProtectedEvent } from "@/lib/calendar/event-display";

describe("calendarDatesForProtectedEvent", () => {
  it("places a single-day Event on its event_date", () => {
    assert.deepEqual(
      calendarDatesForProtectedEvent("2099-06-15", null, "2099-06-01", "2099-06-30"),
      ["2099-06-15"],
    );
  });

  it("expands a multi-day Event across every protected day in the visible range", () => {
    assert.deepEqual(
      calendarDatesForProtectedEvent("2099-05-30", "2099-06-02", "2099-06-01", "2099-06-30"),
      ["2099-06-01", "2099-06-02"],
    );
  });

  it("includes an Event that starts before the month and continues into it", () => {
    assert.deepEqual(
      calendarDatesForProtectedEvent("2099-05-28", "2099-06-03", "2099-06-01", "2099-06-30"),
      ["2099-06-01", "2099-06-02", "2099-06-03"],
    );
  });
});
