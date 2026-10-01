import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import type { ClassifiedItem } from "@/lib/dashboard-system/decision-engine";
import {
  aggregateFocusEntry,
  isDashboardLevel1Observation,
  isDashboardLevel1Recommendation,
  selectLuvDashboardEntry,
} from "@/lib/dashboard-system/luv-entry";
import { computeSetupGapObservations } from "@/lib/luv/setup-observations";
import type { ActivationChecklistItem } from "@/lib/activation/types";
import {
  assessVenueReadiness,
  readinessDashboardObservations,
  type VenueReadinessFacts,
} from "@/lib/luv/venue-readiness";
import {
  INQUIRY_VOLUME_INCREASE_TYPE,
  PAYMENT_ATTENTION_PATTERN_TYPE,
  UNATTENDED_INQUIRY_PATTERN_TYPE,
} from "@/lib/luv/spot-patterns";
import type { VenueRecommendation } from "@/lib/luv/recommendation-types";
import type { LuvObservation } from "@/lib/luv/types";

function focusItem(overrides: Partial<ClassifiedItem> = {}): ClassifiedItem {
  return {
    id: "task-1",
    priority: "needs_attention_today",
    domain: "Tasks",
    label: "Call florist",
    detail: "Past due",
    href: "/tasks",
    sortDate: null,
    crossSectionSubject: null,
    ...overrides,
  };
}

function observation(overrides: Partial<LuvObservation> = {}): LuvObservation {
  return {
    id: "setup-gap-public_website",
    kind: "recommendation",
    priority: "medium",
    message: "Your public website isn't collecting inquiries yet.",
    link: "/setup",
    actionLabel: "Open setup →",
    recommendation: { label: "Open setup", link: "/setup", type: "navigate" },
    ...overrides,
  };
}

function recommendation(overrides: Partial<VenueRecommendation> = {}): VenueRecommendation {
  return {
    id: "rec-1",
    insightId: null,
    type: "tour_followup_pattern",
    title: "3 recent tours still need follow-up",
    body: "These are completed tours with no recorded follow-up.",
    priority: 72,
    ctas: [{ type: "navigate", target: "/tours", label: "Open Tours" }],
    metadata: {},
    dismissedAt: null,
    completedAt: null,
    expiresAt: null,
    createdAt: "2026-09-29T00:00:00.000Z",
    ...overrides,
  };
}

const READY_FACTS: VenueReadinessFacts = {
  hasName: true,
  hasEmail: true,
  hasPhone: true,
  hasAddress: true,
  hasLogo: true,
  hasTimezone: true,
  inquiryFormReady: true,
  inquiryFormReceivedLead: true,
  emailIntakeEnabled: true,
  emailIntakeAcceptedLead: true,
  facebook: "delivering",
  leadCapturePath: "automated",
  leadCapturePathKnown: true,
  tourSchedulingEnabled: true,
  tourWindowCount: 2,
  activePackageCount: 1,
  contractTemplateCount: 1,
  messageTemplateCount: 1,
  playbookCount: 1,
  inventoryItemCount: 1,
  stripeChargesEnabled: true,
  spaceOperatingMode: "single",
  spaceCount: 1,
};

describe("Phase 3B — Dashboard L1 critical path (locked live sources)", () => {
  const service = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
  const page = readFileSync(resolve("app/(app)/dashboard/page.tsx"), "utf8");

  it("1. persisted recommendation alone cannot produce L1 when validity is not established on GET", () => {
    for (const rec of [
      recommendation({ type: "tour_followup_pattern" }),
      recommendation({
        type: "client_ask_gap_pet_policy",
        title: "Clients have asked about pets.",
        ctas: [{ type: "navigate", target: "/guide", label: "Open Venue Guide" }],
      }),
      recommendation({ type: "inquiry_reactivation", title: "A quiet inquiry may be ready." }),
      recommendation({ type: "seasonal_prep", title: "Seasonal prep is coming up." }),
      recommendation({ type: "followup", title: "Check quiet leads." }),
    ]) {
      assert.equal(isDashboardLevel1Recommendation(rec), false, rec.type);
      assert.equal(
        selectLuvDashboardEntry({
          focusItems: [],
          observations: [],
          recommendations: [rec],
        }),
        null,
        rec.type,
      );
    }
  });

  it("2. insight_* cannot produce L1", () => {
    const insight = observation({
      id: "insight_momentum",
      message: "Inquiry momentum is up this month.",
      link: "/leads",
      recommendation: { label: "View pipeline", link: "/leads", type: "navigate" },
    });
    assert.equal(isDashboardLevel1Observation(insight), false);
    assert.equal(
      selectLuvDashboardEntry({
        focusItems: [],
        observations: [insight],
        recommendations: [],
      }),
      null,
    );
  });

  it("3. setup-gap can produce L1 when its live fact is true", () => {
    const live = computeSetupGapObservations([
      {
        key: "three_couples_active",
        label: "Three couples in motion",
        href: "/leads",
        completed: false,
        points: 20,
      },
      {
        key: "public_website",
        label: "Public website",
        href: "/website",
        completed: true,
        points: 10,
      },
    ] as ActivationChecklistItem[]);
    assert.ok(live.some((o) => o.id === "setup-gap-three_couples_active"));
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: live,
      recommendations: [],
    });
    assert.equal(entry?.dismissObservationId, "setup-gap-three_couples_active");
  });

  it("4. venue-readiness can produce L1 when its live fact is true", () => {
    const live = readinessDashboardObservations(
      assessVenueReadiness({ ...READY_FACTS, activePackageCount: 0 }),
    );
    assert.equal(live[0]?.id, "venue-readiness-own_package");
    assert.equal(isDashboardLevel1Observation(live[0]!), true);
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: live,
      recommendations: [],
    });
    assert.equal(entry?.dismissObservationId, "venue-readiness-own_package");
    assert.equal(
      selectLuvDashboardEntry({
        focusItems: [],
        observations: readinessDashboardObservations(assessVenueReadiness(READY_FACTS)),
        recommendations: [],
      }),
      null,
    );
  });

  it("5. communication L1 candidates can produce L1 when their live fact is true", () => {
    const delivered = observation({
      id: "comm-all-delivered",
      message: "Everything sent in the last day reached its destination — 2 messages, no failures.",
      link: "/messaging/health",
      recommendation: { label: "View", link: "/messaging/health", type: "navigate" },
    });
    const failures = observation({
      id: "comm-recent-failures",
      message: "2 messages couldn't be delivered in the last day.",
      link: "/messaging/health",
      recommendation: { label: "Review what happened", link: "/messaging/health", type: "navigate" },
    });
    const venueWideStale = observation({
      id: "comm-stale-unopened-m1",
      message: "One lead hasn't opened your message in 6 days.",
      link: "/messaging/health",
    });
    assert.equal(isDashboardLevel1Observation(delivered), true);
    assert.equal(isDashboardLevel1Observation(failures), true);
    assert.equal(isDashboardLevel1Observation(venueWideStale), true);
    assert.equal(
      selectLuvDashboardEntry({
        focusItems: [],
        observations: [delivered],
        recommendations: [],
      })?.dismissObservationId,
      "comm-all-delivered",
    );
    assert.equal(
      selectLuvDashboardEntry({
        focusItems: [],
        observations: [failures],
        recommendations: [],
      })?.dismissObservationId,
      "comm-recent-failures",
    );
    assert.equal(
      selectLuvDashboardEntry({
        focusItems: [],
        observations: [venueWideStale],
        recommendations: [],
      })?.dismissObservationId,
      "comm-stale-unopened-m1",
    );
  });

  it("6. Focus aggregate remains the fallback", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [
        focusItem({ id: "t1", href: "/tasks?a=1" }),
        focusItem({ id: "t2", href: "/tasks?b=1" }),
      ],
      observations: [],
      recommendations: [recommendation()],
    });
    assert.equal(entry?.message, "I noticed two tasks are past due.");
    assert.equal(entry?.actionHref, "/tasks");
    assert.equal(entry?.dismissObservationId, undefined);
    assert.equal(entry?.dismissRecommendationId, undefined);
  });

  it("7. no valid L1 candidate results in no L1 card", () => {
    assert.equal(
      selectLuvDashboardEntry({
        focusItems: [],
        observations: [],
        recommendations: [],
      }),
      null,
    );
    assert.equal(
      selectLuvDashboardEntry({
        focusItems: [],
        observations: [
          observation({
            id: "tour-upcoming-abc",
            message: "Lydia has a tour Saturday.",
            link: "/leads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          }),
        ],
        recommendations: [recommendation()],
      }),
      null,
    );
  });

  it("8. record-scoped observations cannot become L1", () => {
    const staleOnLead = observation({
      id: "comm-stale-unopened-m2",
      message: "Jordan hasn't opened your proposal in 5 days.",
      link: "/leads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001",
      recommendation: {
        label: "Send a follow-up",
        link: "/leads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001",
        type: "draft",
      },
    });
    const tourUpcoming = observation({
      id: "tour-upcoming-t1",
      message: "Casey has a tour Friday.",
      link: "/leads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002",
    });
    assert.equal(isDashboardLevel1Observation(staleOnLead), false);
    assert.equal(isDashboardLevel1Observation(tourUpcoming), false);
    assert.equal(
      selectLuvDashboardEntry({
        focusItems: [],
        observations: [staleOnLead, tourUpcoming],
        recommendations: [],
      }),
      null,
    );
  });

  it("9. Phase 5 Spot Patterns remain excluded", () => {
    for (const type of [
      UNATTENDED_INQUIRY_PATTERN_TYPE,
      PAYMENT_ATTENTION_PATTERN_TYPE,
      INQUIRY_VOLUME_INCREASE_TYPE,
    ]) {
      const rec = recommendation({
        type,
        title: "Spot pattern",
        ctas: [{ type: "navigate", target: "/leads", label: "Open" }],
      });
      assert.equal(isDashboardLevel1Recommendation(rec), false, type);
      assert.equal(
        selectLuvDashboardEntry({
          focusItems: [],
          observations: [],
          recommendations: [rec],
        }),
        null,
        type,
      );
    }
  });

  it("10. list-href contract/document observations cannot produce L1", () => {
    const contract = observation({
      id: "contract-aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001",
      message: "A contract has been waiting for a signature for 5 days.",
      link: "/contracts",
      recommendation: { label: "Send a gentle reminder", link: "/contracts", type: "navigate" },
    });
    const expiry = observation({
      id: "contract-expiry-aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002",
      message: "A contract expires in 7 days.",
      link: "/contracts",
      recommendation: { label: "Review the contract", link: "/contracts", type: "navigate" },
    });
    const orphanDoc = observation({
      id: "doc-aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003",
      message: "A document is coming up for renewal.",
      link: "/documents",
      recommendation: { label: "Review before it lapses", link: "/documents", type: "navigate" },
    });
    for (const obs of [contract, expiry, orphanDoc]) {
      assert.equal(isDashboardLevel1Observation(obs), false, obs.id);
    }
    assert.equal(
      selectLuvDashboardEntry({
        focusItems: [],
        observations: [contract, expiry, orphanDoc],
        recommendations: [],
      }),
      null,
    );
    // Live setup-gap still wins when list-href contract/doc noise is present.
    const withSetup = selectLuvDashboardEntry({
      focusItems: [],
      observations: [
        contract,
        observation({
          id: "setup-gap-three_couples_active",
          message: "Invite three couples.",
          link: "/leads",
          recommendation: { label: "Open leads", link: "/leads", type: "navigate" },
        }),
      ],
      recommendations: [],
    });
    assert.equal(withSetup?.dismissObservationId, "setup-gap-three_couples_active");
  });

  it("11. Dashboard GET does not call getLuvObservations for L1", () => {
    assert.doesNotMatch(service, /getLuvObservations/);
    assert.doesNotMatch(page, /getLuvObservations/);
    assert.match(service, /computeSetupGapObservations/);
    assert.match(service, /readinessDashboardObservations/);
    assert.match(service, /getCommunicationObservations/);
  });

  it("12. Dashboard GET does not manufacture persisted recommendations", () => {
    assert.doesNotMatch(service, /readVenueRecommendations/);
    assert.doesNotMatch(service, /getVenueRecommendations\(/);
    assert.doesNotMatch(service, /refreshVenueRecommendations/);
    assert.doesNotMatch(service, /generate_venue_recommendations/);
    assert.doesNotMatch(service, /syncClientAskGapRecommendations/);
    assert.doesNotMatch(service, /syncTourFollowupPatternRecommendation/);
    assert.doesNotMatch(service, /syncPhase5SpotPatternRecommendations/);
    assert.match(page, /recommendations:\s*\[\]/);
  });

  it("13. Dashboard GET does not compute venue insights for L1", () => {
    assert.doesNotMatch(service, /getVenueInsights/);
    assert.doesNotMatch(service, /compute_venue_insights/);
    assert.doesNotMatch(service, /computeInsightObservations/);
    assert.doesNotMatch(page, /\[\.\.\.data\.luvObservations,\s*\.\.\.data\.insightObservations\]/);
    assert.match(page, /observations:\s*data\.luvObservations/);
  });

  it("14. Focus / Event Readiness behavior remains unchanged", () => {
    assert.match(page, /Today's Focus/);
    assert.match(page, /classifyBriefingItems/);
    assert.match(page, /classifyUpcomingItems/);
    assert.match(service, /getFocusNeedsAttentionBriefing/);
    assert.match(service, /loadFocusPopulationLeads/);
    const readiness = aggregateFocusEntry([
      focusItem({ id: "r1", domain: "Event Readiness", href: "/contracts/a" }),
      focusItem({ id: "r2", domain: "Event Readiness", href: "/invoices/b" }),
    ]);
    assert.equal(readiness?.message, "I noticed two bookings have something still outstanding.");
    assert.equal(readiness?.actionHref, "/events");
    const leadsOnly = aggregateFocusEntry([
      focusItem({ id: "l1", domain: "Leads", href: "/leads/a" }),
      focusItem({ id: "l2", domain: "Leads", href: "/leads/b" }),
    ]);
    assert.equal(leadsOnly, null);
  });
});
