import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toOperationalWorkspaceData } from "../data/operational.ts";
import type { Relationship, WorkspaceData } from "../types.ts";

import {
  LUV_CALM_EMPTY_BULLET,
  LUV_CALM_EMPTY_CLOSING,
  LUV_FOLLOW_UP_CLOSING,
  buildDailyBriefing,
} from "./briefing.ts";

const FANCY_VENUE_ID = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";

function rel(
  partial: Partial<Relationship> & { id: string; crmRole?: Relationship["crmRole"] },
): Relationship {
  return {
    venue: { name: "Venue", city: "", state: "" },
    owner: {
      id: "c_1",
      firstName: "A",
      lastName: "B",
      email: "a@b.test",
    },
    status: "inquiry",
    health: "good",
    assignedTeamMemberId: "tm_1",
    planId: "none",
    planName: "—",
    foundingMember: false,
    welcomeBackRequested: false,
    welcomeBackVerified: "none",
    onboardingType: "none",
    currentStageLabel: "Inquiry",
    lastContactAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    supportOpenCount: 0,
    crmRole: "customer",
    ...partial,
  } as Relationship;
}

function emptyData(overrides: Partial<WorkspaceData> = {}): WorkspaceData {
  return {
    teamMembers: [],
    relationships: [],
    timelineEvents: [],
    tasks: [],
    communications: [],
    documents: [],
    invoices: [],
    subscriptions: [],
    walkthroughs: [],
    onboardingMilestones: [],
    notifications: [],
    founderProgram: {
      totalSpots: 100,
      currentCount: 0,
      remainingSpots: 100,
      newThisWeek: 0,
      welcomeBackRequests: 0,
      pendingVerification: 0,
      verified: 0,
      rejected: 0,
      expired: 0,
    },
    reports: {
      founderGrowth: [],
      subscriptionGrowth: [],
      welcomeBackConversions: 0,
      welcomeBackConversionRate: 0,
      whiteGloveAdoption: 0,
      whiteGloveAdoptionRate: 0,
      walkthroughConversionRate: 0,
      mrrCents: 0,
      arrCents: 0,
      customerHealth: [],
    },
    ...overrides,
  };
}

const actor = { id: "tm_jen", name: "Jennifer" };
const noonEastern = new Date("2026-01-15T17:00:00.000Z"); // 12:00 EST

describe("Luv briefing accuracy", () => {
  it("zero operational relationships → calm empty copy, no invented count, no follow-ups", () => {
    const briefing = buildDailyBriefing(emptyData(), actor, { now: noonEastern });
    assert.equal(briefing.greeting, "Good afternoon, Jennifer.");
    assert.equal(briefing.bullets.length, 1);
    assert.equal(briefing.bullets[0]?.text, LUV_CALM_EMPTY_BULLET);
    assert.doesNotMatch(briefing.bullets[0]?.text ?? "", /two relationships/i);
    assert.equal(briefing.closing, LUV_CALM_EMPTY_CLOSING);
    assert.equal(briefing.followUpInsights.length, 0);
  });

  it("Fancy demo-only store is empty after operational filter", () => {
    const full = emptyData({
      relationships: [
        rel({
          id: "rel_fancy",
          crmRole: "sandbox_demo",
          venue: { name: "Jen's Fancy Venue", city: "NY", state: "NY" },
          productSync: { venueId: FANCY_VENUE_ID } as never,
        }),
      ],
    });
    const ops = toOperationalWorkspaceData(full);
    assert.equal(ops.relationships.length, 0);
    const briefing = buildDailyBriefing(ops, actor, { now: noonEastern });
    assert.equal(briefing.bullets[0]?.text, LUV_CALM_EMPTY_BULLET);
    assert.equal(briefing.followUpInsights.length, 0);
  });

  it("mixed demo + genuine keeps only operational relationships in briefing input", () => {
    const full = emptyData({
      relationships: [
        rel({
          id: "rel_demo",
          crmRole: "sandbox_demo",
          venue: { name: "Demo", city: "", state: "" },
        }),
        rel({
          id: "rel_real",
          crmRole: "customer",
          venue: { name: "Real Venue", city: "Austin", state: "TX" },
          status: "inquiry",
          createdAt: "2020-01-01T00:00:00.000Z",
          lastContactAt: "2020-01-01T00:00:00.000Z",
        }),
        rel({
          id: "rel_disp",
          crmRole: "disposable",
          venue: { name: "[DISPOSABLE] X", city: "", state: "" },
        }),
      ],
    });
    const ops = toOperationalWorkspaceData(full);
    assert.deepEqual(
      ops.relationships.map((r) => r.id),
      ["rel_real"],
    );
    const briefing = buildDailyBriefing(ops, actor, { now: noonEastern });
    assert.doesNotMatch(
      briefing.bullets.map((b) => b.text).join(" "),
      /two relationships/i,
    );
    assert.doesNotMatch(
      briefing.bullets.map((b) => b.text).join(" "),
      /Demo|DISPOSABLE/i,
    );
  });

  it("does not use fabricated deepen-two copy anywhere", () => {
    const briefing = buildDailyBriefing(emptyData(), actor, { now: noonEastern });
    assert.doesNotMatch(
      JSON.stringify(briefing),
      /deepen two relationships/i,
    );
  });

  it("server/client greeting helper agrees for fixed Instant", () => {
    const briefing = buildDailyBriefing(emptyData(), actor, {
      now: new Date("2026-01-15T17:00:00.000Z"),
    });
    assert.equal(briefing.greeting, "Good afternoon, Jennifer.");
    assert.match(briefing.generatedAt, /2026-01-15T17:00:00/);
  });

  it("closing invites drafts only when follow-ups exist", () => {
    const empty = buildDailyBriefing(emptyData(), actor, { now: noonEastern });
    assert.equal(empty.closing, LUV_CALM_EMPTY_CLOSING);
    assert.notEqual(empty.closing, LUV_FOLLOW_UP_CLOSING);
  });
});
