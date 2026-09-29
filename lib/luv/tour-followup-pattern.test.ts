/**
 * Luv V2 — Recurring incomplete tour follow-up pattern.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { selectLuvDashboardEntry } from "@/lib/dashboard-system/luv-entry";
import { evaluateAskGapRecommendations } from "@/lib/luv/ask-gap-recommendations";
import {
  ASK_GAP_MIN_COUNT,
  ASK_GAP_WINDOW_DAYS,
} from "@/lib/luv/ask-gap-topics";
import type { VenueRecommendation } from "@/lib/luv/recommendation-types";
import type { LuvObservation } from "@/lib/luv/types";
import {
  TOUR_FOLLOWUP_PATTERN_CTA,
  TOUR_FOLLOWUP_PATTERN_MIN_LEADS,
  TOUR_FOLLOWUP_PATTERN_TYPE,
  TOUR_FOLLOWUP_PATTERN_WINDOW_DAYS,
  countDistinctTourFollowupPatternLeads,
  evaluateTourFollowupPatternRecommendation,
  type TourFollowupPatternTourInput,
} from "@/lib/luv/tour-followup-pattern";

const ROOT = process.cwd();
const VENUE_A = "venue-a";
const VENUE_B = "venue-b";
const NOW = Date.parse("2026-09-29T12:00:00.000Z");

function read(rel: string) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function hoursAgo(hours: number): string {
  return new Date(NOW - hours * 3_600_000).toISOString();
}

function daysAgo(days: number): string {
  return new Date(NOW - days * 86_400_000).toISOString();
}

function tour(
  overrides: Partial<TourFollowupPatternTourInput> & { leadId: string },
): TourFollowupPatternTourInput {
  return {
    venueId: VENUE_A,
    status: "completed",
    followUpSentAt: null,
    scheduledAt: hoursAgo(24),
    leadSalesStage: "touring",
    ...overrides,
  };
}

describe("tour follow-up pattern — threshold and distinct leads", () => {
  it("0 qualifying leads → no recommendation", () => {
    assert.equal(
      evaluateTourFollowupPatternRecommendation([], { venueId: VENUE_A, nowMs: NOW }),
      null,
    );
  });

  it("1 distinct qualifying lead → no recommendation", () => {
    const active = evaluateTourFollowupPatternRecommendation(
      [tour({ leadId: "l1" })],
      { venueId: VENUE_A, nowMs: NOW },
    );
    assert.equal(active, null);
  });

  it("2 distinct qualifying leads → no recommendation", () => {
    const active = evaluateTourFollowupPatternRecommendation(
      [tour({ leadId: "l1" }), tour({ leadId: "l2" })],
      { venueId: VENUE_A, nowMs: NOW },
    );
    assert.equal(active, null);
  });

  it("3 distinct qualifying leads → recommendation with count", () => {
    const active = evaluateTourFollowupPatternRecommendation(
      [tour({ leadId: "l1" }), tour({ leadId: "l2" }), tour({ leadId: "l3" })],
      { venueId: VENUE_A, nowMs: NOW },
    );
    assert.ok(active);
    assert.equal(active!.type, TOUR_FOLLOWUP_PATTERN_TYPE);
    assert.equal(active!.title, "3 recent tours still need follow-up");
    assert.equal(active!.body, "These are completed tours with no recorded follow-up.");
    assert.equal(active!.metadata.lead_count, 3);
    assert.equal(active!.metadata.window_days, TOUR_FOLLOWUP_PATTERN_WINDOW_DAYS);
    assert.equal(active!.ctas[0]?.target, TOUR_FOLLOWUP_PATTERN_CTA.target);
    assert.equal(active!.ctas[0]?.label, TOUR_FOLLOWUP_PATTERN_CTA.label);
    assert.equal(TOUR_FOLLOWUP_PATTERN_MIN_LEADS, 3);
    assert.equal(TOUR_FOLLOWUP_PATTERN_WINDOW_DAYS, 7);
  });

  it("duplicate tours for the same lead do not inflate the count", () => {
    const count = countDistinctTourFollowupPatternLeads(
      [
        tour({ leadId: "l1", scheduledAt: hoursAgo(10) }),
        tour({ leadId: "l1", scheduledAt: hoursAgo(20) }),
        tour({ leadId: "l1", scheduledAt: hoursAgo(30) }),
        tour({ leadId: "l2" }),
        tour({ leadId: "l3" }),
      ],
      { venueId: VENUE_A, nowMs: NOW },
    );
    assert.equal(count, 3);
    const active = evaluateTourFollowupPatternRecommendation(
      [
        tour({ leadId: "l1" }),
        tour({ leadId: "l1" }),
        tour({ leadId: "l2" }),
      ],
      { venueId: VENUE_A, nowMs: NOW },
    );
    assert.equal(active, null, "two distinct leads must not qualify");
  });
});

describe("tour follow-up pattern — population filters", () => {
  it("excludes cancelled / lost / booked / won leads", () => {
    for (const stage of ["cancelled", "lost", "booked", "won"]) {
      const below = evaluateTourFollowupPatternRecommendation(
        [
          tour({ leadId: "l1", leadSalesStage: stage }),
          tour({ leadId: "l2", leadSalesStage: stage }),
          tour({ leadId: "l3" }),
          tour({ leadId: "l4" }),
        ],
        { venueId: VENUE_A, nowMs: NOW },
      );
      assert.equal(below, null, `terminal stage ${stage} must not pad the count`);
    }
  });

  it("follow_up_sent_at removes a lead from the qualifying population", () => {
    const active = evaluateTourFollowupPatternRecommendation(
      [
        tour({ leadId: "l1", followUpSentAt: hoursAgo(1) }),
        tour({ leadId: "l2" }),
        tour({ leadId: "l3" }),
        tour({ leadId: "l4" }),
      ],
      { venueId: VENUE_A, nowMs: NOW },
    );
    // l1 out → still 3 (l2,l3,l4)
    assert.equal(active?.metadata.lead_count, 3);

    const below = evaluateTourFollowupPatternRecommendation(
      [
        tour({ leadId: "l1", followUpSentAt: hoursAgo(1) }),
        tour({ leadId: "l2" }),
        tour({ leadId: "l3" }),
      ],
      { venueId: VENUE_A, nowMs: NOW },
    );
    assert.equal(below, null);
  });

  it("outside-window tour does not count", () => {
    const below = evaluateTourFollowupPatternRecommendation(
      [
        tour({ leadId: "l1", scheduledAt: daysAgo(8) }),
        tour({ leadId: "l2" }),
        tour({ leadId: "l3" }),
      ],
      { venueId: VENUE_A, nowMs: NOW },
    );
    assert.equal(below, null);
  });

  it("wrong venue cannot contribute", () => {
    const below = evaluateTourFollowupPatternRecommendation(
      [
        tour({ leadId: "l1", venueId: VENUE_B }),
        tour({ leadId: "l2" }),
        tour({ leadId: "l3" }),
      ],
      { venueId: VENUE_A, nowMs: NOW },
    );
    assert.equal(below, null);
  });

  it("non-completed status does not count", () => {
    const below = evaluateTourFollowupPatternRecommendation(
      [
        tour({ leadId: "l1", status: "scheduled" }),
        tour({ leadId: "l2" }),
        tour({ leadId: "l3" }),
      ],
      { venueId: VENUE_A, nowMs: NOW },
    );
    assert.equal(below, null);
  });

  it("missing lead_id does not count", () => {
    const below = evaluateTourFollowupPatternRecommendation(
      [
        tour({ leadId: "l1" }),
        tour({ leadId: "l2" }),
        { ...tour({ leadId: "ghost" }), leadId: null },
      ],
      { venueId: VENUE_A, nowMs: NOW },
    );
    assert.equal(below, null);
  });

  it("repeated evaluation is idempotent for the same inputs", () => {
    const tours = [
      tour({ leadId: "l1" }),
      tour({ leadId: "l2" }),
      tour({ leadId: "l3" }),
      tour({ leadId: "l4" }),
    ];
    const a = evaluateTourFollowupPatternRecommendation(tours, {
      venueId: VENUE_A,
      nowMs: NOW,
    });
    const b = evaluateTourFollowupPatternRecommendation(tours, {
      venueId: VENUE_A,
      nowMs: NOW,
    });
    assert.deepEqual(a, b);
    assert.equal(a?.metadata.lead_count, 4);
  });
});

describe("tour follow-up pattern — Dashboard selection / dismissal semantics", () => {
  function recommendation(
    overrides: Partial<VenueRecommendation> = {},
  ): VenueRecommendation {
    return {
      id: "rec-pattern",
      insightId: null,
      type: TOUR_FOLLOWUP_PATTERN_TYPE,
      title: "3 recent tours still need follow-up",
      body: "These are completed tours with no recorded follow-up.",
      priority: 72,
      ctas: [TOUR_FOLLOWUP_PATTERN_CTA],
      metadata: { lead_count: 3, window_days: 7 },
      dismissedAt: null,
      completedAt: null,
      expiresAt: null,
      createdAt: "2026-09-29T00:00:00.000Z",
      ...overrides,
    };
  }

  function observation(overrides: Partial<LuvObservation> = {}): LuvObservation {
    return {
      id: "tour-no-followup-t1",
      kind: "risk",
      priority: "high",
      message: "Alex completed their tour 15h ago — follow up while it's fresh.",
      link: "/leads/alex",
      actionLabel: "View Lead →",
      ...overrides,
    } as LuvObservation;
  }

  it("surfaces the pattern recommendation on the Dashboard Luv card", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [observation()],
      recommendations: [recommendation()],
    });
    assert.equal(entry?.message, "3 recent tours still need follow-up");
    assert.equal(entry?.actionHref, "/tours");
    assert.equal(entry?.actionLabel, "Open Tours");
    assert.equal(entry?.dismissRecommendationId, "rec-pattern");
    assert.equal(entry?.dismissObservationId, undefined);
  });

  it("does not create observation: dismissal — uses recommendation id", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [],
      recommendations: [recommendation()],
    });
    assert.ok(entry?.dismissRecommendationId);
    assert.equal(entry?.dismissObservationId, undefined);
    assert.doesNotMatch(entry!.dismissRecommendationId!, /^observation:/);
  });

  it("dismissed pattern stays hidden (visibility) so refresh cannot resurrect it", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [],
      recommendations: [
        recommendation({ dismissedAt: "2026-09-29T11:00:00.000Z" }),
      ],
    });
    assert.equal(entry, null);
  });

  it("Calendar Focus /tours does not suppress the tour follow-up pattern", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [
        {
          id: "tour-today",
          priority: "needs_attention_today",
          domain: "Calendar",
          label: "Tour today",
          detail: "11:00 AM",
          href: "/tours",
          sortDate: null,
          crossSectionSubject: null,
        },
      ],
      observations: [],
      recommendations: [recommendation()],
    });
    assert.equal(entry?.message, "3 recent tours still need follow-up");
    assert.equal(entry?.actionHref, "/tours");
  });

  it("when pattern is active, individual tour-no-followup observations are not selected", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      // Higher-priority Guide-gap wins first — pattern still active in list.
      observations: [observation()],
      recommendations: [
        {
          ...recommendation({
            id: "rec-gap",
            type: "client_ask_gap_exotic_animal_policy",
            title: "Clients have asked about exotic animals 3 times in the last 30 days.",
            priority: 75,
            ctas: [{ type: "navigate", target: "/guide", label: "Open Venue Guide" }],
          }),
        },
        recommendation(),
      ],
    });
    assert.equal(
      entry?.message,
      "Clients have asked about exotic animals 3 times in the last 30 days.",
    );
  });

  it("CREATE → DISMISS → SYNC/refresh-equivalent → V2 still not visible", () => {
    const created = recommendation({ id: "stable-pattern-id" });
    assert.equal(
      selectLuvDashboardEntry({
        focusItems: [],
        observations: [],
        recommendations: [created],
      })?.dismissRecommendationId,
      "stable-pattern-id",
    );

    // Same durable id after dismiss (sync must not mint a new visible row).
    const afterDismissSync = recommendation({
      id: "stable-pattern-id",
      dismissedAt: "2026-09-29T11:00:00.000Z",
      title: "4 recent tours still need follow-up",
    });
    // Visible list after get_venue_recommendations would exclude it; selection
    // may still receive the cooldown row so individuals stay suppressed.
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [observation()],
      recommendations: [afterDismissSync],
    });
    assert.notEqual(entry?.message, "4 recent tours still need follow-up");
    assert.notEqual(entry?.dismissRecommendationId, "stable-pattern-id");
    assert.doesNotMatch(entry?.message ?? "", /recent tours still need follow-up/);
    // Must not fall through to the individual tour-no-followup card either —
    // that is what made Jennifer's dismiss feel resurrected on refresh.
    assert.notEqual(
      entry?.message,
      "Alex completed their tour 15h ago — follow up while it's fresh.",
    );
    assert.equal(entry?.dismissObservationId, undefined);
  });

  it("without a V2 pattern row, V1 tour-no-followup stays Level-3 and cannot win Dashboard", () => {
    // Product Lock: individual tour-no-followup is lead/tour intelligence, not
    // the global Dashboard card. It remains available on lower surfaces; the
    // old behavior of promoting it to Dashboard when V2 is absent is retired.
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [observation()],
      recommendations: [],
    });
    assert.equal(entry, null);
  });
});

describe("tour follow-up pattern — wiring / venue safety / V1 Ask-gap unchanged", () => {
  it("migration uses current_user_venue_id and never venue_users LIMIT 1", () => {
    const migration = read(
      "supabase/migrations/20261409100000_luv_tour_followup_pattern.sql",
    );
    assert.match(migration, /sync_tour_followup_pattern_recommendation/);
    assert.match(migration, /current_user_venue_id\(\)/);
    assert.match(migration, /tour_followup_pattern/);
    assert.doesNotMatch(
      migration,
      /from\s+venue_users\s+where\s+user_id\s*=\s*auth\.uid\(\)\s+limit\s+1/i,
    );
    const fnBody = migration.slice(
      migration.indexOf("as $$"),
      migration.indexOf("$$;"),
    );
    assert.doesNotMatch(fnBody, /venue_users/i);
    assert.doesNotMatch(fnBody, /limit\s+1/i);
    const conflict = migration.slice(migration.indexOf("on conflict"));
    assert.doesNotMatch(
      conflict.slice(0, conflict.indexOf("v_upserted")),
      /dismissed_at\s*=\s*null/,
    );
  });

  it("harden migration refuses ON CONFLICT update while recently dismissed", () => {
    const harden = read(
      "supabase/migrations/20261409200000_luv_tour_followup_pattern_dismiss_harden.sql",
    );
    assert.match(harden, /skipped',\s*'recently_dismissed'/);
    assert.match(
      harden,
      /where luv_recommendations\.dismissed_at is null\s+or luv_recommendations\.dismissed_at <= now\(\) - interval '7 days'/,
    );
    assert.doesNotMatch(harden, /dismissed_at\s*=\s*null/);
    assert.doesNotMatch(harden, /venue_users/);
  });

  it("recommendation-service keeps dismissed pattern for selection cooldown only", () => {
    const service = read("lib/luv/recommendation-service.ts");
    assert.match(service, /loadRecentlyDismissedTourFollowupPattern/);
    assert.match(service, /syncTourFollowupPatternRecommendation/);
    assert.match(service, /filterVisibleRecommendations/);
  });

  it("recommendation-service syncs after Ask-gap and before get", () => {
    const service = read("lib/luv/recommendation-service.ts");
    assert.match(service, /syncClientAskGapRecommendations/);
    assert.match(service, /syncTourFollowupPatternRecommendation/);
    const askIdx = service.indexOf("syncClientAskGapRecommendations");
    const tourIdx = service.indexOf("syncTourFollowupPatternRecommendation");
    const getIdx = service.indexOf("get_venue_recommendations");
    assert.ok(askIdx < tourIdx && tourIdx < getIdx);
  });

  it("sync aborts without clearing when tour read fails", () => {
    const src = read("lib/luv/tour-followup-pattern.ts");
    assert.match(src, /tour-followup-pattern tours read failed/);
    const syncFn = src.slice(
      src.indexOf("export async function syncTourFollowupPatternRecommendation"),
    );
    const abortIdx = syncFn.indexOf("if (error)");
    const rpcIdx = syncFn.indexOf("sync_tour_followup_pattern_recommendation");
    assert.ok(abortIdx >= 0 && rpcIdx > abortIdx);
  });

  it("V1 Ask-gap threshold and Fancy exotic evaluation remain unchanged", () => {
    assert.equal(ASK_GAP_MIN_COUNT, 3);
    assert.equal(ASK_GAP_WINDOW_DAYS, 30);
    const fancy = evaluateAskGapRecommendations(
      [
        {
          question: "Do you allow live elephants during the ceremony?",
          outcome: "information_gap",
        },
        {
          question: "Are llamas allowed at the venue?",
          outcome: "information_gap",
        },
        {
          question: "Do you allow live elephants during the ceremony?",
          outcome: "information_gap",
        },
        { question: "Do you allow dogs?", outcome: "answered_venue_guide" },
      ],
      {
        policies:
          "No sparklers. Pets are allowed for outdoor events on a case by case/approval basis.",
        faqs: [],
      },
    );
    assert.ok(fancy.some((r) => r.type === "client_ask_gap_exotic_animal_policy"));
    assert.ok(!fancy.some((r) => r.type === "client_ask_gap_pet_policy"));
  });
});
