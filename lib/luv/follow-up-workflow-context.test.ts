/**
 * Follow-up workflow context — tour classify, intent, prompt contract.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { buildFollowUpPrompt } from "@/lib/luv/drafts";
import {
  classifyFollowUpTourState,
  deriveFollowUpProhibitions,
  deriveFollowUpWorkflowIntent,
} from "@/lib/luv/follow-up-workflow-context";
import type { Lead } from "@/lib/leads/types";

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    venueId: "venue-1",
    salesStage: "new_inquiry",
    status: "new_inquiry",
    firstName: "Lucy",
    lastName: "Peanut",
    partnerFirstName: "Charlie",
    partnerLastName: "Brown",
    email: "lucy@example.com",
    phone: null,
    eventType: "wedding",
    eventDate: "2027-07-04",
    guestCount: 150,
    estimatedBudget: null,
    inquiryMessage: null,
    inquiryDate: "2026-09-30",
    lastContactedAt: "2026-09-30",
    nextActionText: null,
    followUpDate: null,
    ...overrides,
  } as Lead;
}

describe("classifyFollowUpTourState", () => {
  it("none when no rows", () => {
    assert.deepEqual(classifyFollowUpTourState([]), { kind: "none" });
  });

  it("upcoming scheduled", () => {
    assert.deepEqual(
      classifyFollowUpTourState([
        { scheduled_at: "2026-10-10T18:00:00Z", status: "scheduled", completed_at: null },
      ]),
      { kind: "upcoming", scheduledAt: "2026-10-10T18:00:00Z", status: "scheduled" },
    );
  });

  it("upcoming confirmed", () => {
    assert.deepEqual(
      classifyFollowUpTourState([
        { scheduled_at: "2026-10-10T18:00:00Z", status: "confirmed", completed_at: null },
      ]),
      { kind: "upcoming", scheduledAt: "2026-10-10T18:00:00Z", status: "confirmed" },
    );
  });

  it("completed", () => {
    assert.deepEqual(
      classifyFollowUpTourState([
        {
          scheduled_at: "2026-09-30T18:45:00Z",
          status: "completed",
          completed_at: "2026-09-30T21:22:13Z",
        },
      ]),
      {
        kind: "completed",
        scheduledAt: "2026-09-30T18:45:00Z",
        completedAt: "2026-09-30T21:22:13Z",
      },
    );
  });

  it("cancelled when only cancelled rows", () => {
    assert.deepEqual(
      classifyFollowUpTourState([
        { scheduled_at: "2026-09-01T15:00:00Z", status: "cancelled", completed_at: null },
      ]),
      { kind: "cancelled", scheduledAt: "2026-09-01T15:00:00Z" },
    );
  });

  it("cancelled historical does not override later completed", () => {
    const state = classifyFollowUpTourState([
      { scheduled_at: "2026-09-01T15:00:00Z", status: "cancelled", completed_at: null },
      {
        scheduled_at: "2026-09-30T18:45:00Z",
        status: "completed",
        completed_at: "2026-09-30T21:22:13Z",
      },
    ]);
    assert.equal(state.kind, "completed");
  });

  it("cancelled historical does not override later upcoming", () => {
    const state = classifyFollowUpTourState([
      { scheduled_at: "2026-09-01T15:00:00Z", status: "cancelled", completed_at: null },
      { scheduled_at: "2026-10-15T18:00:00Z", status: "confirmed", completed_at: null },
    ]);
    assert.equal(state.kind, "upcoming");
    if (state.kind === "upcoming") assert.equal(state.status, "confirmed");
  });
});

describe("deriveFollowUpWorkflowIntent / prohibitions", () => {
  it("completed → never invite to schedule tour; no automatic thank-you", () => {
    const tour = {
      kind: "completed" as const,
      scheduledAt: "2026-09-30T18:45:00Z",
      completedAt: "2026-09-30T21:22:13Z",
    };
    assert.equal(
      deriveFollowUpWorkflowIntent({ tour, nextActionText: null }),
      "no_outreach",
    );
    assert.equal(
      deriveFollowUpWorkflowIntent({ tour, nextActionText: "Follow up after tour" }),
      "no_outreach",
    );
    assert.equal(
      deriveFollowUpWorkflowIntent({
        tour,
        nextActionText: null,
        communicationPurpose: "unresolved_question",
      }),
      "answer_questions",
    );
    const p = deriveFollowUpProhibitions({ tour, proposalSent: false });
    assert.equal(p.inviteToScheduleTour, true);
    assert.equal(p.implyNoTourVisited, true);
  });

  it("upcoming → never invite to schedule first tour", () => {
    const tour = {
      kind: "upcoming" as const,
      scheduledAt: "2026-10-15T18:00:00Z",
      status: "scheduled" as const,
    };
    assert.equal(
      deriveFollowUpWorkflowIntent({ tour, nextActionText: null }),
      "reference_upcoming_tour",
    );
    assert.equal(
      deriveFollowUpProhibitions({ tour, proposalSent: true }).inviteToScheduleTour,
      true,
    );
  });

  it("no tour → schedule may be allowed", () => {
    const tour = { kind: "none" as const };
    assert.equal(
      deriveFollowUpWorkflowIntent({ tour, nextActionText: null }),
      "invite_to_schedule_tour",
    );
    assert.equal(
      deriveFollowUpProhibitions({ tour, proposalSent: false }).inviteToScheduleTour,
      false,
    );
  });

  it("cancelled with no active tour → schedule/reschedule may be allowed", () => {
    const tour = { kind: "cancelled" as const, scheduledAt: "2026-09-01T15:00:00Z" };
    assert.equal(
      deriveFollowUpWorkflowIntent({ tour, nextActionText: null }),
      "invite_to_schedule_tour",
    );
    assert.equal(
      deriveFollowUpProhibitions({ tour, proposalSent: false }).inviteToScheduleTour,
      false,
    );
    assert.equal(
      deriveFollowUpProhibitions({ tour, proposalSent: false }).implyNoTourVisited,
      false,
    );
  });
});

describe("buildFollowUpPrompt — workflow contract", () => {
  it("W1 Lucy-class: completed tour is not a thank-you trigger; no schedule-tour menu", () => {
    const prompt = buildFollowUpPrompt(
      lead({
        salesStage: "proposal_sent",
        status: "proposal_sent",
        nextActionText: "Follow up after tour",
        followUpDate: "2026-10-02",
      }),
      "Jen's Fancy",
      "Jen",
      "warm",
      {
        proposalSent: false,
        tour: {
          kind: "completed",
          scheduledAt: "2026-09-30T18:45:00Z",
          completedAt: "2026-09-30T21:22:13Z",
        },
      },
    );
    assert.match(prompt, /Tour: completed/);
    assert.match(prompt, /Follow up after tour/);
    assert.match(prompt, /Follow-up date: 2026-10-02/);
    assert.match(prompt, /Primary intent: no_outreach/);
    assert.match(prompt, /Do not invite them to schedule a first or another tour/);
    assert.match(prompt, /completed a venue tour/);
    assert.doesNotMatch(prompt, /Primary intent: acknowledge_completed_tour/);
    assert.doesNotMatch(
      prompt,
      /Offer one gentle, specific next step \(schedule a tour, answer questions, arrange a call\)/,
    );
  });

  it("W2 upcoming tour appears; schedule invite prohibited", () => {
    const prompt = buildFollowUpPrompt(
      lead(),
      "Jen's Fancy",
      "Jen",
      "warm",
      {
        proposalSent: false,
        tour: {
          kind: "upcoming",
          scheduledAt: "2026-10-15T18:00:00Z",
          status: "confirmed",
        },
      },
    );
    assert.match(prompt, /Tour: upcoming \(confirmed\)/);
    assert.match(prompt, /Primary intent: reference_upcoming_tour/);
    assert.match(prompt, /Do not invite them to schedule a first or another tour/);
    assert.match(prompt, /upcoming venue tour/);
  });

  it("W3 no tour may permit schedule intent", () => {
    const prompt = buildFollowUpPrompt(lead(), "Jen's Fancy", "Jen", "warm", {
      proposalSent: false,
      tour: { kind: "none" },
    });
    assert.match(prompt, /Tour: none on record/);
    assert.match(prompt, /Primary intent: invite_to_schedule_tour/);
    assert.doesNotMatch(prompt, /Do not invite them to schedule a first or another tour/);
  });

  it("W4 cancelled does not claim completed visit; may permit schedule", () => {
    const prompt = buildFollowUpPrompt(lead(), "Jen's Fancy", "Jen", "warm", {
      proposalSent: false,
      tour: { kind: "cancelled", scheduledAt: "2026-09-01T15:00:00Z" },
    });
    assert.match(prompt, /Tour: cancelled/);
    assert.match(prompt, /no completed visit to claim/);
    assert.match(prompt, /Primary intent: invite_to_schedule_tour/);
    assert.doesNotMatch(prompt, /completed a venue tour/);
  });

  it("W8 unconstrained generic CTA menu is absent from drafts.ts", () => {
    const src = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
    const loader = readFileSync(resolve("lib/luv/follow-up-tour-loader.ts"), "utf8");
    assert.doesNotMatch(
      src,
      /schedule a tour, answer questions, arrange a call/,
    );
    assert.match(src, /loadFollowUpTourState/);
    assert.match(loader, /export async function loadFollowUpTourState/);
    assert.match(loader, /classifyFollowUpTourState/);
    assert.match(src, /deriveFollowUpWorkflowIntent|resolveFollowUpDraftEligibility/);
  });

  it("Gate 2 still applied — Charlie relationship commentary withheld", () => {
    const prompt = buildFollowUpPrompt(
      lead({
        inquiryMessage:
          "Lucy keeping Charlie on his toes sounds like it will make the day even more fun.",
        inquiryMessageOrigin: "customer",
      }),
      "Jen's Fancy",
      "Jen",
      "warm",
      { proposalSent: false, inquiryOrigin: "customer", tour: { kind: "none" } },
    );
    assert.doesNotMatch(prompt, /on his toes/);
    assert.doesNotMatch(prompt, /Customer-provided details/);
  });

  it("Gate 2 useful customer detail survives alongside workflow", () => {
    const prompt = buildFollowUpPrompt(
      lead({
        inquiryMessage: "We love the garden ceremony space.",
        inquiryMessageOrigin: "customer",
      }),
      "Jen's Fancy",
      "Jen",
      "warm",
      {
        proposalSent: false,
        inquiryOrigin: "customer",
        tour: { kind: "none" },
      },
    );
    assert.match(prompt, /We love the garden ceremony space/);
    assert.match(prompt, /Customer-provided details relevant to this follow-up/);
  });
});
