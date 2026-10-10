/**
 * Client / booked-event page: compact booking summary + team staffing region.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
const teamSection = readFileSync(resolve("components/events/event-team-section.tsx"), "utf8");
const staffField = readFileSync(resolve("components/team/staff-assignment-field.tsx"), "utf8");
const eventActions = readFileSync(resolve("app/(app)/events/[id]/actions.ts"), "utf8");
const leadDetail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");

describe("client page compact booking + staffing layout", () => {
  it("places booking, team assignment, and additional staff in one upper region", () => {
    const region = detail.slice(
      detail.indexOf('data-testid="client-booking-staff-region"'),
      detail.indexOf("{/* ── Tabs"),
    );
    assert.match(region, /EventHeroCard/);
    assert.match(region, /data-testid="event-staff-assignment"/);
    assert.match(region, /data-testid="event-team-roster"/);
    assert.match(region, /lg:grid-cols-\[minmax\(0,1\.45fr\)_minmax\(0,1fr\)\]/);
    assert.match(region, /StaffAssignmentField/);
    assert.match(region, /compact/);
    assert.match(region, /label="Event owner"/);
    assert.match(region, /EventTeamSection/);
    // Staffing cards no longer live as full-width Overview stack.
    const overview = detail.slice(
      detail.indexOf('<TabsContent value="overview"'),
      detail.indexOf('<TabsContent value="playbook"'),
    );
    assert.doesNotMatch(overview, /data-testid="event-staff-assignment"/);
    assert.doesNotMatch(overview, /EventTeamSection/);
  });

  it("keeps booking date, status, time, guests, and space assignment rows", () => {
    const start = detail.indexOf("function EventHeroCard");
    const end = detail.indexOf("// ---- Coming Soon", start);
    const hero = detail.slice(start, end);
    assert.match(hero, /data-testid="event-booking-summary"/);
    assert.match(hero, /formatEventDateRange/);
    assert.match(hero, /EventStatusBadge/);
    assert.match(hero, /<dt[^>]*>Time<\/dt>/);
    assert.match(hero, /<dt[^>]*>Guests<\/dt>/);
    assert.match(hero, /<dt[^>]*>Spaces<\/dt>/);
    assert.match(hero, /parseSpaceLines/);
    assert.match(hero, /row\.use/);
    assert.match(hero, /row\.space/);
    assert.match(hero, /sm:grid-cols-2/);
    assert.match(hero, /lg:grid-cols-3/);
    assert.doesNotMatch(hero, /text-5xl/);
    assert.doesNotMatch(hero, /min-h-/);
  });

  it("event owner stays explicit-save and separate from lead sales owner", () => {
    assert.match(detail, /setEventAssignedStaffAction\(event\.id, staffId\)/);
    assert.match(detail, /testId="event-owner-assignment"/);
    assert.match(eventActions, /export async function setEventAssignedStaffAction/);
    assert.match(staffField, /Save assignment/);
    assert.match(staffField, /__unassigned__/);
    assert.match(staffField, /onSave\(next\.trim\(\) \|\| null\)/);
    assert.match(leadDetail, /label="Sales owner"/);
    assert.match(leadDetail, /testId="lead-staff-assignment"/);
    assert.doesNotMatch(
      detail.slice(
        detail.indexOf('data-testid="client-booking-staff-region"'),
        detail.indexOf("{/* ── Tabs"),
      ),
      /Sales owner/,
    );
  });

  it("additional staff empty state is compact and keep add/remove controls", () => {
    assert.match(teamSection, /No additional staff assigned\./);
    assert.doesNotMatch(teamSection, /py-4 text-center/);
    assert.match(teamSection, /data-testid="event-team-add"/);
    assert.match(teamSection, /Add team member/);
    assert.match(teamSection, /addTeamMemberAction/);
    assert.match(teamSection, /removeTeamMemberAction/);
    assert.match(teamSection, /data-testid="event-team-member"/);
  });

  it("overview keeps adjacent setup and attention content after the upper region", () => {
    const overview = detail.slice(
      detail.indexOf('<TabsContent value="overview"'),
      detail.indexOf('<TabsContent value="playbook"'),
    );
    assert.match(overview, /EventSetupPanel/);
    assert.match(overview, /NeedsAttentionList/);
    assert.match(overview, /Edit contact/);
  });
});
