import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateEventOccupancy, type OccupancyEvent, type OccupancyVenue } from "@/lib/availability/event-occupancy";
import { bookingConfirmationError, toConfirmedBookingOccupancy } from "@/lib/booking-journey/confirmed-occupancy";
import { summarizeOwnHolds } from "@/lib/booking-journey/confirmation-draft";

const GARDEN = "space-garden";
const BARN = "space-barn";

const venue: OccupancyVenue = {
  effectiveMax: 2,
  minTurnaroundHours: 0,
  activeSpaceIds: [GARDEN, BARN],
  allSpaceIds: [GARDEN, BARN],
};

function booked(partial: Partial<OccupancyEvent> & Pick<OccupancyEvent, "id">): OccupancyEvent {
  return {
    status: "confirmed",
    eventDate: "2028-06-16",
    eventEndDate: null,
    spaceId: BARN,
    spaceIds: [BARN],
    setupTime: null,
    startTime: "15:00",
    endTime: "17:00",
    teardownTime: null,
    name: "Other event",
    ...partial,
  };
}

describe("per-space booking windows", () => {
  it("allows a different space at the same time and the same space later that day", () => {
    const existing = booked({ id: "other" });
    const result = evaluateEventOccupancy(
      {
        eventDate: "2028-06-16",
        windows: [
          { spaceId: GARDEN, startTime: "14:00", endTime: "16:00" },
          { spaceId: BARN, startTime: "18:00", endTime: "21:00" },
        ],
      },
      venue,
      [existing],
    );
    assert.equal(result.ok, true);
  });

  it("refuses the same space when the windows overlap", () => {
    const result = evaluateEventOccupancy(
      {
        eventDate: "2028-06-16",
        windows: [{ spaceId: BARN, startTime: "16:00", endTime: "19:00" }],
      },
      venue,
      [booked({ id: "other" })],
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "space_overlap");
  });

  it("still treats one shared event window as occupying every assigned space", () => {
    const result = evaluateEventOccupancy(
      {
        eventDate: "2028-06-16",
        startTime: "14:00",
        endTime: "18:00",
        spaceId: GARDEN,
        spaceIds: [GARDEN, BARN],
      },
      venue,
      [booked({ id: "other", startTime: "15:00", endTime: "16:00" })],
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "space_overlap");
  });
});

describe("booking confirmation contract", () => {
  it("stores each space window and uses the overall span on the event", () => {
    const occupancy = toConfirmedBookingOccupancy({
      eventDate: "2028-06-16",
      eventEndDate: "",
      startTime: "",
      endTime: "",
      spaceId: "",
      weddingFamily: true,
      assignments: [
        { useKey: "ceremony", useLabel: "Ceremony", spaceId: GARDEN, startTime: "16:00", endTime: "17:00" },
        { useKey: "reception", useLabel: "Reception", spaceId: BARN, startTime: "18:00", endTime: "22:00" },
      ],
    });
    assert.equal(occupancy.startTime, "16:00");
    assert.equal(occupancy.endTime, "22:00");
    assert.equal(occupancy.spaceId, BARN);
    assert.equal(occupancy.assignments[0]?.startTime, "16:00");
    assert.equal(bookingConfirmationError(occupancy, 2), null);
  });

  it("rejects a space that has only one of the two times", () => {
    const occupancy = toConfirmedBookingOccupancy({
      eventDate: "2028-06-16",
      eventEndDate: "",
      startTime: "",
      endTime: "",
      spaceId: "",
      weddingFamily: true,
      assignments: [
        { useKey: "ceremony", useLabel: "Ceremony", spaceId: GARDEN, startTime: "16:00", endTime: null },
      ],
    });
    assert.match(bookingConfirmationError(occupancy, 2) ?? "", /start and an end time for each assigned space/);
  });

  it("labels a hold with no spaces as the whole venue", () => {
    const [hold] = summarizeOwnHolds(
      [{ holdDate: "2028-06-16", startTime: null, endTime: null, spaceId: null, spaceIds: [] }],
      [],
    );
    assert.equal(hold?.wholeVenue, true);
    assert.equal(hold?.spaceLabel, null);
  });
});
