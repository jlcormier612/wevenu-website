import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatComponentTimeRange,
  formatDayOfBookingWindow,
  groupBookingSummaryByDate,
  type BookingSummaryComponent,
} from "@/lib/events/booking-summary";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function component(
  overrides: Partial<BookingSummaryComponent> & Pick<BookingSummaryComponent, "useKey" | "useLabel">,
): BookingSummaryComponent {
  return {
    spaceName: null,
    scheduledDate: null,
    startTime: null,
    endTime: null,
    sortOrder: 0,
    ...overrides,
  };
}

describe("booking summary multi-day components", () => {
  it("groups by each component's saved date, not a shared event window", () => {
    const groups = groupBookingSummaryByDate([
      component({
        useKey: "rehearsal_dinner",
        useLabel: "Rehearsal Dinner",
        scheduledDate: "2027-09-03",
        startTime: "18:00",
        endTime: "21:00",
        spaceName: "Garden Room",
        sortOrder: 0,
      }),
      component({
        useKey: "ceremony",
        useLabel: "Ceremony",
        scheduledDate: "2027-09-04",
        startTime: "16:00",
        endTime: "17:00",
        spaceName: "Chapel",
        sortOrder: 2,
      }),
      component({
        useKey: "reception",
        useLabel: "Reception",
        scheduledDate: "2027-09-04",
        startTime: "18:00",
        endTime: "23:00",
        spaceName: "Ballroom",
        sortOrder: 3,
      }),
    ]);

    assert.equal(groups.length, 2);
    assert.equal(groups[0].date, "2027-09-03");
    assert.equal(groups[0].components.length, 1);
    assert.equal(groups[0].components[0].useKey, "rehearsal_dinner");
    assert.equal(groups[1].date, "2027-09-04");
    assert.deepEqual(
      groups[1].components.map((c) => c.useKey),
      ["ceremony", "reception"],
    );
  });

  it("does not inherit wedding-day hours onto the rehearsal dinner", () => {
    const rehearsal = component({
      useKey: "rehearsal_dinner",
      useLabel: "Rehearsal Dinner",
      scheduledDate: "2027-09-03",
      startTime: "18:00",
      endTime: "21:00",
      spaceName: "Garden Room",
    });
    const reception = component({
      useKey: "reception",
      useLabel: "Reception",
      scheduledDate: "2027-09-04",
      startTime: "14:00",
      endTime: "22:00",
      spaceName: "Ballroom",
    });
    const groups = groupBookingSummaryByDate([rehearsal, reception]);
    const friday = groups.find((g) => g.date === "2027-09-03");
    assert.ok(friday);
    assert.equal(
      formatComponentTimeRange(friday!.components[0].startTime, friday!.components[0].endTime),
      formatComponentTimeRange("18:00", "21:00"),
    );
    assert.notEqual(
      formatComponentTimeRange(friday!.components[0].startTime, friday!.components[0].endTime),
      formatComponentTimeRange("14:00", "22:00"),
    );
  });

  it("shows Time not set instead of copying another component's hours", () => {
    assert.equal(formatComponentTimeRange(null, null), "Time not set");
    assert.equal(formatComponentTimeRange("", ""), "Time not set");
    const groups = groupBookingSummaryByDate([
      component({
        useKey: "getting_ready",
        useLabel: "Getting Ready",
        scheduledDate: "2027-09-04",
        startTime: null,
        endTime: null,
      }),
      component({
        useKey: "reception",
        useLabel: "Reception",
        scheduledDate: "2027-09-04",
        startTime: "18:00",
        endTime: "23:00",
      }),
    ]);
    const unset = groups[0].components.find((c) => c.useKey === "getting_ready");
    assert.ok(unset);
    assert.equal(formatComponentTimeRange(unset!.startTime, unset!.endTime), "Time not set");
  });

  it("keeps components without a saved date in a Date not set group", () => {
    const groups = groupBookingSummaryByDate([
      component({
        useKey: "rehearsal_dinner",
        useLabel: "Rehearsal Dinner",
        scheduledDate: null,
        startTime: "18:00",
        endTime: "21:00",
      }),
      component({
        useKey: "ceremony",
        useLabel: "Ceremony",
        scheduledDate: "2027-09-04",
        startTime: "16:00",
        endTime: "17:00",
      }),
    ]);
    assert.equal(groups.length, 2);
    assert.equal(groups[0].date, "2027-09-04");
    assert.equal(groups[1].date, null);
    assert.equal(groups[1].label, "Date not set");
  });
});

describe("Day-of booking window metadata", () => {
  it("returns null when no overall times are saved", () => {
    assert.equal(formatDayOfBookingWindow({}), null);
    assert.equal(
      formatDayOfBookingWindow({
        startTime: null,
        endTime: null,
        setupTime: "",
        teardownTime: null,
      }),
      null,
    );
  });

  it("formats setup, start/end, and teardown without inventing missing parts", () => {
    assert.equal(
      formatDayOfBookingWindow({
        setupTime: "12:00",
        startTime: "14:00",
        endTime: "23:00",
        teardownTime: "00:00",
      }),
      "Setup 12:00 PM · 2:00 PM – 11:00 PM · Teardown 12:00 AM",
    );
    assert.equal(
      formatDayOfBookingWindow({ startTime: "16:00", multiDay: true }),
      "Overall 4:00 PM",
    );
  });

  it("keeps Day-of window visible alongside component schedule in Overview and Timeline", () => {
    const detail = readFileSync(
      resolve("components/events/event-detail.tsx"),
      "utf8",
    );
    assert.match(detail, /formatDayOfBookingWindow/);
    assert.match(detail, /data-testid="event-day-of-booking-window"/);
    assert.match(detail, /dayOfSetupTime=\{event\.setupTime\}/);
    assert.match(detail, /dayOfEndTime=\{event\.endTime\}/);
    assert.match(detail, /dayOfTeardownTime=\{event\.teardownTime\}/);

    const timeline = readFileSync(
      resolve("components/events/timeline/timeline-view.tsx"),
      "utf8",
    );
    assert.match(timeline, /formatDayOfBookingWindow/);
    assert.match(timeline, /data-testid="timeline-day-of-booking-window"/);
    // Must not stamp overall start onto every activity.
    assert.doesNotMatch(
      timeline,
      /entry_time:\s*eventStartTime|entryTime:\s*eventStartTime/,
    );
  });
});
