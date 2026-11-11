/**
 * Team Assignment — Event owner only (Additional team members removed from UI).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
const staffField = readFileSync(resolve("components/team/staff-assignment-field.tsx"), "utf8");
const actions = readFileSync(resolve("app/(app)/events/[id]/actions.ts"), "utf8");

function staffingRegion(): string {
  return detail.slice(
    detail.indexOf('data-testid="client-booking-staff-region"'),
    detail.indexOf("{/* ── Tabs"),
  );
}

describe("event team assignment — owner only", () => {
  it("keeps one Team assignment band with Event owner only", () => {
    const region = staffingRegion();
    assert.match(region, /data-testid="event-staff-assignment"/);
    assert.match(region, /data-testid="event-team-assignment-row"/);
    assert.match(region, /Team assignment/);
    assert.match(region, /label="Event owner"/);
    assert.match(region, /\bcompact\b/);
    assert.doesNotMatch(region, /EventTeamSection/);
    assert.doesNotMatch(region, /Additional team members/);
    assert.doesNotMatch(region, /Additional event staff/);
    assert.doesNotMatch(region, /event-team-add-select/);
    assert.doesNotMatch(region, /event-team-assignment-divider/);
    assert.doesNotMatch(detail, /The person responsible for this booked event/);
    const staffCol = region.slice(region.indexOf('data-testid="client-staffing-column"'));
    const qCard = staffCol.indexOf('<Card size="sm" className="gap-2" id="questionnaires-card"');
    assert.ok(qCard > 0);
    const staffAssignmentBlock = staffCol.slice(0, qCard);
    assert.match(staffAssignmentBlock, /data-testid="event-staff-assignment"/);
    assert.doesNotMatch(staffAssignmentBlock, /<Card[\s>]/);
    assert.doesNotMatch(staffAssignmentBlock, /CardTitle/);
  });

  it("keeps Event owner explicit-save via StaffAssignmentField and existing action", () => {
    const region = staffingRegion();
    assert.match(region, /StaffAssignmentField/);
    assert.match(region, /testId="event-owner-assignment"/);
    assert.match(region, /setEventAssignedStaffAction\(event\.id, staffId\)/);
    assert.match(actions, /export async function setEventAssignedStaffAction/);
    assert.match(staffField, /assignmentActionLabel/);
    assert.match(staffField, /onSave\(next\.trim\(\) \|\| null\)/);
  });

  it("does not import or render additional-staff UI in event detail", () => {
    assert.doesNotMatch(detail, /from "@\/components\/events\/event-team-section"/);
    assert.doesNotMatch(detail, /EventTeamSection/);
    assert.doesNotMatch(detail, /addTeamMemberAction/);
    assert.doesNotMatch(detail, /filterEligibleAdditionalStaff/);
  });

  it("staffing stays in the upper region; overview does not reintroduce team cards", () => {
    const overview = detail.slice(
      detail.indexOf('<TabsContent value="overview"'),
      detail.indexOf('<TabsContent value="playbook"'),
    );
    assert.doesNotMatch(overview, /data-testid="event-staff-assignment"/);
    assert.doesNotMatch(overview, /EventTeamSection/);
  });

  it("Questionnaires card copy is exact and Open Questionnaires is unchanged", () => {
    const cardStart = detail.indexOf('id="questionnaires-card"');
    const card = detail.slice(cardStart, cardStart + 1200);
    assert.match(
      card,
      /Choose and send your prepared information\/feedback-gathering questionnaires when ready — separate from the client portal release process\. Schedule them or send now — your choice!/,
    );
    assert.match(card, /CardTitle className="text-base">Questionnaires</);
    assert.match(card, /Open Questionnaires/);
    assert.match(card, /data-testid="open-questionnaires-card"/);
  });
});
