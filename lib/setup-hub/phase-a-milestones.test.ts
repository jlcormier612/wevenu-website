import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPhaseAMilestones,
  calendarMilestoneStatus,
  nextIncompleteMilestoneHref,
  phaseAProgressSummary,
  venueDefaultLandingPath,
} from "@/lib/setup-hub/phase-a-milestones";
import type { SetupHubState } from "@/lib/setup-hub/types";

const emptyHub: SetupHubState = {
  venueId: "v1",
  onboardingType: "self_setup",
  yourVenueReviewedAt: null,
  calendarAvailabilityReviewedAt: null,
  bringYourBusinessManualConfirmedAt: null,
  bringYourBusinessPath: null,
  yourOfferingsReviewedAt: null,
  clientExperienceReviewedAt: null,
  leadCapturePath: null,
  leadCapturePathDecidedAt: null,
  yourTeamSoloConfirmedAt: null,
  financialsReviewedAt: null,
  readyToInviteCouples: false,
  readyToInviteCouplesAt: null,
  welcomeExploredAt: null,
  existingBookingsAnswer: null,
  existingBookingsAnsweredAt: null,
  bookingRulesReviewedAt: null,
  hostedEventTypes: null,
  hostedEventTypesSetAt: null,
  eventExperienceReviews: {},
  bookingProcessReviewedAt: null,
  communicationsReviewedAt: null,
  operationalResourcesReviewedAt: null,
  operationalResourceChoices: {},
};

describe("calendarMilestoneStatus", () => {
  it("never marks Ready when existing bookings = yes (reconciliation not verified)", () => {
    assert.equal(
      calendarMilestoneStatus({
        spacesCount: 2,
        bookingRulesReviewedAt: "2026-01-01",
        existingBookingsAnswer: "yes",
        hasMigrationImport: true,
      }),
      "needs_attention",
    );
  });

  it("marks Ready when answer is No and spaces + rules are done", () => {
    assert.equal(
      calendarMilestoneStatus({
        spacesCount: 1,
        bookingRulesReviewedAt: "2026-01-01",
        existingBookingsAnswer: "no",
        hasMigrationImport: false,
      }),
      "ready",
    );
  });

  it("does not treat zero events as No", () => {
    assert.equal(
      calendarMilestoneStatus({
        spacesCount: 1,
        bookingRulesReviewedAt: "2026-01-01",
        existingBookingsAnswer: null,
        hasMigrationImport: false,
      }),
      "in_progress",
    );
  });
});

describe("buildPhaseAMilestones", () => {
  it("returns four cards in approved order with exact titles", () => {
    const cards = buildPhaseAMilestones({
      hubState: emptyHub,
      spacesCount: 0,
      hasMigrationImport: false,
      venueBrandStarted: false,
      setupProfileCount: 0,
    });
    assert.deepEqual(
      cards.map((c) => c.title),
      [
        "Protect your calendar",
        "Make HTC yours",
        "Bring your business over",
        "Take a look, then go live",
      ],
    );
    assert.equal(cards[3]?.status, "not_started");
  });

  it("progress summary is descriptive, not a fake percentage", () => {
    const cards = buildPhaseAMilestones({
      hubState: emptyHub,
      spacesCount: 0,
      hasMigrationImport: false,
      venueBrandStarted: false,
      setupProfileCount: 0,
    });
    assert.doesNotMatch(phaseAProgressSummary(cards), /%/);
    assert.equal(nextIncompleteMilestoneHref(cards), "/setup-hub/protect-calendar");
  });
});

describe("venueDefaultLandingPath", () => {
  it("sends incomplete venues to Setup Hub and established venues to Dashboard", () => {
    assert.equal(
      venueDefaultLandingPath({ readyToInviteCouples: false, setupCompleted: false }),
      "/setup-hub",
    );
    assert.equal(
      venueDefaultLandingPath({ readyToInviteCouples: true, setupCompleted: false }),
      "/dashboard",
    );
    assert.equal(
      venueDefaultLandingPath({ readyToInviteCouples: false, setupCompleted: true }),
      "/dashboard",
    );
  });
});
