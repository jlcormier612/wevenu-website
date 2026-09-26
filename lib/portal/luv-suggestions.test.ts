import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getNeutralVenueWelcome,
  getQuietLuvMessage,
  resolveLuvHomeSuggestion,
  shouldSkipForVenueAttention,
  usesForbiddenLuvLanguage,
  usesUnsupportedAssumption,
  type LuvHomeSuggestionInput,
} from "@/lib/portal/luv-suggestions";

function base(over: Partial<LuvHomeSuggestionInput> = {}): LuvHomeSuggestionInput {
  return {
    venueName: "Jen's Fancy Venue",
    hasEvent: true,
    daysUntil: 70,
    eventDateLabel: "June 21, 2027",
    guestTotal: 10,
    guestAttending: 2,
    readiness: 60,
    totalThisWeek: 0,
    questionnaireOpen: false,
    venueAttentionCount: 0,
    contractAwaitingSignature: false,
    contractFullyExecuted: false,
    nextPayment: null,
    ...over,
  };
}

describe("resolveLuvHomeSuggestion — HTC-known facts only", () => {
  it("never implies the couple is still choosing a venue", () => {
    for (const daysUntil of [400, 300, 200, 100, 40, 10, null] as const) {
      const s = resolveLuvHomeSuggestion(
        base({
          daysUntil,
          guestTotal: 0,
          contractAwaitingSignature: false,
          nextPayment: null,
          venueAttentionCount: 0,
          totalThisWeek: 0,
          questionnaireOpen: false,
        }),
      );
      assert.equal(usesUnsupportedAssumption(s.message), false, s.message);
      assert.doesNotMatch(s.message, /choosing .*venue/i);
      assert.doesNotMatch(s.message, /most couples/i);
    }
  });

  it("acknowledges the actual venue relationship for booked/event clients", () => {
    const s = resolveLuvHomeSuggestion(
      base({
        daysUntil: 200,
        guestTotal: 5,
        totalThisWeek: 0,
        venueAttentionCount: 0,
      }),
    );
    assert.match(s.message, /Jen's Fancy Venue/);
    assert.equal(usesUnsupportedAssumption(s.message), false);
  });

  it("points to a contract awaiting signature", () => {
    const s = resolveLuvHomeSuggestion(
      base({ contractAwaitingSignature: true }),
    );
    assert.equal(s.kind, "contract");
    assert.equal(s.destination, "documents");
    assert.match(s.message, /agreement/i);
    assert.match(s.message, /Jen's Fancy Venue/);
  });

  it("surfaces a known payment due date", () => {
    const s = resolveLuvHomeSuggestion(
      base({
        nextPayment: { label: "Deposit", dueDateLabel: "October 1, 2026" },
      }),
    );
    assert.equal(s.kind, "payment");
    assert.equal(s.destination, "payments");
    assert.match(s.message, /Deposit/);
    assert.match(s.message, /October 1, 2026/);
  });

  it("uses event-date countdown from known daysUntil", () => {
    const s = resolveLuvHomeSuggestion(
      base({
        daysUntil: 12,
        eventDateLabel: "June 21, 2027",
        guestTotal: 20,
        guestAttending: 5,
        totalThisWeek: 0,
        venueAttentionCount: 0,
        questionnaireOpen: false,
      }),
    );
    assert.equal(s.kind, "event_countdown");
    assert.match(s.message, /June 21, 2027|Jen's Fancy Venue/);
    assert.doesNotMatch(s.message, /most couples/i);
  });

  it("neutral state does not invent planning progress", () => {
    const s = resolveLuvHomeSuggestion(
      base({
        hasEvent: true,
        daysUntil: 200,
        guestTotal: 5,
        totalThisWeek: 0,
        venueAttentionCount: 0,
        questionnaireOpen: false,
        contractAwaitingSignature: false,
        contractFullyExecuted: false,
        nextPayment: null,
      }),
    );
    assert.ok(s.kind === "quiet" || s.kind === "event_countdown" || s.kind === "guest_planning");
    assert.equal(usesUnsupportedAssumption(s.message), false);
    assert.doesNotMatch(s.message, /guest list is the heart|first big step|exploring/i);
  });

  it("celebrates known weekly activity", () => {
    const s = resolveLuvHomeSuggestion(base({ totalThisWeek: 2 }));
    assert.equal(s.kind, "activity");
    assert.match(s.message, /2 planning items/i);
  });

  it("does not duplicate questionnaire when Next Steps has attention", () => {
    assert.equal(shouldSkipForVenueAttention("questionnaire", 3), true);
    const withP1 = resolveLuvHomeSuggestion(
      base({
        questionnaireOpen: true,
        venueAttentionCount: 3,
        totalThisWeek: 0,
        contractAwaitingSignature: false,
        nextPayment: null,
      }),
    );
    assert.equal(withP1.kind, "venue_attention");
    assert.doesNotMatch(withP1.message, /questionnaire/i);
  });

  it("never emits forbidden productivity language across quiet bank", () => {
    for (const du of [null, -5, 0, 10, 45, 120, 200, 300, 400] as const) {
      const msg = getQuietLuvMessage(du, "Jen's Fancy Venue", du !== null, "June 21, 2027");
      assert.equal(usesForbiddenLuvLanguage(msg), false, msg);
      assert.equal(usesUnsupportedAssumption(msg), false, msg);
    }
    assert.equal(usesUnsupportedAssumption(getNeutralVenueWelcome("Jen's Fancy Venue", true)), false);
  });

  it("CTA destinations are existing portal sections only", () => {
    const allowed = new Set([
      "guests",
      "todos",
      "story",
      "vendors",
      "questionnaire",
      "website",
      "budget",
      "seating",
      "tasks",
      "timeline",
      "documents",
      "payments",
      null,
    ]);
    const samples: LuvHomeSuggestionInput[] = [
      base({}),
      base({ contractAwaitingSignature: true }),
      base({ nextPayment: { label: "Final", dueDateLabel: "May 1, 2027" } }),
      base({ venueAttentionCount: 2 }),
      base({ questionnaireOpen: true, venueAttentionCount: 0 }),
      base({ totalThisWeek: 1 }),
      base({ guestTotal: 0, daysUntil: 200 }),
    ];
    for (const input of samples) {
      const s = resolveLuvHomeSuggestion(input);
      assert.ok(allowed.has(s.destination), String(s.destination));
      if (s.destination) assert.ok(s.ctaLabel);
      else assert.equal(s.ctaLabel, null);
      assert.equal(usesUnsupportedAssumption(s.message), false, s.message);
    }
  });
});
