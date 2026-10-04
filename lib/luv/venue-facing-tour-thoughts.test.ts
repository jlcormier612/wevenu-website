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
import { upcomingTourThoughtsSentence } from "@/lib/leads/momentum";
import {
  extractVenueFacingTourNoteSignals,
  internalTourNotesForFollowUp,
  thoughtsEchoRawNote,
  usefulInternalTourNote,
  venueFacingCompletedTourThoughts,
} from "@/lib/luv/venue-facing-tour-thoughts";
import type { Lead } from "@/lib/leads/types";

const WENDY_NOTES =
  "Wendy walked in and we accommodated them. They loved the venue and especially how private and secluded the farm is. They will provide their own security for the event.";

const OPERATIONAL_NOTES = "Need to email them the lighting plot after the walkthrough.";

const MIXED_NOTES =
  "They loved the barn. Need to send them the lighting plot. They will provide their own security.";

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

function assertSynthesized(copy: string, notes: string) {
  assert.doesNotMatch(copy, /Your notes:/i);
  assert.doesNotMatch(copy, /I'm not drawing conclusions about how it went/);
  assert.doesNotMatch(copy, /the notes say/i);
  assert.equal(thoughtsEchoRawNote(copy, notes), false, `echoed notes in: ${copy}`);
  assert.doesNotMatch(copy, /Wendytoured|Wendyhas/);
}

describe("venue-facing completed-tour Thoughts", () => {
  it("1. useful internal notes are available and synthesized, not echoed", () => {
    const available = usefulInternalTourNote(WENDY_NOTES);
    assert.equal(available, WENDY_NOTES);
    const signals = extractVenueFacingTourNoteSignals(WENDY_NOTES);
    assert.equal(signals.strongInterest, true);
    assert.equal(signals.ownSecurity, true);

    const copy = venueFacingCompletedTourThoughts("Wendy", WENDY_NOTES);
    assert.match(copy, /^Wendy has toured the venue/);
    assert.match(copy, /strong interest/i);
    assert.match(copy, /own security/i);
    assert.doesNotMatch(copy, /walked in and we accommodated/);
    assert.doesNotMatch(copy, /private and secluded/);
    assert.doesNotMatch(copy, /will book|ready to sign|definitely going to/i);
    assertSynthesized(copy, WENDY_NOTES);
    assert.equal(evaluateCompletedTour({
      tourId: "t1",
      leadId: "L1",
      contactName: "Wendy",
      occurredAt: "2026-10-02T14:00:00.000Z",
      proposalSent: false,
      messages: [],
    }).mode, "silence");
  });

  it("2. positive / operational / mixed details are not mechanically concatenated", () => {
    const positive = venueFacingCompletedTourThoughts("Wendy", "They loved the venue.");
    assert.match(positive, /strong interest/i);
    assert.doesNotMatch(positive, /They loved the venue/);
    assert.doesNotMatch(positive, /adored|falling in love|can't wait to book|will definitely book/i);
    assertSynthesized(positive, "They loved the venue.");

    const operational = venueFacingCompletedTourThoughts("Wendy", OPERATIONAL_NOTES);
    assert.match(operational, /lighting plot/);
    assert.doesNotMatch(operational, /Need to email them/);
    assert.doesNotMatch(operational, /loved|excited|amazing/i);
    assert.doesNotMatch(operational, new RegExp(OPERATIONAL_NOTES.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assertSynthesized(operational, OPERATIONAL_NOTES);

    const mixed = venueFacingCompletedTourThoughts("Wendy", MIXED_NOTES);
    assert.match(mixed, /strong interest/i);
    assert.match(mixed, /own security/i);
    assert.match(mixed, /lighting plot/);
    assert.doesNotMatch(mixed, /They loved the barn/);
    assert.doesNotMatch(mixed, /Need to send them/);
    assert.equal(mixed.includes(MIXED_NOTES), false);
    assertSynthesized(mixed, MIXED_NOTES);
  });

  it("3. no useful internal note → concise no-action, no invented insight", () => {
    const expected =
      "Wendy has toured the venue. Nothing from the tour record currently needs your attention.";
    assert.equal(venueFacingCompletedTourThoughts("Wendy", null), expected);
    assert.equal(venueFacingCompletedTourThoughts("Wendy", "n/a"), expected);
    assert.equal(venueFacingCompletedTourThoughts("Wendy", "  "), expected);
    assert.equal(
      venueFacingCompletedTourThoughts("Wendy", "Wendy walked in and we accommodated them."),
      expected,
    );
    assert.doesNotMatch(venueFacingCompletedTourThoughts("Wendy", null), /I'm not drawing conclusions/);
    assert.doesNotMatch(venueFacingCompletedTourThoughts("Wendy", null), /loved|security|follow-up/i);
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
    const copy = venueFacingCompletedTourThoughts("Wendy", notes);
    assertSynthesized(copy, WENDY_NOTES);
  });
});

describe("upcoming-tour Thoughts have no raw-note restatement path", () => {
  it("5. upcoming helper never interpolates notes", () => {
    const src = readFileSync(resolve("lib/leads/momentum.ts"), "utf8");
    assert.match(src, /export function upcomingTourThoughtsSentence/);
    assert.doesNotMatch(src, /Your notes:/);
    assert.doesNotMatch(src, /internalTourNotes/);
    const copy = upcomingTourThoughtsSentence("Wendy", "Oct 8, 2:00 PM");
    assert.equal(
      copy,
      "Wendy has a venue tour scheduled for Oct 8, 2:00 PM. It has not taken place yet.",
    );
    assert.doesNotMatch(copy, /Your notes:|loved the venue|walked in/i);
    assert.equal(internalTourNotesForFollowUp([
      { status: "scheduled", scheduledAt: "2026-10-10T18:00:00.000Z", notes: WENDY_NOTES },
    ]), null);
  });
});

describe("customer-facing drafts still exclude internal tour notes", () => {
  it("4. positive tour note is not in the draft prompt", () => {
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
    assert.doesNotMatch(card, /Your notes:/);
    const thoughtSrc = readFileSync(resolve("lib/luv/venue-facing-tour-thoughts.ts"), "utf8");
    assert.doesNotMatch(thoughtSrc, /Your notes: \$\{/);
  });
});
