import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyAcquisitionAttributionToRelationship,
  readAcquisitionAttribution,
} from "./acquisition-attribution";
import type { Relationship } from "./types";

/** Minimal valid Relationship for attribution unit tests (no cast). */
function stubRelationship(): Relationship {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "rel_test",
    status: "inquiry",
    health: "good",
    owner: {
      id: "c_test",
      firstName: "A",
      lastName: "B",
      email: "a@example.com",
    },
    venue: { name: "Test Venue", city: "Austin", state: "TX" },
    assignedTeamMemberId: "tm_test",
    planId: "none",
    planName: "",
    foundingMember: false,
    welcomeBackRequested: false,
    welcomeBackVerified: "none",
    onboardingType: "none",
    currentStageLabel: "Inquiry",
    lastContactAt: now,
    createdAt: now,
    updatedAt: now,
    supportOpenCount: 0,
    meta: {},
  };
}

describe("CRM acquisition attribution persistence", () => {
  it("sets first-touch once and refreshes latest-touch", () => {
    const rel = stubRelationship();
    applyAcquisitionAttributionToRelationship(rel, {
      first_touch: {
        utm_source: "linkedin",
        landing_page: "/",
        captured_at: "2026-01-01T00:00:00.000Z",
      },
      latest_touch: {
        utm_source: "linkedin",
        landing_page: "/",
        captured_at: "2026-01-01T00:00:00.000Z",
      },
    });
    applyAcquisitionAttributionToRelationship(rel, {
      first_touch: {
        utm_source: "should-not-overwrite",
        landing_page: "/pricing",
        captured_at: "2026-02-01T00:00:00.000Z",
      },
      latest_touch: {
        utm_campaign: "pricing-retarget",
        landing_page: "/pricing",
        captured_at: "2026-02-01T00:00:00.000Z",
      },
    });
    const read = readAcquisitionAttribution(rel);
    assert.equal(read.first_touch?.utm_source, "linkedin");
    assert.equal(read.latest_touch?.utm_campaign, "pricing-retarget");
  });
});
