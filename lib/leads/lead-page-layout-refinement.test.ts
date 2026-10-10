/**
 * Lead page upper-layout refinement:
 * Sales owner + Date hold row; compact collapsed Date hold;
 * Communication Preferences disclosure; contact people columns;
 * Schedule Tour beside Start booking; Follow-up/Contact stretch pair.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
const holds = readFileSync(resolve("components/availability/date-holds-section.tsx"), "utf8");
const comms = readFileSync(
  resolve("components/leads/relationship-communication-summary.tsx"),
  "utf8",
);
const staff = readFileSync(resolve("components/team/staff-assignment-field.tsx"), "utf8");
const actionLabel = readFileSync(resolve("lib/team/assignment-action-label.ts"), "utf8");


describe("lead page layout refinement", () => {
  it("places Sales owner with summary facts and keeps explicit save", () => {
    const facts = detail.slice(
      detail.indexOf('data-testid="lead-summary-facts"'),
      detail.indexOf('data-testid="lead-followup-contact-row"'),
    );
    assert.match(facts, /StaffAssignmentField/);
    assert.match(facts, /label="Sales owner"/);
    assert.match(facts, /testId="lead-staff-assignment"/);
    assert.match(facts, /setLeadAssignedStaffAction/);
    assert.match(facts, /data-testid="lead-owner-hold-row"/);
    assert.match(facts, /<DateHoldsSection/);
    assert.match(staff, /assignmentActionLabel\(persistedId\)/);
    assert.match(actionLabel, /Save assignment/);
    assert.match(actionLabel, /Edit assignment/);
    assert.match(staff, /onSave\(next\.trim\(\) \|\| null\)/);
    assert.match(staff, /dirtyRef\.current = true/);


  });

  it("places Schedule Tour immediately before Start booking", () => {
    const actions = detail.slice(
      detail.indexOf('data-testid="lead-booking-tour-actions"'),
      detail.indexOf('data-testid="start-booking-action"') + 80,
    );
    assert.match(actions, /TourScheduleActions includeCopyLink=\{false\}/);
    assert.match(actions, /data-testid="start-booking-action"/);
    assert.ok(detail.indexOf('data-testid="start-booking-action"') > 0);
    assert.match(detail, /includeSchedule/);
  });

  it("aligns Follow-up and Contact as a stretch pair with people above Communication Preferences", () => {
    assert.match(detail, /data-testid="lead-followup-contact-row"/);
    assert.match(detail, /items-stretch/);
    assert.match(detail, /data-testid="lead-contact-card"/);
    assert.match(detail, /data-testid="lead-contact-people"/);
    assert.match(detail, /data-testid="lead-primary-contact"/);
    assert.match(detail, /data-testid="lead-partner-contact"/);
    const contact = detail.slice(
      detail.indexOf('data-testid="lead-contact-card"'),
      detail.indexOf("</TourScheduleRoot>"),
    );
    const peopleIdx = contact.indexOf('data-testid="lead-contact-people"');
    const prefsIdx = contact.indexOf("RelationshipCommunicationSummary");
    assert.ok(peopleIdx >= 0 && prefsIdx > peopleIdx);
    assert.match(contact, /lead\.partnerEmail/);
    assert.doesNotMatch(contact, /Lydia Cormier|Ali Shazam/);
  });

  it("collapsed compact Date hold omits space names and expiration", () => {
    const marker = 'data-testid="date-hold-summary-date"';
    const start = holds.indexOf(marker);
    const end = holds.indexOf(") : (", start);
    assert.ok(start > 0 && end > start);
    const summary = holds.slice(start - 180, end);
    assert.match(summary, />\s*Held\s*</);
    assert.match(summary, /formatDate\(hold\.holdDate\)/);
    assert.match(summary, /date-hold-details-toggle/);
    assert.doesNotMatch(summary, /holdResourcesLabel/);
    assert.doesNotMatch(summary, /Expires/);
    assert.doesNotMatch(summary, /holdWindowLabel/);
  });

  it("expanded Date hold details expose spaces and expiration; Edit/Release remain", () => {
    assert.match(holds, /data-testid="date-hold-details"/);
    assert.match(holds, /data-testid="date-hold-details-spaces"/);
    assert.match(holds, /data-testid="date-hold-details-expires"/);
    assert.match(holds, /holdResourcesLabel\(hold\)/);
    assert.match(holds, /data-testid="date-hold-edit"/);
    assert.match(holds, /data-testid="date-hold-release"/);
    assert.match(holds, /aria-expanded=\{expandedHoldIds\.has\(hold\.id\)\}/);
  });

  it("Communication Preferences is collapsed by default with accessible disclosure", () => {
    assert.match(comms, /useState\(false\)/);
    assert.match(comms, /Communication Preferences/);
    assert.match(comms, /aria-expanded=\{open\}/);
    assert.match(comms, /data-testid="communication-preferences-toggle"/);
    assert.match(comms, /data-testid="communication-preferences-content"/);
    assert.match(comms, /data-testid="communication-preferences-status"/);
    assert.match(comms, /\{open \? \(/);
  });

  it("preserves consent copy and request controls inside expanded content", () => {
    assert.match(comms, /Text messaging/);
    assert.match(comms, /hasn(?:&apos;|')t opted in to receive text messages from your venue/);
    assert.match(comms, /requires the person(?:&apos;|')s permission before you can send them text/);
    assert.match(comms, /This person gave permission to receive text messages/);
    assert.match(comms, /RequestSmsConsentButton/);
    assert.doesNotMatch(comms, /status:\s*"opted_in"/);
  });
});
