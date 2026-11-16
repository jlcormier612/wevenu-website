import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { makeHtcYoursStatus } from "@/lib/setup-hub/phase-a-milestones";
import {
  effectiveHostedEventTypes,
  HOSTED_EVENT_TYPE_OPTIONS,
  normalizeHostedEventTypes,
} from "@/lib/setup-hub/phase-b1-event-types";
import {
  bookingProcessStatus,
  canConfirmBookingProcess,
  canConfirmEventTypeReview,
  eventExperiencesStatus,
  eventTypeReadiness,
  experienceFamilyDisplayStatus,
  experiencePreparationStatus,
  isEventTypeResourcesReviewed,
  isEventTypeReviewValid,
  makeHtcYoursMilestoneStatusFromSections,
  makeHtcYoursSectionStatuses,
  parseEventExperienceReviews,
  SECTION_STATUS_LABEL,
  venueBrandStatus,
} from "@/lib/setup-hub/phase-b1-readiness";

const weddingProfile = { id: "prof-wedding", name: "Standard Wedding Setup", updatedAt: "2026-01-01T00:00:00.000Z" };
const corporateProfile = { id: "prof-corp", name: "Corporate Setup", updatedAt: "2026-02-01T00:00:00.000Z" };
const weddingAssignment = { profileId: "prof-wedding", eventType: "wedding" as const };
const corporateAssignment = { profileId: "prof-corp", eventType: "corporate" as const };

describe("Phase B1 hosted event types", () => {
  it("uses existing canonical identifiers for the three families", () => {
    assert.deepEqual(
      HOSTED_EVENT_TYPE_OPTIONS.map((o) => o.value),
      ["wedding", "corporate", "social_event"],
    );
    const social = HOSTED_EVENT_TYPE_OPTIONS.find((o) => o.value === "social_event");
    assert.equal(social?.label, "Social celebrations");
    assert.equal(
      social && "checkboxLabel" in social ? social.checkboxLabel : null,
      "Social celebrations (birthdays, showers, quinceañeras & more)",
    );
  });

  it("does not invent new identifiers or persist an implicit wedding default", () => {
    assert.deepEqual(normalizeHostedEventTypes(null), []);
    assert.deepEqual(normalizeHostedEventTypes(["Wedding", "corporate_event"]), ["wedding", "corporate"]);
  });

  it("treats an unsaved selection as weddings only for display and readiness", () => {
    assert.deepEqual(effectiveHostedEventTypes(null), ["wedding"]);
    assert.deepEqual(effectiveHostedEventTypes(undefined), ["wedding"]);
    assert.deepEqual(effectiveHostedEventTypes(["corporate"]), ["corporate"]);
    assert.deepEqual(effectiveHostedEventTypes([]), []);
  });
});

describe("venue brand status", () => {
  it("is Ready only after deliberate review/save, not from provisioned name", () => {
    assert.equal(venueBrandStatus({ venueBrandStarted: false, yourVenueReviewedAt: null }), "not_started");
    assert.equal(venueBrandStatus({ venueBrandStarted: true, yourVenueReviewedAt: null }), "in_progress");
    assert.equal(
      venueBrandStatus({ venueBrandStarted: true, yourVenueReviewedAt: "2026-01-01" }),
      "ready",
    );
  });
});

describe("booking process status", () => {
  it("does not mark Ready from unpriced starter packages alone", () => {
    assert.equal(
      bookingProcessStatus({
        bookingProcessReviewedAt: null,
        packages: [{ isActive: true, basePrice: null, sourceMasterKey: "PKG-01" }],
        contractStarterCount: 1,
      }),
      "starter_available",
    );
    assert.equal(
      canConfirmBookingProcess([{ isActive: true, basePrice: null, sourceMasterKey: "PKG-01" }]),
      false,
    );
  });

  it("allows Ready after confirmation when unpriced starters are archived", () => {
    assert.equal(
      canConfirmBookingProcess([{ isActive: false, basePrice: null, sourceMasterKey: "PKG-01" }]),
      true,
    );
    assert.equal(
      bookingProcessStatus({
        bookingProcessReviewedAt: "2026-01-02",
        packages: [{ isActive: false, basePrice: null }, { isActive: true, basePrice: 2500 }],
        contractStarterCount: 1,
      }),
      "ready",
    );
  });

  it("invalidates Ready if active packages become unpriced after confirmation", () => {
    assert.equal(
      bookingProcessStatus({
        bookingProcessReviewedAt: "2026-01-02",
        packages: [{ isActive: true, basePrice: null }],
        contractStarterCount: 1,
      }),
      "needs_review",
    );
  });
});

describe("event experiences status", () => {
  it("counts a saved resource review as owner progress even before hosted types are saved", () => {
    assert.equal(
      eventExperiencesStatus({
        hostedEventTypes: null,
        assignments: [weddingAssignment],
        profiles: [weddingProfile],
        reviews: {
          wedding: {
            profileId: weddingProfile.id,
            profileUpdatedAt: weddingProfile.updatedAt,
            confirmedAt: "",
            resourcesReviewedAt: "2026-03-01T00:00:00.000Z",
          },
        },
      }),
      "in_progress",
    );
  });

  it("does not infer wedding selection or Ready from a provisioned profile", () => {
    assert.equal(
      eventExperiencesStatus({
        hostedEventTypes: null,
        assignments: [weddingAssignment],
        profiles: [weddingProfile],
        reviews: {},
      }),
      "starter_available",
    );
  });

  it("uses the wedding default without silently enabling corporate or social", () => {
    assert.equal(
      eventExperiencesStatus({
        hostedEventTypes: null,
        assignments: [weddingAssignment],
        profiles: [weddingProfile],
        reviews: {
          wedding: {
            profileId: weddingProfile.id,
            profileUpdatedAt: weddingProfile.updatedAt,
            confirmedAt: "2026-03-01T00:00:00.000Z",
          },
        },
      }),
      "ready",
    );
    const corporate = eventTypeReadiness({
      eventType: "corporate",
      selected: effectiveHostedEventTypes(null).includes("corporate"),
      assignments: [weddingAssignment],
      profiles: [weddingProfile],
      reviews: {},
    });
    assert.equal(corporate.reason, "not_selected");
    const weddingGate = canConfirmEventTypeReview({
      eventType: "wedding",
      hostedEventTypes: null,
      assignments: [weddingAssignment],
      profiles: [weddingProfile],
    });
    assert.equal(weddingGate.ok, true);
    const corporateGate = canConfirmEventTypeReview({
      eventType: "corporate",
      hostedEventTypes: null,
      assignments: [weddingAssignment],
      profiles: [weddingProfile],
    });
    assert.equal(corporateGate.ok, false);
  });

  it("requires a deliberate selection of at least one type", () => {
    const selectedWedding = eventTypeReadiness({
      eventType: "wedding",
      selected: true,
      assignments: [weddingAssignment],
      profiles: [weddingProfile],
      reviews: {},
    });
    assert.equal(selectedWedding.status, "starter_available");
    assert.equal(selectedWedding.reason, "needs_review");
  });

  it("unselected corporate/social types do not block readiness", () => {
    assert.equal(
      eventExperiencesStatus({
        hostedEventTypes: ["wedding"],
        assignments: [weddingAssignment],
        profiles: [weddingProfile],
        reviews: {
          wedding: {
            profileId: weddingProfile.id,
            profileUpdatedAt: weddingProfile.updatedAt,
            confirmedAt: "2026-03-01T00:00:00.000Z",
          },
        },
      }),
      "ready",
    );
  });

  it("selected corporate without a configured profile blocks readiness", () => {
    assert.equal(
      eventExperiencesStatus({
        hostedEventTypes: ["wedding", "corporate"],
        assignments: [weddingAssignment],
        profiles: [weddingProfile],
        reviews: {
          wedding: {
            profileId: weddingProfile.id,
            profileUpdatedAt: weddingProfile.updatedAt,
            confirmedAt: "2026-03-01T00:00:00.000Z",
          },
        },
      }),
      "needs_review",
    );
    const corp = eventTypeReadiness({
      eventType: "corporate",
      selected: true,
      assignments: [weddingAssignment],
      profiles: [weddingProfile],
      reviews: {},
    });
    assert.equal(corp.reason, "needs_setup");
  });

  it("adding a type later reopens readiness for that type without destroying prior types", () => {
    const afterAdd = eventExperiencesStatus({
      hostedEventTypes: ["wedding", "corporate"],
      assignments: [weddingAssignment, corporateAssignment],
      profiles: [weddingProfile, corporateProfile],
      reviews: {
        wedding: {
          profileId: weddingProfile.id,
          profileUpdatedAt: weddingProfile.updatedAt,
          confirmedAt: "2026-03-01T00:00:00.000Z",
        },
      },
    });
    assert.equal(afterAdd, "starter_available");
    const weddingStillValid = eventTypeReadiness({
      eventType: "wedding",
      selected: true,
      assignments: [weddingAssignment, corporateAssignment],
      profiles: [weddingProfile, corporateProfile],
      reviews: {
        wedding: {
          profileId: weddingProfile.id,
          profileUpdatedAt: weddingProfile.updatedAt,
          confirmedAt: "2026-03-01T00:00:00.000Z",
        },
      },
    });
    assert.equal(weddingStillValid.status, "ready");
  });

  it("removing or unassigning a profile invalidates its confirmation", () => {
    const stale = eventTypeReadiness({
      eventType: "wedding",
      selected: true,
      assignments: [],
      profiles: [weddingProfile],
      reviews: {
        wedding: {
          profileId: weddingProfile.id,
          profileUpdatedAt: weddingProfile.updatedAt,
          confirmedAt: "2026-03-01T00:00:00.000Z",
        },
      },
    });
    assert.equal(stale.reason, "needs_setup");

    const changed = eventTypeReadiness({
      eventType: "wedding",
      selected: true,
      assignments: [weddingAssignment],
      profiles: [{ ...weddingProfile, updatedAt: "2026-04-01T00:00:00.000Z" }],
      reviews: {
        wedding: {
          profileId: weddingProfile.id,
          profileUpdatedAt: weddingProfile.updatedAt,
          confirmedAt: "2026-03-01T00:00:00.000Z",
        },
      },
    });
    assert.equal(changed.reason, "stale");
    assert.equal(changed.status, "needs_review");
  });

  it("cannot confirm a type that is not selected or has no assigned profile", () => {
    assert.equal(
      canConfirmEventTypeReview({
        eventType: "corporate",
        hostedEventTypes: ["wedding"],
        assignments: [weddingAssignment],
        profiles: [weddingProfile],
      }).ok,
      false,
    );
    assert.equal(
      canConfirmEventTypeReview({
        eventType: "wedding",
        hostedEventTypes: ["wedding"],
        assignments: [weddingAssignment],
        profiles: [weddingProfile],
      }).ok,
      true,
    );
  });

  it("does not treat a starter profile as Ready without confirmation", () => {
    const card = eventTypeReadiness({
      eventType: "wedding",
      selected: true,
      assignments: [weddingAssignment],
      profiles: [weddingProfile],
      reviews: {},
    });
    assert.equal(experienceFamilyDisplayStatus(card), "Not reviewed");
    assert.notEqual(experienceFamilyDisplayStatus(card), "Ready");
  });

  it("blocks confirmation when included planning is missing required templates", () => {
    const incomplete = {
      ...weddingProfile,
      decisions: { planning: "set_up" as const },
      templateRefs: {},
    };
    const gate = canConfirmEventTypeReview({
      eventType: "wedding",
      hostedEventTypes: ["wedding"],
      assignments: [weddingAssignment],
      profiles: [incomplete],
    });
    assert.equal(gate.ok, false);
    const card = eventTypeReadiness({
      eventType: "wedding",
      selected: true,
      assignments: [weddingAssignment],
      profiles: [incomplete],
      reviews: {},
    });
    assert.equal(experienceFamilyDisplayStatus(card), "Needs attention");
  });

  it("labels an unassigned selected family as Not started", () => {
    const card = eventTypeReadiness({
      eventType: "corporate",
      selected: true,
      assignments: [],
      profiles: [],
      reviews: {},
    });
    assert.equal(experienceFamilyDisplayStatus(card), "Not started");
  });
});

describe("event experience reviews", () => {
  it("stores review state independently per event experience", () => {
    const reviews = parseEventExperienceReviews({
      wedding: {
        profileId: weddingProfile.id,
        profileUpdatedAt: weddingProfile.updatedAt,
        confirmedAt: "2026-03-01T00:00:00.000Z",
      },
    });
    const wedding = eventTypeReadiness({
      eventType: "wedding",
      selected: true,
      assignments: [weddingAssignment, corporateAssignment],
      profiles: [weddingProfile, corporateProfile],
      reviews,
    });
    const corporate = eventTypeReadiness({
      eventType: "corporate",
      selected: true,
      assignments: [weddingAssignment, corporateAssignment],
      profiles: [weddingProfile, corporateProfile],
      reviews,
    });
    assert.equal(wedding.status, "ready");
    assert.equal(corporate.status, "starter_available");
    assert.equal(corporate.reason, "needs_review");
  });

  it("does not treat event-experience readiness as an import prerequisite", () => {
    const corporateNotReady = eventTypeReadiness({
      eventType: "corporate",
      selected: false,
      assignments: [],
      profiles: [],
      reviews: {},
    });
    assert.equal(corporateNotReady.reason, "not_selected");
    assert.notEqual(corporateNotReady.reason, "import_blocked");
  });
});

describe("starter availability is informational", () => {
  it("does not treat starter_available as milestone In progress", () => {
    assert.equal(SECTION_STATUS_LABEL.starter_available, "Starter ready for you");
    const sections = makeHtcYoursSectionStatuses({
      venueBrandStarted: false,
      yourVenueReviewedAt: null,
      bookingProcessReviewedAt: null,
      packages: [{ isActive: true, basePrice: null, sourceMasterKey: "PKG-01" }],
      contractStarterCount: 1,
      hostedEventTypes: null,
      assignments: [weddingAssignment],
      profiles: [weddingProfile],
      reviews: {},
      communicationsReviewedAt: null,
      templateCount: 8,
      pausedAutomationCount: 4,
      operationalResourcesReviewedAt: null,
      operationalStarterAvailable: true,
    });
    assert.equal(sections.brand, "not_started");
    assert.equal(sections.booking, "starter_available");
    assert.equal(sections.experiences, "starter_available");
    assert.equal(sections.communications, "starter_available");
    assert.equal(makeHtcYoursMilestoneStatusFromSections(sections), "not_started");
  });

  it("moves Make HTC yours to In progress after a saved owner confirmation", () => {
    const sections = makeHtcYoursSectionStatuses({
      venueBrandStarted: false,
      yourVenueReviewedAt: null,
      bookingProcessReviewedAt: "2026-01-02",
      packages: [{ isActive: true, basePrice: 1800 }],
      contractStarterCount: 1,
      hostedEventTypes: null,
      assignments: [weddingAssignment],
      profiles: [weddingProfile],
      reviews: {},
      communicationsReviewedAt: null,
      templateCount: 8,
      pausedAutomationCount: 4,
      operationalResourcesReviewedAt: null,
      operationalStarterAvailable: true,
    });
    assert.equal(sections.booking, "ready");
    assert.equal(makeHtcYoursMilestoneStatusFromSections(sections), "in_progress");
  });
});

describe("event-experience resource review and readiness gating", () => {
  it("persists Step 3 independently of Step 4 and keeps families independent", () => {
    const reviews = parseEventExperienceReviews({
      wedding: {
        profileId: weddingProfile.id,
        profileUpdatedAt: weddingProfile.updatedAt,
        resourcesReviewedAt: "2026-03-01T00:00:00.000Z",
      },
    });
    const weddingInput = {
      eventType: "wedding",
      assignments: [weddingAssignment, corporateAssignment],
      profiles: [weddingProfile, corporateProfile],
      reviews,
    };
    const corporateInput = {
      eventType: "corporate",
      assignments: [weddingAssignment, corporateAssignment],
      profiles: [weddingProfile, corporateProfile],
      reviews,
    };
    assert.equal(isEventTypeResourcesReviewed(weddingInput), true);
    assert.equal(isEventTypeReviewValid(weddingInput), false);
    assert.equal(experiencePreparationStatus(weddingInput), "Reviewed");
    assert.equal(isEventTypeResourcesReviewed(corporateInput), false);
    assert.equal(experiencePreparationStatus(corporateInput), "Not reviewed");
    const weddingCard = eventTypeReadiness({
      eventType: "wedding",
      selected: true,
      assignments: weddingInput.assignments,
      profiles: weddingInput.profiles,
      reviews,
    });
    assert.equal(weddingCard.status, "in_progress");
    assert.notEqual(weddingCard.status, "ready");
    assert.equal(experienceFamilyDisplayStatus(weddingCard), "Reviewed");
  });

  it("does not mark Ready until Step 3 is saved, then preserves Ready after confirmation", () => {
    const unreviewed = eventTypeReadiness({
      eventType: "wedding",
      selected: true,
      assignments: [weddingAssignment],
      profiles: [weddingProfile],
      reviews: {},
    });
    assert.equal(unreviewed.status, "starter_available");
    const confirmed = parseEventExperienceReviews({
      wedding: {
        profileId: weddingProfile.id,
        profileUpdatedAt: weddingProfile.updatedAt,
        confirmedAt: "2026-03-02T00:00:00.000Z",
        resourcesReviewedAt: "2026-03-01T00:00:00.000Z",
      },
    });
    const readyCard = eventTypeReadiness({
      eventType: "wedding",
      selected: true,
      assignments: [weddingAssignment],
      profiles: [weddingProfile],
      reviews: confirmed,
    });
    assert.equal(readyCard.status, "ready");
    assert.equal(
      experiencePreparationStatus({
        eventType: "wedding",
        assignments: [weddingAssignment],
        profiles: [weddingProfile],
        reviews: confirmed,
      }),
      "Ready",
    );
  });

  it("preserves legacy confirmed experiences without resourcesReviewedAt", () => {
    const legacy = parseEventExperienceReviews({
      wedding: {
        profileId: weddingProfile.id,
        profileUpdatedAt: weddingProfile.updatedAt,
        confirmedAt: "2026-03-01T00:00:00.000Z",
      },
    });
    const input = {
      eventType: "wedding",
      assignments: [weddingAssignment],
      profiles: [weddingProfile],
      reviews: legacy,
    };
    assert.equal(isEventTypeReviewValid(input), true);
    assert.equal(isEventTypeResourcesReviewed(input), true);
    assert.equal(experiencePreparationStatus(input), "Ready");
  });

  it("invalidates resource review and Ready when the Setup Profile changes", () => {
    const reviews = parseEventExperienceReviews({
      wedding: {
        profileId: weddingProfile.id,
        profileUpdatedAt: weddingProfile.updatedAt,
        confirmedAt: "2026-03-02T00:00:00.000Z",
        resourcesReviewedAt: "2026-03-01T00:00:00.000Z",
      },
    });
    const staleInput = {
      eventType: "wedding",
      assignments: [weddingAssignment],
      profiles: [{ ...weddingProfile, updatedAt: "2026-04-01T00:00:00.000Z" }],
      reviews,
    };
    assert.equal(isEventTypeReviewValid(staleInput), false);
    assert.equal(isEventTypeResourcesReviewed(staleInput), false);
    assert.equal(experiencePreparationStatus(staleInput), "Not reviewed");
    const staleCard = eventTypeReadiness({
      eventType: "wedding",
      selected: true,
      assignments: [weddingAssignment],
      profiles: staleInput.profiles,
      reviews,
    });
    assert.equal(staleCard.reason, "stale");
  });

  it("invalidates only the family whose assigned Setup Profile changed", () => {
    const reviews = parseEventExperienceReviews({
      wedding: {
        profileId: weddingProfile.id,
        profileUpdatedAt: weddingProfile.updatedAt,
        confirmedAt: "2026-03-02T00:00:00.000Z",
        resourcesReviewedAt: "2026-03-01T00:00:00.000Z",
      },
      corporate: {
        profileId: corporateProfile.id,
        profileUpdatedAt: corporateProfile.updatedAt,
        confirmedAt: "2026-03-02T00:00:00.000Z",
        resourcesReviewedAt: "2026-03-01T00:00:00.000Z",
      },
    });
    const reassignedWedding = {
      eventType: "wedding",
      assignments: [{ profileId: corporateProfile.id, eventType: "wedding" as const }, corporateAssignment],
      profiles: [weddingProfile, corporateProfile],
      reviews,
    };
    const unchangedCorporate = {
      eventType: "corporate",
      assignments: [{ profileId: corporateProfile.id, eventType: "wedding" as const }, corporateAssignment],
      profiles: [weddingProfile, corporateProfile],
      reviews,
    };
    assert.equal(isEventTypeReviewValid(reassignedWedding), false);
    assert.equal(isEventTypeResourcesReviewed(reassignedWedding), false);
    assert.equal(isEventTypeReviewValid(unchangedCorporate), true);
    assert.equal(isEventTypeResourcesReviewed(unchangedCorporate), true);
    assert.equal(experiencePreparationStatus(unchangedCorporate), "Ready");
  });

  it("does not invalidate on unrelated venue edits or an unrelated profile timestamp", () => {
    const reviews = parseEventExperienceReviews({
      wedding: {
        profileId: weddingProfile.id,
        profileUpdatedAt: weddingProfile.updatedAt,
        confirmedAt: "2026-03-02T00:00:00.000Z",
        resourcesReviewedAt: "2026-03-01T00:00:00.000Z",
      },
    });
    const input = {
      eventType: "wedding",
      assignments: [weddingAssignment, corporateAssignment],
      profiles: [weddingProfile, { ...corporateProfile, updatedAt: "2026-05-01T00:00:00.000Z" }],
      reviews,
    };
    assert.equal(isEventTypeReviewValid(input), true);
    assert.equal(isEventTypeResourcesReviewed(input), true);
    assert.equal(experiencePreparationStatus(input), "Ready");
    const sections = makeHtcYoursSectionStatuses({
      venueBrandStarted: true,
      yourVenueReviewedAt: "2026-05-01T00:00:00.000Z",
      bookingProcessReviewedAt: "2026-05-01T00:00:00.000Z",
      packages: [{ isActive: true, basePrice: 2500 }],
      contractStarterCount: 1,
      hostedEventTypes: ["wedding"],
      assignments: [weddingAssignment],
      profiles: [weddingProfile],
      reviews,
      communicationsReviewedAt: "2026-05-01T00:00:00.000Z",
      templateCount: 8,
      pausedAutomationCount: 4,
      operationalResourcesReviewedAt: "2026-05-01T00:00:00.000Z",
      operationalStarterAvailable: true,
    });
    assert.equal(sections.experiences, "ready");
  });
});

describe("makeHtcYoursStatus shortcut removal", () => {
  it("brand save + provisioned Setup Profile does not make Milestone 02 Ready", () => {
    assert.equal(
      makeHtcYoursStatus({
        venueBrandStarted: true,
        yourVenueReviewedAt: "2026-01-01",
        setupProfileCount: 1,
        setupProfiles: [weddingProfile],
        setupProfileAssignments: [weddingAssignment],
      }),
      "in_progress",
    );
  });

  it("is Ready when the four approved areas are Ready without operational-resources review", () => {
    const sections = makeHtcYoursSectionStatuses({
      venueBrandStarted: true,
      yourVenueReviewedAt: "2026-01-01",
      bookingProcessReviewedAt: "2026-01-02",
      packages: [{ isActive: true, basePrice: 1800 }],
      contractStarterCount: 1,
      hostedEventTypes: ["wedding"],
      assignments: [weddingAssignment],
      profiles: [weddingProfile],
      reviews: {
        wedding: {
          profileId: weddingProfile.id,
          profileUpdatedAt: weddingProfile.updatedAt,
          confirmedAt: "2026-03-01T00:00:00.000Z",
        },
      },
      communicationsReviewedAt: "2026-01-03",
      templateCount: 4,
      pausedAutomationCount: 4,
      operationalResourcesReviewedAt: null,
      operationalStarterAvailable: true,
    });
    assert.equal(makeHtcYoursMilestoneStatusFromSections(sections), "ready");
    assert.equal(sections.communications, "ready");
    assert.equal(sections.operations, "starter_available");
  });

  it("communications can be Ready while automations remain paused", () => {
    const sections = makeHtcYoursSectionStatuses({
      venueBrandStarted: false,
      yourVenueReviewedAt: null,
      bookingProcessReviewedAt: null,
      packages: [],
      contractStarterCount: 0,
      hostedEventTypes: null,
      assignments: [],
      profiles: [],
      reviews: {},
      communicationsReviewedAt: "2026-01-03",
      templateCount: 8,
      pausedAutomationCount: 4,
      operationalResourcesReviewedAt: null,
      operationalStarterAvailable: true,
    });
    assert.equal(sections.communications, "ready");
    assert.equal(sections.operations, "starter_available");
  });
});
