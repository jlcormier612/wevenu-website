/**
 * Completed-tour intelligence — context drives the outcome, not the trigger.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  completedTourDraftAllowed,
  evaluateCompletedTour,
  looksLikeCustomerQuestion,
  looksLikeExplicitRequest,
  looksLikeThanksOnly,
  type CompletedTourEvalInput,
  type ThreadMessage,
} from "@/lib/luv/completed-tour-intelligence";
import { buildFollowUpPrompt } from "@/lib/luv/drafts";
import { deriveFollowUpWorkflowIntent } from "@/lib/luv/follow-up-workflow-context";
import type { Lead } from "@/lib/leads/types";

const OCCURRED = "2026-10-02T14:00:00.000Z";

function msg(partial: Partial<ThreadMessage> & Pick<ThreadMessage, "sentAt" | "senderType" | "body">): ThreadMessage {
  return {
    channel: "email",
    ...partial,
  };
}

function base(over: Partial<CompletedTourEvalInput> = {}): CompletedTourEvalInput {
  return {
    tourId: "t1",
    leadId: "L1",
    contactName: "Alex",
    occurredAt: OCCURRED,
    proposalSent: false,
    messages: [],
    ...over,
  };
}

function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: "L1",
    venueId: "v1",
    salesStage: "tour_scheduled",
    status: "tour_scheduled",
    firstName: "Alex",
    lastName: "Rivera",
    partnerFirstName: "Jordan",
    partnerLastName: null,
    email: "alex@example.com",
    phone: null,
    eventType: "wedding",
    eventDate: "2027-06-14",
    guestCount: 120,
    estimatedBudget: 25000,
    inquiryMessage: null,
    inquiryDate: "2026-09-01",
    lastContactedAt: null,
    ...over,
  } as Lead;
}

describe("completed tour — different contexts, different outcomes", () => {
  it("1. unresolved customer question → actionable, not generic thank-you", () => {
    const a = evaluateCompletedTour(base({
      messages: [
        msg({
          sentAt: "2026-10-02T16:00:00.000Z",
          senderType: "lead_or_client",
          body: "Can you do Saturday setup for the ceremony?",
        }),
      ],
    }));
    assert.equal(a.mode, "actionable");
    if (a.mode !== "actionable") return;
    assert.equal(a.purpose, "unresolved_question");
    assert.match(a.observation.message, /Saturday setup/);
    assert.match(a.observation.recommendation?.label ?? "", /question/i);
    assert.doesNotMatch(a.observation.message, /follow up while it's fresh/);
    assert.doesNotMatch(a.observation.detail ?? "", /keep momentum/);
    assert.equal(completedTourDraftAllowed(a), true);
  });

  it("2. explicit pricing request, no proposal → actionable request", () => {
    const b = evaluateCompletedTour(base({
      contactName: "Casey",
      messages: [
        msg({
          sentAt: "2026-10-02T16:30:00.000Z",
          senderType: "lead_or_client",
          body: "Please send your pricing and package options when you can.",
        }),
      ],
    }));
    assert.equal(b.mode, "actionable");
    if (b.mode !== "actionable") return;
    assert.equal(b.purpose, "explicit_request");
    assert.match(b.observation.message, /pricing or package/);
    assert.doesNotMatch(b.observation.message, /Saturday setup/);
    assert.doesNotMatch(b.observation.message, /follow up while it's fresh/);
  });

  it("3. proposal already sent + recent venue communication → silence", () => {
    const c = evaluateCompletedTour(base({
      proposalSent: true,
      messages: [
        msg({
          sentAt: "2026-10-02T18:00:00.000Z",
          senderType: "venue_staff",
          body: "Great meeting you today — the proposal is attached.",
        }),
      ],
    }));
    assert.equal(c.mode, "silence");
    assert.equal(completedTourDraftAllowed(c), false);
  });

  it("4. nothing unresolved → silence is correct", () => {
    const d = evaluateCompletedTour(base({ messages: [] }));
    assert.equal(d.mode, "silence");
    assert.equal(completedTourDraftAllowed(d), false);
  });

  it("5. family-pause after tour → contextual, no draft CTA", () => {
    const e = evaluateCompletedTour(base({
      messages: [
        msg({
          sentAt: "2026-10-02T17:00:00.000Z",
          senderType: "lead_or_client",
          body: "We need to talk this over with our parents before we decide.",
        }),
      ],
    }));
    assert.equal(e.mode, "contextual");
    if (e.mode !== "contextual") return;
    assert.match(e.observation.message, /family/);
    assert.equal(e.observation.recommendation, undefined);
    assert.equal(completedTourDraftAllowed(e), false);
  });

  it("6. different contexts do not share observation or recommendation", () => {
    const question = evaluateCompletedTour(base({
      tourId: "tq",
      messages: [
        msg({
          sentAt: "2026-10-02T16:00:00.000Z",
          senderType: "lead_or_client",
          body: "Is Saturday setup included?",
        }),
      ],
    }));
    const pricing = evaluateCompletedTour(base({
      tourId: "tp",
      messages: [
        msg({
          sentAt: "2026-10-02T16:00:00.000Z",
          senderType: "lead_or_client",
          body: "Please send your pricing and package options when you can.",
        }),
      ],
    }));
    const quiet = evaluateCompletedTour(base({ tourId: "tz", messages: [] }));
    assert.equal(question.mode, "actionable");
    assert.equal(pricing.mode, "actionable");
    assert.equal(quiet.mode, "silence");
    if (question.mode === "actionable" && pricing.mode === "actionable") {
      assert.notEqual(question.observation.message, pricing.observation.message);
      assert.notEqual(question.purpose, pricing.purpose);
    }
  });

  it("7. confirmed upcoming tour intent never invites to schedule (draft contract)", () => {
    assert.equal(
      deriveFollowUpWorkflowIntent({
        tour: { kind: "upcoming", scheduledAt: "2026-10-15T18:00:00Z", status: "confirmed" },
        nextActionText: null,
      }),
      "reference_upcoming_tour",
    );
  });

  it("8. post-tour venue message is contact — do not claim no contact / generic follow-up", () => {
    const decision = evaluateCompletedTour(base({
      messages: [
        msg({
          sentAt: "2026-10-02T15:00:00.000Z",
          senderType: "venue_staff",
          body: "So glad we got to walk the garden with you.",
        }),
      ],
    }));
    assert.equal(decision.mode, "silence");
  });

  it("9. pipeline stage booked without stamps does not invent booked silence by itself", () => {
    const decision = evaluateCompletedTour(base({
      booked: false,
      messages: [
        msg({
          sentAt: "2026-10-02T16:00:00.000Z",
          senderType: "lead_or_client",
          body: "What time can we start setup on Saturday?",
        }),
      ],
    }));
    assert.equal(decision.mode, "actionable");
  });

  it("10. internal notes are ignored — privacy", () => {
    const decision = evaluateCompletedTour(base({
      messages: [
        msg({
          sentAt: "2026-10-02T16:00:00.000Z",
          senderType: "venue_staff",
          channel: "internal_note",
          body: "They seemed cheap. Push the gold package.",
        }),
      ],
    }));
    assert.equal(decision.mode, "silence");
    assert.equal(looksLikeCustomerQuestion("They seemed cheap."), false);
  });

  it("11. Gate 2 relationship commentary is not mechanically repeated", () => {
    const decision = evaluateCompletedTour(base({
      messages: [
        msg({
          sentAt: "2026-10-02T16:00:00.000Z",
          senderType: "lead_or_client",
          body: "Lucy keeping Charlie on his toes sounds like it will make the day even more fun.",
        }),
      ],
    }));
    assert.notEqual(decision.mode, "actionable");
    if (decision.mode === "contextual" || decision.mode === "positive") {
      assert.doesNotMatch(decision.observation.message, /on his toes/);
    }
  });

  it("12. proposal-sent factuality: stage is not used; status+offered_at silences generic follow-up", () => {
    const decision = evaluateCompletedTour(base({
      proposalSent: true,
      messages: [],
    }));
    assert.equal(decision.mode, "silence");
  });

  it("thank-you only after tour → silence (not another thank-you draft)", () => {
    assert.equal(looksLikeThanksOnly("Thank you!"), true);
    const decision = evaluateCompletedTour(base({
      messages: [
        msg({
          sentAt: "2026-10-02T16:00:00.000Z",
          senderType: "lead_or_client",
          body: "Thank you!",
        }),
      ],
    }));
    assert.equal(decision.mode, "silence");
  });

  it("completed tour + next-action 'Follow up after tour' is not a draft purpose", () => {
    assert.equal(
      deriveFollowUpWorkflowIntent({
        tour: { kind: "completed", scheduledAt: OCCURRED, completedAt: OCCURRED },
        nextActionText: "Follow up after tour",
      }),
      "no_outreach",
    );
    assert.equal(
      deriveFollowUpWorkflowIntent({
        tour: { kind: "completed", scheduledAt: OCCURRED, completedAt: OCCURRED },
        nextActionText: null,
        communicationPurpose: "unresolved_question",
      }),
      "answer_questions",
    );
  });

  it("draft prompt for an unresolved question is purpose-specific", () => {
    const prompt = buildFollowUpPrompt(lead(), "Fancy", "Jen", "warm", {
      proposalSent: false,
      tour: { kind: "completed", scheduledAt: OCCURRED, completedAt: OCCURRED },
      communicationPurpose: "unresolved_question",
      communicationExcerpt: "Can you do Saturday setup for the ceremony?",
    });
    assert.match(prompt, /Primary intent: answer_questions/);
    assert.match(prompt, /Saturday setup/);
    assert.match(prompt, /Do not write a generic tour thank-you/);
    assert.doesNotMatch(prompt, /Primary intent: acknowledge_completed_tour/);
    assert.doesNotMatch(prompt, /Primary intent: no_outreach/);
  });
});

describe("source lock — canned tour follow-up retired", () => {
  it("observations.ts no longer emits freshness / momentum copy from completion alone", () => {
    const src = readFileSync(resolve("lib/luv/observations.ts"), "utf8");
    assert.doesNotMatch(src, /follow up while it's fresh/);
    assert.doesNotMatch(src, /keep momentum alive/);
    assert.match(src, /evaluateCompletedTour/);
  });

  it("helpers recognize question vs request vs thanks", () => {
    assert.equal(looksLikeCustomerQuestion("Can we start at 2?"), true);
    assert.equal(looksLikeExplicitRequest("Please send a package quote"), true);
    assert.equal(looksLikeThanksOnly("Thanks"), true);
    assert.equal(looksLikeThanksOnly("Can you send a quote?"), false);
  });
});
