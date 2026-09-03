import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  addClockMinutes,
  datesInProtectedRange,
  effectiveMaxSimultaneousEvents,
  effectiveMinTurnaroundHours,
  eventOccupancyOverlapsTour,
  evaluateEventOccupancy,
  formatOperationalInstant,
  isInquiryEventDateAvailable,
  isSimpleOperatingModel,
  operationalWindow,
  type OccupancyEvent,
  type OccupancyInput,
  type OccupancyVenue,
  windowsOverlap,
} from "@/lib/availability/event-occupancy";

const MIGRATION = "supabase/migrations/20261316000000_event_availability_assert.sql";

const BALLROOM = "space-ballroom";
const GARDEN = "space-garden";
const TERRACE = "space-terrace";

function venue(partial: Partial<OccupancyVenue> & Pick<OccupancyVenue, "effectiveMax">): OccupancyVenue {
  return {
    activeSpaceIds: partial.activeSpaceIds ?? [BALLROOM, GARDEN, TERRACE],
    allSpaceIds: partial.allSpaceIds ?? partial.activeSpaceIds ?? [BALLROOM, GARDEN, TERRACE],
    ...partial,
  };
}

function event(partial: Partial<OccupancyEvent> & Pick<OccupancyEvent, "id" | "eventDate">): OccupancyEvent {
  return {
    status: "draft",
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

function input(partial: Partial<OccupancyInput> & Pick<OccupancyInput, "eventDate">): OccupancyInput {
  return { ...partial };
}

describe("effectiveMaxSimultaneousEvents (Decision 4)", () => {
  it("treats a missing rules row as 1, never unlimited", () => {
    assert.equal(effectiveMaxSimultaneousEvents(null), 1);
    assert.equal(effectiveMaxSimultaneousEvents(undefined), 1);
  });

  it("uses the stored max when present", () => {
    assert.equal(effectiveMaxSimultaneousEvents({ maxSimultaneousEvents: 2 }), 2);
    assert.equal(effectiveMaxSimultaneousEvents({ maxSimultaneousEvents: 1 }), 1);
  });

  it("does not treat zero or garbage as unlimited", () => {
    assert.equal(effectiveMaxSimultaneousEvents({ maxSimultaneousEvents: 0 }), 1);
    assert.equal(effectiveMaxSimultaneousEvents({ maxSimultaneousEvents: -3 }), 1);
  });
});

describe("operational window", () => {
  it("uses setup/start through end/teardown", () => {
    assert.deepEqual(
      operationalWindow({ setupTime: "15:00", startTime: "17:00", endTime: "23:00", teardownTime: "23:30" }),
      { start: "15:00", end: "23:30" },
    );
  });

  it("treats all four empty as 00:00–23:59", () => {
    assert.deepEqual(operationalWindow({}), { start: "00:00", end: "23:59" });
  });

  it("overlaps when windows cross; sequential same-day windows do not", () => {
    assert.equal(windowsOverlap({ start: "17:00", end: "23:00" }, { start: "18:00", end: "22:00" }), true);
    assert.equal(windowsOverlap({ start: "17:00", end: "23:00" }, { start: "10:00", end: "14:00" }), false);
    assert.equal(windowsOverlap({ start: "00:00", end: "23:59" }, { start: "10:00", end: "14:00" }), true);
  });
});

describe("Decision 3 — multi-day protected range", () => {
  it("protects every day from event_date through coalesce(end, start)", () => {
    assert.deepEqual(datesInProtectedRange("2027-06-12", null), ["2027-06-12"]);
    assert.deepEqual(datesInProtectedRange("2027-06-12", "2027-06-12"), ["2027-06-12"]);
    assert.deepEqual(
      datesInProtectedRange("2027-06-12", "2027-06-14"),
      ["2027-06-12", "2027-06-13", "2027-06-14"],
    );
  });
});

describe("simple venue (effective_max = 1)", () => {
  const simple = venue({ effectiveMax: 1 });

  it("is the simple operating model regardless of Event Spaces", () => {
    assert.equal(isSimpleOperatingModel(1), true);
    assert.equal(isSimpleOperatingModel(2), false);
  });

  it("allows a first dated Event with no times and no space", () => {
    const result = evaluateEventOccupancy(input({ eventDate: "2027-06-12" }), simple, []);
    assert.equal(result.ok, true);
  });

  it("rejects a same-day overlapping booking (missing times occupy the whole date)", () => {
    const existing = [event({ id: "a", eventDate: "2027-06-12" })];
    const result = evaluateEventOccupancy(input({ eventDate: "2027-06-12", startTime: "17:00", endTime: "23:00" }), simple, existing);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "venue_at_capacity");
  });

  it("allows non-overlapping operational windows on the same date", () => {
    const existing = [event({ id: "a", eventDate: "2027-06-12", startTime: "17:00", endTime: "23:00" })];
    const result = evaluateEventOccupancy(
      input({ eventDate: "2027-06-12", startTime: "10:00", endTime: "14:00" }),
      simple,
      existing,
    );
    assert.equal(result.ok, true);
  });

  it("is venue-wide: different spaces still conflict when windows overlap", () => {
    const existing = [event({
      id: "a", eventDate: "2027-06-12", spaceId: BALLROOM,
      startTime: "17:00", endTime: "23:00",
    })];
    const result = evaluateEventOccupancy(
      input({ eventDate: "2027-06-12", spaceId: GARDEN, startTime: "18:00", endTime: "22:00" }),
      simple,
      existing,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "venue_at_capacity");
  });

  it("ignores cancelled Events (cancellation restores availability)", () => {
    const existing = [event({ id: "a", eventDate: "2027-06-12", status: "cancelled" })];
    const result = evaluateEventOccupancy(input({ eventDate: "2027-06-12" }), simple, existing);
    assert.equal(result.ok, true);
  });

  it("counts confirmed/draft/in_progress the same — status is not the lock", () => {
    for (const status of ["draft", "confirmed", "in_progress", "complete"]) {
      const existing = [event({ id: "a", eventDate: "2027-06-12", status })];
      const result = evaluateEventOccupancy(input({ eventDate: "2027-06-12" }), simple, existing);
      assert.equal(result.ok, false, status);
    }
  });

  it("protects the middle day of a multi-day Event", () => {
    const existing = [event({
      id: "a", eventDate: "2027-06-12", eventEndDate: "2027-06-14",
      startTime: "17:00", endTime: "23:00",
    })];
    const overlap = evaluateEventOccupancy(
      input({ eventDate: "2027-06-13", startTime: "18:00", endTime: "21:00" }),
      simple,
      existing,
    );
    assert.equal(overlap.ok, false);
    const morning = evaluateEventOccupancy(
      input({ eventDate: "2027-06-13", startTime: "10:00", endTime: "14:00" }),
      simple,
      existing,
    );
    assert.equal(morning.ok, true);
  });

  it("does not require space_id", () => {
    const result = evaluateEventOccupancy(input({ eventDate: "2027-06-12" }), venue({ effectiveMax: 1, activeSpaceIds: [] }), []);
    assert.equal(result.ok, true);
  });
});

describe("simultaneous-event venue (Decision 1 + 2)", () => {
  const multi = venue({ effectiveMax: 2 });

  it("hard-refuses a dated Event with no space_id", () => {
    const result = evaluateEventOccupancy(input({ eventDate: "2027-06-12", startTime: "17:00", endTime: "23:00" }), multi, []);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "missing_space");
  });

  it("hard-refuses a space_id that does not belong to the venue", () => {
    const result = evaluateEventOccupancy(
      input({ eventDate: "2027-06-12", spaceId: "space-other-venue" }),
      multi,
      [],
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_space");
  });

  it("hard-refuses when the venue has zero Event Spaces (Decision 2)", () => {
    const none = venue({ effectiveMax: 2, activeSpaceIds: [], allSpaceIds: [] });
    const result = evaluateEventOccupancy(
      input({ eventDate: "2027-06-12", spaceId: BALLROOM }),
      none,
      [],
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "no_spaces");
  });

  it("does not fall back to simple/venue-level capacity when spaces are missing", () => {
    const none = venue({ effectiveMax: 2, activeSpaceIds: [], allSpaceIds: [] });
    const result = evaluateEventOccupancy(input({ eventDate: "2027-06-12" }), none, []);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "no_spaces");
  });

  it("keeps an inactivated space valid when another space is still active", () => {
    const mixed = venue({
      effectiveMax: 2,
      activeSpaceIds: [GARDEN],
      allSpaceIds: [BALLROOM, GARDEN],
    });
    const result = evaluateEventOccupancy(
      input({ eventDate: "2027-06-12", spaceId: BALLROOM, startTime: "17:00", endTime: "23:00" }),
      mixed,
      [],
    );
    assert.equal(result.ok, true);
  });

  it("allows different-space overlapping Events under the cap", () => {
    const existing = [event({
      id: "a", eventDate: "2027-06-12", spaceId: BALLROOM,
      startTime: "17:00", endTime: "23:00",
    })];
    const result = evaluateEventOccupancy(
      input({ eventDate: "2027-06-12", spaceId: GARDEN, startTime: "17:00", endTime: "23:00" }),
      multi,
      existing,
    );
    assert.equal(result.ok, true);
  });

  it("rejects same-space overlapping operational windows", () => {
    const existing = [event({
      id: "a", name: "Smith Wedding", eventDate: "2027-06-12", spaceId: BALLROOM,
      startTime: "17:00", endTime: "23:00",
    })];
    const result = evaluateEventOccupancy(
      input({ eventDate: "2027-06-12", spaceId: BALLROOM, startTime: "18:00", endTime: "22:00" }),
      multi,
      existing,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "space_overlap");
      assert.match(result.message, /Smith Wedding/);
    }
  });

  it("allows same-space sequential windows", () => {
    const existing = [event({
      id: "a", eventDate: "2027-06-12", spaceId: BALLROOM,
      startTime: "10:00", endTime: "14:00",
    })];
    const result = evaluateEventOccupancy(
      input({ eventDate: "2027-06-12", spaceId: BALLROOM, startTime: "17:00", endTime: "23:00" }),
      multi,
      existing,
    );
    assert.equal(result.ok, true);
  });

  it("rejects a third simultaneous Event when max = 2", () => {
    const existing = [
      event({ id: "a", eventDate: "2027-06-12", spaceId: BALLROOM, startTime: "17:00", endTime: "23:00" }),
      event({ id: "b", eventDate: "2027-06-12", spaceId: GARDEN, startTime: "17:00", endTime: "23:00" }),
    ];
    const result = evaluateEventOccupancy(
      input({ eventDate: "2027-06-12", spaceId: TERRACE, startTime: "18:00", endTime: "22:00" }),
      multi,
      existing,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "venue_at_capacity");
  });

  it("treats missing times as occupying the space all day", () => {
    const existing = [event({ id: "a", eventDate: "2027-06-12", spaceId: BALLROOM })];
    const result = evaluateEventOccupancy(
      input({ eventDate: "2027-06-12", spaceId: BALLROOM, startTime: "10:00", endTime: "14:00" }),
      multi,
      existing,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "space_overlap");
  });

  it("setup/teardown count as occupancy", () => {
    const existing = [event({
      id: "a", eventDate: "2027-06-12", spaceId: BALLROOM,
      setupTime: "15:00", startTime: "17:00", endTime: "23:00", teardownTime: "23:30",
    })];
    const duringSetup = evaluateEventOccupancy(
      input({ eventDate: "2027-06-12", spaceId: BALLROOM, startTime: "15:00", endTime: "16:00" }),
      multi,
      existing,
    );
    assert.equal(duringSetup.ok, false);
    const beforeSetup = evaluateEventOccupancy(
      input({ eventDate: "2027-06-12", spaceId: BALLROOM, startTime: "10:00", endTime: "14:00" }),
      multi,
      existing,
    );
    assert.equal(beforeSetup.ok, true);
  });

  it("multi-day occupancy applies the window to each protected day", () => {
    const existing = [event({
      id: "a", eventDate: "2027-06-12", eventEndDate: "2027-06-13", spaceId: BALLROOM,
      startTime: "17:00", endTime: "23:00",
    })];
    const sundayEvening = evaluateEventOccupancy(
      input({ eventDate: "2027-06-13", spaceId: BALLROOM, startTime: "18:00", endTime: "21:00" }),
      multi,
      existing,
    );
    assert.equal(sundayEvening.ok, false);
    const sundayMorning = evaluateEventOccupancy(
      input({ eventDate: "2027-06-13", spaceId: BALLROOM, startTime: "10:00", endTime: "14:00" }),
      multi,
      existing,
    );
    assert.equal(sundayMorning.ok, true);
  });

  it("excludeEventId allows an Event to keep its own occupancy when editing", () => {
    const existing = [event({
      id: "a", eventDate: "2027-06-12", spaceId: BALLROOM, startTime: "17:00", endTime: "23:00",
    })];
    const result = evaluateEventOccupancy(
      input({ eventDate: "2027-06-12", spaceId: BALLROOM, startTime: "17:00", endTime: "23:00", excludeEventId: "a" }),
      multi,
      existing,
    );
    assert.equal(result.ok, true);
  });
});

describe("concurrency semantics (serialized occupancy)", () => {
  it("after the first booking occupies a simple venue day, the second refuses", () => {
    const simple = venue({ effectiveMax: 1 });
    const first = input({ eventDate: "2027-06-12" });
    const r1 = evaluateEventOccupancy(first, simple, []);
    assert.equal(r1.ok, true);
    const occupied = [event({ id: "winner", eventDate: "2027-06-12" })];
    const r2 = evaluateEventOccupancy(input({ eventDate: "2027-06-12", startTime: "10:00", endTime: "14:00" }), simple, occupied);
    assert.equal(r2.ok, false);
    if (!r2.ok) assert.equal(r2.code, "venue_at_capacity");
  });

  it("two simultaneous-event bookings for the same space serialize to one success", () => {
    const multi = venue({ effectiveMax: 2 });
    const attempt = input({ eventDate: "2027-06-12", spaceId: BALLROOM, startTime: "17:00", endTime: "23:00" });
    const r1 = evaluateEventOccupancy(attempt, multi, []);
    assert.equal(r1.ok, true);
    const occupied = [event({ id: "winner", eventDate: "2027-06-12", spaceId: BALLROOM, startTime: "17:00", endTime: "23:00" })];
    const r2 = evaluateEventOccupancy(attempt, multi, occupied);
    assert.equal(r2.ok, false);
    if (!r2.ok) assert.equal(r2.code, "space_overlap");
  });
});

describe("assert_event_availability SQL (Phase 2 seam)", () => {
  const sql = readFileSync(resolve(MIGRATION), "utf8");
  const executable = sql.replace(/--.*$/gm, "");

  it("takes a transaction-scoped advisory lock per protected day before reading events", () => {
    assert.match(sql, /pg_advisory_xact_lock/);
    const lockAt = sql.indexOf("pg_advisory_xact_lock");
    const eventsAt = sql.indexOf("from public.events");
    assert.ok(lockAt > 0 && eventsAt > lockAt, "lock must precede the events occupancy read");
    assert.match(sql, /while v_day <= v_end loop/);
    assert.match(sql, /hashtext\(p_venue_id::text\)[\s\S]*hashtext\(v_day::text\)/);
  });

  it("Decision 4: missing capacity row sets effective max to 1", () => {
    assert.match(sql, /if v_max is null or v_max < 1 then\s+v_max := 1;/);
    assert.doesNotMatch(executable, /max_simultaneous_tours/);
    assert.doesNotMatch(executable, /min_turnaround/);
  });

  it("Decision 1+2: simultaneous venues require an active space and assigned space_id", () => {
    assert.match(sql, /if v_max >= 2 then/);
    assert.match(sql, /code', 'no_spaces'/);
    assert.match(sql, /code', 'missing_space'/);
    assert.match(sql, /s\.is_active = true/);
  });

  it("Decision 3: occupancy uses event_date through coalesce(event_end_date, event_date)", () => {
    assert.match(sql, /coalesce\(p_event_end_date, p_event_date\)/);
    assert.match(sql, /coalesce\(e\.event_end_date, e\.event_date\) >= v_start/);
  });

  it("reuses setup/start → end/teardown, defaulting to 00:00–23:59", () => {
    assert.match(sql, /coalesce\(p_setup_time, p_start_time, time '00:00'\)/);
    assert.match(sql, /coalesce\(p_teardown_time, p_end_time, time '23:59'\)/);
  });

  it("ignores cancelled Events and does not use confirmed / Booking.Confirmed / calendar_blocks as occupancy", () => {
    assert.match(sql, /status is distinct from 'cancelled'/);
    assert.doesNotMatch(executable, /Booking\.Confirmed/);
    assert.doesNotMatch(executable, /calendar_blocks/);
    assert.doesNotMatch(executable, /date_holds/);
    assert.doesNotMatch(executable, /tour_appointments/);
    assert.doesNotMatch(executable, /status = 'confirmed'/);
  });

  it("documents that the lock must share the write transaction (Phase 3 composition)", () => {
    assert.match(sql, /same Postgres transaction as the/);
    assert.match(sql, /Phase 3 will compose this into the write RPCs/);
  });
});

describe("eventOccupancyOverlapsTour (Phase 2 window, not date-only)", () => {
  const evening = event({
    id: "e1", eventDate: "2099-06-15", startTime: "18:00", endTime: "22:00",
  });

  it("allows a daytime Tour against an evening Event", () => {
    assert.equal(
      eventOccupancyOverlapsTour(evening, { date: "2099-06-15", startTime: "10:00", durationMinutes: 60 }),
      false,
    );
  });

  it("allows an evening Tour against a daytime Event", () => {
    const daytime = event({
      id: "e1", eventDate: "2099-06-15", startTime: "10:00", endTime: "14:00",
    });
    assert.equal(
      eventOccupancyOverlapsTour(daytime, { date: "2099-06-15", startTime: "18:00", durationMinutes: 60 }),
      false,
    );
  });

  it("allows a Tour that ends before Event occupancy starts", () => {
    assert.equal(
      eventOccupancyOverlapsTour(evening, { date: "2099-06-15", startTime: "17:00", durationMinutes: 60 }),
      false,
    );
  });

  it("refuses a Tour that overlaps Event start/end", () => {
    assert.equal(
      eventOccupancyOverlapsTour(evening, { date: "2099-06-15", startTime: "21:30", durationMinutes: 60 }),
      true,
    );
  });

  it("refuses a Tour that overlaps Event setup", () => {
    const withSetup = event({
      id: "e1", eventDate: "2099-06-15",
      setupTime: "16:00", startTime: "18:00", endTime: "22:00", teardownTime: "23:00",
    });
    assert.equal(
      eventOccupancyOverlapsTour(withSetup, { date: "2099-06-15", startTime: "16:30", durationMinutes: 60 }),
      true,
    );
  });

  it("allows a Tour that begins exactly when Event occupancy ends", () => {
    assert.equal(
      eventOccupancyOverlapsTour(evening, { date: "2099-06-15", startTime: "22:00", durationMinutes: 60 }),
      false,
    );
  });

  it("allows a Tour entirely after Event teardown", () => {
    const withTeardown = event({
      id: "e1", eventDate: "2099-06-15",
      setupTime: "16:00", startTime: "18:00", endTime: "22:00", teardownTime: "23:00",
    });
    assert.equal(
      eventOccupancyOverlapsTour(withTeardown, { date: "2099-06-15", startTime: "23:00", durationMinutes: 60 }),
      false,
    );
  });

  it("treats missing Event times as a full-day block", () => {
    const allDay = event({ id: "e1", eventDate: "2099-06-15" });
    assert.equal(
      eventOccupancyOverlapsTour(allDay, { date: "2099-06-15", startTime: "10:00", durationMinutes: 60 }),
      true,
    );
  });

  it("applies the operational window on each protected day of a multi-day Event", () => {
    const multi = event({
      id: "e1", eventDate: "2099-06-15", eventEndDate: "2099-06-17",
      startTime: "18:00", endTime: "22:00",
    });
    assert.equal(
      eventOccupancyOverlapsTour(multi, { date: "2099-06-16", startTime: "10:00", durationMinutes: 60 }),
      false,
    );
    assert.equal(
      eventOccupancyOverlapsTour(multi, { date: "2099-06-16", startTime: "21:00", durationMinutes: 60 }),
      true,
    );
  });

  it("does not block Tours with a cancelled Event", () => {
    const cancelled = event({
      id: "e1", eventDate: "2099-06-15", status: "cancelled", startTime: "18:00", endTime: "22:00",
    });
    assert.equal(
      eventOccupancyOverlapsTour(cancelled, { date: "2099-06-15", startTime: "21:00", durationMinutes: 60 }),
      false,
    );
  });

  it("addClockMinutes crosses midnight with a dayOffset", () => {
    assert.deepEqual(addClockMinutes("23:30", 60), { clock: "00:30", dayOffset: 1 });
    assert.deepEqual(addClockMinutes("10:00", 60), { clock: "11:00", dayOffset: 0 });
  });
});

describe("min_turnaround_hours", () => {
  const simple = venue({ effectiveMax: 1, minTurnaroundHours: 12 });
  const evening = event({
    id: "e1", eventDate: "2099-06-15", startTime: "18:00", endTime: "22:00", name: "Evening",
  });

  it("treats null, missing, zero, and negative as no requirement", () => {
    assert.equal(effectiveMinTurnaroundHours(null), 0);
    assert.equal(effectiveMinTurnaroundHours({}), 0);
    assert.equal(effectiveMinTurnaroundHours({ minTurnaroundHours: 0 }), 0);
    assert.equal(effectiveMinTurnaroundHours({ minTurnaroundHours: -1 }), 0);
    const r = evaluateEventOccupancy(
      input({ eventDate: "2099-06-16", startTime: "09:00", endTime: "11:00" }),
      venue({ effectiveMax: 1, minTurnaroundHours: 0 }),
      [evening],
    );
    assert.equal(r.ok, true);
  });

  it("preserves adjacent (touching) Events when turnaround is 0", () => {
    const r = evaluateEventOccupancy(
      input({ eventDate: "2099-06-15", startTime: "22:00", endTime: "23:00" }),
      venue({ effectiveMax: 1, minTurnaroundHours: 0 }),
      [evening],
    );
    assert.equal(r.ok, true);
  });

  it("allows exactly 12h after a 10 PM end and refuses 11h59m", () => {
    const allowed = evaluateEventOccupancy(
      input({ eventDate: "2099-06-16", startTime: "10:00", endTime: "12:00" }),
      simple,
      [evening],
    );
    assert.equal(allowed.ok, true);

    const refused = evaluateEventOccupancy(
      input({ eventDate: "2099-06-16", startTime: "09:59", endTime: "11:00" }),
      simple,
      [evening],
    );
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, "event_turnaround");
      assert.match(refused.message, /earliest available start is June 16 at 10:00 AM/);
    }
  });

  it("uses setup/teardown as the operational end and start", () => {
    const withTeardown = event({
      id: "e1", eventDate: "2099-06-15",
      setupTime: "16:00", startTime: "18:00", endTime: "22:00", teardownTime: "23:00",
      name: "Late teardown",
    });
    const tooSoon = evaluateEventOccupancy(
      input({ eventDate: "2099-06-16", setupTime: "10:00", startTime: "11:00", endTime: "14:00" }),
      simple,
      [withTeardown],
    );
    assert.equal(tooSoon.ok, false);
    if (!tooSoon.ok) assert.equal(tooSoon.code, "event_turnaround");

    const afterTeardown = evaluateEventOccupancy(
      input({ eventDate: "2099-06-16", setupTime: "11:00", startTime: "12:00", endTime: "14:00" }),
      simple,
      [withTeardown],
    );
    assert.equal(afterTeardown.ok, true);
  });

  it("missing times occupy 00:00–23:59 so the next day stays inside 12h until 11:59", () => {
    const allDay = event({ id: "e1", eventDate: "2099-06-15", name: "All day" });
    const morning = evaluateEventOccupancy(
      input({ eventDate: "2099-06-16", startTime: "10:00", endTime: "12:00" }),
      simple,
      [allDay],
    );
    assert.equal(morning.ok, false);
    const noon = evaluateEventOccupancy(
      input({ eventDate: "2099-06-16", startTime: "11:59", endTime: "13:00" }),
      simple,
      [allDay],
    );
    assert.equal(noon.ok, true);
  });

  it("cancelled Events impose no turnaround", () => {
    const r = evaluateEventOccupancy(
      input({ eventDate: "2099-06-16", startTime: "09:00", endTime: "11:00" }),
      simple,
      [event({ id: "e1", eventDate: "2099-06-15", status: "cancelled", startTime: "18:00", endTime: "22:00" })],
    );
    assert.equal(r.ok, true);
  });

  it("same-space turnaround applies on simultaneous venues; different space does not", () => {
    const multi = venue({
      effectiveMax: 2,
      minTurnaroundHours: 12,
      activeSpaceIds: [BALLROOM, GARDEN],
      allSpaceIds: [BALLROOM, GARDEN],
    });
    const inBallroom = event({
      id: "e1", eventDate: "2099-06-15", spaceId: BALLROOM, startTime: "18:00", endTime: "22:00", name: "Ballroom",
    });
    const sameSpace = evaluateEventOccupancy(
      input({ eventDate: "2099-06-16", spaceId: BALLROOM, startTime: "09:00", endTime: "11:00" }),
      multi,
      [inBallroom],
    );
    assert.equal(sameSpace.ok, false);
    if (!sameSpace.ok) assert.equal(sameSpace.code, "event_turnaround");

    const sameSpaceBoundary = evaluateEventOccupancy(
      input({ eventDate: "2099-06-16", spaceId: BALLROOM, startTime: "10:00", endTime: "12:00" }),
      multi,
      [inBallroom],
    );
    assert.equal(sameSpaceBoundary.ok, true);

    const otherSpace = evaluateEventOccupancy(
      input({ eventDate: "2099-06-16", spaceId: GARDEN, startTime: "09:00", endTime: "11:00" }),
      multi,
      [inBallroom],
    );
    assert.equal(otherSpace.ok, true);
  });

  it("missing space remains rejected before turnaround on simultaneous venues", () => {
    const multi = venue({
      effectiveMax: 2,
      minTurnaroundHours: 12,
      activeSpaceIds: [BALLROOM],
      allSpaceIds: [BALLROOM],
    });
    const r = evaluateEventOccupancy(
      input({ eventDate: "2099-06-16", startTime: "10:00", endTime: "12:00" }),
      multi,
      [event({ id: "e1", eventDate: "2099-06-15", spaceId: BALLROOM, startTime: "18:00", endTime: "22:00" })],
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "missing_space");
  });

  it("multi-day Events impose turnaround after the final operational window", () => {
    const multiDay = event({
      id: "e1", eventDate: "2099-06-15", eventEndDate: "2099-06-17",
      startTime: "18:00", endTime: "22:00", name: "Three day",
    });
    const thursdayMorning = evaluateEventOccupancy(
      input({ eventDate: "2099-06-18", startTime: "09:00", endTime: "11:00" }),
      simple,
      [multiDay],
    );
    assert.equal(thursdayMorning.ok, false);
    const thursdayTen = evaluateEventOccupancy(
      input({ eventDate: "2099-06-18", startTime: "10:00", endTime: "12:00" }),
      simple,
      [multiDay],
    );
    assert.equal(thursdayTen.ok, true);
  });

  it("overlapping multi-day Events refuse occupancy, not turnaround", () => {
    const existing = event({
      id: "e1", eventDate: "2099-06-15", eventEndDate: "2099-06-17",
      startTime: "10:00", endTime: "22:00",
    });
    const r = evaluateEventOccupancy(
      input({ eventDate: "2099-06-16", eventEndDate: "2099-06-18", startTime: "10:00", endTime: "22:00" }),
      simple,
      [existing],
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "venue_at_capacity");
  });

  it("setup/teardown on the final day of a multi-day Event is the turnaround anchor", () => {
    const multiDay = event({
      id: "e1", eventDate: "2099-06-15", eventEndDate: "2099-06-17",
      setupTime: "16:00", startTime: "18:00", endTime: "22:00", teardownTime: "23:00",
    });
    const tooSoon = evaluateEventOccupancy(
      input({ eventDate: "2099-06-18", startTime: "10:59", endTime: "12:00" }),
      simple,
      [multiDay],
    );
    assert.equal(tooSoon.ok, false);
    if (!tooSoon.ok) assert.equal(tooSoon.code, "event_turnaround");
    const atBoundary = evaluateEventOccupancy(
      input({ eventDate: "2099-06-18", startTime: "11:00", endTime: "13:00" }),
      simple,
      [multiDay],
    );
    assert.equal(atBoundary.ok, true);
  });

  it("formatOperationalInstant renders the boundary label", () => {
    const minutes = Date.UTC(2099, 5, 16, 10, 0) / 60_000;
    assert.equal(formatOperationalInstant(minutes), "June 16 at 10:00 AM");
  });

  it("does not apply Event turnaround to Tour overlap", () => {
    assert.equal(
      eventOccupancyOverlapsTour(evening, { date: "2099-06-16", startTime: "09:00", durationMinutes: 60 }),
      false,
    );
  });
});

describe("isInquiryEventDateAvailable (date-level, same occupancy authority)", () => {
  const simple = venue({ effectiveMax: 1, activeSpaceIds: [], allSpaceIds: [] });
  const multi = venue({ effectiveMax: 2 });

  it("simple venue: empty date is available; an occupying Event makes it unavailable", () => {
    assert.equal(isInquiryEventDateAvailable("2027-06-12", simple, []), true);
    assert.equal(
      isInquiryEventDateAvailable("2027-06-12", simple, [event({ id: "a", eventDate: "2027-06-12", startTime: "17:00", endTime: "23:00" })]),
      false,
    );
  });

  it("is conservative: a timed morning Event makes the date unavailable even though an evening Event would save", () => {
    const existing = [event({ id: "a", eventDate: "2027-06-12", startTime: "10:00", endTime: "14:00" })];
    assert.equal(isInquiryEventDateAvailable("2027-06-12", simple, existing), false);
    assert.equal(
      evaluateEventOccupancy(input({ eventDate: "2027-06-12", startTime: "17:00", endTime: "23:00" }), simple, existing).ok,
      true,
    );
  });

  it("simultaneous venue: available when at least one active space would accept a full-day Event", () => {
    const existing = [event({ id: "a", eventDate: "2027-06-12", spaceId: BALLROOM })];
    assert.equal(isInquiryEventDateAvailable("2027-06-12", multi, existing), true);
    const both = [
      event({ id: "a", eventDate: "2027-06-12", spaceId: BALLROOM }),
      event({ id: "b", eventDate: "2027-06-12", spaceId: GARDEN }),
      event({ id: "c", eventDate: "2027-06-12", spaceId: TERRACE }),
    ];
    assert.equal(isInquiryEventDateAvailable("2027-06-12", multi, both), false);
  });

  it("Event Space: same-space all-day occupancy does not hide a free sister space", () => {
    const existing = [event({ id: "a", eventDate: "2027-06-12", spaceId: BALLROOM })];
    assert.equal(isInquiryEventDateAvailable("2027-06-12", multi, existing), true);
  });

  it("multi-day Event occupies every protected day for inquiry", () => {
    const existing = [event({ id: "a", eventDate: "2027-06-12", eventEndDate: "2027-06-14" })];
    assert.equal(isInquiryEventDateAvailable("2027-06-13", simple, existing), false);
    assert.equal(isInquiryEventDateAvailable("2027-06-15", simple, existing), true);
  });

  it("turnaround: a full-day inquiry the next morning is unavailable when hours remain", () => {
    const withTurnaround = venue({ effectiveMax: 1, minTurnaroundHours: 12, activeSpaceIds: [], allSpaceIds: [] });
    const existing = [event({ id: "a", eventDate: "2099-06-15", startTime: "18:00", endTime: "22:00" })];
    assert.equal(isInquiryEventDateAvailable("2099-06-16", withTurnaround, existing), false);
    assert.equal(
      evaluateEventOccupancy(input({ eventDate: "2099-06-16" }), withTurnaround, existing).ok,
      false,
    );
  });

  it("missing capacity rules behave as max 1", () => {
    const missing = venue({ effectiveMax: 1, activeSpaceIds: [], allSpaceIds: [] });
    const existing = [event({ id: "a", eventDate: "2027-06-12" })];
    assert.equal(isInquiryEventDateAvailable("2027-06-12", missing, existing), false);
  });

  it("cancelled Events do not close the inquiry date", () => {
    const existing = [event({ id: "a", eventDate: "2027-06-12", status: "cancelled" })];
    assert.equal(isInquiryEventDateAvailable("2027-06-12", simple, existing), true);
  });

  it("zero active spaces on a simultaneous venue is unavailable", () => {
    const none = venue({ effectiveMax: 2, activeSpaceIds: [], allSpaceIds: [] });
    assert.equal(isInquiryEventDateAvailable("2027-06-12", none, []), false);
  });
});

