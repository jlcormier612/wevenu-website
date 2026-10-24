/**
 * Client / booked-event page: compact booking summary + team staffing region.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
const staffField = readFileSync(resolve("components/team/staff-assignment-field.tsx"), "utf8");
const actionLabel = readFileSync(resolve("lib/team/assignment-action-label.ts"), "utf8");
const eventActions = readFileSync(resolve("app/(app)/events/[id]/actions.ts"), "utf8");
const leadDetail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");


describe("client page compact booking + staffing layout", () => {
  it("keeps a View original lead link to clients.lead_id in the booked header", () => {
    assert.match(detail, /originatingLeadId/);
    assert.match(detail, /data-testid="view-original-lead"/);
    assert.match(detail, /View original lead/);
    assert.match(detail, /href=\{`\/leads\/\$\{originatingLeadId\}`\}/);
    const page = readFileSync(resolve("app/(app)/clients/[id]/page.tsx"), "utf8");
    assert.match(page, /originatingLeadId=\{client\.leadId\}/);
    const celebration = readFileSync(resolve("components/clients/booking-celebration.tsx"), "utf8");
    assert.match(celebration, /data-testid="view-original-lead"/);
    assert.match(celebration, /View original lead/);
    assert.match(celebration, /href=\{`\/leads\/\$\{client\.leadId\}`\}/);
  });

  it("places booking and compact team assignment in one upper region", () => {
    const region = detail.slice(
      detail.indexOf('data-testid="client-booking-staff-region"'),
      detail.indexOf("{/* ── Tabs"),
    );
    assert.match(region, /EventHeroCard/);
    assert.match(region, /data-testid="event-staff-assignment"/);
    assert.match(region, /data-testid="event-team-assignment-row"/);
    assert.match(region, /id="event-team-roster"/);
    assert.match(region, /items-stretch/);
    assert.match(region, /lg:grid-cols-\[minmax\(0,1\.45fr\)_minmax\(0,1fr\)\]/);
    assert.match(region, /data-testid="client-staffing-column"/);
    assert.match(region, /StaffAssignmentField/);
    assert.match(region, /compact/);
    assert.match(region, /label="Event owner"/);
    assert.doesNotMatch(region, /EventTeamSection/);
    assert.doesNotMatch(region, /Additional team members/);
    assert.match(region, /\bcompact\b/);
    assert.doesNotMatch(region, /Additional event staff/);

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
    assert.match(hero, /multiDay \? "Overall booking window" : "Time"/);
    assert.match(hero, /<dt[^>]*>Guests<\/dt>/);
    assert.match(hero, /<dt[^>]*>Spaces<\/dt>/);
    assert.match(hero, /spaceLine/);
    assert.match(hero, /groupBookingSummaryByDate|event-booking-component-schedule/);
    assert.match(hero, /sm:grid-cols-2/);
    assert.match(hero, /lg:grid-cols-3/);
    assert.doesNotMatch(hero, /text-5xl/);
    assert.doesNotMatch(hero, /min-h-/);
  });

  it("event owner stays explicit-save and separate from lead sales owner", () => {
    assert.match(detail, /setEventAssignedStaffAction\(event\.id, staffId\)/);
    assert.match(detail, /testId="event-owner-assignment"/);
    assert.match(eventActions, /export async function setEventAssignedStaffAction/);
    assert.match(staffField, /assignmentActionLabel\(persistedId/);
    assert.match(actionLabel, /Edit\/Save Assignment/);
    assert.match(actionLabel, /Edit\/Save/);
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

  it("does not render Additional team members on the booked event staffing band", () => {
    const region = detail.slice(
      detail.indexOf('data-testid="client-booking-staff-region"'),
      detail.indexOf("{/* ── Tabs"),
    );
    assert.doesNotMatch(region, /Additional team members/);
    assert.doesNotMatch(region, /event-team-add-select/);
    assert.doesNotMatch(region, /EventTeamSection/);
    assert.match(region, /label="Event owner"/);
    assert.match(region, /testId="event-owner-assignment"/);
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
