/**
 * Ellie-shaped multi-day booking vs public choose_available / SQL occupancy.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  evaluateEventOccupancy,
  isInquiryEventDateAvailable,
  type OccupancyEvent,
  type OccupancyVenue,
} from "@/lib/availability/event-occupancy";

const BARN = "space-barn";
const VILLA = "space-villa";
const BRIDGE = "space-bridge";
const LAWN = "space-lawn";

const meadowLike: OccupancyVenue = {
  effectiveMax: 4,
  minTurnaroundHours: 2,
  activeSpaceIds: [BARN, VILLA, BRIDGE, LAWN],
  allSpaceIds: [BARN, VILLA, BRIDGE, LAWN],
};

function ellie(): OccupancyEvent {
  return {
    id: "ellie",
    name: "Ellie Yagnesak & Hunter Lomberto",
    status: "confirmed",
    eventDate: "2027-09-03",
    eventEndDate: "2027-09-04",
    spaceId: BARN,
    setupTime: null,
    startTime: "14:00",
    endTime: "23:00",
    teardownTime: null,
    windows: [
      { spaceId: BARN, startTime: "17:00", endTime: "22:00", scheduledDate: "2027-09-03" },
      { spaceId: VILLA, startTime: "14:00", endTime: "16:00", scheduledDate: "2027-09-04" },
      { spaceId: BARN, startTime: "16:00", endTime: "17:00", scheduledDate: "2027-09-04" },
      { spaceId: BRIDGE, startTime: "17:00", endTime: "18:00", scheduledDate: "2027-09-04" },
      { spaceId: BARN, startTime: "18:00", endTime: "23:00", scheduledDate: "2027-09-04" },
    ],
  };
}

describe("public choose_available vs multi-day multi-space booking", () => {
  it("keeps the inquiry date Available when one active space can still take a full-day event", () => {
    const existing = [ellie()];
    assert.equal(isInquiryEventDateAvailable("2027-09-03", meadowLike, existing), true);
    assert.equal(isInquiryEventDateAvailable("2027-09-04", meadowLike, existing), true);
    // Lawn is never assigned — that is what keeps the date Available.
    assert.equal(
      evaluateEventOccupancy({ eventDate: "2027-09-03", spaceId: LAWN }, meadowLike, existing).ok,
      true,
    );
  });

  it("blocks the spaces and windows the booking actually occupies", () => {
    const existing = [ellie()];
    assert.equal(
      evaluateEventOccupancy(
        { eventDate: "2027-09-03", spaceId: BARN, startTime: "17:00", endTime: "22:00" },
        meadowLike,
        existing,
      ).ok,
      false,
    );
    assert.equal(
      evaluateEventOccupancy(
        { eventDate: "2027-09-04", spaceId: BRIDGE, startTime: "17:00", endTime: "18:00" },
        meadowLike,
        existing,
      ).ok,
      false,
    );
  });

  it("does not treat Saturday Bridge occupancy as a Friday Bridge conflict", () => {
    const existing = [ellie()];
    const friBridgeEvening = evaluateEventOccupancy(
      {
        eventDate: "2027-09-03",
        spaceId: BRIDGE,
        startTime: "17:00",
        endTime: "18:00",
        windows: [{ spaceId: BRIDGE, startTime: "17:00", endTime: "18:00", scheduledDate: "2027-09-03" }],
      },
      meadowLike,
      existing,
    );
    assert.equal(friBridgeEvening.ok, true, friBridgeEvening.ok ? "" : friBridgeEvening.message);

    const friBarnMorning = evaluateEventOccupancy(
      {
        eventDate: "2027-09-03",
        spaceId: BARN,
        startTime: "10:00",
        endTime: "12:00",
        windows: [{ spaceId: BARN, startTime: "10:00", endTime: "12:00", scheduledDate: "2027-09-03" }],
      },
      meadowLike,
      existing,
    );
    assert.equal(friBarnMorning.ok, true);
  });

  it("marks the date unavailable when every active space is blocked for a full day", () => {
    const allBlocked: OccupancyVenue = {
      ...meadowLike,
      activeSpaceIds: [BARN, BRIDGE],
      allSpaceIds: [BARN, BRIDGE],
    };
    // Full-day candidate on each space overlaps Ellie's Barn Fri + Bridge Sat windows
    // when those are the only spaces — Fri still has Bridge free in TS model.
    assert.equal(isInquiryEventDateAvailable("2027-09-03", allBlocked, [ellie()]), true);
    // On Sat both Barn and Bridge are occupied during the day for a full-day event
    assert.equal(isInquiryEventDateAvailable("2027-09-04", allBlocked, [ellie()]), false);
  });
});

describe("SQL evaluate_event_availability same-day overlap fix", () => {
  const mig = readFileSync(
    resolve("supabase/migrations/20261418300000_schedule_overlap_same_calendar_day.sql"),
    "utf8",
  );
  const publicCopy = readFileSync(
    resolve("components/availability/public-availability-view.tsx"),
    "utf8",
  );

  it("replaces null-occ_date matches-any with same-calendar-day expansion", () => {
    assert.match(mig, /Day-scoped overlap \(same calendar day required\)/);
    assert.match(mig, /v_cand_day = v_ex_day/);
    assert.match(mig, /v_pair\.c_occ is not null and v_pair\.c_occ is distinct from v_cand_day/);
    assert.match(mig, /v_pair\.x_occ is not null and v_pair\.x_occ is distinct from v_ex_day/);
    // Must not keep the old schedule_overlap_kind null-matches-any as the evaluate path.
    assert.doesNotMatch(mig, /v_kind := public\.schedule_overlap_kind\(/);
  });

  it("preserves public calendar copy: Available is inquiry-request, Not available is venue cannot take an event", () => {
    assert.match(
      publicCopy,
      /Available dates can still be requested\. Not available means this venue cannot take an event that day\./,
    );
  });
});
