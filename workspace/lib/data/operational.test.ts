import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isBoardVisibleRelationship,
  toOperationalWorkspaceData,
} from "./operational.ts";
import type { Relationship, WorkspaceData } from "@/lib/types";

const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";

function rel(partial: Partial<Relationship> & { id: string }): Relationship {
  return {
    venue: { name: "X", city: "", state: "" },
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
    ...partial,
  } as Relationship;
}

function emptyData(overrides: Partial<WorkspaceData>): WorkspaceData {
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

describe("operational workspace slice", () => {
  it("excludes demo subscription MRR and keeps ordinary Sandbox customer", () => {
    const demo = rel({
      id: "rel_demo",
      productSync: {
        status: "idle",
        steps: [],
        adapter: "local",
        venueId: FANCY,
      },
      foundingMember: true,
    });
    const real = rel({
      id: "rel_real",
      venue: { name: "Ordinary Sandbox Venue", city: "Austin", state: "TX" },
      owner: {
        id: "c_2",
        firstName: "Pat",
        lastName: "Buyer",
        email: "pat.buyer@example.com",
      },
      status: "subscribed",
    });
    const data = emptyData({
      relationships: [demo, real],
      subscriptions: [
        {
          id: "sub_demo",
          relationshipId: "rel_demo",
          planId: "gather",
          planName: "Gather",
          status: "active",
          mrrCents: 14900,
          startedAt: "2026-01-01T00:00:00.000Z",
          foundingMember: true,
        },
        {
          id: "sub_real",
          relationshipId: "rel_real",
          planId: "celebrate",
          planName: "Celebrate",
          status: "active",
          mrrCents: 19900,
          startedAt: "2026-01-02T00:00:00.000Z",
          foundingMember: false,
        },
      ],
    });

    const ops = toOperationalWorkspaceData(data);
    assert.deepEqual(
      ops.relationships.map((r) => r.id),
      ["rel_real"],
    );
    assert.equal(ops.subscriptions.length, 1);
    assert.equal(ops.reports.mrrCents, 19900);
    assert.equal(isBoardVisibleRelationship(demo), false);
    assert.equal(isBoardVisibleRelationship(real), true);
  });

  it("keeps disposable fixtures off metrics but board-visible", () => {
    const disp = rel({
      id: "rel_disp",
      venue: { name: "[DISPOSABLE-ACCEPT-1] Probe", city: "", state: "" },
      owner: {
        id: "c_3",
        firstName: "QA",
        lastName: "Probe",
        email: "qa+disposable@hellotocheers.com",
      },
    });
    assert.equal(isBoardVisibleRelationship(disp), true);
    const ops = toOperationalWorkspaceData(
      emptyData({
        relationships: [disp],
        subscriptions: [
          {
            id: "sub_d",
            relationshipId: "rel_disp",
            planId: "gather",
            planName: "Gather",
            status: "active",
            mrrCents: 14900,
            startedAt: "2026-01-01T00:00:00.000Z",
            foundingMember: false,
          },
        ],
      }),
    );
    assert.equal(ops.relationships.length, 0);
    assert.equal(ops.reports.mrrCents, 0);
  });
});
