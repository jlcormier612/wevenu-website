import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeAcquisitionReport,
  parseAcquisitionPeriod,
} from "./acquisition-metrics";
import type { WorkspaceData } from "@/lib/types";

function emptyWorkspace(): WorkspaceData {
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
  } as WorkspaceData;
}

describe("acquisition metrics", () => {
  it("parses period keys with default 30d", () => {
    assert.equal(parseAcquisitionPeriod("90d"), "90d");
    assert.equal(parseAcquisitionPeriod("nope"), "30d");
  });

  it("returns professional empty state with zeros for a new business", () => {
    const report = computeAcquisitionReport(
      emptyWorkspace(),
      "30d",
      new Date("2026-11-24T12:00:00.000Z"),
    );
    assert.equal(report.empty, true);
    assert.equal(report.totals.leads, 0);
    assert.equal(report.totals.newPayingVenues, 0);
    assert.equal(report.totals.newMrrCents, 0);
    assert.equal(report.rows.length, 0);
    assert.match(report.note, /No acquisition activity/i);
  });

  it("groups leads and new MRR by first-touch source/campaign", () => {
    const data = emptyWorkspace();
    data.relationships = [
      {
        id: "rel_1",
        status: "inquiry",
        health: "healthy",
        supportOpenCount: 0,
        owner: { firstName: "A", lastName: "B", email: "a@example.com" },
        venue: { name: "Alpha" },
        createdAt: "2026-11-10T00:00:00.000Z",
        updatedAt: "2026-11-10T00:00:00.000Z",
        referralSource: "Website Contact Us",
        meta: {
          acq_first_touch: JSON.stringify({
            utm_source: "linkedin",
            utm_campaign: "spring",
            captured_at: "2026-11-10T00:00:00.000Z",
          }),
        },
      },
      {
        id: "rel_2",
        status: "subscribed",
        health: "healthy",
        supportOpenCount: 0,
        owner: { firstName: "C", lastName: "D", email: "c@example.com" },
        venue: { name: "Beta" },
        createdAt: "2026-11-12T00:00:00.000Z",
        updatedAt: "2026-11-12T00:00:00.000Z",
        referralSource: "Pricing checkout",
        meta: {
          acq_first_touch: JSON.stringify({
            utm_source: "linkedin",
            utm_campaign: "spring",
            captured_at: "2026-11-12T00:00:00.000Z",
          }),
        },
      },
    ] as WorkspaceData["relationships"];
    data.subscriptions = [
      {
        id: "sub_1",
        relationshipId: "rel_2",
        planId: "celebrate",
        planName: "Growing",
        status: "active",
        mrrCents: 24900,
        startedAt: "2026-11-15T00:00:00.000Z",
        foundingMember: false,
      },
    ] as WorkspaceData["subscriptions"];

    const report = computeAcquisitionReport(
      data,
      "30d",
      new Date("2026-11-24T12:00:00.000Z"),
    );
    assert.equal(report.empty, false);
    assert.equal(report.rows.length, 1);
    assert.equal(report.rows[0]!.source, "linkedin");
    assert.equal(report.rows[0]!.campaign, "spring");
    assert.equal(report.rows[0]!.leads, 2);
    assert.equal(report.rows[0]!.newPayingVenues, 1);
    assert.equal(report.rows[0]!.newMrrCents, 24900);
    assert.equal(report.rows[0]!.leadToCustomerRate, 50);
  });
});
