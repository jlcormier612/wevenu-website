import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Phase 5 product integration seams", () => {
  const settingsPage = readFileSync(resolve("app/(app)/settings/availability/page.tsx"), "utf8");
  const capacity = readFileSync(resolve("components/availability/capacity-rules-section.tsx"), "utf8");
  const spaces = readFileSync(resolve("components/availability/venue-spaces-section.tsx"), "utf8");
  const eventForm = readFileSync(resolve("components/events/event-form.tsx"), "utf8");
  const spaceField = readFileSync(resolve("components/availability/event-space-field.tsx"), "utf8");
  const repo = readFileSync(resolve("lib/availability/repository.ts"), "utf8");
  const calendar = readFileSync(resolve("lib/calendar/service.ts"), "utf8");
  const eventsService = readFileSync(resolve("lib/events/service.ts"), "utf8");
  const clientsService = readFileSync(resolve("lib/clients/service.ts"), "utf8");
  const precheck = readFileSync(resolve("lib/availability/precheck.ts"), "utf8");
  const conflict = readFileSync(resolve("components/availability/conflict-warning.tsx"), "utf8");

  it("settings copy does not claim capacity is an advisory warning", () => {
    assert.doesNotMatch(settingsPage, /warn when these thresholds are approached/);
    assert.match(settingsPage, /enforced when booking/);
    assert.match(capacity, /requires Event Spaces for overlapping events/);
    assert.match(capacity, /Enforced when a tour is booked/);
    assert.match(capacity, /Enforced when an event is booked/);
    assert.doesNotMatch(capacity, /Not applied to booking yet/);
    assert.match(spaces, /must add at least one Event Space/);
  });

  it("Event create/edit space UI is required on simultaneous venues, not labeled optional", () => {
    assert.match(eventForm, /EventSpaceField/);
    assert.match(eventForm, /maxSimultaneousEvents/);
    assert.match(eventForm, /endDate=\{input\.eventEndDate/);
    assert.match(spaceField, /Required — overlapping events must be in different spaces/);
    assert.match(spaceField, /Add an Event Space in/);
  });

  it("pre-check uses occupancy evaluation and cannot skip a missing rules row", () => {
    assert.match(repo, /buildAvailabilityConflicts/);
    assert.match(precheck, /effectiveMaxSimultaneousEvents/);
    assert.match(precheck, /evaluateEventOccupancy/);
    assert.match(precheck, /evaluateTourCapacity/);
    assert.doesNotMatch(precheck, /if \(rules\) \{/);
  });

  it("Event→Tour conflict is operational-window overlap, not a date-only Event-day block", () => {
    assert.match(precheck, /operational-window overlap/);
    assert.match(precheck, /eventOccupancyOverlapsTour/);
    assert.match(precheck, /tourFitsAvailabilityWindow/);
    assert.doesNotMatch(precheck, /eventDate === input\.date/);
    assert.match(calendar, /operational-window overlap/);
    assert.doesNotMatch(calendar, /event_date equals the Tour slot date/);
  });

  it("Calendar queries overlapping Events and expands protected days", () => {
    assert.match(calendar, /calendarDatesForProtectedEvent/);
    assert.match(calendar, /event_end_date/);
    assert.match(calendar, /event-\$\{e\.id\}-\$\{date\}/);
  });

  it("occupancy errors surface on the space field including no_spaces", () => {
    assert.match(eventsService, /fail\.code === "no_spaces"/);
    assert.match(clientsService, /fail\.code === "no_spaces"/);
    assert.match(clientsService, /spaceId: opts\?\.spaceId/);
  });

  it("ConflictWarning occupancy refusals are not described as advisory-only", () => {
    assert.match(conflict, /Allow the required turnaround after the previous event/);
    assert.match(conflict, /does not overlap the Event's setup-to-teardown window/);
    assert.match(conflict, /if \(errors\.length === 0\) return "You can still proceed — this is advisory only\."/);
  });
});
