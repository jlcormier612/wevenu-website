import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { decideEventAssignment } from "@/lib/team/booking-assignment";

const dialog = readFileSync("components/leads/pipeline-booked-confirm-dialog.tsx", "utf8");

const SALES = "staff-sales";
const EVENT = "staff-event";
const OTHER_VENUE = "staff-other-venue";
const eligible = [SALES, EVENT];

describe("booking team assignment", () => {
  it("assigns when the lead had nobody", () => {
    const decision = decideEventAssignment({
      bookingSucceeded: true,
      cancelled: false,
      selectedStaffId: EVENT,
      eligibleStaffIds: eligible,
    });
    assert.deepEqual(decision, { apply: true, staffId: EVENT });
  });

  it("confirms the same person", () => {
    const decision = decideEventAssignment({
      bookingSucceeded: true,
      cancelled: false,
      selectedStaffId: SALES,
      eligibleStaffIds: eligible,
    });
    assert.deepEqual(decision, { apply: true, staffId: SALES });
  });

  it("reassigns to a different eligible person", () => {
    const decision = decideEventAssignment({
      bookingSucceeded: true,
      cancelled: false,
      selectedStaffId: EVENT,
      eligibleStaffIds: eligible,
    });
    assert.equal(decision.apply && decision.staffId, EVENT);
    assert.notEqual(decision.apply && decision.staffId, SALES);
  });

  it("cancel does not apply an assignment", () => {
    const decision = decideEventAssignment({
      bookingSucceeded: false,
      cancelled: true,
      selectedStaffId: EVENT,
      eligibleStaffIds: eligible,
    });
    assert.deepEqual(decision, { apply: false, reason: "cancelled" });
  });

  it("a failed booking does not apply an assignment", () => {
    const decision = decideEventAssignment({
      bookingSucceeded: false,
      cancelled: false,
      selectedStaffId: EVENT,
      eligibleStaffIds: eligible,
    });
    assert.deepEqual(decision, { apply: false, reason: "booking_failed" });
  });

  it("rejects an ineligible or cross-venue staff id", () => {
    const decision = decideEventAssignment({
      bookingSucceeded: true,
      cancelled: false,
      selectedStaffId: OTHER_VENUE,
      eligibleStaffIds: eligible,
    });
    assert.deepEqual(decision, { apply: false, reason: "ineligible" });
  });

  it("allows an explicit unassigned choice", () => {
    const decision = decideEventAssignment({
      bookingSucceeded: true,
      cancelled: false,
      selectedStaffId: null,
      eligibleStaffIds: eligible,
    });
    assert.deepEqual(decision, { apply: true, staffId: null });
  });

  it("omitted selection does not clear an existing event owner", () => {
    const decision = decideEventAssignment({
      bookingSucceeded: true,
      cancelled: false,
      selectedStaffId: undefined,
      eligibleStaffIds: eligible,
    });
    assert.deepEqual(decision, { apply: false, reason: "omitted" });
  });

  it("lead sales owner and event owner are independent fields in confirmation", () => {
    assert.match(dialog, /Event team member/);
    assert.match(dialog, /assignedStaffId: assignedStaffId\.trim\(\) \|\| null/);
    assert.match(dialog, /eventAssigneeSeededRef/);
    assert.match(dialog, /if \(!eventAssigneeSeededRef\.current\)/);
    const service = readFileSync("lib/leads/service.ts", "utf8");
    assert.match(service, /applyEventAssignmentAfterBooking/);
    const returnLead = service.slice(service.indexOf("export async function returnLeadToBooked"));
    const returnClient = service.slice(service.indexOf("export async function returnClientToBooked"));
    assert.match(returnLead, /applyEventAssignmentAfterBooking/);
    assert.match(returnClient, /applyEventAssignmentAfterBooking/);
  });
});

describe("team tab removed from event planning nav", () => {
  const detail = readFileSync("components/events/event-detail.tsx", "utf8");
  const row1Start = detail.indexOf('data-testid="booked-tab-row-1"');
  const row1End = detail.indexOf("</TabsList>", row1Start);
  const row1 = detail.slice(row1Start, row1End);
  const row2Start = detail.indexOf('data-testid="booked-tab-row-2"');
  const row2End = detail.indexOf("</TabsList>", row2Start);
  const row2 = detail.slice(row2Start, row2End);

  it("does not offer Team as a top-level tab", () => {
    assert.doesNotMatch(row1, /TabsTrigger value="team"/);
    assert.doesNotMatch(row2, /TabsTrigger value="team"/);
    assert.doesNotMatch(detail, /TabsTrigger value="team"/);
  });

  it("keeps the other planning tabs", () => {
    // P2-A: Questionnaires / Inventory / Event Order are hash-addressable
    // TabsContent opened from Overview cards — not TabsTrigger rows.
    for (const value of ["overview", "playbook", "timeline", "floorplan", "vendors"]) {
      assert.match(row1, new RegExp(`TabsTrigger value="${value}"`));
    }
    for (const value of ["documents", "invoice", "messages", "activity", "notes", "luv"]) {
      assert.match(row2, new RegExp(`TabsTrigger value="${value}"`));
    }
    assert.doesNotMatch(row1, /TabsTrigger value="questionnaires"/);
    assert.doesNotMatch(row2, /TabsTrigger value="questionnaires"/);
    assert.match(detail, /TabsContent value="questionnaires"/);
    assert.match(detail, /data-testid="open-questionnaires-card"/);
    assert.match(detail, /openWorkspaceSection\("questionnaires"\)/);
  });
});

describe("assignment persistence is a single column write after booking succeeds", () => {
  const service = readFileSync("lib/leads/service.ts", "utf8");
  const confirm = service.slice(service.indexOf("export async function confirmPipelineBookedMove"));

  it("writes the event assignee only after bookClient succeeds", () => {
    const bookAt = confirm.indexOf("bookClient(");
    const failReturn = confirm.indexOf("if (!booked.ok)");
    const assignAt = confirm.indexOf("applyEventAssignmentAfterBooking");
    assert.ok(bookAt > 0 && failReturn > bookAt && assignAt > failReturn);
  });

  it("updates events.assigned_staff_id rather than inserting event_team rows", () => {
    const team = readFileSync("lib/team/staff-assignment.ts", "utf8");
    assert.match(team, /assigned_staff_id/);
    assert.doesNotMatch(team, /event_team/);
  });

  it("rejects cross-venue staff in the database, not only in the picker", () => {
    const sql = readFileSync("supabase/migrations/20261414400000_staff_assignment_same_venue.sql", "utf8");
    assert.match(sql, /assigned staff must be an active member of this venue/);
    assert.match(sql, /leads_assigned_staff_venue_guard/);
    assert.match(sql, /events_assigned_staff_venue_guard/);
    assert.match(sql, /staff_venue is distinct from NEW\.venue_id/);
  });
});
