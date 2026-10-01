/**
 * Luv customer-facing draft context — Gate 1 provenance + Gate 2 naturalness + discard.
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

  it("excludes unknown/legacy content", () => {
    assert.equal(customerFacingInquiryMessage(INNOCUOUS, "unknown"), null);
  });
});

describe("buildFollowUpPrompt — Gate 1 + Gate 2 source boundary", () => {
  const SENSITIVE = "SSN-CANARY-7741 do not tell the couple about the credit hold";
  const INNOCUOUS = "Called back Tuesday; seems lovely.";
  const CHARLIE =
    "Keeping Charlie on his toes sounds like it will make the day even more fun.";
  const USEFUL = "We love the garden and are hoping for a Saturday in August.";
  const MIXED =
    "We love the garden. Keeping Charlie on his toes sounds like it will make the day even more fun.";

  it("1. venue inquiry → absent", () => {
    const prompt = buildFollowUpPrompt(
      lead({ inquiryMessage: SENSITIVE }),
      "Jen's Fancy",
      "Jen",
      "warm",
      { proposalSent: false, inquiryOrigin: "venue" },
    );
    assert.doesNotMatch(prompt, /SSN-CANARY-7741/);
    assert.doesNotMatch(prompt, /credit hold/);
    assert.doesNotMatch(prompt, /Customer-provided details/);
    assert.doesNotMatch(prompt, /Their original message/);
  });

  it("2. unknown inquiry → absent", () => {
    const prompt = buildFollowUpPrompt(
      lead({ inquiryMessage: USEFUL, inquiryMessageOrigin: "unknown" }),
      "Jen's Fancy",
      "Jen",
      "warm",
      { proposalSent: false },
    );
    assert.doesNotMatch(prompt, /We love the garden/);
    assert.doesNotMatch(prompt, /Customer-provided details/);
  });

  it("3. invalid/missing origin → absent (fail closed)", () => {
    const prompt = buildFollowUpPrompt(
      lead({ inquiryMessage: SENSITIVE }),
      "Jen's Fancy",
      "Jen",
      "warm",
      { proposalSent: false },
    );
    assert.doesNotMatch(prompt, /SSN-CANARY-7741/);
    assert.doesNotMatch(prompt, /Customer-provided details/);
  });

  it("4. customer + useful preference → present", () => {
    const prompt = buildFollowUpPrompt(
      lead({ inquiryMessage: "We love the garden." }),
      "Jen's Fancy",
      "Jen",
      "warm",
      { proposalSent: false, inquiryOrigin: "customer" },
    );
    assert.match(prompt, /We love the garden/);
    assert.match(prompt, /Customer-provided details relevant to this follow-up/);
  });

  it("5. customer + useful planning detail → present", () => {
    const prompt = buildFollowUpPrompt(
      lead({ inquiryMessage: USEFUL }),
      "Jen's Fancy",
      "Jen",
      "warm",
      { proposalSent: false, inquiryOrigin: "customer" },
    );
    assert.match(prompt, /hoping for a Saturday in August/);
    assert.match(prompt, /Customer-provided details relevant to this follow-up/);
    assert.match(prompt, /Speak TO the customer/);
  });

  it("6. customer + Charlie-style relationship commentary → absent", () => {
    const prompt = buildFollowUpPrompt(
      lead({ inquiryMessage: CHARLIE }),
      "Jen's Fancy",
      "Jen",
      "warm",
      { proposalSent: false, inquiryOrigin: "customer" },
    );
    assert.doesNotMatch(prompt, /Keeping Charlie on his toes/);
    assert.doesNotMatch(prompt, /on his toes/);
    assert.doesNotMatch(prompt, /make the day even more fun/);
    assert.doesNotMatch(prompt, /Customer-provided details/);
  });

  it("7. customer + mixed useful + withheld → useful remains, withheld absent", () => {
    const prompt = buildFollowUpPrompt(
      lead({ inquiryMessage: MIXED }),
      "Jen's Fancy",
      "Jen",
      "warm",
      { proposalSent: false, inquiryOrigin: "customer" },
    );
    assert.match(prompt, /We love the garden/);
    assert.doesNotMatch(prompt, /Keeping Charlie on his toes/);
    assert.doesNotMatch(prompt, /on his toes/);
    assert.doesNotMatch(prompt, /make the day even more fun/);
  });

  it("8. if any content withheld, raw full inquiry cannot appear anywhere in prompt", () => {
    const prompt = buildFollowUpPrompt(
      lead({ inquiryMessage: MIXED }),
      "Jen's Fancy",
      "Jen",
      "warm",
      { proposalSent: false, inquiryOrigin: "customer" },
    );
    assert.doesNotMatch(prompt, new RegExp(MIXED.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(prompt, /We love the garden\. Keeping Charlie/);
  });

  it("9. structured lead facts remain available when inquiry context excluded", () => {
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
    assert.doesNotMatch(prompt, /Called back Tuesday/);
  });

  it("10. Gate 2 is wired into buildFollowUpPrompt (not only a standalone helper)", () => {
    const src = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
    assert.match(src, /customerFacingInquiryContext/);
    assert.match(src, /from "@\/lib\/luv\/customer-facing-inquiry-context"/);
    assert.doesNotMatch(src, /customerFacingInquiryMessage\(/);
    // Raw inquiry must not be interpolated into the prompt after Gate 2.
    const builder = src.slice(src.indexOf("export function buildFollowUpPrompt"));
    const end = builder.indexOf("\nexport ");
    const fn = end === -1 ? builder : builder.slice(0, end);
    assert.doesNotMatch(fn, /inquiryMessage\}/);
    assert.doesNotMatch(fn, /\$\{lead\.inquiryMessage/);
    assert.doesNotMatch(fn, /customerMessage[^B]/);
  });

  it("11. lead_notes remains excluded", () => {
    const src = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
    assert.doesNotMatch(src, /lead_notes/);
  });

  it("12. no trust-tier / source bypass introduced", () => {
    const src = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
    assert.doesNotMatch(src, /trust_tier/);
    assert.doesNotMatch(src, /lead_intake_attempts/);
    assert.match(src, /inquiryMessageOrigin/);
    assert.match(src, /normalizeInquiryMessageOrigin/);
  });

  it("regression: useful preference remains available to the model", () => {
    const prompt = buildFollowUpPrompt(
      lead({
        inquiryMessage: "We love the garden and are hoping for a Saturday in August.",
      }),
      "Jen's Fancy",
      "Jen",
      "warm",
      { proposalSent: false, inquiryOrigin: "customer" },
    );
    assert.match(prompt, /We love the garden and are hoping for a Saturday in August/);
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
});

describe("generateFollowUpDraft never loads venue lead notes", () => {
  it("does not query lead_notes or infer origin from trust_tier / source", () => {
    const src = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
    assert.doesNotMatch(src, /lead_notes/);
    assert.doesNotMatch(src, /lead_intake_attempts/);
    assert.doesNotMatch(src, /trust_tier/);
    assert.match(src, /inquiryMessageOrigin/);
    assert.match(src, /customerFacingInquiryContext/);
    assert.match(src, /normalizeInquiryMessageOrigin/);
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
