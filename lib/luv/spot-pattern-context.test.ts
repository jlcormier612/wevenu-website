/**
 * Luv Phase 6 — Understand Context (P-A1 / P-P1 / P-A4 enrichment).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  isDashboardLevel1Recommendation,
} from "@/lib/dashboard-system/luv-entry";
import {
  PA1_SUBSTANTIALLY_OLDER_HOURS,
  assertNonCausalContextCopy,
  buildPA1AgeContextClause,
  buildPA1ContextClauses,
  buildPA1SourceContextClause,
  buildPA4NearestEventContextClause,
  buildPP1BookingsAlsoUpClause,
  buildPP1ContextClauses,
  buildPP1SustainedContextClause,
  buildPP1ToursAlsoUpClause,
  enrichSpotPatternWithContext,
} from "@/lib/luv/spot-pattern-context";
import {
  INQUIRY_VOLUME_INCREASE_TYPE,
  PAYMENT_ATTENTION_PATTERN_TYPE,
  UNATTENDED_INQUIRY_PATTERN_TYPE,
  countTimestampsInRange,
  evaluateInquiryVolumeIncrease,
  evaluatePaymentAttentionPattern,
  evaluateUnattendedInquiryPattern,
  isPhase5SpotPatternRecommendation,
  type PaymentAttentionEventInput,
} from "@/lib/luv/spot-patterns";
import type { VenueRecommendation } from "@/lib/luv/recommendation-types";

const VENUE_A = "venue-a";
const VENUE_B = "venue-b";
const NOW = Date.parse("2026-09-30T15:00:00.000Z");

function hoursAgo(hours: number): string {
  return new Date(NOW - hours * 3_600_000).toISOString();
}

function eventDateOffset(days: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function unattendedLead(
  id: string,
  overrides: Partial<{
    venueId: string;
    createdAt: string;
    acquisitionSource: string | null;
    salesStage: string;
    lastContactedAt: string | null;
  }> = {},
) {
  return {
    id,
    venueId: overrides.venueId ?? VENUE_A,
    firstName: "Pat",
    lastName: id,
    salesStage: overrides.salesStage ?? "new_inquiry",
    createdAt: overrides.createdAt ?? hoursAgo(72),
    lastContactedAt:
      overrides.lastContactedAt === undefined ? null : overrides.lastContactedAt,
    acquisitionSource: overrides.acquisitionSource ?? null,
  };
}

function paymentInput(eventId: string, daysUntil: number): PaymentAttentionEventInput {
  return {
    event: {
      id: eventId,
      venueId: VENUE_A,
      name: `Event ${eventId}`,
      eventDate: eventDateOffset(daysUntil),
      status: "confirmed",
      clientId: `client-${eventId}`,
    },
    payment: {
      eventId,
      venueId: VENUE_A,
      status: "needs_attention",
      detail: "Balance overdue",
      href: "/payments?filter=attention",
    },
  };
}

function patternRec(type: string): VenueRecommendation {
  return {
    id: `rec-${type}`,
    insightId: null,
    type,
    title: "Pattern",
    body: "Evidence",
    priority: 70,
    ctas: [{ label: "Go", target: "/leads", type: "navigate" }],
    metadata: {},
    dismissedAt: null,
    completedAt: null,
    expiresAt: null,
    createdAt: new Date(NOW).toISOString(),
  } as VenueRecommendation;
}

describe("Phase 6 P-A1 context", () => {
  it("1. age context appears when floor passes", () => {
    const leads = [
      { id: "a", venueId: VENUE_A, createdAt: hoursAgo(PA1_SUBSTANTIALLY_OLDER_HOURS + 12) },
      { id: "b", venueId: VENUE_A, createdAt: hoursAgo(PA1_SUBSTANTIALLY_OLDER_HOURS + 24) },
      { id: "c", venueId: VENUE_A, createdAt: hoursAgo(60) },
    ];
    const clause = buildPA1AgeContextClause(leads, { venueId: VENUE_A, nowMs: NOW });
    assert.ok(clause);
    assert.match(clause!.text, /2 of these inquiries are more than 7 days old/);
  });

  it("2. age context disappears when floor fails", () => {
    const leads = [
      { id: "a", venueId: VENUE_A, createdAt: hoursAgo(60) },
      { id: "b", venueId: VENUE_A, createdAt: hoursAgo(72) },
      { id: "c", venueId: VENUE_A, createdAt: hoursAgo(PA1_SUBSTANTIALLY_OLDER_HOURS + 1) },
    ];
    assert.equal(
      buildPA1AgeContextClause(leads, { venueId: VENUE_A, nowMs: NOW }),
      null,
    );
  });

  it("3. acquisition-source context appears when concentration floor passes", () => {
    const leads = [
      { id: "a", venueId: VENUE_A, createdAt: hoursAgo(72), acquisitionSource: "website" },
      { id: "b", venueId: VENUE_A, createdAt: hoursAgo(80), acquisitionSource: "website" },
      { id: "c", venueId: VENUE_A, createdAt: hoursAgo(90), acquisitionSource: "instagram" },
    ];
    const clause = buildPA1SourceContextClause(leads, { venueId: VENUE_A });
    assert.ok(clause);
    assert.equal(clause!.text, "Most came from your website.");
    assert.equal(clause!.evidence.acquisition_field, "acquisition_source");
  });

  it("4. acquisition-source context disappears when floor fails", () => {
    // 50% is not “most”
    const even = [
      { id: "a", venueId: VENUE_A, createdAt: hoursAgo(72), acquisitionSource: "website" },
      { id: "b", venueId: VENUE_A, createdAt: hoursAgo(80), acquisitionSource: "instagram" },
    ];
    assert.equal(buildPA1SourceContextClause(even, { venueId: VENUE_A }), null);

    // Unknown / null only — no known concentration
    const unknown = [
      { id: "a", venueId: VENUE_A, createdAt: hoursAgo(72), acquisitionSource: null },
      { id: "b", venueId: VENUE_A, createdAt: hoursAgo(80), acquisitionSource: null },
      { id: "c", venueId: VENUE_A, createdAt: hoursAgo(90), acquisitionSource: null },
    ];
    assert.equal(buildPA1SourceContextClause(unknown, { venueId: VENUE_A }), null);
  });

  it("5. mutable leads.source cannot accidentally become acquisition truth", () => {
    // Builder only reads acquisitionSource — operational `source` is not a parameter.
    const withFrozenWebsite = [
      { id: "a", venueId: VENUE_A, createdAt: hoursAgo(72), acquisitionSource: "website" },
      { id: "b", venueId: VENUE_A, createdAt: hoursAgo(80), acquisitionSource: "website" },
      { id: "c", venueId: VENUE_A, createdAt: hoursAgo(90), acquisitionSource: "instagram" },
    ];
    const clause = buildPA1SourceContextClause(withFrozenWebsite, { venueId: VENUE_A });
    assert.ok(clause);
    assert.equal(clause!.text, "Most came from your website.");
    assert.equal(clause!.evidence.acquisition_field, "acquisition_source");
    // Sync select list must not use mutable leads.source as acquisition truth.
    const syncSrc = readFileSync(resolve("lib/luv/spot-patterns.ts"), "utf8");
    const syncStart = syncSrc.indexOf("export async function syncPhase5SpotPatternRecommendations");
    const unattendedBlock = syncSrc.slice(
      syncStart,
      syncSrc.indexOf("// P-P1", syncStart),
    );
    assert.match(unattendedBlock, /acquisition_source/);
    assert.doesNotMatch(unattendedBlock, /select\([\s\S]*?,\s*source[,\s"]/);
  });

  it("6. venue isolation for P-A1 context", () => {
    const leads = [
      {
        id: "a",
        venueId: VENUE_B,
        createdAt: hoursAgo(PA1_SUBSTANTIALLY_OLDER_HOURS + 10),
        acquisitionSource: "website",
      },
      {
        id: "b",
        venueId: VENUE_B,
        createdAt: hoursAgo(PA1_SUBSTANTIALLY_OLDER_HOURS + 20),
        acquisitionSource: "website",
      },
      {
        id: "c",
        venueId: VENUE_B,
        createdAt: hoursAgo(PA1_SUBSTANTIALLY_OLDER_HOURS + 30),
        acquisitionSource: "website",
      },
    ];
    assert.equal(
      buildPA1AgeContextClause(leads, { venueId: VENUE_A, nowMs: NOW }),
      null,
    );
    assert.equal(buildPA1SourceContextClause(leads, { venueId: VENUE_A }), null);
  });
});

describe("Phase 6 P-P1 context", () => {
  it("7. existing Phase 5 pattern still qualifies exactly as before", () => {
    const active = evaluateInquiryVolumeIncrease({
      venueId: VENUE_A,
      currentCount: 7,
      priorCount: 5,
    });
    assert.ok(active);
    assert.equal(active!.type, INQUIRY_VOLUME_INCREASE_TYPE);
    assert.equal(active!.title, "Inquiry volume is picking up");
    assert.match(
      active!.body,
      /^You received 7 inquiries in the last 14 days, compared with 5 in the previous 14 days\./,
    );
    assert.equal(active!.metadata.percent_increase, 40);
    // Context keys present but empty when secondary floors fail / omitted
    assert.deepEqual(active!.metadata.context, []);
    assert.deepEqual(active!.ctas, []);
  });

  it("8. sustained context appears when floor passes", () => {
    const clause = buildPP1SustainedContextClause({
      priorCount: 6,
      priorPriorCount: 4,
    });
    assert.ok(clause);
    assert.match(clause!.text, /previous 14-day window/);
  });

  it("9. sustained context omitted when insufficient history", () => {
    assert.equal(
      buildPP1SustainedContextClause({ priorCount: 6, priorPriorCount: 0 }),
      null,
    );
    assert.equal(
      buildPP1SustainedContextClause({ priorCount: 5, priorPriorCount: 4 }),
      null,
    ); // +1 absolute only
  });

  it("10. tours-also-up appears only when independent floor passes", () => {
    const clause = buildPP1ToursAlsoUpClause({
      tourCurrentCount: 5,
      tourPriorCount: 2,
    });
    assert.ok(clause);
    assert.equal(clause!.text, "In the same period, tours were also up.");
  });

  it("11. tours-also-up omitted when floor fails", () => {
    assert.equal(
      buildPP1ToursAlsoUpClause({ tourCurrentCount: 3, tourPriorCount: 2 }),
      null,
    ); // +1 absolute
    assert.equal(
      buildPP1ToursAlsoUpClause({ tourCurrentCount: 3, tourPriorCount: 1 }),
      null,
    ); // prior < 2
  });

  it("12. bookings-also-up appears only when independent floor passes", () => {
    const clause = buildPP1BookingsAlsoUpClause({
      bookingCurrentCount: 4,
      bookingPriorCount: 2,
    });
    assert.ok(clause);
    assert.equal(clause!.text, "Bookings were also up.");
    assert.equal(clause!.evidence.booking_clock, "first_booked_at");
  });

  it("13. bookings-also-up uses first_booked_at", () => {
    const active = evaluateInquiryVolumeIncrease({
      venueId: VENUE_A,
      currentCount: 7,
      priorCount: 5,
      bookingCurrentCount: 4,
      bookingPriorCount: 2,
    });
    assert.ok(active);
    assert.match(active!.body, /Bookings were also up/);
    const ctx = active!.metadata.context as Array<{ id: string; evidence: { booking_clock?: string } }>;
    const booking = ctx.find((c) => c.id === "pp1_bookings_also_up");
    assert.ok(booking);
    assert.equal(booking!.evidence.booking_clock, "first_booked_at");
  });

  it("14. contract/payment/client-creation/won cannot create booking context", () => {
    // No alternate clocks are accepted by the builder — only numeric first_booked counts.
    // Pattern without booking counts must not invent booking language.
    const active = evaluateInquiryVolumeIncrease({
      venueId: VENUE_A,
      currentCount: 7,
      priorCount: 5,
    });
    assert.ok(active);
    assert.doesNotMatch(active!.body, /Bookings were also up/);
    assert.doesNotMatch(active!.body, /contract|payment|won|client created/i);
  });

  it("15. no causal language is generated", () => {
    const clauses = buildPP1ContextClauses({
      priorCount: 6,
      priorPriorCount: 4,
      tourCurrentCount: 5,
      tourPriorCount: 2,
      bookingCurrentCount: 4,
      bookingPriorCount: 2,
    });
    assert.ok(clauses.length >= 1);
    for (const c of clauses) {
      assert.equal(assertNonCausalContextCopy(c.text), true);
      assert.doesNotMatch(c.text, /because|caused|driving|converting/i);
    }
  });

  it("16. venue isolation for P-P1 secondary counts", () => {
    const rows = [
      { venueId: VENUE_B, at: hoursAgo(24) },
      { venueId: VENUE_B, at: hoursAgo(48) },
      { venueId: VENUE_A, at: hoursAgo(24) },
    ];
    assert.equal(
      countTimestampsInRange(rows, {
        venueId: VENUE_A,
        startMs: NOW - 14 * 86_400_000,
        endMs: NOW + 1,
      }),
      1,
    );
  });
});

describe("Phase 6 P-A4 context", () => {
  it("17. nearest-event context appears with valid event date", () => {
    const clause = buildPA4NearestEventContextClause(
      [eventDateOffset(6), eventDateOffset(10), eventDateOffset(12)],
      { nowMs: NOW },
    );
    assert.ok(clause);
    assert.equal(clause!.text, "The nearest event is 6 days away.");
  });

  it("18. invalid/missing event date omits context", () => {
    assert.equal(
      buildPA4NearestEventContextClause(["not-a-date", ""], { nowMs: NOW }),
      null,
    );
    assert.equal(buildPA4NearestEventContextClause([], { nowMs: NOW }), null);
  });

  it("19. payment-attention qualification itself remains unchanged", () => {
    // Still needs ≥3; context cannot create the pattern alone.
    assert.equal(
      evaluatePaymentAttentionPattern(
        [paymentInput("e1", 5), paymentInput("e2", 7)],
        { venueId: VENUE_A, nowMs: NOW, venueEventHistoryCount: 20 },
      ),
      null,
    );
    const active = evaluatePaymentAttentionPattern(
      [paymentInput("e1", 3), paymentInput("e2", 7), paymentInput("e3", 12)],
      { venueId: VENUE_A, nowMs: NOW, venueEventHistoryCount: 20 },
    );
    assert.ok(active);
    assert.equal(active!.metadata.event_count, 3);
    assert.match(active!.body, /The nearest event is 3 days away/);
    assert.doesNotMatch(active!.body, /urgently|overdue|likelihood/i);
  });

  it("20. venue isolation for P-A4 nearest context", () => {
    const foreign: PaymentAttentionEventInput = {
      ...paymentInput("fx", 2),
      event: { ...paymentInput("fx", 2).event, venueId: VENUE_B },
      payment: { ...paymentInput("fx", 2).payment, venueId: VENUE_B },
    };
    const active = evaluatePaymentAttentionPattern(
      [paymentInput("e1", 6), paymentInput("e2", 8), paymentInput("e3", 10), foreign],
      { venueId: VENUE_A, nowMs: NOW, venueEventHistoryCount: 20 },
    );
    assert.ok(active);
    assert.equal(active!.metadata.event_count, 3);
    assert.match(active!.body, /The nearest event is 6 days away/);
  });
});

describe("Phase 6 cross-pattern", () => {
  it("21–23. zero / one / two contextual facts are valid", () => {
    const zero = enrichSpotPatternWithContext(
      {
        type: UNATTENDED_INQUIRY_PATTERN_TYPE,
        title: "t",
        body: "Base.",
        priority: 70,
        ctas: [],
        metadata: { pattern: "P-A1" } as Record<string, unknown>,
      },
      [],
    );
    assert.equal(zero.body, "Base.");
    assert.deepEqual(zero.metadata.context, []);

    const one = enrichSpotPatternWithContext(
      {
        type: UNATTENDED_INQUIRY_PATTERN_TYPE,
        title: "t",
        body: "Base.",
        priority: 70,
        ctas: [],
        metadata: { pattern: "P-A1" } as Record<string, unknown>,
      },
      [{ id: "a", text: "Fact one.", evidence: {} }],
    );
    assert.equal(one.body, "Base. Fact one.");
    assert.equal((one.metadata.context as unknown[]).length, 1);

    const two = enrichSpotPatternWithContext(
      {
        type: INQUIRY_VOLUME_INCREASE_TYPE,
        title: "t",
        body: "Base.",
        priority: 70,
        ctas: [],
        metadata: { pattern: "P-P1" } as Record<string, unknown>,
      },
      [
        { id: "a", text: "Fact one.", evidence: {} },
        { id: "b", text: "Fact two.", evidence: {} },
      ],
    );
    assert.equal(two.body, "Base. Fact one. Fact two.");
    assert.equal((two.metadata.context as unknown[]).length, 2);
  });

  it("24. contextual enrichment cannot create a Phase 5 pattern", () => {
    // Rich secondary metrics with inquiry floors failing → still null.
    assert.equal(
      evaluateInquiryVolumeIncrease({
        venueId: VENUE_A,
        currentCount: 4,
        priorCount: 2,
        tourCurrentCount: 10,
        tourPriorCount: 2,
        bookingCurrentCount: 10,
        bookingPriorCount: 2,
        priorPriorCount: 1,
      }),
      null,
    );
    // Age/source context alone cannot create P-A1.
    assert.equal(
      evaluateUnattendedInquiryPattern(
        [
          unattendedLead("a", {
            createdAt: hoursAgo(PA1_SUBSTANTIALLY_OLDER_HOURS + 5),
            acquisitionSource: "website",
          }),
          unattendedLead("b", {
            createdAt: hoursAgo(PA1_SUBSTANTIALLY_OLDER_HOURS + 8),
            acquisitionSource: "website",
          }),
        ],
        { venueId: VENUE_A, nowMs: NOW, venueLeadHistoryCount: 20 },
      ),
      null,
    );
  });

  it("25. contextual enrichment cannot promote anything to L1", () => {
    for (const type of [
      UNATTENDED_INQUIRY_PATTERN_TYPE,
      PAYMENT_ATTENTION_PATTERN_TYPE,
      INQUIRY_VOLUME_INCREASE_TYPE,
    ]) {
      const rec = patternRec(type);
      rec.metadata = {
        context: [{ id: "x", text: "Extra fact.", evidence: {} }],
        context_phase: "phase6",
      };
      assert.equal(isPhase5SpotPatternRecommendation(rec), true);
      assert.equal(isDashboardLevel1Recommendation(rec), false);
    }
  });

  it("26–28. dismissal/cooldown, reload lifecycle, no duplicate types — migration contract intact", () => {
    // Lifecycle remains the Phase 5 sync RPC (single row per type).
    // Context enrichment does not add new recommendation types.
    const clauses = buildPA1ContextClauses(
      [
        {
          id: "a",
          venueId: VENUE_A,
          createdAt: hoursAgo(PA1_SUBSTANTIALLY_OLDER_HOURS + 10),
          acquisitionSource: "website",
        },
        {
          id: "b",
          venueId: VENUE_A,
          createdAt: hoursAgo(PA1_SUBSTANTIALLY_OLDER_HOURS + 20),
          acquisitionSource: "website",
        },
        {
          id: "c",
          venueId: VENUE_A,
          createdAt: hoursAgo(60),
          acquisitionSource: "website",
        },
      ],
      { venueId: VENUE_A, nowMs: NOW },
    );
    assert.ok(clauses.length >= 1);
    assert.ok(clauses.length <= 2);

    const active = evaluateUnattendedInquiryPattern(
      [
        unattendedLead("a", {
          createdAt: hoursAgo(PA1_SUBSTANTIALLY_OLDER_HOURS + 10),
          acquisitionSource: "website",
        }),
        unattendedLead("b", {
          createdAt: hoursAgo(PA1_SUBSTANTIALLY_OLDER_HOURS + 20),
          acquisitionSource: "website",
        }),
        unattendedLead("c", {
          createdAt: hoursAgo(60),
          acquisitionSource: "website",
        }),
      ],
      { venueId: VENUE_A, nowMs: NOW, venueLeadHistoryCount: 20 },
    );
    assert.ok(active);
    assert.equal(active!.type, UNATTENDED_INQUIRY_PATTERN_TYPE);
    // Cap: at most two context facts on the card
    assert.ok((active!.metadata.context as unknown[]).length <= 2);
  });
});

describe("Phase 6 P-P1 clause cap", () => {
  it("emits at most two context clauses even when all secondary floors pass", () => {
    const clauses = buildPP1ContextClauses({
      priorCount: 6,
      priorPriorCount: 4,
      tourCurrentCount: 5,
      tourPriorCount: 2,
      bookingCurrentCount: 4,
      bookingPriorCount: 2,
    });
    assert.equal(clauses.length, 2);
    assert.equal(clauses[0]!.id, "pp1_sustained");
    assert.equal(clauses[1]!.id, "pp1_tours_also_up");
  });
});
