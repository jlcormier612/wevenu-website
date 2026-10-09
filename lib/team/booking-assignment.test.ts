import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { decideEventAssignment } from "@/lib/team/booking-assignment";

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
});

describe("team tab removed from event planning nav", () => {
  const detail = readFileSync("components/events/event-detail.tsx", "utf8");
  const start = detail.indexOf("<TabsList");
  const end = detail.indexOf("</TabsList>", start);
  const list = detail.slice(start, end);

  it("does not offer Team as a top-level tab", () => {
    assert.doesNotMatch(list, /TabsTrigger value="team"/);
  });

  it("keeps the other planning tabs", () => {
    for (const value of ["overview", "playbook", "timeline", "floorplan", "vendors", "questionnaires", "documents", "invoice", "messages"]) {
      assert.match(list, new RegExp(`TabsTrigger value="${value}"`));
    }
  });
});

describe("assignment persistence is a single column write after booking succeeds", () => {
  const service = readFileSync("lib/leads/service.ts", "utf8");
  const confirm = service.slice(service.indexOf("export async function confirmPipelineBookedMove"));

  it("writes the event assignee only after bookClient succeeds", () => {
    const bookAt = confirm.indexOf("bookClient(");
    const failReturn = confirm.indexOf("if (!booked.ok)");
    const assignAt = confirm.indexOf("persistEventStaffAssignment");
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
