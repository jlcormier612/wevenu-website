/**
 * Lead workspace compaction — header facts, one quick-action row,
 * follow-up owns tours, inquiry facts are not repeated in a second card.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
const followUp = readFileSync(resolve("components/leads/relationship-card.tsx"), "utf8");
const tours = readFileSync(resolve("components/leads/tour-panel.tsx"), "utf8");
const staff = readFileSync(resolve("components/team/staff-assignment-field.tsx"), "utf8");

describe("lead workspace compaction", () => {
  it("keeps header facts and primary actions", () => {
    assert.match(detail, /eventTypeLabel\(lead\.eventType\)/);
    assert.match(detail, /formatDate\(lead\.eventDate\)/);
    assert.match(detail, /lead\.guestCount\.toLocaleString\(\)/);
    assert.match(detail, /formatCurrency\(lead\.estimatedBudget\)/);
    assert.match(detail, /Pipeline stage/);
    assert.match(detail, /Change stage/);
    assert.match(detail, />\s*Edit\s*</);
    assert.match(detail, />\s*Archive\s*</);
    assert.match(detail, /Start booking file/);
    assert.match(detail, /DeleteRecordButton/);
  });

  it("puts sales owner, date hold, and tour scheduling in one header row", () => {
    const row = detail.slice(
      detail.indexOf('data-testid="lead-quick-actions"'),
      detail.indexOf("<RelationshipCard"),
    );
    assert.match(row, /StaffAssignmentField/);
    assert.match(row, /compact/);
    assert.match(row, /<DateHoldsSection/);
    assert.match(row, /density="compact"/);
    assert.match(row, /TourScheduleActions includeCopyLink=\{false\}/);
    assert.equal(detail.match(/<StaffAssignmentField/g)?.length, 1);
    assert.doesNotMatch(detail, /CardTitle className="text-base">Team assignment/);
    assert.doesNotMatch(detail, /CardTitle className="text-base">Inquiry details/);
    assert.doesNotMatch(detail, /CardTitle className="text-base">Date hold/);
  });

  it("combines tour scheduling into Follow-up and keeps the scheduling link", () => {
    assert.match(followUp, /Follow-up/);
    assert.match(followUp, /Add follow-up details/);
    assert.match(followUp, /label="Follow-up"/);
    assert.match(followUp, /label="Last contacted"/);
    assert.match(detail, /<TourScheduleActions \/>/);
    assert.match(detail, /TourAppointmentList/);
    assert.doesNotMatch(detail, /<TourPanel/);
    assert.match(tours, /Schedule Tour/);
    assert.match(tours, /Copy scheduling link/);
    assert.match(tours, /getLeadPublicTourSchedulingUrlAction/);
  });

  it("keeps a non-venue inquiry message in Internal notes", () => {
    assert.match(detail, /function LeadInquiryRecord/);
    assert.match(detail, /origin !== "venue"/);
    assert.match(detail, /<LeadInquiryRecord lead=\{lead\} \/>/);
    const notes = detail.indexOf('<TabsContent value="notes">');
    const record = detail.indexOf("<LeadInquiryRecord", notes);
    const tasks = detail.indexOf('<TabsContent value="tasks">');
    assert.ok(record > notes && record < tasks);
  });

  it("compact assignment still saves and can stay unassigned", () => {
    assert.match(staff, /__unassigned__/);
    assert.match(staff, /selectedRef\.current = resolved/);
    assert.match(staff, /const next = selectedRef\.current/);
    assert.match(staff, /onSave\(next\.trim\(\) \|\| null\)/);
    assert.match(staff, /Save assignment/);
    assert.match(staff, /Assignment saved\./);
    assert.match(staff, /Could not save the assignment/);
  });
});
