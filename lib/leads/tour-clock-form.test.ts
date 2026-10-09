/**
 * Relationship form initial values — scheduled vs actual must stay distinct
 * for the Oct 11 / Oct 9 acceptance case.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createInitialRelationshipInput } from "@/lib/leads/constants";
import type { Lead } from "@/lib/leads/types";

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    venueId: "v1",
    salesStage: "tour_completed",
    status: "tour_completed",
    pipelineStageId: null,
    source: "inquiry_form",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phone: null,
    preferredCommunicationChannels: [],
    partnerFirstName: null,
    partnerLastName: null,
    partnerEmail: null,
    eventType: "wedding",
    eventDate: null,
    plannedEventSpaceId: null,
    endDate: null,
    guestCount: null,
    estimatedBudget: null,
    inquiryMessage: null,
    inquiryDate: "2026-09-01",
    nextActionText: "Follow up after tour",
    nextActionDue: null,
    followUpDate: "2026-10-12",
    lastContactedAt: null,
    tourDate: "2026-10-09",
    tourTime: "14:00",
    tourCompleted: true,
    tourNotes: "Internal only",
    tourScheduledDate: "2026-10-11",
    tourScheduledTime: "14:00",
    tourActualDate: "2026-10-09",
    tourActualTime: "14:00",
    tourCompletedAt: "2026-10-09T19:30:00.000Z",
    commitmentScore: 0,
    responsivenessScore: 0,
    interestScore: 0,
    scoresUpdatedAt: null,
    sourceData: null,
    relationshipId: null,
    intakeConfidence: null,
    lostReason: null,
    lostReasonDetail: null,
    lostAt: null,
    firstBookedAt: null,
    venueSeenAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-10-09T19:30:00.000Z",
    ...overrides,
  } as Lead;
}

describe("createInitialRelationshipInput — three clocks", () => {
  it("keeps scheduled appointment separate from actual occurrence", () => {
    const input = createInitialRelationshipInput(lead());
    assert.equal(input.tourDate, "2026-10-11");
    assert.equal(input.tourTime, "14:00");
    assert.equal(input.tourActualDate, "2026-10-09");
    assert.equal(input.tourActualTime, "14:00");
    assert.equal(input.tourCompleted, true);
    assert.equal(input.followUpDate, "2026-10-12");
    assert.equal(input.tourNotes, "Internal only");
  });

  it("does not invent actual from completion when only scheduled exists", () => {
    const input = createInitialRelationshipInput(lead({
      tourCompleted: false,
      tourDate: "2026-10-11",
      tourTime: "14:00",
      tourScheduledDate: "2026-10-11",
      tourScheduledTime: "14:00",
      tourActualDate: null,
      tourActualTime: null,
      tourCompletedAt: null,
    }));
    assert.equal(input.tourDate, "2026-10-11");
    assert.equal(input.tourCompleted, false);
    // Actual prepopulates from scheduled for the form default only when completed later.
    assert.equal(input.tourActualDate, "2026-10-11");
  });
});
