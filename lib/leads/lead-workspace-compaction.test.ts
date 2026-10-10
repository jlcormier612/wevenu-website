/**
 * Lead workspace compaction — header facts, owner+hold row,
 * follow-up owns tour list, inquiry facts are not repeated in a second card.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
const followUp = readFileSync(resolve("components/leads/relationship-card.tsx"), "utf8");
const tours = readFileSync(resolve("components/leads/tour-panel.tsx"), "utf8");
const staff = readFileSync(resolve("components/team/staff-assignment-field.tsx"), "utf8");
const actionLabel = readFileSync(resolve("lib/team/assignment-action-label.ts"), "utf8");


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

  it("puts sales owner and date hold on the summary facts row", () => {
    const facts = detail.slice(
      detail.indexOf('data-testid="lead-summary-facts"'),
      detail.indexOf('data-testid="lead-followup-contact-row"'),
    );
    assert.match(facts, /eventTypeLabel\(lead\.eventType\)/);
    assert.match(facts, /formatDate\(lead\.eventDate\)/);
    assert.match(facts, /lead\.guestCount\.toLocaleString\(\)/);
    assert.match(facts, /formatCurrency\(lead\.estimatedBudget\)/);
    assert.match(facts, /StaffAssignmentField/);
    assert.match(facts, /label="Sales owner"/);
    assert.match(facts, /compact/);
    assert.match(facts, /data-testid="lead-owner-hold-row"/);
    assert.match(facts, /<DateHoldsSection/);
    assert.match(facts, /density="compact"/);
    assert.equal(detail.match(/<StaffAssignmentField/g)?.length, 1);
    assert.doesNotMatch(detail, /data-testid="lead-quick-actions"/);
    assert.doesNotMatch(detail, /CardTitle className="text-base">Team assignment/);
    assert.doesNotMatch(detail, /CardTitle className="text-base">Inquiry details/);
    assert.doesNotMatch(detail, /CardTitle className="text-base">Date hold/);
  });

  it("places Schedule Tour beside Start booking and keeps copy-link on Follow-up", () => {
    assert.match(detail, /data-testid="lead-booking-tour-actions"/);
    const booking = detail.slice(
      detail.indexOf('data-testid="lead-booking-tour-actions"'),
      detail.indexOf('data-testid="lead-followup-contact-row"'),
    );
    assert.match(booking, /TourScheduleActions includeCopyLink=\{false\}/);
    assert.match(booking, /includeSchedule/);
    assert.match(booking, /data-testid="start-booking-action"/);
    assert.match(detail, /TourScheduleActions includeSchedule=\{false\}/);
    assert.match(followUp, /Follow-up/);
    assert.match(followUp, /Add follow-up details/);
    assert.match(detail, /TourAppointmentList/);
    assert.doesNotMatch(detail, /<TourPanel/);
    assert.match(tours, /Schedule Tour/);
    assert.match(tours, /Copy scheduling link/);
    assert.match(tours, /includeSchedule/);
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
    assert.match(staff, /dirtyRef\.current = true/);
    assert.match(staff, /if \(dirtyRef\.current\) return/);
    assert.match(staff, /const next = selectedRef\.current/);
    assert.match(staff, /onSave\(next\.trim\(\) \|\| null\)/);
    assert.match(staff, /assignmentActionLabel/);
    assert.match(actionLabel, /Save assignment/);
    assert.match(actionLabel, /Edit assignment/);
    assert.match(staff, /Assignment saved\./);
    assert.match(staff, /Could not save the assignment/);
  });
});
