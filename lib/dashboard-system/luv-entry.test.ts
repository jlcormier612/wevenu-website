import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ClassifiedItem } from "@/lib/dashboard-system/decision-engine";
import {
  aggregateFocusEntry,
  isDashboardLevel1Observation,
  isTourUpcomingObservation,
  selectLuvDashboardEntry,
} from "@/lib/dashboard-system/luv-entry";
import type { VenueRecommendation } from "@/lib/luv/recommendation-types";
import type { LuvObservation } from "@/lib/luv/types";

function focusItem(overrides: Partial<ClassifiedItem> = {}): ClassifiedItem {
  return {
    id: "lead-1",
    priority: "needs_attention_today",
    domain: "Leads",
    label: "Sara Parker",
    detail: "No reply in 5 days",
    href: "/leads/sara",
    sortDate: null,
    crossSectionSubject: null,
    ...overrides,
  };
}

function observation(overrides: Partial<LuvObservation> = {}): LuvObservation {
  return {
    id: "obs-1",
    kind: "fact",
    priority: "high",
    message: "Sara Parker has a tour today at 11:00 AM.",
    link: "/leads/sara",
    actionLabel: "View Lead →",
    ...overrides,
  } as LuvObservation;
}

/** Level-3 single-lead observation (product lock: not Dashboard-eligible). */
function level3LeadObservation(overrides: Partial<LuvObservation> = {}): LuvObservation {
  return observation({
    id: "tour-upcoming-abc",
    message: "Lydia Cormier has a tour scheduled for Sat, Oct 4, 2:00 PM.",
    detail: "60-minute tour. In 5 days.",
    link: "/leads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    actionLabel: "View Lead →",
    recommendation: {
      label: "Prepare for the tour",
      link: "/leads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      type: "navigate",
    },
    ...overrides,
  });
}

/** Level-1 venue-wide observation (setup gap). */
function level1SetupObservation(overrides: Partial<LuvObservation> = {}): LuvObservation {
  return observation({
    id: "setup-gap-public_website",
    kind: "recommendation",
    message: "Your public website isn't collecting inquiries yet.",
    detail: "Turn on inquiry capture so new couples can reach you.",
    link: "/setup",
    actionLabel: "Open setup →",
    recommendation: { label: "Open setup", link: "/setup", type: "navigate" },
    ...overrides,
  });
}

function recommendation(overrides: Partial<VenueRecommendation> = {}): VenueRecommendation {
  return {
    id: "rec-1",
    insightId: null,
    type: "followup",
    title: "Your inquiry response time slipped this week.",
    body: "Want to see which leads are waiting?",
    priority: 1,
    ctas: [{ type: "navigate", target: "/reporting/leads", label: "View report" }],
    metadata: {},
    dismissedAt: null,
    completedAt: null,
    expiresAt: null,
    createdAt: "2026-08-31T00:00:00.000Z",
    ...overrides,
  } as VenueRecommendation;
}

describe("Luv does not restate Today's Focus", () => {
  // The reported defect: the Dashboard listed Sara Parker's tour in Today's
  // Focus and Luv repeated the same tour immediately below it.
  it("skips an observation about a lead already listed in Today's Focus", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [focusItem({ href: "/leads/sara" })],
      observations: [observation({ link: "/leads/sara" })],
      recommendations: [],
    });

    // Leads-only Focus has no non-duplicative aggregate — stay quiet rather
    // than inventing an insight after skipping the repeated observation.
    // Level-3 lead obs also cannot win the Dashboard under Product Lock.
    assert.equal(entry, null);
  });

  it("still shows a Level-1 observation when Today's Focus covers other work", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [focusItem({ href: "/leads/sara" })],
      observations: [level1SetupObservation()],
      recommendations: [],
    });

    assert.equal(entry?.message, "Your public website isn't collecting inquiries yet.");
    assert.equal(entry?.actionHref, "/setup");
    assert.equal(entry?.dismissObservationId, "setup-gap-public_website");
  });

  it("ignores query strings and fragments when deciding what is a repeat", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [focusItem({ href: "/leads/sara" })],
      // Level-1 obs whose link subject matches Focus would still be skipped;
      // use a Level-3 path that matches Focus to prove subject matching alone.
      observations: [level1SetupObservation({ link: "/leads/sara?from=luv", id: "setup-gap-dup-test" })],
      recommendations: [],
    });

    assert.equal(entry, null);
  });

  it("leads with a recommendation, which is already interpretation plus an action", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [focusItem()],
      observations: [level1SetupObservation()],
      recommendations: [recommendation()],
    });

    assert.equal(entry?.message, "Your inquiry response time slipped this week.");
    assert.equal(entry?.suggestion, "Want to see which leads are waiting?");
    assert.equal(entry?.actionLabel, "View report");
  });

  it("observations carry a persistable observation dismiss id, not a recommendation id", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [level1SetupObservation()],
      recommendations: [],
    });
    assert.equal(entry?.dismissRecommendationId, undefined);
    assert.equal(entry?.dismissObservationId, "setup-gap-public_website");
  });

  it("skips a recently dismissed recommendation so refresh cannot resurrect it", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [],
      recommendations: [recommendation({
        type: "client_ask_gap_exotic_animal_policy",
        title: "Clients have asked about exotic animals 3 times in the last 30 days.",
        dismissedAt: "2026-09-29T11:59:00.000Z",
        ctas: [{ type: "navigate", target: "/guide", label: "Open Venue Guide" }] as never,
      })],
    });
    assert.equal(entry, null);
  });

  it("skips the Leads stale-contact filter recommendation instead of duplicating Leads", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [focusItem({ href: "/leads/sara" })],
      observations: [],
      recommendations: [recommendation({
        type: "lead_followup",
        title: "2 active leads haven't been contacted in 7+ days",
        ctas: [{ type: "navigate", target: "/leads?attention=stale_contact", label: "Review inquiries →" }] as never,
      })],
    });
    assert.equal(entry, null);
  });

  it("skips a recommendation that only points back at a Focus row", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [focusItem({ href: "/leads/sara" })],
      observations: [],
      recommendations: [recommendation({ ctas: [{ type: "navigate", target: "/leads/sara", label: "Open lead" }] as never })],
    });

    // Leads-only Focus has no non-duplicative aggregate — stay quiet.
    // Record-scoped CTA is also Level-3 under Product Lock.
    assert.equal(entry, null);
  });

  it("says nothing at all when there is nothing to add", () => {
    assert.equal(selectLuvDashboardEntry({ focusItems: [], observations: [], recommendations: [] }), null);
  });

  it("still surfaces tour_followup_pattern when Focus Calendar also links to /tours", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [
        focusItem({
          id: "cal-1",
          domain: "Calendar",
          href: "/tours",
          label: "Tour today",
        }),
      ],
      observations: [],
      recommendations: [
        recommendation({
          type: "tour_followup_pattern",
          title: "3 recent tours still need follow-up",
          body: "These are completed tours with no recorded follow-up.",
          ctas: [{ type: "navigate", target: "/tours", label: "Open Tours" }] as never,
        }),
      ],
    });
    assert.equal(entry?.message, "3 recent tours still need follow-up");
    assert.equal(entry?.actionHref, "/tours");
    assert.equal(entry?.dismissRecommendationId, "rec-1");
  });
});

describe("Dashboard Level-1 eligibility (Product Lock attention model)", () => {
  it("A. Level-3 single-lead observation cannot win when no Level-1 item exists", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [level3LeadObservation()],
      recommendations: [],
    });
    assert.equal(entry, null);
  });

  it("B. Level-1 item still wins the Dashboard slot", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [level1SetupObservation()],
      recommendations: [],
    });
    assert.equal(entry?.message, "Your public website isn't collecting inquiries yet.");
    assert.equal(entry?.dismissObservationId, "setup-gap-public_website");
  });

  it("C. Level-3 item does not displace a valid Level-1 item", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      // Level-3 listed first — must not win over Level-1 setup gap.
      observations: [level3LeadObservation(), level1SetupObservation()],
      recommendations: [],
    });
    assert.equal(entry?.message, "Your public website isn't collecting inquiries yet.");
    assert.equal(entry?.dismissObservationId, "setup-gap-public_website");
  });

  it("D. One Dashboard card maximum remains enforced", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [
        level1SetupObservation({ id: "setup-gap-a", message: "Gap A" }),
        level1SetupObservation({ id: "setup-gap-b", message: "Gap B" }),
      ],
      recommendations: [
        recommendation({
          type: "client_ask_gap_pet_policy",
          title: "Clients have asked about pets.",
          ctas: [{ type: "navigate", target: "/guide", label: "Open Venue Guide" }] as never,
        }),
        recommendation({
          id: "rec-2",
          type: "tour_followup_pattern",
          title: "3 recent tours still need follow-up",
          ctas: [{ type: "navigate", target: "/tours", label: "Open Tours" }] as never,
        }),
      ],
    });
    // Exactly one entry object — first eligible Level-1 recommendation wins.
    assert.ok(entry);
    assert.equal(entry?.message, "Clients have asked about pets.");
    assert.equal(Object.keys(entry!).filter((k) => k === "message").length, 1);
  });

  it("E. Focus duplicate suppression remains intact", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [focusItem({ href: "/leads/sara" })],
      observations: [
        level1SetupObservation({
          id: "setup-gap-focus-dup",
          link: "/leads/sara",
          recommendation: { label: "Open", link: "/leads/sara", type: "navigate" },
        }),
      ],
      recommendations: [],
    });
    assert.equal(entry, null);
  });

  it("F. tour-upcoming-* cannot surface as the global Dashboard card", () => {
    assert.equal(isTourUpcomingObservation(level3LeadObservation()), true);
    assert.equal(isDashboardLevel1Observation(level3LeadObservation()), false);

    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [
        level3LeadObservation({
          id: "tour-upcoming-lydia-tour",
          message: "Lydia Cormier has a tour scheduled for Sat, Oct 4, 2:00 PM.",
        }),
      ],
      recommendations: [],
    });
    assert.equal(entry, null);
    assert.doesNotMatch(JSON.stringify(entry), /Lydia Cormier/);
  });

  it("G. V2 tour-no-followup suppression/cooldown unchanged when pattern is dismissed", () => {
    const patternDismissed = recommendation({
      id: "rec-pattern",
      type: "tour_followup_pattern",
      title: "3 recent tours still need follow-up",
      dismissedAt: "2026-09-29T11:00:00.000Z",
      ctas: [{ type: "navigate", target: "/tours", label: "Open Tours" }] as never,
    });
    const individual = observation({
      id: "tour-no-followup-t1",
      message: "Alex completed their tour 15h ago — follow up while it's fresh.",
      link: "/leads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001",
    });
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [individual, level1SetupObservation()],
      recommendations: [patternDismissed],
    });
    // Pattern hidden (dismissed). Individuals remain suppressed under cooldown.
    // Level-1 setup may still win — individuals must not.
    assert.notEqual(entry?.message, individual.message);
    assert.notEqual(entry?.dismissObservationId, "tour-no-followup-t1");
    assert.equal(entry?.message, "Your public website isn't collecting inquiries yet.");
  });

  it("H. Level-3 intelligence is still present in the observation list (relocation, not deletion)", () => {
    const level3 = level3LeadObservation();
    const observations = [level3, level1SetupObservation()];
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations,
      recommendations: [],
    });
    // Dashboard picks Level-1 only…
    assert.equal(entry?.dismissObservationId, "setup-gap-public_website");
    // …while the Level-3 observation remains in the source list for lead/tour surfaces.
    assert.ok(observations.some((o) => o.id === level3.id));
    assert.equal(isDashboardLevel1Observation(level3), false);
  });

  it("Level-1 recommendation wins over Level-3 observation", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [level3LeadObservation()],
      recommendations: [
        recommendation({
          type: "tour_followup_pattern",
          title: "3 recent tours still need follow-up",
          ctas: [{ type: "navigate", target: "/tours", label: "Open Tours" }] as never,
        }),
      ],
    });
    assert.equal(entry?.message, "3 recent tours still need follow-up");
    assert.equal(entry?.actionHref, "/tours");
  });

  it("record-scoped recommendation CTA is not Dashboard Level-1", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [],
      recommendations: [
        recommendation({
          type: "custom_lead_nudge",
          title: "Follow up with Lydia",
          ctas: [{
            type: "navigate",
            target: "/leads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            label: "Open lead",
          }] as never,
        }),
      ],
    });
    assert.equal(entry, null);
  });
});

describe("Luv interprets Today's Focus when it has nothing new", () => {
  it("does not aggregate Leads-only Focus into a stale-contact filter CTA", () => {
    const entry = aggregateFocusEntry([
      focusItem({ id: "lead-1", href: "/leads/a" }),
      focusItem({ id: "lead-2", href: "/leads/b" }),
      focusItem({ id: "lead-3", href: "/leads/c" }),
      focusItem({ id: "lead-4", href: "/leads/d" }),
    ]);
    assert.equal(entry, null);
  });

  it("picks the domain with the most work among non-Leads aggregates", () => {
    const entry = aggregateFocusEntry([
      focusItem({ id: "l1", domain: "Leads", href: "/leads/a" }),
      focusItem({ id: "t1", domain: "Tasks", href: "/leads/b?tab=tasks" }),
      focusItem({ id: "t2", domain: "Tasks", href: "/leads/c?tab=tasks" }),
      focusItem({ id: "t3", domain: "Tasks", href: "/leads/d?tab=tasks" }),
    ]);

    assert.equal(entry?.message, "I noticed three tasks are past due.");
    assert.equal(entry?.actionHref, "/tasks");
  });

  it("reads Event Readiness as bookings with something outstanding", () => {
    const entry = aggregateFocusEntry([
      focusItem({ id: "r1", domain: "Event Readiness", href: "/contracts/a" }),
      focusItem({ id: "r2", domain: "Event Readiness", href: "/invoices/b" }),
    ]);

    assert.equal(entry?.message, "I noticed two bookings have something still outstanding.");
  });

  it("returns nothing for domains it has no interpretation for", () => {
    assert.equal(aggregateFocusEntry([focusItem({ domain: "Unmapped" })]), null);
    assert.equal(aggregateFocusEntry([focusItem({ domain: "Leads" })]), null);
    assert.equal(aggregateFocusEntry([]), null);
  });

  // Luv offers to take the owner to the work; it must not promise to perform
  // an action no Dashboard control actually performs.
  it("does not promise to send or draft anything", () => {
    for (const domain of ["Tasks", "Event Readiness", "Calendar", "Payments"]) {
      const entry = aggregateFocusEntry([focusItem({ domain })]);
      assert.ok(entry, `${domain} should have an aggregate`);
      assert.doesNotMatch(`${entry.suggestion} ${entry.actionLabel}`, /draft|send|write it|for you/i);
    }
  });

  it("Focus aggregate still fills the slot when only Level-3 observations exist", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [
        focusItem({ id: "t1", domain: "Tasks", href: "/tasks" }),
        focusItem({ id: "t2", domain: "Tasks", href: "/tasks?x=1" }),
      ],
      observations: [level3LeadObservation()],
      recommendations: [],
    });
    assert.equal(entry?.message, "I noticed two tasks are past due.");
    assert.equal(entry?.actionHref, "/tasks");
  });
});

describe("Contextual intelligence S1–S4 stay off Dashboard L1", () => {
  const contextual: LuvObservation[] = [
    observation({
      id: "event-contract-unsigned-aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001",
      message: "Wedding is in 12 days, and the contract is still awaiting signature.",
      link: "/contracts/aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001",
      recommendation: {
        label: "Follow up",
        link: "/contracts/aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001",
        type: "navigate",
      },
    }),
    observation({
      id: "event-payment-attention-aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002",
      message: "Wedding is in 10 days, and a payment still needs attention.",
      link: "/invoices/aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003",
      recommendation: {
        label: "Review",
        link: "/invoices/aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003",
        type: "navigate",
      },
    }),
    observation({
      id: "inquiry-unattended-aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0004",
      message: "Jordan reached out over 48 hours ago and has not been contacted yet.",
      link: "/leads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0004",
      recommendation: {
        label: "Reach out",
        link: "/leads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0004",
        type: "draft",
      },
    }),
    observation({
      id: "tour-upcoming-aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0005",
      kind: "recommendation",
      message: "Casey's tour is Fri — preparation is still incomplete.",
      link: "/leads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0006",
      recommendation: {
        label: "Complete next action",
        link: "/leads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0006",
        type: "navigate",
      },
    }),
  ];

  it("each S1–S4 observation fails the Level-1 gate", () => {
    for (const obs of contextual) {
      assert.equal(isDashboardLevel1Observation(obs), false, obs.id);
    }
  });

  it("S1–S4 alone never occupy the Dashboard Luv card", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: contextual,
      recommendations: [],
    });
    assert.equal(entry, null);
  });

  it("Level-1 setup still wins when contextual L3 signals are present", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [...contextual, level1SetupObservation()],
      recommendations: [],
    });
    assert.equal(entry?.dismissObservationId, "setup-gap-public_website");
    assert.doesNotMatch(entry!.message, /awaiting signature|payment still needs|not been contacted|preparation is still incomplete/);
  });
});
