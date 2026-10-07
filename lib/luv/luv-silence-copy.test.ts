/**
 * Completed-tour silence copy. Eligibility and discard stay as they are.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  draftHistoryDrafts,
  pendingReviewDrafts,
  withoutDraft,
} from "@/lib/luv/draft-status";
import type { LuvDraft } from "@/lib/luv/drafts";
import {
  evaluateCompletedTour,
  type ThreadMessage,
} from "@/lib/luv/completed-tour-intelligence";
import { resolveFollowUpDraftEligibility } from "@/lib/luv/follow-up-draft-eligibility";
import {
  LUV_FOLLOW_UP_PROMISE,
  LUV_FOLLOW_UP_SILENCE,
  luvPanelDescription,
} from "@/lib/luv/luv-panel-copy";

const OCCURRED = "2026-10-02T14:00:00.000Z";
const COMPLETED = {
  kind: "completed" as const,
  scheduledAt: "2026-10-01T18:00:00.000Z",
  completedAt: OCCURRED,
};

const panel = readFileSync(resolve("components/luv/luv-draft-panel.tsx"), "utf8");
const leadDetail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
const draftsSrc = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
const eligibilitySrc = readFileSync(resolve("lib/luv/follow-up-draft-eligibility.ts"), "utf8");

function msg(partial: Partial<ThreadMessage> & Pick<ThreadMessage, "sentAt" | "senderType" | "body">): ThreadMessage {
  return { channel: "email", ...partial };
}

function draft(id: string): LuvDraft {
  return {
    id,
    entityType: "lead",
    entityId: "lead-1",
    draftType: "follow_up_email",
    subject: "Checking in",
    content: "Hi there",
    status: "pending_review",
    createdAt: "2026-10-03T12:00:00.000Z",
  };
}

function ctaBlock(): string {
  const start = panel.indexOf("{followUpDraftEligible && (");
  const end = panel.indexOf("{/* Pending drafts */}");
  assert.ok(start > 0 && end > start);
  return panel.slice(start, end);
}

describe("Luv silence copy alignment", () => {
  it("A. no tour and zero drafts keeps the CTA and the existing promise", () => {
    const gate = resolveFollowUpDraftEligibility({
      tour: { kind: "none" },
      nextActionText: null,
    });
    assert.equal(gate.eligible, true);
    assert.equal(pendingReviewDrafts([]).length, 0);
    assert.equal(luvPanelDescription(gate.eligible), LUV_FOLLOW_UP_PROMISE);
    assert.match(ctaBlock(), /Draft a follow-up email/);
    assert.match(leadDetail, /luvPanelDescription\(followUpDraftEligible\)/);
  });

  it("B. eligible lead after discard still offers the CTA and writes no history", () => {
    const before = [draft("pending-1")];
    assert.equal(pendingReviewDrafts(before).length, 1);
    const after = withoutDraft(before, "pending-1");
    assert.equal(after.length, 0);
    assert.equal(draftHistoryDrafts(after).length, 0);
    assert.equal(pendingReviewDrafts(after).length, 0);
    const gate = resolveFollowUpDraftEligibility({
      tour: { kind: "none" },
      nextActionText: null,
    });
    assert.equal(gate.eligible, true);
    assert.match(ctaBlock(), /Draft a follow-up email/);
    assert.equal(luvPanelDescription(true), LUV_FOLLOW_UP_PROMISE);
  });

  it("C. completed tour silence hides the CTA and the draft promise", () => {
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
    assert.equal(gate.eligible, false);
    const copy = luvPanelDescription(gate.eligible);
    assert.equal(copy, LUV_FOLLOW_UP_SILENCE);
    assert.equal(copy.includes("can help draft a follow-up"), false);
    assert.equal(copy.includes("Draft a follow-up"), false);
    assert.match(ctaBlock(), /followUpDraftEligible &&/);
  });

  it("D. completed tour with an unanswered question keeps the CTA", () => {
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
    assert.equal(gate.eligible, true);
    assert.equal(gate.communicationPurpose, "unresolved_question");
    assert.equal(luvPanelDescription(gate.eligible), LUV_FOLLOW_UP_PROMISE);
    assert.match(ctaBlock(), /Draft a follow-up email/);
  });

  it("E. an ineligible lead still shows a pending draft, then silence after discard", () => {
    const before = [draft("stale")];
    assert.deepEqual(pendingReviewDrafts(before).map((d) => d.id), ["stale"]);
    const pendingIdx = panel.indexOf("{/* Pending drafts */}");
    const ctaIdx = panel.indexOf("{followUpDraftEligible && (");
    assert.ok(pendingIdx > ctaIdx);
    assert.match(panel.slice(pendingIdx), /pendingDrafts\.map/);

    const after = withoutDraft(before, "stale");
    assert.equal(after.length, 0);
    assert.equal(draftHistoryDrafts(after).length, 0);
    const gate = resolveFollowUpDraftEligibility({
      tour: COMPLETED,
      nextActionText: null,
      completedDecision: { mode: "silence", purpose: "none" },
    });
    assert.equal(gate.eligible, false);
    assert.equal(luvPanelDescription(gate.eligible), LUV_FOLLOW_UP_SILENCE);
    assert.doesNotMatch(ctaBlock(), /followUpDraftEligible === false[\s\S]*Draft a follow-up email/);
  });

  it("F. pricing request with no proposal stays actionable and keeps the CTA", () => {
    const decision = evaluateCompletedTour({
      tourId: "t1",
      leadId: "L1",
      contactName: "Casey",
      occurredAt: OCCURRED,
      proposalSent: false,
      messages: [
        msg({
          sentAt: "2026-10-02T16:30:00.000Z",
          senderType: "lead_or_client",
          body: "Please send your pricing and package options when you can.",
        }),
      ],
    });
    assert.equal(decision.mode, "actionable");
    const gate = resolveFollowUpDraftEligibility({
      tour: COMPLETED,
      nextActionText: null,
      completedDecision: decision,
    });
    assert.equal(gate.eligible, true);
    assert.equal(gate.communicationPurpose, "explicit_request");
    assert.equal(luvPanelDescription(gate.eligible), LUV_FOLLOW_UP_PROMISE);
    assert.match(ctaBlock(), /Draft a follow-up email/);
  });

  it("G. Follow up after tour does not override completed-tour silence", () => {
    const decision = evaluateCompletedTour({
      tourId: "t1",
      leadId: "L1",
      contactName: "Wendy",
      occurredAt: OCCURRED,
      proposalSent: false,
      messages: [],
    });
    const gate = resolveFollowUpDraftEligibility({
      tour: COMPLETED,
      nextActionText: "Follow up after tour",
      completedDecision: decision,
    });
    assert.equal(gate.eligible, false);
    assert.equal(gate.workflowIntent, "no_outreach");
    assert.equal(luvPanelDescription(gate.eligible), LUV_FOLLOW_UP_SILENCE);
    assert.match(eligibilitySrc, /completedTourDraftAllowed/);
  });

  it("H. discard does not record a drafted state, so an eligible lead can draft again", () => {
    const deleteFn = draftsSrc.slice(draftsSrc.indexOf("export async function deleteDraft"));
    assert.match(deleteFn, /\.delete\(\)/);
    assert.doesNotMatch(deleteFn.slice(0, 1500), /status:\s*"discarded"/);
    assert.doesNotMatch(deleteFn.slice(0, 1500), /\.insert\(/);

    const generateFn = draftsSrc.slice(
      draftsSrc.indexOf("export async function generateFollowUpDraft"),
      draftsSrc.indexOf("if (!gate.eligible)"),
    );
    assert.match(generateFn, /resolveFollowUpDraftEligibility/);
    assert.doesNotMatch(generateFn, /from\("luv_drafts"\)/);
    assert.doesNotMatch(eligibilitySrc, /luv_drafts/);

    let drafts = [draft("old")];
    drafts = withoutDraft(drafts, "old");
    assert.equal(draftHistoryDrafts(drafts).length, 0);
    drafts = [draft("again"), ...drafts];
    assert.deepEqual(pendingReviewDrafts(drafts).map((d) => d.id), ["again"]);
    const gate = resolveFollowUpDraftEligibility({
      tour: { kind: "none" },
      nextActionText: null,
    });
    assert.equal(gate.eligible, true);
    assert.match(panel, /Draft another/);
  });
});
