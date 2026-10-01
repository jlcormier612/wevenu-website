/**
 * Luv customer-facing draft context — provenance + discard decisions.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import type { LuvDraft } from "@/lib/luv/drafts";
import { buildFollowUpPrompt } from "@/lib/luv/drafts";
import {
  applyDiscardResult,
  draftHistoryDrafts,
  pendingReviewDrafts,
} from "@/lib/luv/draft-status";
import {
  customerFacingInquiryMessage,
  inquiryOriginFromTrustTier,
  isCustomerOriginatedTrustTier,
  resolveDraftDeleteDecision,
} from "@/lib/luv/draft-context-boundary";
import type { Lead } from "@/lib/leads/types";

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    venueId: "venue-1",
    salesStage: "new_inquiry",
    status: "new_inquiry",
    firstName: "Lucy",
    lastName: "Chen",
    partnerFirstName: "Charlie",
    partnerLastName: null,
    email: "lucy@example.com",
    phone: null,
    eventType: "wedding",
    eventDate: "2027-08-14",
    guestCount: 80,
    estimatedBudget: 18000,
    inquiryMessage: "We love the garden and want a Saturday in August.",
    inquiryDate: "2026-09-01",
    lastContactedAt: null,
    ...overrides,
  } as Lead;
}

function draft(partial: Partial<LuvDraft> & Pick<LuvDraft, "id" | "status">): LuvDraft {
  return {
    entityType: "lead",
    entityId: "lead-1",
    draftType: "follow_up_email",
    subject: "Checking in",
    content: "Hi there…",
    createdAt: "2026-09-29T12:00:00.000Z",
    ...partial,
  };
}

describe("inquiry origin from intake trust tier", () => {
  it("treats direct, webhook, and email_parsed as customer-originated", () => {
    assert.equal(isCustomerOriginatedTrustTier("direct"), true);
    assert.equal(isCustomerOriginatedTrustTier("webhook"), true);
    assert.equal(isCustomerOriginatedTrustTier("email_parsed"), true);
    assert.equal(inquiryOriginFromTrustTier("direct"), "customer");
  });

  it("treats manual, import, missing, and unknown as venue-internal", () => {
    assert.equal(isCustomerOriginatedTrustTier("manual"), false);
    assert.equal(isCustomerOriginatedTrustTier("import"), false);
    assert.equal(isCustomerOriginatedTrustTier(null), false);
    assert.equal(isCustomerOriginatedTrustTier(undefined), false);
    assert.equal(isCustomerOriginatedTrustTier("website"), false);
    assert.equal(inquiryOriginFromTrustTier("manual"), "venue");
    assert.equal(inquiryOriginFromTrustTier(null), "venue");
  });
});

describe("customerFacingInquiryMessage — venue-originated excluded before generation", () => {
  const SENSITIVE = "SSN-CANARY-7741 do not tell the couple about the credit hold";
  const INNOCUOUS = "Called back Tuesday; seems lovely.";

  it("excludes a sensitive venue-entered note", () => {
    assert.equal(customerFacingInquiryMessage(SENSITIVE, "venue"), null);
  });

  it("excludes an innocuous venue-entered note", () => {
    assert.equal(customerFacingInquiryMessage(INNOCUOUS, "venue"), null);
  });

  it("keeps a customer-originated inquiry available for personalization", () => {
    assert.equal(
      customerFacingInquiryMessage("We love the garden and want a Saturday in August.", "customer"),
      "We love the garden and want a Saturday in August.",
    );
  });

  it("does not treat leads.source as provenance", () => {
    // Staff can pick "website" on New Lead; that is not customer authorship.
    assert.equal(inquiryOriginFromTrustTier("website"), "venue");
  });
});

describe("buildFollowUpPrompt — source boundary", () => {
  const SENSITIVE = "SSN-CANARY-7741 do not tell the couple about the credit hold";
  const INNOCUOUS = "Called back Tuesday; seems lovely.";
  const AWKWARD = "Lucy keeping Charlie on his toes sounds like it will make the day even more fun.";
  const USEFUL = "We love the garden and want a Saturday in August.";

  it("does not put a sensitive venue note in generation context", () => {
    const prompt = buildFollowUpPrompt(
      lead({ inquiryMessage: SENSITIVE }),
      "Jen's Fancy",
      "Jen",
      "warm",
      { proposalSent: false, inquiryOrigin: "venue" },
    );
    assert.doesNotMatch(prompt, /SSN-CANARY-7741/);
    assert.doesNotMatch(prompt, /credit hold/);
    assert.doesNotMatch(prompt, /Their original message/);
  });

  it("does not put an innocuous venue note in generation context", () => {
    const prompt = buildFollowUpPrompt(
      lead({ inquiryMessage: INNOCUOUS }),
      "Jen's Fancy",
      "Jen",
      "warm",
      { proposalSent: false, inquiryOrigin: "venue" },
    );
    assert.doesNotMatch(prompt, /Called back Tuesday/);
    assert.doesNotMatch(prompt, /seems lovely/);
  });

  it("defaults missing origin to venue (fail closed)", () => {
    const prompt = buildFollowUpPrompt(
      lead({ inquiryMessage: SENSITIVE }),
      "Jen's Fancy",
      "Jen",
      "warm",
      { proposalSent: false },
    );
    assert.doesNotMatch(prompt, /SSN-CANARY-7741/);
  });

  it("includes customer-originated inquiry for potential personalization", () => {
    const prompt = buildFollowUpPrompt(
      lead({ inquiryMessage: USEFUL }),
      "Jen's Fancy",
      "Jen",
      "warm",
      { proposalSent: false, inquiryOrigin: "customer" },
    );
    assert.match(prompt, /We love the garden and want a Saturday in August/);
    assert.match(prompt, /Customer-originated inquiry/);
    assert.match(prompt, /GATE 1/);
    assert.match(prompt, /GATE 2/);
  });

  it("includes awkward customer detail in context but requires judgment not to echo", () => {
    const prompt = buildFollowUpPrompt(
      lead({ inquiryMessage: AWKWARD }),
      "Jen's Fancy",
      "Jen",
      "warm",
      { proposalSent: false, inquiryOrigin: "customer" },
    );
    assert.match(prompt, /Lucy keeping Charlie on his toes/);
    assert.match(prompt, /awkward callback/);
    assert.match(prompt, /Do not repeat their message mechanically/);
  });

  it("still personalizes from structured lead fields without venue notes", () => {
    const prompt = buildFollowUpPrompt(
      lead({ inquiryMessage: INNOCUOUS }),
      "Jen's Fancy",
      "Jen",
      "warm",
      { proposalSent: false, inquiryOrigin: "venue" },
    );
    assert.match(prompt, /Lucy and Charlie/);
    assert.match(prompt, /wedding/);
    assert.match(prompt, /2027-08-14/);
    assert.match(prompt, /80/);
  });
});

describe("generateFollowUpDraft never loads venue lead notes", () => {
  it("does not query lead_notes and resolves origin from intake trust_tier", () => {
    const src = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
    assert.doesNotMatch(src, /lead_notes/);
    assert.match(src, /loadInquiryOrigin/);
    assert.match(src, /lead_intake_attempts/);
    assert.match(src, /trust_tier/);
    assert.match(src, /inquiryOriginFromTrustTier/);
    assert.match(src, /customerFacingInquiryMessage/);
  });
});

describe("failed deletion leaves the draft visible and reports an error", () => {
  it("ok:false keeps pending draft and returns the error", () => {
    const before = [draft({ id: "d1", status: "pending_review" })];
    const next = applyDiscardResult(before, "d1", {
      ok: false,
      message: "Couldn't discard that draft. Please try again.",
    });
    assert.equal(pendingReviewDrafts(next.drafts).length, 1);
    assert.equal(next.drafts[0]?.id, "d1");
    assert.equal(next.error, "Couldn't discard that draft. Please try again.");
    assert.equal(draftHistoryDrafts(next.drafts).length, 0);
  });

  it("ok:true removes the draft and reports no error", () => {
    const before = [draft({ id: "d1", status: "pending_review" })];
    const next = applyDiscardResult(before, "d1", { ok: true });
    assert.equal(pendingReviewDrafts(next.drafts).length, 0);
    assert.equal(next.error, null);
  });

  it("Discard UI applies applyDiscardResult before removing", () => {
    const panel = readFileSync(resolve("components/luv/luv-draft-panel.tsx"), "utf8");
    assert.match(panel, /applyDiscardResult/);
    assert.match(panel, /toast\.error\(next\.error\)/);
    assert.match(panel, /if \(next\.error\)/);
  });
});

describe("cross-venue deletion protection", () => {
  it("missing row in this venue (other venue's draft) does not proceed to delete", () => {
    const decision = resolveDraftDeleteDecision(null, null);
    assert.equal(decision.proceed, false);
    if (!decision.proceed) {
      assert.match(decision.message, /no longer available/);
    }
  });

  it("read failure does not proceed to delete", () => {
    const decision = resolveDraftDeleteDecision({ id: "d1" }, { message: "timeout" });
    assert.equal(decision.proceed, false);
    if (!decision.proceed) {
      assert.match(decision.message, /Couldn't discard/);
    }
  });

  it("same-venue existence check is required before admin delete", () => {
    const decision = resolveDraftDeleteDecision({ id: "d1" }, null);
    assert.equal(decision.proceed, true);
  });

  it("deleteDraft always scopes read and admin delete by venue_id", () => {
    const draftsSrc = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
    const fn = draftsSrc.slice(draftsSrc.indexOf("export async function deleteDraft"));
    assert.match(fn, /resolveDraftDeleteDecision/);
    const readBlock = fn.slice(fn.indexOf(".from(\"luv_drafts\")"), fn.indexOf("resolveDraftDeleteDecision"));
    assert.match(readBlock, /\.eq\("id", draftId\)/);
    assert.match(readBlock, /\.eq\("venue_id", venue\.id\)/);
    const deleteBlock = fn.slice(fn.indexOf("admin"));
    assert.match(deleteBlock, /\.delete\(\)/);
    assert.match(deleteBlock, /\.eq\("id", draftId\)/);
    assert.match(deleteBlock, /\.eq\("venue_id", venue\.id\)/);
    assert.doesNotMatch(fn.slice(0, 1800), /\.delete\(\)[\s\S]{0,80}\.eq\("id", draftId\)\s*;/);
  });
});
