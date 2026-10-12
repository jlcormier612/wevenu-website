import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatComponentTimeRange,
  groupBookingSummaryByDate,
  type BookingSummaryComponent,
} from "@/lib/events/booking-summary";

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
