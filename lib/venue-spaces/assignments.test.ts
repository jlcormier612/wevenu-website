import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import type { VenueSpace } from "@/lib/availability/types";
import {
  configuredUsesFromSpaces,
  intraEventSpaceOverlapError,
  materializeMissingScheduledDates,
  normalizeAssignmentInputs,
  primarySpaceIdFromAssignments,
  spacesEligibleForUse,
} from "@/lib/venue-spaces/assignments";
import { shouldShowCalendarSpaceFilter } from "@/lib/venue-spaces/uses";

function space(partial: Partial<VenueSpace> & { id: string; name: string }): VenueSpace {
  return {
    venueId: "v1",
    description: null,
    capacity: null,
    permittedUses: [],
    isActive: true,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("event space assignments", () => {
  it("collects configured uses from spaces only — no universal wedding defaults", () => {
    const spaces = [
      space({ id: "barn", name: "Barn", permittedUses: ["ceremony", "reception"] }),
      space({ id: "garden", name: "Garden", permittedUses: ["ceremony", "cocktail_hour"] }),
    ];
    const uses = configuredUsesFromSpaces(spaces);
    assert.deepEqual(
      uses.map((u) => u.key),
      ["ceremony", "reception", "cocktail_hour"],
    );
  });

  it("prefers reception over an earlier ceremony assignment as the occupancy primary", () => {
    assert.equal(
      primarySpaceIdFromAssignments([
        { useKey: "ceremony", useLabel: "Ceremony", spaceId: "garden" },
        { useKey: "reception", useLabel: "Reception", spaceId: "barn" },
        { useKey: "cocktail_hour", useLabel: "Cocktail Hour", spaceId: "terrace" },
      ], { weddingFamily: true }),
      "barn",
    );
  });

  it("non-wedding occupancy uses the first assigned relevant space", () => {
    assert.equal(
      primarySpaceIdFromAssignments([
        { useKey: "cocktail_hour", useLabel: "Cocktail Hour", spaceId: "patio" },
        { useKey: "meeting", useLabel: "Meeting", spaceId: "barn" },
      ], { weddingFamily: false }),
      "patio",
    );
  });

  it("allows same physical space for multiple uses", () => {
    const normalized = normalizeAssignmentInputs([
      { useKey: "ceremony", useLabel: "Ceremony", spaceId: "barn" },
      { useKey: "reception", useLabel: "Reception", spaceId: "barn" },
    ]);
    assert.equal(normalized.length, 2);
    assert.equal(primarySpaceIdFromAssignments(normalized), "barn");
  });

  it("materializes display eventDate into null scheduledDate without overwriting explicit dates", () => {
    const { next, changed } = materializeMissingScheduledDates([
      {
        useKey: "rehearsal_dinner",
        useLabel: "Rehearsal Dinner",
        spaceId: "barn",
        scheduledDate: "2027-05-08",
        startTime: "18:00",
        endTime: "22:00",
      },
      {
        useKey: "reception",
        useLabel: "Reception",
        spaceId: "barn",
        scheduledDate: null,
        startTime: "18:00",
        endTime: "22:00",
      },
    ], "2027-05-08");
    assert.equal(changed, true);
    assert.equal(next[0]?.scheduledDate, "2027-05-08");
    assert.equal(next[1]?.scheduledDate, "2027-05-08");
  });

  it("rejects same-space same-date overlapping components inside one event", () => {
    const err = intraEventSpaceOverlapError([
      {
        useKey: "rehearsal_dinner",
        useLabel: "Rehearsal Dinner",
        spaceId: "barn",
        scheduledDate: "2030-06-08",
        startTime: "18:00",
        endTime: "22:00",
      },
      {
        useKey: "reception",
        useLabel: "Reception",
        spaceId: "barn",
        scheduledDate: "2030-06-08",
        startTime: "18:00",
        endTime: "22:00",
      },
    ]);
    assert.match(err ?? "", /overlap/i);
    assert.equal(
      intraEventSpaceOverlapError([
        {
          useKey: "rehearsal_dinner",
          useLabel: "Rehearsal Dinner",
          spaceId: "barn",
          scheduledDate: "2030-06-08",
          startTime: "18:00",
          endTime: "22:00",
        },
        {
          useKey: "reception",
          useLabel: "Reception",
          spaceId: "barn",
          scheduledDate: "2030-06-09",
          startTime: "18:00",
          endTime: "22:00",
        },
      ]),
      null,
    );
  });

  it("restricts eligible spaces by permitted use; empty uses = unrestricted", () => {
    const spaces = [
      space({ id: "barn", name: "Barn", permittedUses: ["reception"] }),
      space({ id: "suite", name: "Suite", permittedUses: [] }),
    ];
    const forCeremony = spacesEligibleForUse(spaces, "ceremony").map((s) => s.id);
    assert.deepEqual(forCeremony, ["suite"]);
    const forReception = spacesEligibleForUse(spaces, "reception").map((s) => s.id);
    assert.deepEqual(forReception, ["barn", "suite"]);
  });

  it("calendar space filter only when multi and at least two spaces", () => {
    assert.equal(shouldShowCalendarSpaceFilter("single"), false);
    assert.equal(shouldShowCalendarSpaceFilter("multi"), true);
    assert.equal(shouldShowCalendarSpaceFilter("multi", 1), false);
    assert.equal(shouldShowCalendarSpaceFilter("multi", 2), true);
    assert.equal(shouldShowCalendarSpaceFilter("single", 3), false);
  });

  it("event form wires multi assignment editor; calendar gates on configured spaces", () => {
    const form = readFileSync(resolve("components/events/event-form.tsx"), "utf8");
    assert.match(form, /EventSpaceAssignmentsEditor/);
    assert.match(form, /spaceOperatingMode/);
    assert.match(form, /relevantUsesForExperience/);
    assert.match(form, /experience\.isWeddingSpecific/);
    const cal = readFileSync(resolve("components/calendar/calendar-view.tsx"), "utf8");
    assert.match(cal, /shouldShowCalendarSpaceFilter/);
    assert.match(cal, /venueSpaces/);
  });
});
