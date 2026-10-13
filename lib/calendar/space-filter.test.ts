import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  calendarItemMatchesSpace,
  calendarSpaceOptionsFromVenueSpaces,
  isVenueWideCalendarItem,
  normalizeCalendarSpaceFilterId,
  spaceIdsForCalendarItem,
} from "@/lib/calendar/space-filter";

describe("calendar space filter", () => {
  it("matches All spaces and a named space for space-assigned items", () => {
    const barn = { type: "event" as const, id: "event-1", spaceId: "barn", spaceIds: ["barn"] };
    const garden = {
      type: "event" as const,
      id: "event-2",
      spaceId: "barn",
      spaceIds: ["garden", "barn"],
    };

    assert.equal(calendarItemMatchesSpace(barn, null), true);
    assert.equal(calendarItemMatchesSpace(garden, null), true);

    assert.equal(calendarItemMatchesSpace(barn, "barn"), true);
    assert.equal(calendarItemMatchesSpace(barn, "garden"), false);
    assert.equal(calendarItemMatchesSpace(garden, "garden"), true);
    assert.equal(calendarItemMatchesSpace(garden, "barn"), true);

    assert.equal(normalizeCalendarSpaceFilterId("__unassigned__"), null);
    assert.equal(calendarItemMatchesSpace(barn, "__unassigned__"), true);
  });

  it("keeps venue-wide tours visible under All spaces and a named space", () => {
    const tour = {
      type: "tour" as const,
      id: "tour-061714de",
      spaceId: null,
      spaceIds: [] as string[],
      title: "Venue Tour — Lucy",
    };
    assert.equal(isVenueWideCalendarItem(tour), true);
    assert.equal(calendarItemMatchesSpace(tour, null), true);
    assert.equal(calendarItemMatchesSpace(tour, "barn"), true);
    assert.equal(calendarItemMatchesSpace(tour, "6366187b-e7f5-45d0-b9bd-5534a48f6650"), true);
  });

  it("keeps venue-wide Christmas tour exceptions visible under a named space", () => {
    const xmas = {
      type: "calendar_block" as const,
      id: "tour-exception-a32242fa-852b-4b34-85c8-8db9f879517d-2026-12-25",
      manualType: "blocked_time" as const,
      spaceId: null,
      spaceIds: [] as string[],
      title: "Christmas",
    };
    assert.equal(isVenueWideCalendarItem(xmas), true);
    assert.equal(calendarItemMatchesSpace(xmas, null), true);
    assert.equal(calendarItemMatchesSpace(xmas, "barn"), true);
  });

  it("keeps manual blocked-time calendar_blocks visible (no space column in model)", () => {
    const block = {
      type: "calendar_block" as const,
      id: "block-abc-2026-12-25",
      manualType: "blocked_time" as const,
      spaceId: null,
      spaceIds: [] as string[],
    };
    assert.equal(isVenueWideCalendarItem(block), true);
    assert.equal(calendarItemMatchesSpace(block, "barn"), true);
  });

  it("excludes space-specific events assigned to another physical space", () => {
    const villaOnly = {
      type: "event" as const,
      id: "event-villa",
      spaceId: "villa",
      spaceIds: ["villa"],
    };
    assert.equal(calendarItemMatchesSpace(villaOnly, "barn"), false);
    assert.equal(calendarItemMatchesSpace(villaOnly, "villa"), true);
    assert.equal(calendarItemMatchesSpace(villaOnly, null), true);
  });

  it("does not treat unassigned events or date holds as venue-wide", () => {
    const unassignedEvent = {
      type: "event" as const,
      id: "event-none",
      spaceId: null,
      spaceIds: [] as string[],
    };
    const unassignedHold = {
      type: "date_hold" as const,
      id: "hold-none",
      spaceId: null,
      spaceIds: [] as string[],
    };
    assert.equal(isVenueWideCalendarItem(unassignedEvent), false);
    assert.equal(isVenueWideCalendarItem(unassignedHold), false);
    assert.equal(calendarItemMatchesSpace(unassignedEvent, "barn"), false);
    assert.equal(calendarItemMatchesSpace(unassignedHold, "barn"), false);
    assert.equal(calendarItemMatchesSpace(unassignedEvent, null), true);
    assert.equal(calendarItemMatchesSpace(unassignedHold, null), true);
  });

  it("uses assignment spaceIds before the primary spaceId", () => {
    assert.deepEqual(
      spaceIdsForCalendarItem({ spaceId: "barn", spaceIds: ["garden"] }),
      ["garden"],
    );
    assert.deepEqual(
      spaceIdsForCalendarItem({ spaceId: "barn", spaceIds: [] }),
      ["barn"],
    );
    assert.deepEqual(
      spaceIdsForCalendarItem({ spaceId: null, spaceIds: undefined }),
      [],
    );
  });

  it("lists configured venue spaces, not only spaces that already have items", () => {
    const options = calendarSpaceOptionsFromVenueSpaces([
      { id: "barn", name: "Barn", isActive: true },
      { id: "bridge", name: "Covered Bridge", isActive: true },
      { id: "lawn", name: "Garden Lawn", isActive: true },
      { id: "old", name: "Old Tent", isActive: false },
    ]);
    assert.deepEqual(
      options.map((o) => o.name),
      ["Barn", "Covered Bridge", "Garden Lawn"],
    );
  });

  it("calendar service loads canonical assignments and FilterBar says All spaces", () => {
    const service = readFileSync(resolve("lib/calendar/service.ts"), "utf8");
    assert.match(service, /event_space_assignments/);
    assert.match(service, /spaceIds/);
    const filters = readFileSync(resolve("components/calendar/use-calendar-filters.ts"), "utf8");
    assert.match(filters, /calendarItemMatchesSpace/);
    assert.match(filters, /venueSpaces/);
    const bar = readFileSync(resolve("components/calendar/calendar-shared.tsx"), "utf8");
    assert.match(bar, /All spaces/);
    assert.doesNotMatch(bar, /Every space/);
    assert.doesNotMatch(bar, /No space set/);
    assert.match(bar, /nextTaxonomySelectionAfterToggle/);
    assert.match(filters, /normalizeCalendarSpaceFilterId/);
    const page = readFileSync(resolve("app/(app)/calendar/page.tsx"), "utf8");
    assert.match(page, /getSpaces/);
    assert.match(page, /venueSpaces=/);
  });
});
