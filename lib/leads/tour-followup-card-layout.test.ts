/**
 * Tour & follow-up card — layout hierarchy (Queue Item 2B).
 * Presentation only: scheduling link, tour Edit, actions, Follow-up separation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const card = readFileSync(resolve("components/leads/relationship-card.tsx"), "utf8");
const panel = readFileSync(resolve("components/leads/tour-panel.tsx"), "utf8");
const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");

describe("tour-follow-up card layout", () => {
  it("renders scheduling link in the card body, not beside header Edit", () => {
    const header = card.slice(0, card.indexOf("</CardHeader>"));
    assert.doesNotMatch(header, /\{tourActions\}/);
    assert.match(card, /data-testid="tour-followup-scheduling-block"/);
    assert.match(detail, /tourActions=\{<TourScheduleActions includeSchedule=\{false\} \/>\}/);
    assert.match(panel, /data-testid="lead-copy-scheduling-link"/);
    assert.match(panel, /data-testid="lead-scheduling-link-guidance"/);
  });

  it("places Follow-up and Last contacted in a distinct block below tours", () => {
    const scheduling = card.indexOf('data-testid="tour-followup-scheduling-block"');
    const tours = card.indexOf('data-testid="tour-followup-tour-block"');
    const follow = card.indexOf('data-testid="tour-followup-followup-block"');
    assert.ok(scheduling > 0 && tours > scheduling && follow > tours);
    const followSlice = card.slice(follow, follow + 1600);
    assert.match(followSlice, /label="Follow-up"/);
    assert.match(followSlice, /label="Last contacted"/);
  });

  it("keeps per-tour Edit above that tour's action controls", () => {
    const row = panel.slice(
      panel.indexOf("function AppointmentRow"),
      panel.indexOf("type TourScheduleContextValue"),
    );
    assert.match(row, /data-testid=\{`tour-appointment-edit-\$\{appt\.id\}`\}/);
    assert.match(row, /data-testid=\{`tour-appointment-actions-\$\{appt\.id\}`\}/);
    assert.ok(row.indexOf("tour-appointment-edit-") < row.indexOf("tour-appointment-actions-"));
    assert.match(row, />\s*Edit\s*</);
    assert.match(row, />\s*Reschedule\s*</);
    assert.match(row, /Send Confirmation Request/);
    assert.match(row, /Mark as Confirmed/);
    assert.match(row, />\s*Completed\s*</);
    assert.match(row, />\s*Cancel\s*</);
  });

  it("does not change tour action handlers or copy-link destination", () => {
    assert.match(panel, /onClick=\{\(\) => onReschedule\(appt\.id\)\}/);
    assert.match(panel, /updateTourStatusAction/);
    assert.match(panel, /requestTourConfirmationAction/);
    assert.match(panel, /getLeadPublicTourSchedulingUrlAction/);
    assert.match(card, /updateRelationshipAction/);
    assert.match(card, /completeFollowUpAction/);
  });
});
