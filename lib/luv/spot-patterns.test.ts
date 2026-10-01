/**
 * Luv Phase 5 — Spot Patterns (P-A1, P-A4, P-P1) + booking metric repair.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  isDashboardLevel1Recommendation,
  selectLuvDashboardEntry,
} from "@/lib/dashboard-system/luv-entry";
import { buildS2EventPaymentObservation, buildS3UnattendedInquiryObservation } from "@/lib/luv/contextual-signals";
import type { VenueRecommendation } from "@/lib/luv/recommendation-types";
import type { LuvObservation } from "@/lib/luv/types";
import {
  INQUIRY_VOLUME_INCREASE_TYPE,
  INQUIRY_VOLUME_MIN_ABSOLUTE,
  INQUIRY_VOLUME_MIN_CURRENT,
  INQUIRY_VOLUME_MIN_PCT,
  PAYMENT_ATTENTION_PATTERN_TYPE,
  SPOT_PATTERN_MIN_CLUSTER,
  SPOT_PATTERN_MIN_VENUE_HISTORY,
  SPOT_PATTERN_WINDOW_DAYS,
  UNATTENDED_INQUIRY_PATTERN_TYPE,
  countLeadsCreatedInRange,
  evaluateInquiryVolumeIncrease,
  evaluatePaymentAttentionPattern,
  evaluateUnattendedInquiryPattern,
  filterGlobalObservationsForSpotPatterns,
  isPhase5SpotPatternRecommendation,
  isQualifyingPaymentAttentionForCluster,
  isQualifyingUnattendedInquiryForCluster,
  type PaymentAttentionEventInput,
} from "@/lib/luv/spot-patterns";

const ROOT = process.cwd();
const VENUE_A = "venue-a";
const VENUE_B = "venue-b";
const NOW = Date.parse("2026-09-30T15:00:00.000Z");
const MIGRATION = "supabase/migrations/20261410100000_luv_phase5_spot_patterns.sql";

function read(rel: string) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function hoursAgo(hours: number): string {
  return new Date(NOW - hours * 3_600_000).toISOString();
}

function daysAgo(days: number): string {
  return new Date(NOW - days * 86_400_000).toISOString();
}

function eventDateOffset(days: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function lead(
  id: string,
  overrides: Partial<{
    venueId: string;
    createdAt: string;
    lastContactedAt: string | null;
    salesStage: string;
  }> = {},
) {
  return {
    id,
    venueId: overrides.venueId ?? VENUE_A,
    firstName: "Pat",
    lastName: id,
    salesStage: overrides.salesStage ?? "new_inquiry",
    createdAt: overrides.createdAt ?? hoursAgo(72),
    lastContactedAt: overrides.lastContactedAt === undefined ? null : overrides.lastContactedAt,
  };
}

function paymentInput(
  eventId: string,
  daysUntil: number,
  overrides: Partial<PaymentAttentionEventInput["payment"]> = {},
): PaymentAttentionEventInput {
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
      ...overrides,
    },
  };
}

function patternRec(
  type: string,
  overrides: Partial<VenueRecommendation> = {},
): VenueRecommendation {
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
    ...overrides,
  } as VenueRecommendation;
}

describe("P-A1 — unattended inquiry cluster", () => {
  it("below threshold → no pattern", () => {
    const leads = [lead("a"), lead("b")];
    assert.equal(
      evaluateUnattendedInquiryPattern(leads, {
        venueId: VENUE_A,
        nowMs: NOW,
        venueLeadHistoryCount: 20,
      }),
      null,
    );
  });

  it("3 qualifying unattended inquiries → pattern", () => {
    const leads = [lead("a"), lead("b"), lead("c")];
    const active = evaluateUnattendedInquiryPattern(leads, {
      venueId: VENUE_A,
      nowMs: NOW,
      venueLeadHistoryCount: 20,
    });
    assert.ok(active);
    assert.equal(active!.type, UNATTENDED_INQUIRY_PATTERN_TYPE);
    assert.equal(active!.metadata.lead_count, 3);
    assert.match(active!.title, /3 recent inquiries/);
  });

  it("P-A1 Help on Leads — no same-surface /leads CTA and no replacement CTA", () => {
    const leads = [lead("a"), lead("b"), lead("c")];
    const active = evaluateUnattendedInquiryPattern(leads, {
      venueId: VENUE_A,
      nowMs: NOW,
      venueLeadHistoryCount: 20,
    });
    assert.ok(active);
    assert.equal(active!.type, UNATTENDED_INQUIRY_PATTERN_TYPE);
    assert.deepEqual(active!.ctas, []);
    assert.equal(
      active!.ctas.some((cta) => cta.target === "/leads" || /review inquiries/i.test(cta.label)),
      false,
    );
    const src = read("lib/luv/spot-patterns.ts");
    const fnStart = src.indexOf("export function evaluateUnattendedInquiryPattern");
    const fnEnd = src.indexOf("export type PaymentAttentionEventInput", fnStart);
    const fn = src.slice(fnStart, fnEnd);
    assert.match(fn, /ctas:\s*\[\]/);
    assert.doesNotMatch(fn, /Review inquiries/);
    assert.doesNotMatch(fn, /target:\s*"\/leads"/);
  });

  it("insufficient venue history → no pattern even at cluster size", () => {
    const leads = [lead("a"), lead("b"), lead("c")];
    assert.equal(
      evaluateUnattendedInquiryPattern(leads, {
        venueId: VENUE_A,
        nowMs: NOW,
        venueLeadHistoryCount: SPOT_PATTERN_MIN_VENUE_HISTORY - 1,
      }),
      null,
    );
  });

  it("reuses S3 semantics (contacted / wrong stage / too new excluded)", () => {
    const contacted = lead("x", { lastContactedAt: hoursAgo(1) });
    const touring = lead("y", { salesStage: "touring" });
    const fresh = lead("z", { createdAt: hoursAgo(12) });
    const ok = lead("ok");
    assert.equal(buildS3UnattendedInquiryObservation(contacted, { venueId: VENUE_A, nowMs: NOW }), null);
    assert.equal(
      isQualifyingUnattendedInquiryForCluster(contacted, { venueId: VENUE_A, nowMs: NOW }),
      false,
    );
    assert.equal(
      isQualifyingUnattendedInquiryForCluster(touring, { venueId: VENUE_A, nowMs: NOW }),
      false,
    );
    assert.equal(
      isQualifyingUnattendedInquiryForCluster(fresh, { venueId: VENUE_A, nowMs: NOW }),
      false,
    );
    assert.equal(
      isQualifyingUnattendedInquiryForCluster(ok, { venueId: VENUE_A, nowMs: NOW }),
      true,
    );
  });

  it("outside 14-day window → excluded from cluster", () => {
    const old = lead("old", { createdAt: daysAgo(SPOT_PATTERN_WINDOW_DAYS + 2) });
    // Still S3-unattended (48h+) but outside pattern window.
    assert.ok(buildS3UnattendedInquiryObservation(old, { venueId: VENUE_A, nowMs: NOW }));
    assert.equal(
      isQualifyingUnattendedInquiryForCluster(old, { venueId: VENUE_A, nowMs: NOW }),
      false,
    );
  });

  it("venue isolation — other venue leads do not qualify", () => {
    const other = lead("o", { venueId: VENUE_B });
    assert.equal(
      isQualifyingUnattendedInquiryForCluster(other, { venueId: VENUE_A, nowMs: NOW }),
      false,
    );
    assert.equal(
      evaluateUnattendedInquiryPattern(
        [lead("a"), lead("b"), other],
        { venueId: VENUE_A, nowMs: NOW, venueLeadHistoryCount: 20 },
      ),
      null,
    );
  });

  it("resolved condition (below threshold) → evaluator returns null (lifecycle clear)", () => {
    assert.equal(
      evaluateUnattendedInquiryPattern([lead("a"), lead("b")], {
        venueId: VENUE_A,
        nowMs: NOW,
        venueLeadHistoryCount: 20,
      }),
      null,
    );
  });
});

describe("P-A4 — payment-attention cluster", () => {
  it("below threshold → no pattern", () => {
    const inputs = [paymentInput("e1", 5), paymentInput("e2", 7)];
    assert.equal(
      evaluatePaymentAttentionPattern(inputs, {
        venueId: VENUE_A,
        nowMs: NOW,
        venueEventHistoryCount: 20,
      }),
      null,
    );
  });

  it("3 qualifying upcoming payment-attention events → pattern", () => {
    const inputs = [paymentInput("e1", 3), paymentInput("e2", 7), paymentInput("e3", 12)];
    const active = evaluatePaymentAttentionPattern(inputs, {
      venueId: VENUE_A,
      nowMs: NOW,
      venueEventHistoryCount: 20,
    });
    assert.ok(active);
    assert.equal(active!.type, PAYMENT_ATTENTION_PATTERN_TYPE);
    assert.equal(active!.metadata.event_count, 3);
    assert.match(active!.title, /3 upcoming events need payment attention/);
    assert.equal(active!.ctas[0]?.target, "/payments?filter=attention");
  });

  it("uses authoritative S2 payment-attention logic", () => {
    const ok = paymentInput("e1", 5);
    const waiting = paymentInput("e2", 5, { status: "waiting" });
    const outside14 = paymentInput("e3", 18); // S2 allows ≤21d; cluster requires ≤14d
    assert.ok(buildS2EventPaymentObservation(ok.event, ok.payment, { venueId: VENUE_A, nowMs: NOW }));
    assert.equal(
      isQualifyingPaymentAttentionForCluster(ok, { venueId: VENUE_A, nowMs: NOW }),
      true,
    );
    assert.equal(
      isQualifyingPaymentAttentionForCluster(waiting, { venueId: VENUE_A, nowMs: NOW }),
      false,
    );
    assert.ok(
      buildS2EventPaymentObservation(outside14.event, outside14.payment, {
        venueId: VENUE_A,
        nowMs: NOW,
      }),
    );
    assert.equal(
      isQualifyingPaymentAttentionForCluster(outside14, { venueId: VENUE_A, nowMs: NOW }),
      false,
    );
  });

  it("venue isolation", () => {
    const foreign: PaymentAttentionEventInput = {
      ...paymentInput("fx", 5),
      event: { ...paymentInput("fx", 5).event, venueId: VENUE_B },
      payment: { ...paymentInput("fx", 5).payment, venueId: VENUE_B },
    };
    assert.equal(
      isQualifyingPaymentAttentionForCluster(foreign, { venueId: VENUE_A, nowMs: NOW }),
      false,
    );
  });

  it("no duplicate competing aggregate cards when pattern active", () => {
    const pattern = patternRec(PAYMENT_ATTENTION_PATTERN_TYPE);
    const observations: LuvObservation[] = [
      {
        id: "event-payment-attention-e1",
        kind: "risk",
        priority: "high",
        message: "Event needs payment",
        link: "/payments",
      },
      {
        id: "inquiry-unattended-L1",
        kind: "recommendation",
        priority: "medium",
        message: "Inquiry waiting",
        link: "/leads/L1",
      },
      {
        id: "setup-gap-website",
        kind: "recommendation",
        priority: "low",
        message: "Publish website",
        link: "/website",
      },
    ];
    const filtered = filterGlobalObservationsForSpotPatterns(observations, [pattern]);
    assert.deepEqual(
      filtered.map((o) => o.id),
      ["inquiry-unattended-L1", "setup-gap-website"],
    );
  });

  it("resolved condition → null", () => {
    assert.equal(
      evaluatePaymentAttentionPattern([paymentInput("e1", 5)], {
        venueId: VENUE_A,
        nowMs: NOW,
        venueEventHistoryCount: 20,
      }),
      null,
    );
  });
});

describe("P-P1 — inquiry volume increase", () => {
  it("below 5 current inquiries → no pattern", () => {
    assert.equal(
      evaluateInquiryVolumeIncrease({
        venueId: VENUE_A,
        currentCount: INQUIRY_VOLUME_MIN_CURRENT - 1,
        priorCount: 2,
      }),
      null,
    );
  });

  it("<25% increase → no pattern", () => {
    assert.equal(
      evaluateInquiryVolumeIncrease({
        venueId: VENUE_A,
        currentCount: 6,
        priorCount: 5, // +20%
      }),
      null,
    );
  });

  it("<2 absolute increase → no pattern", () => {
    assert.equal(
      evaluateInquiryVolumeIncrease({
        venueId: VENUE_A,
        currentCount: 5,
        priorCount: 4, // +1 absolute, 25%
      }),
      null,
    );
    assert.ok(INQUIRY_VOLUME_MIN_ABSOLUTE >= 2);
    assert.ok(INQUIRY_VOLUME_MIN_PCT >= 25);
  });

  it("no prior baseline → no pattern (cannot claim increase)", () => {
    assert.equal(
      evaluateInquiryVolumeIncrease({
        venueId: VENUE_A,
        currentCount: 8,
        priorCount: 0,
      }),
      null,
    );
  });

  it("qualifying increase → pattern with evidence copy", () => {
    const active = evaluateInquiryVolumeIncrease({
      venueId: VENUE_A,
      currentCount: 7,
      priorCount: 5,
    });
    assert.ok(active);
    assert.equal(active!.type, INQUIRY_VOLUME_INCREASE_TYPE);
    assert.equal(active!.title, "Inquiry volume is picking up");
    assert.equal(
      active!.body,
      "You received 7 inquiries in the last 14 days, compared with 5 in the previous 14 days.",
    );
    assert.equal(active!.metadata.percent_increase, 40);
    assert.equal(active!.metadata.absolute_increase, 2);
    // P-P1 lives on /leads — no redundant "View inquiries" CTA, and no replacement invented.
    assert.deepEqual(active!.ctas, []);
  });

  it("P-P1 still qualifies as Inform L2 — no CTA invented; suppressed from Leads panel", () => {
    const active = evaluateInquiryVolumeIncrease({
      venueId: VENUE_A,
      currentCount: 20,
      priorCount: 5,
      priorPriorCount: 3,
      tourCurrentCount: 5,
      tourPriorCount: 2,
    });
    assert.ok(active);
    assert.equal(active!.type, INQUIRY_VOLUME_INCREASE_TYPE);
    assert.equal(active!.title, "Inquiry volume is picking up");
    assert.match(
      active!.body,
      /^You received 20 inquiries in the last 14 days, compared with 5 in the previous 14 days\./,
    );
    assert.match(active!.body, /previous 14-day window|tours/i);
    assert.deepEqual(active!.ctas, []);
    assert.equal(
      active!.ctas.some((cta) => cta.target === "/leads" || /view inquiries/i.test(cta.label)),
      false,
    );
    const src = read("lib/luv/spot-patterns.ts");
    const fnStart = src.indexOf("export function evaluateInquiryVolumeIncrease");
    const fnEnd = src.indexOf("export function countLeadsCreatedInRange", fnStart);
    const fn = src.slice(fnStart, fnEnd);
    assert.match(fn, /ctas:\s*\[\]/);
    assert.doesNotMatch(fn, /View inquiries/);
    assert.doesNotMatch(fn, /target:\s*"\/leads"/);
    // Leads "Recommended next steps" must not mount Inform P-P1.
    const leadsTypes = read("components/luv/spot-pattern-recommendations.tsx");
    assert.match(leadsTypes, /LEADS_SPOT_PATTERN_TYPES/);
    assert.doesNotMatch(
      leadsTypes.slice(
        leadsTypes.indexOf("LEADS_SPOT_PATTERN_TYPES"),
        leadsTypes.indexOf("PAYMENTS_SPOT_PATTERN_TYPES"),
      ),
      /INQUIRY_VOLUME_INCREASE_TYPE/,
    );
    assert.equal(isDashboardLevel1Recommendation(patternRec(INQUIRY_VOLUME_INCREASE_TYPE)), false);
    const panel = read("components/dashboard/recommendations-panel.tsx");
    assert.match(panel, /rec\.ctas\.length > 0 &&/);
  });

  it("correct current/prior 14-day counts + venue isolation", () => {
    const leads = [
      { venueId: VENUE_A, createdAt: daysAgo(2) },
      { venueId: VENUE_A, createdAt: daysAgo(5) },
      { venueId: VENUE_A, createdAt: daysAgo(10) },
      { venueId: VENUE_A, createdAt: daysAgo(16) },
      { venueId: VENUE_A, createdAt: daysAgo(20) },
      { venueId: VENUE_B, createdAt: daysAgo(1) },
      { venueId: VENUE_A, createdAt: daysAgo(40) },
    ];
    const currentStart = NOW - SPOT_PATTERN_WINDOW_DAYS * 86_400_000;
    const priorStart = NOW - 2 * SPOT_PATTERN_WINDOW_DAYS * 86_400_000;
    assert.equal(
      countLeadsCreatedInRange(leads, { venueId: VENUE_A, startMs: currentStart, endMs: NOW + 1 }),
      3,
    );
    assert.equal(
      countLeadsCreatedInRange(leads, { venueId: VENUE_A, startMs: priorStart, endMs: currentStart }),
      2,
    );
  });
});

describe("Phase 5 — Dashboard L1 exclusion + supersession", () => {
  it("Phase 5 patterns are never Dashboard L1", () => {
    for (const type of [
      UNATTENDED_INQUIRY_PATTERN_TYPE,
      PAYMENT_ATTENTION_PATTERN_TYPE,
      INQUIRY_VOLUME_INCREASE_TYPE,
    ]) {
      const rec = patternRec(type);
      assert.equal(isPhase5SpotPatternRecommendation(rec), true);
      assert.equal(isDashboardLevel1Recommendation(rec), false);
    }
  });

  it("Phase 5 pattern does not win Dashboard L1 card", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [
        {
          id: "setup-gap-website",
          kind: "recommendation",
          priority: "medium",
          message: "Publish your website",
          link: "/website",
          actionLabel: "Open website",
        },
      ],
      recommendations: [
        patternRec(UNATTENDED_INQUIRY_PATTERN_TYPE, {
          title: "3 recent inquiries still need a first response",
          body: "Cluster",
          ctas: [],
        }),
      ],
    });
    // Falls through to Level-1 observation, not the Phase 5 L2 pattern.
    assert.equal(entry?.message, "Publish your website");
  });

  it("active P-A1 suppresses global S3 observations; record ids remain filterable", () => {
    const observations: LuvObservation[] = [
      {
        id: "inquiry-unattended-L1",
        kind: "recommendation",
        priority: "medium",
        message: "A",
        link: "/leads/L1",
      },
      {
        id: "inquiry-unattended-L2",
        kind: "recommendation",
        priority: "medium",
        message: "B",
        link: "/leads/L2",
      },
      {
        id: "event-contract-unsigned-c1",
        kind: "risk",
        priority: "high",
        message: "C",
        link: "/contracts/c1",
      },
    ];
    const filtered = filterGlobalObservationsForSpotPatterns(observations, [
      patternRec(UNATTENDED_INQUIRY_PATTERN_TYPE),
    ]);
    assert.deepEqual(
      filtered.map((o) => o.id),
      ["event-contract-unsigned-c1"],
    );
  });

  it("dismissed-in-cooldown P-A1 still suppresses global S3", () => {
    const dismissed = patternRec(UNATTENDED_INQUIRY_PATTERN_TYPE, {
      dismissedAt: new Date(NOW - 2 * 86_400_000).toISOString(),
    });
    const filtered = filterGlobalObservationsForSpotPatterns(
      [
        {
          id: "inquiry-unattended-L1",
          kind: "recommendation",
          priority: "medium",
          message: "A",
          link: "/leads/L1",
        },
      ],
      [dismissed],
    );
    assert.deepEqual(filtered, []);
  });
});

describe("Booking metric repair — canonical Lead→Booked", () => {
  it("migration sync RPC + pattern types exist", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /sync_luv_spot_pattern_recommendation/);
    assert.match(sql, /unattended_inquiry_pattern/);
    assert.match(sql, /payment_attention_pattern/);
    assert.match(sql, /inquiry_volume_increase/);
    assert.match(sql, /Never resurrects a dismissal within 7 days/);
  });

  it("get_venue_trends uses first_booked_at — not status=won", () => {
    const sql = read(MIGRATION);
    const trendsStart = sql.indexOf("create or replace function public.get_venue_trends()");
    const trendsEnd = sql.indexOf(
      "grant execute on function public.get_venue_trends() to authenticated;",
    );
    const trends = sql.slice(trendsStart, trendsEnd);
    assert.match(trends, /first_booked_at/);
    assert.doesNotMatch(trends, /status\s*=\s*'won'/);
    assert.doesNotMatch(trends, /from clients/);
  });

  it("compute_venue_insights momentum uses first_booked_at — not clients.created_at", () => {
    const sql = read(MIGRATION);
    const insightsStart = sql.indexOf("create or replace function public.compute_venue_insights()");
    const insights = sql.slice(insightsStart);
    // Momentum block must count first_booked_at
    assert.match(insights, /first_booked_at >= now\(\) - interval '14 days'/);
    assert.match(insights, /'clock',\s+'first_booked_at'/);
    // Must not count clients.created_at as bookings
    const momentum = insights.slice(insights.indexOf("-- ── 3. Momentum"));
    assert.doesNotMatch(momentum, /from clients where venue_id/);
    assert.doesNotMatch(momentum, /status\s*=\s*'won'/);
    assert.match(insights, /current_user_venue_id\(\)/);
  });

  it("wiring syncs Phase 5 patterns; L1 gate excludes them; Leads omits Inform P-P1", () => {
    const service = read("lib/luv/recommendation-service.ts");
    assert.match(service, /syncPhase5SpotPatternRecommendations/);
    const entry = read("lib/dashboard-system/luv-entry.ts");
    assert.match(entry, /isPhase5SpotPatternRecommendation/);
    assert.match(entry, /Phase 5 Spot Patterns are L2/);
    const dash = read("lib/dashboard/service.ts");
    assert.doesNotMatch(dash, /filterGlobalObservationsForSpotPatterns/);
    assert.doesNotMatch(dash, /from "@\/lib\/luv\/observations"/);
    const leadsPage = read("app/(app)/leads/page.tsx");
    assert.match(leadsPage, /SpotPatternRecommendationsPanel/);
    assert.match(leadsPage, /LEADS_SPOT_PATTERN_TYPES/);
    const spotPanel = read("components/luv/spot-pattern-recommendations.tsx");
    const leadsBlock = spotPanel.slice(
      spotPanel.indexOf("LEADS_SPOT_PATTERN_TYPES"),
      spotPanel.indexOf("PAYMENTS_SPOT_PATTERN_TYPES"),
    );
    assert.match(leadsBlock, /UNATTENDED_INQUIRY_PATTERN_TYPE/);
    assert.doesNotMatch(leadsBlock, /INQUIRY_VOLUME_INCREASE_TYPE/);
    assert.doesNotMatch(leadsBlock, /PAYMENT_ATTENTION_PATTERN_TYPE/);
    const paymentsBlock = spotPanel.slice(spotPanel.indexOf("PAYMENTS_SPOT_PATTERN_TYPES"));
    assert.match(paymentsBlock, /PAYMENT_ATTENTION_PATTERN_TYPE/);
    assert.match(paymentsBlock, /filter=attention|PAYMENT_ATTENTION/);
    const paymentsPage = read("app/(app)/payments/page.tsx");
    assert.match(paymentsPage, /SpotPatternRecommendationsPanel/);
    assert.match(paymentsPage, /PAYMENTS_SPOT_PATTERN_TYPES/);
    const dashPage = read("app/(app)/dashboard/page.tsx");
    assert.doesNotMatch(dashPage, /SpotPatternRecommendationsPanel/);
    // P-A4 CTA destination unchanged in evaluator.
    const patterns = read("lib/luv/spot-patterns.ts");
    const pa4Start = patterns.indexOf("export function evaluatePaymentAttentionPattern");
    const pa4End = patterns.indexOf("export function evaluateInquiryVolumeIncrease", pa4Start);
    assert.match(patterns.slice(pa4Start, pa4End), /\/payments\?filter=attention/);
  });

  it("tour volume for P-P1 does not use exclude_from_business_reporting", () => {
    const src = read("lib/luv/spot-patterns.ts");
    const start = src.lastIndexOf('.from("tour_appointments")');
    const tourBlock = src.slice(start, src.indexOf("priorStart),", start) + "priorStart),".length);
    assert.match(tourBlock, /scheduled_at/);
    assert.doesNotMatch(tourBlock, /onlyBusinessReporting/);
    assert.doesNotMatch(tourBlock, /exclude_from_business_reporting/);
  });

  it("manual and automation Lead→Booked share first_booked_at clock", () => {
    const bookSql = read("supabase/migrations/20261408300000_book_relationship_consumes_date_holds.sql");
    assert.match(bookSql, /first_booked_at = coalesce\(first_booked_at, now\(\)\)/);
    const lifecycle = read("lib/lifecycle-bookings/service.ts");
    assert.match(lifecycle, /\.update\(\{ first_booked_at: occurredAt \}\)/);
    assert.match(lifecycle, /\.is\("first_booked_at", null\)/);
    // Trends/insights count that same stamp — not won / client create.
    const sql = read(MIGRATION);
    assert.match(sql, /Canonical booking clock: first_booked_at \(manual or automation Lead→Booked\)/);
    assert.doesNotMatch(
      sql.slice(
        sql.indexOf("create or replace function public.get_venue_trends()"),
        sql.indexOf("grant execute on function public.get_venue_trends()"),
      ),
      /status\s*=\s*'won'/,
    );
  });

  it("cluster size constant is 3+ within 14 days", () => {
    assert.equal(SPOT_PATTERN_MIN_CLUSTER, 3);
    assert.equal(SPOT_PATTERN_WINDOW_DAYS, 14);
  });
});
