/**
 * Lead workspace polish — identity, sales & availability, tour & follow-up hierarchy.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
const followUp = readFileSync(resolve("components/leads/relationship-card.tsx"), "utf8");
const tours = readFileSync(resolve("components/leads/tour-panel.tsx"), "utf8");
const prefs = readFileSync(resolve("components/leads/space-preference-fields.tsx"), "utf8");
const holds = readFileSync(resolve("components/availability/date-holds-section.tsx"), "utf8");
const staff = readFileSync(resolve("components/team/staff-assignment-field.tsx"), "utf8");
const actionLabel = readFileSync(resolve("lib/team/assignment-action-label.ts"), "utf8");

describe("lead workspace polish", () => {
  it("keeps lead identity strongest with subordinate event metadata", () => {
    assert.match(detail, /RelationshipPhotoAvatar/);
    assert.match(detail, /font-heading text-2xl/);
    assert.match(detail, /data-testid="lead-summary-facts"/);
    assert.match(detail, /eventTypeLabel\(lead\.eventType\)/);
    assert.match(detail, /workspaceDateText\(\{[\s\S]*eventDate: lead\.eventDate/);
    assert.match(detail, /lead\.guestCount\.toLocaleString\(\)/);
    assert.match(detail, /formatCurrency\(lead\.estimatedBudget\)/);
    const facts = detail.slice(
      detail.indexOf('data-testid="lead-summary-facts"'),
      detail.indexOf('data-testid="lead-action-area"'),
    );
    assert.doesNotMatch(facts, /StaffAssignmentField/);
    assert.doesNotMatch(facts, /DateHoldsSection/);
  });

  it("groups pipeline and workflow actions with hierarchy", () => {
    assert.match(detail, /data-testid="lead-action-area"/);
    assert.match(detail, /Pipeline stage/);
    assert.match(detail, /Change stage/);
    assert.match(detail, />\s*Edit\s*</);
    assert.match(detail, /Archive/);
    assert.match(detail, /DeleteRecordButton/);
    assert.match(detail, /data-testid="lead-booking-tour-actions"/);
    assert.match(detail, /Start booking file/);
    assert.match(detail, /Mark as Booked/);
    // Archive / Restore stay ghost + muted vs primary booking actions
    assert.match(detail, /variant="ghost"[\s\S]*?className="text-muted-foreground"[\s\S]*?>\s*Archive\s*</);
  });

  it("places sales owner and date hold in Sales & availability", () => {
    assert.match(detail, /data-testid="lead-sales-availability"/);
    assert.match(detail, /Sales &amp; availability/);
    assert.match(detail, /data-testid="lead-owner-hold-row"/);
    const area = detail.slice(
      detail.indexOf('data-testid="lead-sales-availability"'),
      detail.indexOf('data-testid="lead-followup-contact-row"'),
    );
    assert.match(area, /StaffAssignmentField/);
    assert.match(area, /label="Sales owner"/);
    assert.match(area, /<DateHoldsSection/);
    assert.match(area, /density="compact"/);
    assert.equal(detail.match(/<StaffAssignmentField/g)?.length, 1);
    assert.doesNotMatch(detail, /data-testid="lead-quick-actions"/);
    assert.doesNotMatch(detail, /CardTitle className="text-base">Inquiry details/);
  });

  it("keeps Schedule Tour with booking actions and copy-link on Tour & follow-up", () => {
    assert.match(detail, /TourScheduleActions includeCopyLink=\{false\}/);
    assert.match(detail, /includeSchedule/);
    assert.match(detail, /TourScheduleActions includeSchedule=\{false\}/);
    assert.match(followUp, /Tour &amp; follow-up/);
    assert.match(followUp, /data-testid="lead-tour-followup-card"/);
    assert.match(followUp, /data-testid="tour-followup-tour-block"/);
    assert.match(followUp, /data-testid="tour-followup-followup-block"/);
    assert.match(followUp, /Add tour\/follow-up details/);
    assert.doesNotMatch(followUp, /Add follow-up details/);
    assert.match(detail, /TourAppointmentList/);
    assert.doesNotMatch(detail, /<TourPanel/);
    assert.match(tours, /Schedule Tour/);
    assert.match(tours, /Copy scheduling link/);
  });

  it("orders tour content above follow-up fields in the card", () => {
    const schedulingBlock = followUp.indexOf('data-testid="tour-followup-scheduling-block"');
    const tourBlock = followUp.indexOf('data-testid="tour-followup-tour-block"');
    const followBlock = followUp.indexOf('data-testid="tour-followup-followup-block"');
    assert.ok(schedulingBlock > 0 && tourBlock > schedulingBlock && followBlock > tourBlock);
    assert.match(followUp, /Last contacted/);
    assert.match(followUp, /Actually occurred/);
  });

  it("keeps scheduling link out of the card header and Edit off the scheduling cluster", () => {
    const headerEnd = followUp.indexOf("</CardHeader>");
    const header = followUp.slice(0, headerEnd);
    assert.doesNotMatch(header, /\{tourActions\}/);
    assert.match(followUp, /data-testid="tour-followup-scheduling-block"/);
    assert.match(followUp, /data-testid="tour-followup-edit"/);
    assert.match(tours, /data-testid=\{`tour-appointment-edit-\$\{appt\.id\}`\}/);
    assert.match(tours, /data-testid=\{`tour-appointment-actions-\$\{appt\.id\}`\}/);
    const rowStart = tours.indexOf("function AppointmentRow");
    const row = tours.slice(rowStart, tours.indexOf("type TourScheduleContextValue"));
    const editIdx = row.indexOf("tour-appointment-edit-");
    const actionsIdx = row.indexOf("tour-appointment-actions-");
    assert.ok(editIdx > 0 && actionsIdx > editIdx);
    assert.match(row, />\s*Reschedule\s*</);
    assert.match(row, /Send Confirmation Request/);
    assert.match(row, /Mark as Confirmed/);
  });

  it("uses a responsive Space Preferences grid without a standalone rehearsal date field", () => {
    assert.match(prefs, /data-testid="lead-space-preferences"/);
    assert.match(prefs, /flex w-full min-w-0 flex-wrap/);
    assert.match(prefs, /xl:basis-\[calc\(20%-1rem\)\]/);
    assert.doesNotMatch(prefs, /xl:grid-cols-4/);
    assert.doesNotMatch(prefs, /Rehearsal Dinner Date/);
    assert.doesNotMatch(detail, /Rehearsal Dinner Date/);
  });

  it("keeps Sales owner left and Place another hold on the owner/hold row", () => {
    assert.match(detail, /data-testid="lead-owner-hold-row"/);
    assert.match(detail, /flex min-w-0 flex-wrap items-center gap-x-6/);
    assert.match(detail, /StaffAssignmentField/);
    assert.match(detail, /DateHoldsSection/);
    assert.match(holds, /date-hold-place/);
    assert.match(holds, /shrink-0 whitespace-nowrap/);
    assert.match(holds, /w-fit min-w-0 max-w-full/);
  });

  it("keeps inquiry message in Internal notes", () => {
    assert.match(detail, /function LeadInquiryRecord/);
    assert.match(detail, /origin !== "venue"/);
    assert.match(detail, /<LeadInquiryRecord lead=\{lead\} \/>/);
  });

  it("compact assignment still saves and can stay unassigned", () => {
    assert.match(staff, /__unassigned__/);
    assert.match(staff, /onSave\(next\.trim\(\) \|\| null\)/);
    assert.match(staff, /assignmentActionLabel/);
    assert.match(actionLabel, /Edit\/Save Assignment/);
  });
});
