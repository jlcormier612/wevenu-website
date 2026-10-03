/**
 * Completed-tour Thoughts + draft CTA alignment.
 *
 * Wendy-class: completed tour, silence drafting, young lead — must not render
 * Stage-1 NEW LEAD, and CTA must not appear when eligibility is false.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  completedTourDraftAllowed,
  evaluateCompletedTour,
  type CompletedTourEvalInput,
  type ThreadMessage,
} from "@/lib/luv/completed-tour-intelligence";
import { resolveFollowUpDraftEligibility } from "@/lib/luv/follow-up-draft-eligibility";
import { followUpTourStateFromAppointments } from "@/lib/luv/follow-up-presentation";
import { classifyFollowUpTourState } from "@/lib/luv/follow-up-workflow-context";
import { getConfidenceStage } from "@/lib/leads/momentum";
import type { TourAppointment } from "@/lib/tours/types";

const OCCURRED = "2026-10-02T14:00:00.000Z";
const card = readFileSync(resolve("components/luv/lead-momentum-card.tsx"), "utf8");
const panel = readFileSync(resolve("components/luv/luv-draft-panel.tsx"), "utf8");
const actions = readFileSync(resolve("app/(app)/leads/[id]/actions.ts"), "utf8");

function msg(
  partial: Partial<ThreadMessage> & Pick<ThreadMessage, "sentAt" | "senderType" | "body">,
): ThreadMessage {
  return { channel: "email", ...partial };
}

function base(over: Partial<CompletedTourEvalInput> = {}): CompletedTourEvalInput {
  return {
    tourId: "t1",
    leadId: "L1",
    contactName: "Wendy",
    occurredAt: OCCURRED,
    followUpSentAt: null,
    proposalSent: false,
    messages: [],
    inquiryMessage: "Venue-originated outreach about availability.",
    inquiryOrigin: "venue",
    ...over,
  };
}

function appt(partial: Partial<TourAppointment> & Pick<TourAppointment, "id" | "status">): TourAppointment {
  return {
    venueId: "v1",
    leadId: "L1",
    scheduledAt: "2026-10-01T18:00:00.000Z",
    actualOccurredAt: OCCURRED,
    origin: "scheduled",
    durationMinutes: 60,
    contactName: "Wendy",
    contactEmail: null,
    contactPhone: null,
    eventType: null,
    eventDate: null,
    guestCount: null,
    notes: "Private staff notes — loved the patio",
    assignedTo: null,
    confirmedAt: null,
    completedAt: OCCURRED,
    followUpSentAt: null,
    outcome: null,
    cancellationReason: null,
    createdAt: "2026-09-30T12:00:00.000Z",
    confirmationRequestedAt: null,
    confirmationSource: null,
    isArchived: false,
    ...partial,
  };
}

describe("completed-tour Thoughts presentation wiring", () => {
  it("1. Wendy-class: completed + young + observing scores never use NEW LEAD shell", () => {
    const tour = classifyFollowUpTourState([
      {
        scheduled_at: "2026-10-01T18:00:00.000Z",
        status: "completed",
        completed_at: OCCURRED,
      },
    ]);
    assert.equal(tour.kind, "completed");

    // Same score band that previously fell through ≤3-day override → "new"
    const stage = getConfidenceStage(10, 10, 20);
    assert.equal(stage, "observing");

    assert.match(card, /tour\.kind === "completed"/);
    assert.match(card, /CompletedTourView/);
    assert.match(card, /Tour on record/);
    assert.match(card, /has toured the venue/);
    assert.doesNotMatch(card, /loved the venue|excited|liked the|approved/i);
    // Completed/upcoming branches must precede the ≤3-day NEW override
    const completedIdx = card.indexOf('tour.kind === "completed"');
    const ageIdx = card.indexOf("daysOld !== null && daysOld <= 3");
    assert.ok(completedIdx > 0 && ageIdx > completedIdx);
  });

  it("2. Wendy-class: evaluateCompletedTour SILENCE + draft CTA not eligible", () => {
    const decision = evaluateCompletedTour(base({ messages: [] }));
    assert.equal(decision.mode, "silence");
    assert.equal(completedTourDraftAllowed(decision), false);

    const gate = resolveFollowUpDraftEligibility({
      tour: {
        kind: "completed",
        scheduledAt: "2026-10-01T18:00:00.000Z",
        completedAt: OCCURRED,
      },
      nextActionText: "Follow up after tour",
      completedDecision: decision,
    });
    assert.equal(gate.eligible, false);
    assert.equal(gate.workflowIntent, "no_outreach");

    assert.match(panel, /followUpDraftEligible/);
    assert.match(panel, /\{followUpDraftEligible && \(/);
  });

  it("3. complete_scheduled / tourCompleted refreshes lead score without post-tour automation", () => {
    const updateFn = actions.slice(actions.indexOf("export async function updateRelationshipAction"));
    const body = updateFn.slice(0, updateFn.indexOf("export async function completeFollowUpAction"));
    assert.match(body, /input\.tourCompleted/);
    assert.match(body, /refreshLeadScore/);
    assert.doesNotMatch(body, /runPostTourAutomation/);
    assert.doesNotMatch(body, /updateTourStatus/);
  });

  it("4. True new lead (no tour) still allowed Stage-1 NEW LEAD path", () => {
    assert.match(card, /NewInquiryView/);
    assert.match(card, /newLeadBeginningSentence/);
    // Age override remains for no-tour relationships
    assert.match(card, /daysOld !== null && daysOld <= 3 && stage === "observing"/);
    const tour = classifyFollowUpTourState([]);
    assert.equal(tour.kind, "none");
    const gate = resolveFollowUpDraftEligibility({
      tour,
      nextActionText: null,
      completedDecision: null,
    });
    assert.equal(gate.eligible, true);
    assert.equal(gate.workflowIntent, "invite_to_schedule_tour");
  });

  it("5. Completed + unanswered customer question → ACTION + draft eligible", () => {
    const decision = evaluateCompletedTour(base({
      inquiryMessage: null,
      inquiryOrigin: "unknown",
      messages: [
        msg({
          sentAt: "2026-10-02T16:00:00.000Z",
          senderType: "lead_or_client",
          body: "Is Saturday setup included with the package?",
        }),
      ],
    }));
    assert.equal(decision.mode, "actionable");
    if (decision.mode !== "actionable") return;
    assert.equal(decision.purpose, "unresolved_question");
    assert.match(decision.excerpt ?? "", /Saturday setup/i);

    const gate = resolveFollowUpDraftEligibility({
      tour: {
        kind: "completed",
        scheduledAt: "2026-10-01T18:00:00.000Z",
        completedAt: OCCURRED,
      },
      nextActionText: null,
      completedDecision: decision,
    });
    assert.equal(gate.eligible, true);
    assert.equal(gate.workflowIntent, "answer_questions");
    assert.equal(gate.communicationPurpose, "unresolved_question");
  });

  it("6. Completed + venue outbound after tour → SILENCE + no draft CTA", () => {
    const decision = evaluateCompletedTour(base({
      messages: [
        msg({
          sentAt: "2026-10-02T15:00:00.000Z",
          senderType: "venue_staff",
          body: "Thanks for coming by today — let us know if you have questions.",
        }),
      ],
    }));
    assert.equal(decision.mode, "silence");
    const gate = resolveFollowUpDraftEligibility({
      tour: {
        kind: "completed",
        scheduledAt: "2026-10-01T18:00:00.000Z",
        completedAt: OCCURRED,
      },
      nextActionText: null,
      completedDecision: decision,
    });
    assert.equal(gate.eligible, false);
  });

  it("7. Upcoming/confirmed tour recognized as upcoming, never completed", () => {
    const state = followUpTourStateFromAppointments([
      appt({ id: "u1", status: "confirmed", completedAt: null, actualOccurredAt: null }),
    ]);
    assert.equal(state.kind, "upcoming");
    if (state.kind === "upcoming") assert.equal(state.status, "confirmed");

    assert.match(card, /tour\.kind === "upcoming"/);
    assert.match(card, /UpcomingTourView/);
    assert.match(card, /has not taken place yet/);
    assert.doesNotMatch(
      card.slice(card.indexOf("function UpcomingTourView")),
      /has toured the venue/,
    );

    const gate = resolveFollowUpDraftEligibility({
      tour: state,
      nextActionText: null,
    });
    assert.equal(gate.eligible, true);
    assert.equal(gate.workflowIntent, "reference_upcoming_tour");
  });

  it("8. Privacy: venue-origin inquiry + private tour notes stay out of customer-facing prompt path", () => {
    const drafts = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
    // Inquiry still gated; notes never loaded for drafts
    assert.match(drafts, /customerFacingInquiryContext/);
    assert.match(drafts, /normalizeInquiryMessageOrigin/);
    assert.doesNotMatch(drafts, /tour\.notes|tour_notes|tourNotes/);
    assert.doesNotMatch(
      readFileSync(resolve("lib/luv/follow-up-presentation.ts"), "utf8"),
      /\.notes|tourNotes/,
    );
  });

  it("9. Follow up after tour remains workflow metadata — not a customer-facing purpose", () => {
    const decision = evaluateCompletedTour(base({ messages: [] }));
    const gate = resolveFollowUpDraftEligibility({
      tour: {
        kind: "completed",
        scheduledAt: "2026-10-01T18:00:00.000Z",
        completedAt: OCCURRED,
      },
      nextActionText: "Follow up after tour",
      completedDecision: decision,
    });
    assert.equal(gate.eligible, false);
    assert.equal(gate.communicationPurpose, "none");
    assert.equal(gate.workflowIntent, "no_outreach");
  });

  it("10. Shared architecture: Thoughts + drafts use FollowUpTourState / loadFollowUpTourState", () => {
    assert.match(card, /FollowUpTourState/);
    assert.match(panel, /followUpTour/);
    const drafts = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
    assert.match(drafts, /from "@\/lib\/luv\/follow-up-tour-loader"/);
    assert.match(drafts, /resolveFollowUpDraftEligibility/);
    const loader = readFileSync(resolve("lib/luv/follow-up-tour-loader.ts"), "utf8");
    assert.match(loader, /classifyFollowUpTourState/);
  });
});
