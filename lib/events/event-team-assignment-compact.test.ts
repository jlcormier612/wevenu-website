/**
 * Compact Team Assignment row + Questionnaires card copy on booked-event workspace.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
const teamSection = readFileSync(resolve("components/events/event-team-section.tsx"), "utf8");
const staffField = readFileSync(resolve("components/team/staff-assignment-field.tsx"), "utf8");
const actions = readFileSync(resolve("app/(app)/events/[id]/actions.ts"), "utf8");
const eligibility = readFileSync(resolve("lib/events/additional-team-eligibility.ts"), "utf8");

function staffingRegion(): string {
  return detail.slice(
    detail.indexOf('data-testid="client-booking-staff-region"'),
    detail.indexOf("{/* ── Tabs"),
  );
}

describe("compact event team assignment", () => {
  it("uses one Team assignment band instead of two stacked cards", () => {
    const region = staffingRegion();
    assert.match(region, /data-testid="event-staff-assignment"/);
    assert.match(region, /data-testid="event-team-assignment-row"/);
    assert.match(region, /Team assignment/);
    assert.match(region, /label="Event owner"/);
    assert.match(region, /density="compact"/);
    assert.match(teamSection, /Additional team members/);
    assert.doesNotMatch(region, /Additional event staff/);
    assert.doesNotMatch(detail, /The person responsible for this booked event/);
    assert.doesNotMatch(detail, /Names working this event who are not the assigned owner/);
    // Single muted band (div), not Card wrappers for staffing.
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

  it("additional members use existing add/remove actions and internal staff options only", () => {
    assert.match(teamSection, /addTeamMemberAction/);
    assert.match(teamSection, /removeTeamMemberAction/);
    assert.match(teamSection, /filterEligibleAdditionalStaff/);
    assert.match(teamSection, /staffOptions/);
    assert.match(teamSection, /ownerStaffId/);
    assert.match(teamSection, /data-testid="event-team-add-select"/);
    assert.match(teamSection, /data-testid="event-team-member"/);
    assert.match(teamSection, /data-testid="event-team-member-remove"/);
    assert.doesNotMatch(teamSection, /\bprompt\(/);
    assert.doesNotMatch(teamSection, /external vendor/i);
    // New adds are select-from-staff only (no free-text input UI).
    assert.doesNotMatch(teamSection, /<Input|<Textarea|placeholder="Name"/);
    assert.match(eligibility, /exclude event owner/i);
    assert.match(actions, /export async function addTeamMemberAction/);
    assert.match(actions, /export async function removeTeamMemberAction/);
  });

  it("preserves legacy event_team rows in the compact chips list", () => {
    assert.match(teamSection, /initialTeam/);
    assert.match(teamSection, /team\.map\(\(member\)/);
    assert.match(teamSection, /member\.fullName/);
    assert.match(teamSection, /Legacy free-text|legacy/i);
  });

  it("does not couple Event owner save to additional-staff persistence", () => {
    // Owner save stays on StaffAssignmentField; adds/removes are separate actions.
    assert.match(teamSection, /startAdd\(async \(\) => \{/);
    assert.match(teamSection, /handleRemove/);
    assert.doesNotMatch(teamSection, /setEventAssignedStaffAction/);
  });

  it("staffing stays in the upper region; overview does not reintroduce the cards", () => {
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
    assert.doesNotMatch(
      card,
      /Draft, review, and send questionnaires when ready — separate from portal release\./,
    );
    assert.match(card, /CardTitle className="text-base">Questionnaires</);
    assert.match(card, /Open Questionnaires/);
    assert.match(card, /data-testid="open-questionnaires-card"/);
  });
});
