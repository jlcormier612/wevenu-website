import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ClassifiedItem } from "@/lib/dashboard-system/decision-engine";
import { aggregateFocusEntry, selectLuvDashboardEntry } from "@/lib/dashboard-system/luv-entry";
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

    assert.ok(entry);
    assert.doesNotMatch(entry.message, /has a tour today/, "must not repeat the Focus row");
  });

  it("still shows an observation about something Today's Focus is not covering", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [focusItem({ href: "/leads/sara" })],
      observations: [observation({ id: "obs-2", link: "/leads/dana", message: "Dana has gone quiet for 10 days." })],
      recommendations: [],
    });

    assert.equal(entry?.message, "Dana has gone quiet for 10 days.");
    assert.equal(entry?.actionHref, "/leads/dana");
  });

  it("ignores query strings and fragments when deciding what is a repeat", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [focusItem({ href: "/leads/sara" })],
      observations: [observation({ link: "/leads/sara?from=luv" })],
      recommendations: [],
    });

    assert.doesNotMatch(entry!.message, /has a tour today/);
  });

  it("leads with a recommendation, which is already interpretation plus an action", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [focusItem()],
      observations: [observation({ link: "/leads/dana" })],
      recommendations: [recommendation()],
    });

    assert.equal(entry?.message, "Your inquiry response time slipped this week.");
    assert.equal(entry?.suggestion, "Want to see which leads are waiting?");
    assert.equal(entry?.actionLabel, "View report");
  });

  it("skips a recommendation that only points back at a Focus row", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [focusItem({ href: "/leads/sara" })],
      observations: [],
      recommendations: [recommendation({ ctas: [{ type: "navigate", target: "/leads/sara", label: "Open lead" }] as never })],
    });

    // Falls through to the aggregate rather than echoing the row.
    assert.match(entry!.message, /I noticed one lead has been waiting/);
  });

  it("says nothing at all when there is nothing to add", () => {
    assert.equal(selectLuvDashboardEntry({ focusItems: [], observations: [], recommendations: [] }), null);
  });
});

describe("Luv interprets Today's Focus when it has nothing new", () => {
  it("summarises the largest group instead of repeating rows", () => {
    const entry = aggregateFocusEntry([
      focusItem({ id: "lead-1", href: "/leads/a" }),
      focusItem({ id: "lead-2", href: "/leads/b" }),
      focusItem({ id: "lead-3", href: "/leads/c" }),
      focusItem({ id: "lead-4", href: "/leads/d" }),
    ]);

    assert.equal(entry?.message, "I noticed four leads have been waiting for follow-up.");
    assert.equal(entry?.suggestion, "Want to work through them?");
    assert.equal(entry?.actionHref, "/leads");
  });

  it("gets singular grammar right", () => {
    const entry = aggregateFocusEntry([focusItem()]);
    assert.equal(entry?.message, "I noticed one lead has been waiting for follow-up.");
  });

  it("picks the domain with the most work", () => {
    const entry = aggregateFocusEntry([
      focusItem({ id: "l1", domain: "Leads", href: "/leads/a" }),
      focusItem({ id: "t1", domain: "Tasks", href: "/leads/b" }),
      focusItem({ id: "t2", domain: "Tasks", href: "/leads/c" }),
      focusItem({ id: "t3", domain: "Tasks", href: "/leads/d" }),
    ]);

    assert.equal(entry?.message, "I noticed three tasks are past due.");
    assert.equal(entry?.actionHref, "/tasks");
  });

  it("reads Event Readiness as bookings with something outstanding", () => {
    const entry = aggregateFocusEntry([
      focusItem({ id: "r1", domain: "Event Readiness", href: "/events/a" }),
      focusItem({ id: "r2", domain: "Event Readiness", href: "/events/b" }),
    ]);

    assert.equal(entry?.message, "I noticed two bookings have something still outstanding.");
  });

  it("returns nothing for domains it has no interpretation for", () => {
    assert.equal(aggregateFocusEntry([focusItem({ domain: "Unmapped" })]), null);
    assert.equal(aggregateFocusEntry([]), null);
  });

  // Luv offers to take the owner to the work; it must not promise to perform
  // an action no Dashboard control actually performs.
  it("does not promise to send or draft anything", () => {
    for (const domain of ["Leads", "Tasks", "Event Readiness", "Calendar", "Payments"]) {
      const entry = aggregateFocusEntry([focusItem({ domain })]);
      assert.ok(entry, `${domain} should have an aggregate`);
      assert.doesNotMatch(`${entry.suggestion} ${entry.actionLabel}`, /draft|send|write it|for you/i);
    }
  });
});
