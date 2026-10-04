/**
 * Venue-facing completed-tour Thoughts vs customer-facing draft privacy.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { customerFacingInquiryContext } from "@/lib/luv/customer-facing-inquiry-context";
import {
  completedTourDraftAllowed,
  evaluateCompletedTour,
} from "@/lib/luv/completed-tour-intelligence";
import { buildFollowUpPrompt } from "@/lib/luv/drafts";
import { resolveFollowUpDraftEligibility } from "@/lib/luv/follow-up-draft-eligibility";
import {
  internalTourNotesForFollowUp,
  usefulInternalTourNote,
  venueFacingCompletedTourThoughts,
} from "@/lib/luv/venue-facing-tour-thoughts";
import type { Lead } from "@/lib/leads/types";

const WENDY_NOTES =
  "Wendy walked in and we accommodated them. They loved the venue and especially how private and secluded the farm is. They will provide their own security for the event.";

const OPERATIONAL_NOTES = "Need to email them the lighting plot after the walkthrough.";

function lead(): Lead {
  return {
    id: "L1",
    venueId: "v1",
    salesStage: "tour_scheduled",
    status: "tour_scheduled",
    firstName: "Wendy",
    lastName: "Davis",
    partnerFirstName: null,
    partnerLastName: null,
    email: "wendy@example.com",
    phone: null,
    eventType: "wedding",
    eventDate: "2027-06-14",
    guestCount: 80,
    estimatedBudget: 20000,
    inquiryMessage: null,
    inquiryDate: "2026-09-01",
    lastContactedAt: null,
  } as Lead;
}

describe("venue-facing completed-tour Thoughts", () => {
  it("1. completed tour + useful internal note is used, without the epistemic disclaimer", () => {
    const copy = venueFacingCompletedTourThoughts("Wendy", WENDY_NOTES);
    assert.match(copy, /^Wendy toured the venue/);
    assert.doesNotMatch(copy, /Wendytoured|Wendyhas/);
    assert.match(copy, /Your notes:/);
    assert.match(copy, /loved the venue/);
    assert.match(copy, /private and secluded/);
    assert.match(copy, /own security/);
    assert.doesNotMatch(copy, /I'm not drawing conclusions about how it went/);
    assert.doesNotMatch(copy, /will book|ready to sign|definitely going to/i);
    assert.equal(evaluateCompletedTour({
      tourId: "t1",
      leadId: "L1",
      contactName: "Wendy",
      occurredAt: "2026-10-02T14:00:00.000Z",
      proposalSent: false,
      messages: [],
    }).mode, "silence");
  });

  it("2. positive note is summarized from the note, not strengthened", () => {
    const copy = venueFacingCompletedTourThoughts("Wendy", "They loved the venue.");
    assert.match(copy, /They loved the venue/);
    assert.doesNotMatch(copy, /adored|falling in love|can't wait to book|will definitely book/i);
  });

  it("3. operational internal note can be surfaced", () => {
    const copy = venueFacingCompletedTourThoughts("Wendy", OPERATIONAL_NOTES);
    assert.match(copy, /lighting plot/);
    assert.doesNotMatch(copy, /loved|excited|amazing/i);
  });

  it("4. no useful note stays concise — no invented sentiment, no disclaimer", () => {
    assert.equal(venueFacingCompletedTourThoughts("Wendy", null), "Wendy toured the venue.");
    assert.equal(venueFacingCompletedTourThoughts("Wendy", "n/a"), "Wendy toured the venue.");
    assert.equal(venueFacingCompletedTourThoughts("Wendy", "  "), "Wendy toured the venue.");
    assert.doesNotMatch(venueFacingCompletedTourThoughts("Wendy", null), /I'm not drawing conclusions/);
    assert.doesNotMatch(venueFacingCompletedTourThoughts("Wendy", null), /loved/);
  });

  it("picks notes from the completed appointment the classifier would use", () => {
    const notes = internalTourNotesForFollowUp([
      {
        status: "cancelled",
        scheduledAt: "2026-10-10T18:00:00.000Z",
        notes: "Ignore cancelled notes",
      },
      {
        status: "completed",
        scheduledAt: "2026-10-01T18:00:00.000Z",
        completedAt: "2026-10-01T19:00:00.000Z",
        notes: WENDY_NOTES,
      },
    ]);
    assert.equal(notes, usefulInternalTourNote(WENDY_NOTES));
  });
});

describe("customer-facing drafts still exclude internal tour notes", () => {
  it("5. positive tour note is not in the draft prompt", () => {
    const prompt = buildFollowUpPrompt(lead(), "Fancy", "Jen", "warm", {
      proposalSent: false,
      tour: { kind: "completed", scheduledAt: "2026-10-01T18:00:00.000Z", completedAt: "2026-10-02T14:00:00.000Z" },
      communicationPurpose: "none",
    });
    assert.doesNotMatch(prompt, /loved the venue|private and secluded|own security|lighting plot/i);
    assert.match(prompt, /Never invent or allude to venue-internal notes/);
  });

  it("6. operational tour note is not a draft prompt field", () => {
    const drafts = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
    const loader = readFileSync(resolve("lib/luv/follow-up-tour-loader.ts"), "utf8");
    assert.doesNotMatch(drafts, /internalTourNotes|tourAppointments\.notes|venueFacingCompletedTourThoughts/);
    assert.doesNotMatch(loader, /\bnotes\b/);
    assert.match(loader, /scheduled_at, status, completed_at, follow_up_sent_at, actual_occurred_at/);
  });

  it("7. customer-originated inquiry remains eligible; SILENCE still hides draft CTA", () => {
    const ctx = customerFacingInquiryContext(
      "Can we use the barn for 80 guests?",
      "customer",
    );
    assert.equal(ctx.status, "usable");
    const decision = evaluateCompletedTour({
      tourId: "t1",
      leadId: "L1",
      contactName: "Wendy",
      occurredAt: "2026-10-02T14:00:00.000Z",
      proposalSent: false,
      messages: [],
    });
    assert.equal(decision.mode, "silence");
    assert.equal(completedTourDraftAllowed(decision), false);
    const gate = resolveFollowUpDraftEligibility({
      tour: { kind: "completed", scheduledAt: "2026-10-01T18:00:00.000Z", completedAt: "2026-10-02T14:00:00.000Z" },
      nextActionText: "Follow up after tour",
      completedDecision: decision,
    });
    assert.equal(gate.eligible, false);
  });
});

describe("Luv JSX must not concatenate dynamic values with literal words", () => {
  it("components/luv human-facing copy uses string helpers instead of `{name} has`", () => {
    const dir = resolve("components/luv");
    const files = readdirSync(dir).filter((f) => f.endsWith(".tsx"));
    const adjacent = /\{(?:name|firstName|contactName)\}[ ]?(?:has|is|was|can|will)\b/;
    for (const file of files) {
      const src = readFileSync(resolve(dir, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      assert.doesNotMatch(src, adjacent, `${file} has adjacent JSX name + verb`);
    }
    const card = readFileSync(resolve("components/luv/lead-momentum-card.tsx"), "utf8");
    assert.match(card, /venueFacingCompletedTourThoughts\(/);
    assert.match(card, /upcomingTourThoughtsSentence\(/);
    assert.match(card, /newLeadBeginningSentence\(/);
    assert.doesNotMatch(card, /I'm not drawing conclusions about how it went/);
  });
});
