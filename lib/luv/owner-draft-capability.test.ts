/**
 * Workstream 2: draft capability is independent of proactive recommendations.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  evaluateCompletedTour,
  type ThreadMessage,
} from "@/lib/luv/completed-tour-intelligence";
import {
  resolveFollowUpDraftEligibility,
  resolveOwnerDraftCapability,
} from "@/lib/luv/follow-up-draft-eligibility";
import {
  LUV_FOLLOW_UP_OWNER_AVAILABLE,
  LUV_FOLLOW_UP_PROMISE,
  luvPanelDescription,
} from "@/lib/luv/luv-panel-copy";
import { observationsForDraftSurface } from "@/lib/luv/draft-recommendation-surface";
import type { LuvObservation } from "@/lib/luv/types";

const OCCURRED = "2026-10-02T14:00:00.000Z";
const COMPLETED = {
  kind: "completed" as const,
  scheduledAt: "2026-10-01T18:00:00.000Z",
  completedAt: OCCURRED,
};

function msg(partial: Partial<ThreadMessage> & Pick<ThreadMessage, "sentAt" | "senderType" | "body">): ThreadMessage {
  return { channel: "email", ...partial };
}

describe("owner draft capability vs proactive recommendation", () => {
  it("1. eligible active lead with proactive recommendation can draft", () => {
    const gate = resolveFollowUpDraftEligibility({
      tour: { kind: "none" },
      nextActionText: null,
    });
    assert.equal(gate.draftCapable, true);
    assert.equal(gate.proactiveRecommended, true);
    assert.equal(gate.eligible, true);
    assert.equal(
      luvPanelDescription({
        draftCapable: gate.draftCapable,
        proactiveRecommended: gate.proactiveRecommended,
      }),
      LUV_FOLLOW_UP_PROMISE,
    );
  });

  it("2. eligible active lead without proactive recommendation can still draft", () => {
    const decision = evaluateCompletedTour({
      tourId: "t1",
      leadId: "L1",
      contactName: "Wendy",
      occurredAt: OCCURRED,
      proposalSent: false,
      messages: [],
    });
    assert.equal(decision.mode, "silence");
    const gate = resolveFollowUpDraftEligibility({
      tour: COMPLETED,
      nextActionText: null,
      completedDecision: decision,
    });
    assert.equal(gate.proactiveRecommended, false);
    assert.equal(gate.draftCapable, true);
    assert.equal(gate.eligible, true);
    assert.equal(gate.workflowIntent, "gentle_check_in");
    assert.equal(
      luvPanelDescription({
        draftCapable: gate.draftCapable,
        proactiveRecommended: gate.proactiveRecommended,
      }),
      LUV_FOLLOW_UP_OWNER_AVAILABLE,
    );
  });

  it("3. completed tour does not itself disable drafting", () => {
    const gate = resolveFollowUpDraftEligibility({
      tour: COMPLETED,
      nextActionText: "Follow up after tour",
      completedDecision: { mode: "silence", purpose: "none" },
    });
    assert.equal(gate.draftCapable, true);
    assert.equal(gate.proactiveRecommended, false);
  });

  it("4. recommendation visibility and draft capability are independently determined", () => {
    const lost = resolveOwnerDraftCapability({ leadStatus: "lost", lostAt: "2026-10-01T00:00:00Z" });
    assert.equal(lost.draftCapable, false);

    const activeSilence = resolveFollowUpDraftEligibility({
      tour: COMPLETED,
      nextActionText: null,
      completedDecision: { mode: "silence", purpose: "none" },
      leadStatus: "active",
    });
    assert.equal(activeSilence.draftCapable, true);
    assert.equal(activeSilence.proactiveRecommended, false);

    const activeActionable = resolveFollowUpDraftEligibility({
      tour: COMPLETED,
      nextActionText: null,
      completedDecision: {
        mode: "actionable",
        purpose: "unresolved_question",
        excerpt: "Is Saturday setup included?",
      },
      leadStatus: "active",
    });
    assert.equal(activeActionable.draftCapable, true);
    assert.equal(activeActionable.proactiveRecommended, true);
  });

  it("5. unanswered customer question yields answer_questions intent + draft capable", () => {
    const decision = evaluateCompletedTour({
      tourId: "t1",
      leadId: "L1",
      contactName: "Alex",
      occurredAt: OCCURRED,
      proposalSent: false,
      messages: [
        msg({
          sentAt: "2026-10-02T16:00:00.000Z",
          senderType: "lead_or_client",
          body: "Is Saturday setup included with the package?",
        }),
      ],
    });
    const gate = resolveFollowUpDraftEligibility({
      tour: COMPLETED,
      nextActionText: null,
      completedDecision: decision,
    });
    assert.equal(gate.draftCapable, true);
    assert.equal(gate.proactiveRecommended, true);
    assert.equal(gate.workflowIntent, "answer_questions");
    assert.equal(gate.communicationPurpose, "unresolved_question");
  });

  it("6. recent venue outreach → proactive silence, draft still capable", () => {
    const decision = evaluateCompletedTour({
      tourId: "t1",
      leadId: "L1",
      contactName: "Casey",
      occurredAt: OCCURRED,
      proposalSent: false,
      messages: [
        msg({
          sentAt: "2026-10-02T15:00:00.000Z",
          senderType: "venue_staff",
          body: "Thanks for coming by today — let us know if you have questions.",
        }),
      ],
    });
    assert.equal(decision.mode, "silence");
    const gate = resolveFollowUpDraftEligibility({
      tour: COMPLETED,
      nextActionText: null,
      completedDecision: decision,
    });
    assert.equal(gate.proactiveRecommended, false);
    assert.equal(gate.draftCapable, true);
  });

  it("7. generate path uses draftCapable, not proactive silence", () => {
    const drafts = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
    const generateFn = drafts.slice(
      drafts.indexOf("export async function generateFollowUpDraft"),
      drafts.indexOf("export async function deleteDraft"),
    );
    assert.match(generateFn, /if \(!gate\.draftCapable\)/);
    assert.doesNotMatch(generateFn, /if \(!gate\.eligible\)/);
    assert.match(generateFn, /workflowIntent/);
  });

  it("8. lead Luv tab does not double-render Noticed inside the draft panel", () => {
    const leadDetail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
    assert.match(leadDetail, /showContextualObservations=\{false\}/);
    assert.match(leadDetail, /ContextualLuvObservationsPanel/);
    const panel = readFileSync(resolve("components/luv/luv-draft-panel.tsx"), "utf8");
    assert.match(panel, /showContextualObservations/);
  });

  it("9. Oct 12 screenshot: interest + silence cannot coexist after surface assembly", () => {
    const hot: LuvObservation = {
      id: "momentum-hot-ellie",
      kind: "inference",
      priority: "medium",
      message: "Ellie is showing strong interest right now.",
      detail: "Good timing — may be worth following up while the interest is fresh.",
      link: "/leads/e26c3be4",
      recommendation: {
        label: "Ask Luv to draft a follow-up",
        link: "/leads/e26c3be4?luv=follow_up_email",
        type: "draft",
      },
    };
    const out = observationsForDraftSurface([hot, hot], false, { proactiveRecommended: false });
    assert.equal(out.length, 0);
  });

  it("10. privacy: drafts path never loads tour notes or internal notes into prompt", () => {
    const drafts = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
    assert.match(drafts, /customerFacingInquiryContext/);
    assert.doesNotMatch(drafts, /tour\.notes|tour_notes|tourNotes/);
    assert.doesNotMatch(drafts, /internal_notes|internalNotes/);
  });
});
