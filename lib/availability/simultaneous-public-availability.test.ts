/**
 * Confirmed-event public availability policy:
 * venues.allow_simultaneous_public_availability (default false).
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

const MIG = "supabase/migrations/20261418500000_allow_simultaneous_public_availability.sql";
const BARN = "space-barn";
const LAWN = "space-lawn";

function venue(partial: Partial<OccupancyVenue> & Pick<OccupancyVenue, "effectiveMax">): OccupancyVenue {
  return {
    activeSpaceIds: partial.activeSpaceIds ?? [BARN, LAWN],
    allSpaceIds: partial.allSpaceIds ?? partial.activeSpaceIds ?? [BARN, LAWN],
    ...partial,
  };
}

function confirmed(partial: Partial<OccupancyEvent> & Pick<OccupancyEvent, "id" | "eventDate">): OccupancyEvent {
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

describe("allow_simultaneous_public_availability migration + settings", () => {
  const sql = readFileSync(resolve(MIG), "utf8");

  it("adds the column with safe default false and no silent backfill to true", () => {
    assert.match(sql, /allow_simultaneous_public_availability boolean not null default false/);
    assert.match(sql, /Existing venues keep the safe default/);
    assert.doesNotMatch(sql, /set allow_simultaneous_public_availability = true/i);
  });

  it("clamps public _is_event_date_available to venue-wide when opt-in is off", () => {
    const fix = readFileSync(
      resolve("supabase/migrations/20261418700000_fix_public_availability_venue_wide_default.sql"),
      "utf8",
    );
    const fn = fix.slice(fix.indexOf("function public._is_event_date_available"));
    assert.match(fn, /allow_simultaneous_public_availability/);
    assert.match(fn, /any booked Event occupying the date closes it venue-wide/i);
    assert.match(fn, /e\.booked_at is not null/);
    assert.doesNotMatch(
      fn.slice(fn.indexOf("if not v_allow_simul then"), fn.indexOf("v_result := public.evaluate_event_availability")),
      /evaluate_event_availability\(\s*p_venue_id, p_date, null, null, null, null, null, null, null\s*\)/,
    );
  });

  it("Settings control and action persist the preference", () => {
    const control = readFileSync(
      resolve("components/settings/simultaneous-public-availability-control.tsx"),
      "utf8",
    );
    const actions = readFileSync(resolve("app/(app)/settings/availability-actions.ts"), "utf8");
    const page = readFileSync(resolve("app/(app)/settings/availability/page.tsx"), "utf8");
    assert.match(control, /Allow inquiries when another event is booked/);
    assert.match(control, /Close the date when an event is booked/);
    assert.match(control, /Keep the date open for other events/);
    assert.match(control, /public inquiry availability is currently date-based/);
    assert.match(control, /choose\(false\)/);
    assert.match(control, /choose\(true\)/);
    assert.match(actions, /updateAllowSimultaneousPublicAvailabilityAction/);
    assert.match(actions, /allow_simultaneous_public_availability/);
    assert.match(page, /SimultaneousPublicAvailabilityControl/);
  });

  it("TS inquiry authority and repository load the same flag", () => {
    const occ = readFileSync(resolve("lib/availability/event-occupancy.ts"), "utf8");
    const repo = readFileSync(resolve("lib/availability/repository.ts"), "utf8");
    const precheck = readFileSync(resolve("lib/availability/precheck.ts"), "utf8");
    assert.match(occ, /allowSimultaneousPublicAvailability === true && max >= 2/);
    assert.match(repo, /allow_simultaneous_public_availability/);
    assert.match(precheck, /allowSimultaneousPublicAvailability/);
  });
});

describe("confirmed-event inquiry defaults", () => {
  const multi = venue({ effectiveMax: 4 });
  const multiOptIn = venue({ effectiveMax: 4, allowSimultaneousPublicAvailability: true });

  it("newly created venue shape (flag unset) blocks a confirmed wedding date", () => {
    const wedding = confirmed({ id: "w", eventDate: "2027-10-10", spaceId: BARN });
    assert.equal(isInquiryEventDateAvailable("2027-10-10", multi, [wedding]), false);
  });

  it("confirmed wedding with assigned spaces blocks its date by default", () => {
    const wedding = confirmed({ id: "w", eventDate: "2027-10-10", spaceId: BARN });
    assert.equal(isInquiryEventDateAvailable("2027-10-10", multi, [wedding]), false);
  });

  it("confirmed wedding with missing space assignments still blocks by default", () => {
    const wedding = confirmed({ id: "w", eventDate: "2027-10-10", spaceId: null });
    assert.equal(isInquiryEventDateAvailable("2027-10-10", multi, [wedding]), false);
  });

  it("multiple confirmed events do not make a date available when disabled", () => {
    const events = [
      confirmed({ id: "a", eventDate: "2027-10-10", spaceId: BARN }),
      confirmed({ id: "b", eventDate: "2027-10-10", spaceId: LAWN }),
    ];
    assert.equal(isInquiryEventDateAvailable("2027-10-10", multi, events), false);
  });

  it("cancelled events follow existing cancellation rules", () => {
    const cancelled = confirmed({ id: "c", eventDate: "2027-10-10", spaceId: BARN, status: "cancelled" });
    assert.equal(isInquiryEventDateAvailable("2027-10-10", multi, [cancelled]), true);
  });

  it("rehearsal-dinner occupancy does not incorrectly control the wedding date", () => {
    const rehearsal = confirmed({
      id: "r",
      eventDate: "2027-10-09",
      spaceId: BARN,
      name: "Rehearsal dinner",
    });
    const wedding = confirmed({ id: "w", eventDate: "2027-10-10", spaceId: BARN });
    assert.equal(isInquiryEventDateAvailable("2027-10-10", multi, [rehearsal]), true);
    assert.equal(isInquiryEventDateAvailable("2027-10-09", multi, [rehearsal, wedding]), false);
    assert.equal(isInquiryEventDateAvailable("2027-10-10", multi, [rehearsal, wedding]), false);
  });

  it("explicit opt-in restores space-based availability", () => {
    const wedding = confirmed({ id: "w", eventDate: "2027-10-10", spaceId: BARN });
    assert.equal(isInquiryEventDateAvailable("2027-10-10", multiOptIn, [wedding]), true);
    assert.equal(
      evaluateEventOccupancy({ eventDate: "2027-10-10", spaceId: LAWN }, multiOptIn, [wedding]).ok,
      true,
    );
  });

  it("opt-in still enforces same-space conflicts and capacity", () => {
    const wedding = confirmed({ id: "w", eventDate: "2027-10-10", spaceId: BARN });
    assert.equal(
      evaluateEventOccupancy({ eventDate: "2027-10-10", spaceId: BARN }, multiOptIn, [wedding]).ok,
      false,
    );
    const bothSpaces = [
      confirmed({ id: "a", eventDate: "2027-10-10", spaceId: BARN }),
      confirmed({ id: "b", eventDate: "2027-10-10", spaceId: LAWN }),
    ];
    assert.equal(isInquiryEventDateAvailable("2027-10-10", multiOptIn, bothSpaces), false);
  });
});
