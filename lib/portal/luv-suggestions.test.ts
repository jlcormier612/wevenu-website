import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getQuietLuvMessage,
  resolveLuvHomeSuggestion,
  shouldSkipForVenueAttention,
  usesForbiddenLuvLanguage,
  type LuvHomeSuggestionInput,
} from "@/lib/portal/luv-suggestions";

function base(over: Partial<LuvHomeSuggestionInput> = {}): LuvHomeSuggestionInput {
  return {
    daysUntil: 70,
    guestTotal: 10,
    guestAttending: 2,
    readiness: 60,
    bracket: "1-3",
    totalThisWeek: 0,
    questionnaireOpen: false,
    soonKeyDate: null,
    venueAttentionCount: 0,
    dayOfMonth: 1, // odd → social proof when bracket path
    ...over,
  };
}

describe("resolveLuvHomeSuggestion", () => {
  it("1. returns a meaningful suggestion when signals exist", () => {
    const s = resolveLuvHomeSuggestion(
      base({
        soonKeyDate: { label: "Tasting", date: "2026-08-12" },
      }),
    );
    assert.equal(s.kind, "key_date");
    assert.match(s.message, /tasting/i);
    assert.equal(s.destination, null);
    assert.equal(usesForbiddenLuvLanguage(s.message), false);
  });

  it("2. uses quiet state when no stronger signal applies", () => {
    const s = resolveLuvHomeSuggestion(
      base({
        daysUntil: 12,
        readiness: 90,
        totalThisWeek: 0,
        questionnaireOpen: false,
        soonKeyDate: null,
        dayOfMonth: 1,
        guestTotal: 10,
        guestAttending: 4,
      }),
    );
    assert.equal(s.kind, "quiet");
    assert.ok(s.message.length > 0);
    assert.equal(s.ctaLabel, null);
    assert.equal(usesForbiddenLuvLanguage(s.message), false);
  });

  it("3. surfaces couple-owned guest planning suggestions", () => {
    const s = resolveLuvHomeSuggestion(
      base({
        daysUntil: 200,
        guestTotal: 0,
        guestAttending: 0,
        readiness: 40,
        soonKeyDate: null,
        totalThisWeek: 0,
        questionnaireOpen: false,
      }),
    );
    assert.equal(s.kind, "guest_planning");
    assert.equal(s.destination, "guests");
    assert.ok(s.ctaLabel);
    assert.doesNotMatch(s.message, /your venue needs/i);
    assert.equal(usesForbiddenLuvLanguage(s.message), false);
  });

  it("4. surfaces a planning milestone suggestion (even day)", () => {
    const s = resolveLuvHomeSuggestion(
      base({
        daysUntil: 100,
        guestTotal: 5,
        bracket: "3-6",
        dayOfMonth: 2,
        soonKeyDate: null,
        totalThisWeek: 0,
        questionnaireOpen: false,
        venueAttentionCount: 0,
      }),
    );
    assert.equal(s.kind, "milestone");
    assert.ok(s.destination);
    assert.ok(s.ctaLabel);
    assert.equal(usesForbiddenLuvLanguage(s.message), false);
  });

  it("5. does not duplicate venue-required questionnaire when Next Steps has attention", () => {
    assert.equal(shouldSkipForVenueAttention("questionnaire", 3), true);

    const withP1 = resolveLuvHomeSuggestion(
      base({
        daysUntil: 20,
        questionnaireOpen: true,
        venueAttentionCount: 3,
        totalThisWeek: 0,
        soonKeyDate: null,
        // Avoid overview observation winning
        guestTotal: 5,
        guestAttending: 2,
        readiness: 90,
      }),
    );
    assert.notEqual(withP1.kind, "questionnaire");
    assert.doesNotMatch(withP1.message, /your venue needs/i);
    assert.doesNotMatch(withP1.message, /questionnaire/i);

    const withoutP1 = resolveLuvHomeSuggestion(
      base({
        daysUntil: 20,
        questionnaireOpen: true,
        venueAttentionCount: 0,
        totalThisWeek: 0,
        soonKeyDate: null,
        guestTotal: 5,
        guestAttending: 2,
        readiness: 90,
      }),
    );
    assert.equal(withoutP1.kind, "questionnaire");
    assert.equal(withoutP1.destination, "questionnaire");
  });

  it("skips venue-readiness progress suggest when P1 attention exists", () => {
    const s = resolveLuvHomeSuggestion(
      base({
        daysUntil: 25,
        readiness: 40,
        venueAttentionCount: 4,
        guestTotal: 20,
        guestAttending: 5,
        totalThisWeek: 0,
        questionnaireOpen: false,
        soonKeyDate: null,
      }),
    );
    assert.notEqual(s.kind, "progress");
    assert.doesNotMatch(s.message, /venue tasks/i);
    assert.doesNotMatch(s.message, /your venue needs/i);
  });

  it("celebrates weekly activity warmly", () => {
    const s = resolveLuvHomeSuggestion(
      base({
        totalThisWeek: 2,
        soonKeyDate: null,
        daysUntil: 40,
      }),
    );
    assert.equal(s.kind, "activity");
    assert.match(s.message, /2 planning items/i);
  });

  it("6–7. never emits forbidden productivity language across quiet bank", () => {
    for (const du of [null, -5, 0, 10, 45, 120, 200, 300, 400] as const) {
      for (const guests of [0, 50]) {
        for (const readiness of [20, 80]) {
          const msg = getQuietLuvMessage(du, guests, readiness);
          assert.equal(usesForbiddenLuvLanguage(msg), false, msg);
        }
      }
    }
  });

  it("8. CTA destinations are existing portal sections only", () => {
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
      null,
    ]);
    const samples: LuvHomeSuggestionInput[] = [
      base({ soonKeyDate: { label: "Fitting", date: "2026-08-10" } }),
      base({ dayOfMonth: 2, daysUntil: 200, guestTotal: 0 }),
      base({ dayOfMonth: 2, daysUntil: 100, bracket: "3-6" }),
      base({ dayOfMonth: 1, daysUntil: 100 }),
      base({ questionnaireOpen: true, daysUntil: 20, readiness: 90 }),
      base({ totalThisWeek: 1 }),
      base({ daysUntil: 20, readiness: 90 }),
    ];
    for (const input of samples) {
      const s = resolveLuvHomeSuggestion(input);
      assert.ok(allowed.has(s.destination), String(s.destination));
      if (s.destination) assert.ok(s.ctaLabel);
      else assert.equal(s.ctaLabel, null);
    }
  });
});
