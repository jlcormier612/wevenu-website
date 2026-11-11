/**
 * Booked-event: Booking card stretches to match combined staffing column height.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");

describe("booking + staffing column equal height", () => {
  it("parent grid uses stretch alignment at desktop widths", () => {
    const region = detail.slice(
      detail.indexOf('data-testid="client-booking-staff-region"'),
      detail.indexOf("{/* ── Tabs"),
    );
    assert.match(region, /items-stretch/);
    assert.doesNotMatch(region, /items-start/);
    assert.match(region, /lg:grid-cols-\[minmax\(0,1\.45fr\)_minmax\(0,1fr\)\]/);
    assert.match(region, /data-testid="client-staffing-column"/);
  });

  it("booking card stretches to fill the shared row height", () => {
    const start = detail.indexOf("function EventHeroCard");
    const end = detail.indexOf("// ---- Coming Soon", start);
    const hero = detail.slice(start, end);
    assert.match(hero, /data-testid="event-booking-summary"/);
    assert.match(hero, /h-full/);
    assert.match(hero, /flex h-full flex-col/);
    // No JS measurement / hardcoded pixel heights.
    assert.doesNotMatch(hero, /offsetHeight|getBoundingClientRect|style=\{\{[^}]*height/);
    assert.doesNotMatch(hero, /min-h-\[|h-\[\d/);
  });

  it("keeps one compact Team assignment band beside booking (owner only)", () => {
    const region = detail.slice(
      detail.indexOf('data-testid="client-booking-staff-region"'),
      detail.indexOf("{/* ── Tabs"),
    );
    assert.match(region, /data-testid="event-staff-assignment"/);
    assert.match(region, /data-testid="event-team-assignment-row"/);
    assert.match(region, /id="event-team-roster"/);
    assert.match(region, /Team assignment/);
    assert.match(region, /\bcompact\b/);
    assert.doesNotMatch(region, /Additional event staff/);
    assert.doesNotMatch(region, /Additional team members/);
    assert.doesNotMatch(region, /EventTeamSection/);
    assert.match(region, /flex min-w-0 flex-col gap-3/);
    const staffCol = region.slice(region.indexOf('data-testid="client-staffing-column"'));
    const band = staffCol.slice(0, staffCol.indexOf("questionnaires-card"));
    assert.doesNotMatch(band, /h-full/);
  });

  it("preserves booking details and Event owner control", () => {
    const start = detail.indexOf("function EventHeroCard");
    const end = detail.indexOf("// ---- Coming Soon", start);
    const hero = detail.slice(start, end);
    assert.match(hero, /formatEventDateRange/);
    assert.match(hero, /EventStatusBadge/);
    assert.match(hero, /multiDay \? "Overall booking window" : "Time"/);
    assert.match(hero, /<dt[^>]*>Guests<\/dt>/);
    assert.match(hero, /<dt[^>]*>Spaces<\/dt>/);
    assert.match(detail, /StaffAssignmentField/);
    assert.match(detail, /label="Event owner"/);
    assert.doesNotMatch(detail, /EventTeamSection/);
  });
});
