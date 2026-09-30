import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildFollowUpPrompt,
  isAuthoritativeProposalSent,
} from "@/lib/luv/drafts";
import type { Lead } from "@/lib/leads/types";

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    venueId: "venue-1",
    salesStage: "proposal_sent",
    status: "proposal_sent",
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
    inquiryMessage: "Looking for a June date",
    inquiryDate: "2026-09-01",
    lastContactedAt: "2026-09-20",
    ...overrides,
  } as Lead;
}

describe("isAuthoritativeProposalSent", () => {
  it("requires status=sent and offered_at", () => {
    assert.equal(isAuthoritativeProposalSent({ status: "sent", offeredAt: "2026-09-20T12:00:00Z" }), true);
    assert.equal(isAuthoritativeProposalSent({ status: "sent", offeredAt: null }), false);
    assert.equal(isAuthoritativeProposalSent({ status: "draft", offeredAt: "2026-09-20T12:00:00Z" }), false);
    assert.equal(isAuthoritativeProposalSent(null), false);
  });
});

describe("buildFollowUpPrompt — proposal factuality", () => {
  it("stage-only: pipeline is workflow context; no verified proposal-sent fact", () => {
    const prompt = buildFollowUpPrompt(lead(), "Jen's Fancy", "Jen", "warm", { proposalSent: false });
    assert.match(prompt, /Pipeline stage \(venue workflow context; not proof that a document or message was sent\): proposal sent/);
    assert.match(prompt, /Do not tell the client that the venue has sent/);
    assert.match(prompt, /do not say a proposal was sent merely because the lead is in proposal_sent/);
    assert.match(prompt, /Verified facts:\*\* none for completed actions/);
    assert.doesNotMatch(prompt, /Verified facts[\s\S]*The proposal was sent to this client/);
    assert.doesNotMatch(prompt, /Pipeline status:/);
  });

  it("verified proposal: includes authoritative proposal-sent fact", () => {
    const prompt = buildFollowUpPrompt(lead(), "Jen's Fancy", "Jen", "warm", { proposalSent: true });
    assert.match(prompt, /Verified facts \(actions proven in the system/);
    assert.match(prompt, /The proposal was sent to this client/);
    assert.match(prompt, /Pipeline stage \(venue workflow context/);
  });

  it("preserves personalization fields", () => {
    const prompt = buildFollowUpPrompt(lead(), "Jen's Fancy", "Jen", "warm", { proposalSent: false });
    assert.match(prompt, /Alex and Jordan/);
    assert.match(prompt, /wedding/);
    assert.match(prompt, /2027-06-14/);
    assert.match(prompt, /120/);
    assert.match(prompt, /\$25,000/);
    assert.match(prompt, /Looking for a June date/);
  });

  it("sales_stage alone never qualifies as proposal sent in source", () => {
    const src = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
    assert.match(src, /isAuthoritativeProposalSent/);
    assert.match(src, /status === "sent"/);
    assert.match(src, /offered_at|offeredAt/);
    assert.match(src, /commercial_proposals/);
    // Stage must not be the sole gate for verified proposal fact.
    const loadFn = src.slice(src.indexOf("async function loadProposalSentFact"));
    assert.doesNotMatch(loadFn.slice(0, 800), /sales_stage/);
  });
});

describe("observations — proposal_sent stage copy", () => {
  it("does not assert Proposal sent from sales_stage alone", () => {
    const src = readFileSync(resolve("lib/luv/observations.ts"), "utf8");
    assert.doesNotMatch(
      src,
      /sales_stage === "proposal_sent" \? "Proposal sent"/,
    );
    assert.match(
      src,
      /sales_stage === "proposal_sent" \? "In Proposal Sent stage"/,
    );
  });
});
