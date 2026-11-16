import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bringBusinessNothingToBringOver,
  bringBusinessStatus,
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
    assert.equal(phaseAProgressSummary(cards), "0 of 4 milestones ready · 0 in progress");
    assert.equal(nextIncompleteMilestoneHref(cards), "/setup-hub/protect-calendar");
  });

  it("starters alone leave a fresh venue at 0 ready / 0 in progress", () => {
    const cards = buildPhaseAMilestones({
      hubState: emptyHub,
      spacesCount: 0,
      hasMigrationImport: false,
      venueBrandStarted: false,
      setupProfileCount: 1,
      packages: [{ isActive: true, basePrice: null, sourceMasterKey: "PKG-01" }],
      contractStarterCount: 1,
      setupProfileAssignments: [{ profileId: "prof-wedding", eventType: "wedding" }],
      setupProfiles: [{ id: "prof-wedding", name: "Standard Wedding Setup", updatedAt: "2026-01-01T00:00:00.000Z" }],
      messageTemplateCount: 8,
      pausedAutomationCount: 4,
      operationalStarterAvailable: true,
    });
    assert.deepEqual(
      cards.map((c) => c.statusLabel),
      ["Not started", "Not started", "Not started", "Not started"],
    );
    assert.equal(phaseAProgressSummary(cards), "0 of 4 milestones ready · 0 in progress");
  });

  it("a meaningful saved action moves only that milestone to In progress", () => {
    const cards = buildPhaseAMilestones({
      hubState: emptyHub,
      spacesCount: 1,
      hasMigrationImport: false,
      venueBrandStarted: false,
      setupProfileCount: 1,
      packages: [{ isActive: true, basePrice: null, sourceMasterKey: "PKG-01" }],
      contractStarterCount: 1,
      messageTemplateCount: 8,
      pausedAutomationCount: 4,
      operationalStarterAvailable: true,
    });
    assert.equal(cards[0]?.status, "in_progress");
    assert.equal(cards[1]?.status, "not_started");
    assert.equal(cards[2]?.status, "not_started");
    assert.equal(cards[3]?.status, "not_started");
    assert.equal(phaseAProgressSummary(cards), "0 of 4 milestones ready · 1 in progress");
  });

  it("preserves existing Ready states and historical progress", () => {
    const cards = buildPhaseAMilestones({
      hubState: {
        ...emptyHub,
        yourVenueReviewedAt: "2026-01-01",
        bookingProcessReviewedAt: "2026-01-02",
        hostedEventTypes: ["wedding"],
        hostedEventTypesSetAt: "2026-01-03",
        eventExperienceReviews: {
          wedding: {
            profileId: "prof-wedding",
            profileUpdatedAt: "2026-01-01T00:00:00.000Z",
            confirmedAt: "2026-03-01T00:00:00.000Z",
          },
        },
        communicationsReviewedAt: "2026-01-04",
        existingBookingsAnswer: "no",
        existingBookingsAnsweredAt: "2026-01-05",
        bookingRulesReviewedAt: "2026-01-05",
      },
      spacesCount: 1,
      hasMigrationImport: false,
      venueBrandStarted: true,
      setupProfileCount: 1,
      packages: [{ isActive: true, basePrice: 1800 }],
      contractStarterCount: 1,
      setupProfileAssignments: [{ profileId: "prof-wedding", eventType: "wedding" }],
      setupProfiles: [{ id: "prof-wedding", name: "Standard Wedding Setup", updatedAt: "2026-01-01T00:00:00.000Z" }],
      messageTemplateCount: 8,
      pausedAutomationCount: 4,
      operationalStarterAvailable: true,
    });
    assert.equal(cards[0]?.status, "ready");
    assert.equal(cards[1]?.status, "ready");
    assert.equal(cards[2]?.status, "ready");
    assert.equal(cards[2]?.statusLabel, "Nothing to bring over");
    assert.equal(cards[3]?.status, "not_started");
  });
});

describe("bring-business labeling", () => {
  it("labels explicit no-import completion as Nothing to bring over and still counts as Ready", () => {
    assert.equal(
      bringBusinessStatus({
        existingBookingsAnswer: "no",
        hasMigrationImport: false,
        bringYourBusinessPath: null,
      }),
      "ready",
    );
    assert.equal(
      bringBusinessNothingToBringOver({
        existingBookingsAnswer: "no",
        hasMigrationImport: false,
        bringYourBusinessPath: null,
      }),
      true,
    );
  });

  it("does not label an actual import as Nothing to bring over", () => {
    assert.equal(
      bringBusinessStatus({
        existingBookingsAnswer: "yes",
        hasMigrationImport: true,
        bringYourBusinessPath: "individual",
      }),
      "in_progress",
    );
    assert.equal(
      bringBusinessNothingToBringOver({
        existingBookingsAnswer: "yes",
        hasMigrationImport: true,
        bringYourBusinessPath: "individual",
      }),
      false,
    );
    const cards = buildPhaseAMilestones({
      hubState: { ...emptyHub, existingBookingsAnswer: "yes", existingBookingsAnsweredAt: "2026-01-01" },
      spacesCount: 0,
      hasMigrationImport: true,
      venueBrandStarted: false,
      setupProfileCount: 0,
    });
    assert.equal(cards[2]?.statusLabel, "In progress");
    assert.notEqual(cards[2]?.statusLabel, "Nothing to bring over");
  });

  it("restores incomplete state when the owner answers Yes", () => {
    assert.equal(
      bringBusinessStatus({
        existingBookingsAnswer: "yes",
        hasMigrationImport: false,
        bringYourBusinessPath: null,
      }),
      "in_progress",
    );
    assert.equal(
      bringBusinessNothingToBringOver({
        existingBookingsAnswer: "yes",
        hasMigrationImport: false,
        bringYourBusinessPath: null,
      }),
      false,
    );
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
