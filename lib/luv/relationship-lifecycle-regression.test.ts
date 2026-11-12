/**
 * Targeted regression matrix for Luv lifecycle communication safety.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveFollowUpDraftEligibility } from "@/lib/luv/follow-up-draft-eligibility";
import {
  classifyFollowUpTourState,
  deriveFollowUpWorkflowIntent,
} from "@/lib/luv/follow-up-workflow-context";
import {
  lifecycleWithdrawnDrafts,
  pendingReviewDrafts,
  withLifecycleWithdrawal,
} from "@/lib/luv/draft-status";
import {
  resolveRelationshipLifecycle,
  shouldWithdrawSalesFollowUpDraft,
} from "@/lib/luv/relationship-lifecycle-eligibility";

const FUTURE = Date.parse("2026-10-01T12:00:00Z");
const AFTER_TOUR = Date.parse("2026-11-12T17:00:00Z");

describe("Luv lifecycle regression matrix", () => {
  it("legitimate unbooked prospect can draft sales follow-up", () => {
    const gate = resolveFollowUpDraftEligibility({
      tour: { kind: "none" },
      nextActionText: null,
      lifecycleFacts: { contractSigned: false, firstBookedAt: null },
    });
    assert.equal(gate.draftCapable, true);
    assert.equal(gate.proactiveRecommended, true);
  });

  it("prospect with upcoming tour → reference_upcoming_tour", () => {
    const tour = classifyFollowUpTourState(
      [{ scheduled_at: "2026-10-10T18:00:00Z", status: "confirmed", completed_at: null }],
      FUTURE,
    );
    const gate = resolveFollowUpDraftEligibility({
      tour,
      nextActionText: null,
      lifecycleFacts: { contractSigned: false },
    });
    assert.equal(gate.draftCapable, true);
    assert.equal(gate.workflowIntent, "reference_upcoming_tour");
  });

  it("prospect with completed tour: owner can still draft; proactive silent", () => {
    const gate = resolveFollowUpDraftEligibility({
      tour: {
        kind: "completed",
        scheduledAt: "2026-10-01T18:00:00Z",
        completedAt: "2026-10-01T20:00:00Z",
      },
      nextActionText: null,
      completedDecision: { mode: "silence", purpose: "none" },
      lifecycleFacts: { contractSigned: false },
    });
    assert.equal(gate.proactiveRecommended, false);
    assert.equal(gate.draftCapable, true);
    assert.equal(gate.workflowIntent, "gentle_check_in");
  });

  it("cancelled tour invites reschedule for prospects", () => {
    const intent = deriveFollowUpWorkflowIntent({
      tour: { kind: "cancelled", scheduledAt: "2026-10-01T18:00:00Z" },
      nextActionText: null,
    });
    assert.equal(intent, "invite_to_schedule_tour");
    const gate = resolveFollowUpDraftEligibility({
      tour: { kind: "cancelled", scheduledAt: "2026-10-01T18:00:00Z" },
      nextActionText: null,
      lifecycleFacts: { contractSigned: false },
    });
    assert.equal(gate.draftCapable, true);
  });

  it("past-due confirmed tour is not reference_upcoming_tour", () => {
    const tour = classifyFollowUpTourState(
      [{ scheduled_at: "2026-11-10T16:15:00Z", status: "confirmed", completed_at: null }],
      AFTER_TOUR,
    );
    assert.equal(tour.kind, "past_due");
    const gate = resolveFollowUpDraftEligibility({
      tour,
      nextActionText: null,
      lifecycleFacts: { contractSigned: false },
    });
    assert.equal(gate.workflowIntent, "invite_to_schedule_tour");
    assert.notEqual(gate.workflowIntent, "reference_upcoming_tour");
  });

  it("Ellie: signed without first_booked_at blocks sales draft generation", () => {
    const tour = classifyFollowUpTourState(
      [{ scheduled_at: "2026-11-10T16:15:00Z", status: "confirmed", completed_at: null }],
      Date.parse("2026-11-08T02:00:00Z"),
    );
    assert.equal(tour.kind, "upcoming");
    const gate = resolveFollowUpDraftEligibility({
      tour,
      nextActionText: null,
      leadStatus: "tour_scheduled",
      lifecycleFacts: {
        firstBookedAt: null,
        contractSigned: true,
        salesStage: "tour_scheduled",
      },
    });
    assert.equal(gate.draftCapable, false);
    assert.equal(gate.proactiveRecommended, false);
    assert.match(gate.capabilityBlockReason ?? "", /signed/i);
  });

  it("officially booked client blocks sales follow-up", () => {
    const gate = resolveFollowUpDraftEligibility({
      tour: { kind: "none" },
      nextActionText: null,
      lifecycleFacts: { firstBookedAt: "2026-11-08T00:00:00Z" },
    });
    assert.equal(gate.draftCapable, false);
    assert.equal(gate.lifecycle?.officiallyBooked, true);
  });

  it("booking after draft generation → withdraw pending sales draft", () => {
    const decision = resolveRelationshipLifecycle({
      firstBookedAt: "2026-11-09T00:00:00Z",
    });
    const w = shouldWithdrawSalesFollowUpDraft({
      draftType: "follow_up_email",
      context: { workflowIntent: "reference_upcoming_tour", communicationPurpose: "none" },
      decision,
    });
    assert.equal(w.withdraw, true);
    const drafts = withLifecycleWithdrawal(
      [{ id: "d1", status: "pending_review" as const }],
      "d1",
      {
        withdrawnAt: "2026-11-09T01:00:00Z",
        reasonCode: w.reasonCode!,
        reason: w.reason!,
      },
    );
    assert.equal(pendingReviewDrafts(drafts).length, 0);
    assert.equal(lifecycleWithdrawnDrafts(drafts).length, 1);
  });

  it("answer_questions remains eligible after commercial commitment", () => {
    const gate = resolveFollowUpDraftEligibility({
      tour: {
        kind: "completed",
        scheduledAt: "2026-10-01T18:00:00Z",
        completedAt: "2026-10-01T20:00:00Z",
      },
      nextActionText: null,
      completedDecision: {
        mode: "actionable",
        purpose: "unresolved_question",
        excerpt: "What is included in catering?",
        observation: {
          id: "obs-1",
          kind: "follow_up",
          title: "Unanswered question",
          detail: "What is included in catering?",
        } as never,
      },
      lifecycleFacts: { contractSigned: true },
    });
    // completedTourDraftAllowed + answer_questions should remain capable
    assert.equal(gate.communicationPurpose, "unresolved_question");
    assert.equal(gate.workflowIntent, "answer_questions");
    assert.equal(gate.draftCapable, true);
  });

  it("lost / archived / consent / past event / cancel blocks", () => {
    assert.equal(
      resolveFollowUpDraftEligibility({
        tour: { kind: "none" },
        nextActionText: null,
        lostAt: "2026-01-01T00:00:00Z",
      }).draftCapable,
      false,
    );
    assert.equal(
      resolveRelationshipLifecycle({ channelConsentOk: false }).salesFollowUpAllowed,
      false,
    );
    assert.equal(
      resolveRelationshipLifecycle({
        firstBookedAt: "2026-01-01T00:00:00Z",
        eventDatePast: true,
      }).communicationRelationshipState,
      "past_event",
    );
    assert.equal(
      resolveRelationshipLifecycle({ bookingCancelled: true }).salesFollowUpBlockReasonCode,
      "booking_cancelled",
    );
  });

  it("queue counts: withdrawn drafts leave pending_review status but exit actionable queue", () => {
    const rows = [
      { id: "a", status: "pending_review" as const },
      {
        id: "b",
        status: "pending_review" as const,
        lifecycleWithdrawal: {
          withdrawnAt: "2026-11-12T00:00:00Z",
          reasonCode: "contract_signed",
          reason: "signed",
        },
      },
      { id: "c", status: "accepted" as const },
    ];
    assert.deepEqual(pendingReviewDrafts(rows).map((d) => d.id), ["a"]);
    assert.deepEqual(lifecycleWithdrawnDrafts(rows).map((d) => d.id), ["b"]);
  });

  it("does not invent Booked from sales_stage=booked alone", () => {
    const gate = resolveFollowUpDraftEligibility({
      tour: { kind: "none" },
      nextActionText: null,
      lifecycleFacts: { salesStage: "booked", firstBookedAt: null, contractSigned: false },
    });
    assert.equal(gate.draftCapable, true);
  });
});
