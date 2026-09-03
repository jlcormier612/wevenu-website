import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAvailabilityConflicts, occupancyConflictType } from "@/lib/availability/precheck";
import type { OccupancyEvent } from "@/lib/availability/event-occupancy";

function event(partial: Partial<OccupancyEvent> & Pick<OccupancyEvent, "id" | "eventDate">): OccupancyEvent {
  return {
    status: "confirmed",
    eventEndDate: null,
    spaceId: null,
    setupTime: null,
    startTime: null,
    endTime: null,
    teardownTime: null,
    name: partial.name ?? partial.id,
    ...partial,
  };
}

describe("availability pre-check (Phase 5)", () => {
  it("treats a missing capacity row as max 1 and refuses a second overlapping Event", () => {
    const status = buildAvailabilityConflicts(
      { date: "2099-06-15", type: "event" },
      {
        calendarBlocks: [],
        holdCount: 0,
        rules: null,
        events: [event({ id: "e1", eventDate: "2099-06-15" })],
        activeSpaceIds: [],
        allSpaceIds: [],
        tours: [],
      },
    );
    assert.equal(status.available, false);
    assert.equal(status.conflicts.some((c) => c.type === "event_capacity_full" && c.severity === "error"), true);
  });

  it("does not treat sequential same-day Event windows as at capacity", () => {
    const status = buildAvailabilityConflicts(
      {
        date: "2099-06-15",
        type: "event",
        startTime: "18:00",
        endTime: "22:00",
      },
      {
        calendarBlocks: [],
        holdCount: 0,
        rules: { maxSimultaneousEvents: 1 },
        events: [event({ id: "e1", eventDate: "2099-06-15", startTime: "10:00", endTime: "14:00" })],
        activeSpaceIds: [],
        allSpaceIds: [],
        tours: [],
      },
    );
    assert.equal(status.available, true);
    assert.equal(status.conflicts.some((c) => c.severity === "error"), false);
  });

  it("uses the protected Event range, not only the start date", () => {
    const status = buildAvailabilityConflicts(
      { date: "2099-06-16", type: "event" },
      {
        calendarBlocks: [],
        holdCount: 0,
        rules: { maxSimultaneousEvents: 1 },
        events: [event({ id: "e1", eventDate: "2099-06-15", eventEndDate: "2099-06-17" })],
        activeSpaceIds: [],
        allSpaceIds: [],
        tours: [],
      },
    );
    assert.equal(status.available, false);
    assert.equal(status.conflicts.some((c) => c.type === "event_capacity_full"), true);
  });

  it("maps occupancy codes so the UI can hard-block instead of calling them advisory", () => {
    assert.equal(occupancyConflictType("venue_at_capacity"), "event_capacity_full");
    assert.equal(occupancyConflictType("space_overlap"), "space_booked");
    assert.equal(occupancyConflictType("no_spaces"), "event_occupancy");
    assert.equal(occupancyConflictType("missing_space"), "event_occupancy");
    assert.equal(occupancyConflictType("event_turnaround"), "event_turnaround");
  });

  it("precheck refuses a Tour-adjacent Event that violates turnaround", () => {
    const status = buildAvailabilityConflicts(
      { date: "2099-06-16", type: "event", startTime: "09:00", endTime: "11:00" },
      {
        calendarBlocks: [],
        holdCount: 0,
        rules: { maxSimultaneousEvents: 1, minTurnaroundHours: 12 },
        events: [event({ id: "e1", eventDate: "2099-06-15", startTime: "18:00", endTime: "22:00", name: "Evening" })],
        activeSpaceIds: [],
        allSpaceIds: [],
        tours: [],
      },
    );
    assert.equal(status.available, false);
    assert.equal(status.conflicts.some((c) => c.type === "event_turnaround" && c.severity === "error"), true);
  });

  it("precheck allows the Event that starts exactly at the turnaround boundary", () => {
    const status = buildAvailabilityConflicts(
      { date: "2099-06-16", type: "event", startTime: "10:00", endTime: "12:00" },
      {
        calendarBlocks: [],
        holdCount: 0,
        rules: { maxSimultaneousEvents: 1, minTurnaroundHours: 12 },
        events: [event({ id: "e1", eventDate: "2099-06-15", startTime: "18:00", endTime: "22:00" })],
        activeSpaceIds: [],
        allSpaceIds: [],
        tours: [],
      },
    );
    assert.equal(status.conflicts.some((c) => c.type === "event_turnaround"), false);
    assert.equal(status.available, true);
  });

  it("Event→Tour conflict uses operational overlap, not event_date-only", () => {
    const evening = event({ id: "e1", eventDate: "2099-06-15", startTime: "18:00", endTime: "22:00" });
    const daytime = buildAvailabilityConflicts(
      { date: "2099-06-15", type: "tour", tourScheduledAtMs: Date.parse("2099-06-15T10:00:00Z"), tourDurationMinutes: 60 },
      {
        calendarBlocks: [],
        holdCount: 0,
        rules: null,
        events: [evening],
        activeSpaceIds: [],
        allSpaceIds: [],
        tours: [],
      },
    );
    assert.equal(daytime.conflicts.some((c) => c.type === "tour_event_overlap"), false);

    const eveningTour = buildAvailabilityConflicts(
      { date: "2099-06-15", type: "tour", tourScheduledAtMs: Date.parse("2099-06-15T18:00:00Z"), tourDurationMinutes: 60 },
      {
        calendarBlocks: [],
        holdCount: 0,
        rules: null,
        events: [event({ id: "e1", eventDate: "2099-06-15", startTime: "10:00", endTime: "14:00" })],
        activeSpaceIds: [],
        allSpaceIds: [],
        tours: [],
      },
    );
    assert.equal(eveningTour.conflicts.some((c) => c.type === "tour_event_overlap"), false);

    const overlapping = buildAvailabilityConflicts(
      { date: "2099-06-15", type: "tour", tourScheduledAtMs: Date.parse("2099-06-15T21:30:00Z"), tourDurationMinutes: 60 },
      {
        calendarBlocks: [],
        holdCount: 0,
        rules: null,
        events: [evening],
        activeSpaceIds: [],
        allSpaceIds: [],
        tours: [],
      },
    );
    assert.equal(overlapping.available, false);
    assert.equal(overlapping.conflicts.some((c) => c.type === "tour_event_overlap"), true);
  });

  it("applies Event operational overlap on each protected day of a multi-day Event", () => {
    const multi = event({
      id: "e1", eventDate: "2099-06-15", eventEndDate: "2099-06-17",
      startTime: "18:00", endTime: "22:00",
    });
    const morning = buildAvailabilityConflicts(
      { date: "2099-06-16", type: "tour", tourScheduledAtMs: Date.parse("2099-06-16T10:00:00Z"), tourDurationMinutes: 60 },
      {
        calendarBlocks: [], holdCount: 0, rules: null, events: [multi],
        activeSpaceIds: [], allSpaceIds: [], tours: [],
      },
    );
    assert.equal(morning.conflicts.some((c) => c.type === "tour_event_overlap"), false);

    const evening = buildAvailabilityConflicts(
      { date: "2099-06-16", type: "tour", tourScheduledAtMs: Date.parse("2099-06-16T21:00:00Z"), tourDurationMinutes: 60 },
      {
        calendarBlocks: [], holdCount: 0, rules: null, events: [multi],
        activeSpaceIds: [], allSpaceIds: [], tours: [],
      },
    );
    assert.equal(evening.conflicts.some((c) => c.type === "tour_event_overlap"), true);
  });

  it("cancelled Events do not block Tours in the pre-check", () => {
    const status = buildAvailabilityConflicts(
      { date: "2099-06-15", type: "tour", tourScheduledAtMs: Date.parse("2099-06-15T21:00:00Z"), tourDurationMinutes: 60 },
      {
        calendarBlocks: [],
        holdCount: 0,
        rules: null,
        events: [event({ id: "e1", eventDate: "2099-06-15", status: "cancelled", startTime: "18:00", endTime: "22:00" })],
        activeSpaceIds: [],
        allSpaceIds: [],
        tours: [],
      },
    );
    assert.equal(status.conflicts.some((c) => c.type === "tour_event_overlap"), false);
  });

  it("lead-form weekly window: inside succeeds, outside and overrun fail", () => {
    const windows = [{ dayOfWeek: 1, startTime: "10:00", endTime: "12:00" }];
    const base = {
      calendarBlocks: [] as { title: string; type: string }[],
      holdCount: 0,
      rules: null,
      events: [] as OccupancyEvent[],
      activeSpaceIds: [] as string[],
      allSpaceIds: [] as string[],
      tours: [],
      tourWindows: windows,
    };
    const inside = buildAvailabilityConflicts(
      { date: "2099-06-15", type: "tour", tourScheduledAtMs: Date.parse("2099-06-15T10:00:00Z"), tourDurationMinutes: 60 },
      base,
    );
    assert.equal(inside.conflicts.some((c) => c.type === "tour_outside_window"), false);

    const outside = buildAvailabilityConflicts(
      { date: "2099-06-15", type: "tour", tourScheduledAtMs: Date.parse("2099-06-15T13:00:00Z"), tourDurationMinutes: 60 },
      base,
    );
    assert.equal(outside.available, false);
    assert.equal(outside.conflicts.some((c) => c.type === "tour_outside_window"), true);

    const overrun = buildAvailabilityConflicts(
      { date: "2099-06-15", type: "tour", tourScheduledAtMs: Date.parse("2099-06-15T11:30:00Z"), tourDurationMinutes: 60 },
      base,
    );
    assert.equal(overrun.conflicts.some((c) => c.type === "tour_outside_window"), true);
  });

  it("lead-form pre-check still enforces exceptions, Event overlap, and Tour capacity with windows", () => {
    const windows = [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }];
    const ten = Date.parse("2099-06-15T10:00:00Z");
    const exception = buildAvailabilityConflicts(
      { date: "2099-06-15", type: "tour", tourScheduledAtMs: ten, tourDurationMinutes: 60 },
      {
        calendarBlocks: [], holdCount: 0, rules: null, events: [],
        activeSpaceIds: [], allSpaceIds: [], tours: [],
        tourWindows: windows, tourExceptionLabel: "Holiday",
      },
    );
    assert.equal(exception.conflicts.some((c) => c.type === "tour_exception"), true);

    const eventOverlap = buildAvailabilityConflicts(
      { date: "2099-06-15", type: "tour", tourScheduledAtMs: Date.parse("2099-06-15T16:00:00Z"), tourDurationMinutes: 60 },
      {
        calendarBlocks: [], holdCount: 0, rules: null,
        events: [event({ id: "e1", eventDate: "2099-06-15", startTime: "15:00", endTime: "22:00" })],
        activeSpaceIds: [], allSpaceIds: [], tours: [], tourWindows: windows,
      },
    );
    assert.equal(eventOverlap.conflicts.some((c) => c.type === "tour_event_overlap"), true);

    const capacity = buildAvailabilityConflicts(
      { date: "2099-06-15", type: "tour", tourScheduledAtMs: ten, tourDurationMinutes: 60 },
      {
        calendarBlocks: [], holdCount: 0, rules: null, events: [],
        activeSpaceIds: [], allSpaceIds: [],
        tours: [{ id: "t1", status: "scheduled", scheduledAtMs: ten, durationMinutes: 60 }],
        tourWindows: windows,
      },
    );
    assert.equal(capacity.conflicts.some((c) => c.type === "tour_capacity_full"), true);
  });

  it("Tour pre-check uses a venue duration other than 60", () => {
    const windows = [{ dayOfWeek: 1, startTime: "10:00", endTime: "12:00" }];
    const base = {
      calendarBlocks: [] as { title: string; type: string }[],
      holdCount: 0,
      rules: null,
      events: [] as OccupancyEvent[],
      activeSpaceIds: [] as string[],
      allSpaceIds: [] as string[],
      tours: [],
      tourWindows: windows,
    };
    const fits = buildAvailabilityConflicts(
      { date: "2099-06-15", type: "tour", tourScheduledAtMs: Date.parse("2099-06-15T10:00:00Z"), tourDurationMinutes: 90 },
      base,
    );
    assert.equal(fits.conflicts.some((c) => c.type === "tour_outside_window"), false);
    const overrun = buildAvailabilityConflicts(
      { date: "2099-06-15", type: "tour", tourScheduledAtMs: Date.parse("2099-06-15T10:45:00Z"), tourDurationMinutes: 90 },
      base,
    );
    assert.equal(overrun.available, false);
    assert.equal(overrun.conflicts.some((c) => c.type === "tour_outside_window"), true);
  });

  it("Event→Tour pre-check uses venue-local clock when timezone is set", () => {
    const evening = event({
      id: "e1", eventDate: "2099-06-15", startTime: "18:00", endTime: "22:00",
    });
    const snapshot = {
      calendarBlocks: [] as { title: string; type: string }[],
      holdCount: 0,
      rules: null,
      events: [evening],
      activeSpaceIds: [] as string[],
      allSpaceIds: [] as string[],
      tours: [],
    };
    const morningNy = buildAvailabilityConflicts(
      {
        date: "2099-06-15",
        type: "tour",
        tourScheduledAtMs: Date.parse("2099-06-15T14:00:00Z"),
        tourDurationMinutes: 60,
        timezone: "America/New_York",
      },
      snapshot,
    );
    assert.equal(morningNy.conflicts.some((c) => c.type === "tour_event_overlap"), false);

    const overlappingNy = buildAvailabilityConflicts(
      {
        date: "2099-06-15",
        type: "tour",
        tourScheduledAtMs: Date.parse("2099-06-15T22:30:00Z"),
        tourDurationMinutes: 60,
        timezone: "America/New_York",
      },
      snapshot,
    );
    assert.equal(overlappingNy.available, false);
    assert.equal(overlappingNy.conflicts.some((c) => c.type === "tour_event_overlap"), true);
  });

  it("Tour calendar-block pre-check only uses write-path closing types", () => {
    const ignored = buildAvailabilityConflicts(
      { date: "2099-06-15", type: "tour" },
      {
        calendarBlocks: [{ title: "Consultation", type: "consultation" }],
        holdCount: 0,
        rules: null,
        events: [],
        activeSpaceIds: [],
        allSpaceIds: [],
        tours: [],
      },
    );
    assert.equal(ignored.conflicts.some((c) => c.type === "calendar_blocked"), false);

    const closing = buildAvailabilityConflicts(
      { date: "2099-06-15", type: "tour" },
      {
        calendarBlocks: [{ title: "Blocked", type: "blocked_time" }],
        holdCount: 0,
        rules: null,
        events: [],
        activeSpaceIds: [],
        allSpaceIds: [],
        tours: [],
      },
    );
    assert.equal(closing.available, false);
    assert.equal(closing.conflicts.some((c) => c.type === "calendar_blocked"), true);
  });

  it("Tour capacity is an error when live occupancy is full; completed tours do not consume capacity", () => {
    const ten = Date.parse("2099-06-15T10:00:00Z");
    const liveFull = buildAvailabilityConflicts(
      { date: "2099-06-15", type: "tour", tourScheduledAtMs: ten, tourDurationMinutes: 60 },
      {
        calendarBlocks: [],
        holdCount: 0,
        rules: null,
        events: [],
        activeSpaceIds: [],
        allSpaceIds: [],
        tours: [{ id: "t1", status: "scheduled", scheduledAtMs: ten, durationMinutes: 60 }],
      },
    );
    assert.equal(liveFull.available, false);
    assert.equal(liveFull.conflicts.some((c) => c.type === "tour_capacity_full" && c.severity === "error"), true);

    const historical = buildAvailabilityConflicts(
      { date: "2099-06-15", type: "tour", tourScheduledAtMs: ten, tourDurationMinutes: 60 },
      {
        calendarBlocks: [],
        holdCount: 0,
        rules: null,
        events: [],
        activeSpaceIds: [],
        allSpaceIds: [],
        tours: [{ id: "t1", status: "completed", scheduledAtMs: ten, durationMinutes: 60 }],
      },
    );
    assert.equal(historical.conflicts.some((c) => c.type === "tour_capacity_full"), false);
  });

  it("simultaneous venue with no spaces surfaces no_spaces as a hard pre-check error", () => {
    const status = buildAvailabilityConflicts(
      { date: "2099-06-15", type: "event" },
      {
        calendarBlocks: [],
        holdCount: 0,
        rules: { maxSimultaneousEvents: 2 },
        events: [],
        activeSpaceIds: [],
        allSpaceIds: [],
        tours: [],
      },
    );
    assert.equal(status.available, false);
    const occupancy = status.conflicts.find((c) => c.type === "event_occupancy");
    assert.ok(occupancy);
    assert.match(occupancy.message, /Add an Event Space/);
  });
});
