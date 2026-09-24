import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  calendarItemMatchesSpace,
  calendarSpaceOptionsFromVenueSpaces,
  spaceIdsForCalendarItem,
} from "@/lib/calendar/space-filter";

describe("calendar space filter", () => {
  it("matches All spaces, a named space, and unassigned without inventing assignment", () => {
    const barn = { spaceId: "barn", spaceIds: ["barn"] };
    const garden = { spaceId: "barn", spaceIds: ["garden", "barn"] };
    const unassigned = { spaceId: null, spaceIds: [] };

    assert.equal(calendarItemMatchesSpace(barn, null), true);
    assert.equal(calendarItemMatchesSpace(garden, null), true);
    assert.equal(calendarItemMatchesSpace(unassigned, null), true);

    assert.equal(calendarItemMatchesSpace(barn, "barn"), true);
    assert.equal(calendarItemMatchesSpace(barn, "garden"), false);
    assert.equal(calendarItemMatchesSpace(garden, "garden"), true);
    assert.equal(calendarItemMatchesSpace(garden, "barn"), true);

    assert.equal(calendarItemMatchesSpace(unassigned, "barn"), false);
    assert.equal(calendarItemMatchesSpace(unassigned, "__unassigned__"), true);
    assert.equal(calendarItemMatchesSpace(barn, "__unassigned__"), false);
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
    const page = readFileSync(resolve("app/(app)/calendar/page.tsx"), "utf8");
    assert.match(page, /getSpaces/);
    assert.match(page, /venueSpaces=/);
  });
});
