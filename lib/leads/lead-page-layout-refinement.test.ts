/**
 * Lead page upper-layout refinement:
 * Sales owner on summary facts row; compact collapsed Date hold;
 * Communication Preferences disclosure (collapsed by default).
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

describe("lead page layout refinement", () => {
  it("places Sales owner with summary facts and keeps explicit save", () => {
    const facts = detail.slice(
      detail.indexOf('data-testid="lead-summary-facts"'),
      detail.indexOf('data-testid="lead-quick-actions"'),
    );
    assert.match(facts, /StaffAssignmentField/);
    assert.match(facts, /label="Sales owner"/);
    assert.match(facts, /testId="lead-staff-assignment"/);
    assert.match(facts, /setLeadAssignedStaffAction/);
    assert.match(staff, /Save assignment/);
    assert.match(staff, /onSave\(next\.trim\(\) \|\| null\)/);
    assert.match(staff, /dirtyRef\.current = true/);
    const quick = detail.slice(
      detail.indexOf('data-testid="lead-quick-actions"'),
      detail.indexOf("<RelationshipCard"),
    );
    assert.doesNotMatch(quick, /StaffAssignmentField/);
  });

  it("collapsed compact Date hold omits space names and expiration", () => {
    // Compact summary markup lives between these markers (before the regular-density branch).
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
