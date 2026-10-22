import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setupReadinessDetail, type SetupReadinessContext } from "@/lib/event-setup/readiness-detail";

function base(overrides: Partial<SetupReadinessContext> = {}): SetupReadinessContext {
  return {
    step: "planning",
    decision: "set_up",
    inheritedRefs: {},
    playbookApplications: [],
    hasTimeline: false,
    timelineItemCount: 0,
    questionnaires: [],
    vendorRecommendationCount: 0,
    floorPlanOfferCount: 0,
    preferredFloorPlanName: null,
    hasEventInventory: false,
    eventOrder: null,
    templateNames: { planning: null, timeline: null, inventory: null, eventOrder: null },
    ...overrides,
  };
}

describe("setupReadinessDetail", () => {
  it("marks skipped features as not included, not unfinished work", () => {
    const detail = setupReadinessDetail(base({ decision: "skipped", step: "inventory" }));
    assert.equal(detail.status, "not_included");
    assert.match(detail.summary, /should not expect/i);
    assert.equal(detail.nextAction, null);
  });

  it("shows client planning draft as Draft readiness with prepare-not-released summary", () => {
    const detail = setupReadinessDetail(base({
      playbookApplications: [{
        eventId: "e1",
        kind: "client",
        templateId: "t1",
        templateName: "Wedding checklist",
        appliedAt: "2026-01-01",
        releasedAt: null,
      }],
    }));
    assert.equal(detail.status, "draft");
    assert.match(detail.summary, /has not yet been released|not released yet/i);
    assert.equal(detail.nextAction, "Open Planning");
  });

  it("shows released client planning as Shared", () => {
    const detail = setupReadinessDetail(base({
      playbookApplications: [{
        eventId: "e1",
        kind: "client",
        templateId: "t1",
        templateName: "Wedding checklist",
        appliedAt: "2026-01-01",
        releasedAt: "2026-01-02",
      }],
    }));
    assert.equal(detail.status, "shared");
  });

  it("when both checklists are persisted, Overview says both are set up and Change can edit either", () => {
    const detail = setupReadinessDetail(base({
      playbookApplications: [
        {
          eventId: "e1",
          kind: "client",
          templateId: "tc",
          templateName: "Client Wedding",
          appliedAt: "2026-01-01",
          releasedAt: null,
        },
        {
          eventId: "e1",
          kind: "venue",
          templateId: "tv",
          templateName: "Venue Ops",
          appliedAt: "2026-01-01",
          releasedAt: null,
        },
      ],
    }));
    assert.equal(detail.status, "draft");
    assert.match(detail.summary, /Both checklists are set up/i);
    assert.match(detail.summary, /Client Wedding/);
    assert.match(detail.summary, /Venue Ops/);
    assert.match(detail.summary, /Change for this event/);
    assert.match(detail.summary, /do not alter Library templates/i);
    assert.match(detail.summary, /release is a separate/i);
    assert.match(detail.summary, /stays internal|never released/i);
    assert.match(detail.summary, /Open Planning/);
    assert.doesNotMatch(detail.summary, /has been released to the client/i);
  });

  it("client-only persisted checklist does not claim venue is set up", () => {
    const detail = setupReadinessDetail(base({
      playbookApplications: [{
        eventId: "e1",
        kind: "client",
        templateId: "tc",
        templateName: "Client only",
        appliedAt: "2026-01-01",
        releasedAt: null,
      }],
    }));
    assert.match(detail.summary, /Client only/);
    assert.match(detail.summary, /No venue\/internal checklist is on this event yet/i);
    assert.doesNotMatch(detail.summary, /Both checklists are set up/i);
  });

  it("venue-only persisted checklist is stated when client is missing", () => {
    const detail = setupReadinessDetail(base({
      playbookApplications: [{
        eventId: "e1",
        kind: "venue",
        templateId: "tv",
        templateName: "Venue only",
        appliedAt: "2026-01-01",
        releasedAt: null,
      }],
    }));
    assert.match(detail.summary, /No client planning checklist/i);
    assert.match(detail.summary, /Venue only/);
  });

  it("profile venue ref without venue application is not described as set up", () => {
    const detail = setupReadinessDetail(base({
      inheritedRefs: { venuePlanningPlaybookTemplateId: "tv-ref" },
      playbookApplications: [{
        eventId: "e1",
        kind: "client",
        templateId: "tc",
        templateName: "Client Wedding",
        appliedAt: "2026-01-01",
        releasedAt: null,
      }],
    }));
    assert.match(detail.summary, /configured in the Setup Profile but is not yet applied/i);
    assert.doesNotMatch(detail.summary, /Both checklists are set up/i);
  });

  it("keeps vendor directory discoverable from Vendor Network classifications", () => {
    const detail = setupReadinessDetail(base({
      step: "vendors",
      vendorRecommendationCount: 0,
      vendorAssignmentCount: 0,
      vendorSubmittedHighlightCount: 0,
    }));
    assert.equal(detail.status, "included");
    assert.match(detail.summary, /No vendors highlighted for this event yet/i);
    assert.match(detail.summary, /Vendor Network classifications/i);
    assert.match(detail.summary, /Change for this event/i);
    assert.match(detail.summary, /assigned/i);
    assert.doesNotMatch(detail.summary, /vendors selected|recommendations pending/i);
  });

  it("labels Overview vendors by assignments and unsubmitted highlights", () => {
    const detail = setupReadinessDetail(base({
      step: "vendors",
      vendorRecommendationCount: 3,
      vendorAssignmentCount: 2,
      vendorSubmittedHighlightCount: 1,
    }));
    assert.equal(detail.status, "included");
    assert.match(detail.summary, /2 vendors assigned to this event/i);
    assert.match(detail.summary, /2 highlighted vendors not yet chosen by the couple/i);
    assert.doesNotMatch(detail.summary, /approv/i);
  });

  it("treats questionnaire drafts as authorized-send only, not portal blockers", () => {
    const detail = setupReadinessDetail(base({
      step: "questionnaires",
      questionnaires: [{ kind: "final_details", status: "draft" }],
    }));
    assert.equal(detail.status, "draft");
    assert.match(detail.summary, /authorized send/i);
    assert.match(detail.summary, /not sent by portal release/i);
    assert.match(detail.summary, /not on an automated schedule/i);
  });

  it("does not claim configured questionnaire refs are ready when no drafts exist", () => {
    const detail = setupReadinessDetail(base({
      step: "questionnaires",
      inheritedRefs: { questionnaireTemplateIds: ["q-1"] },
      questionnaires: [],
    }));
    assert.equal(detail.status, "draft");
    assert.match(detail.summary, /no event draft has been created yet/i);
    assert.match(detail.summary, /no automated delivery schedule/i);
  });

  it("treats missing inventory draft with a valid template ref as recoverable Draft, not Unavailable", () => {
    const detail = setupReadinessDetail(base({
      step: "inventory",
      inheritedRefs: { inventoryTemplateId: "inv-1" },
      templateNames: { planning: null, timeline: null, inventory: "Starter kit", eventOrder: null },
    }));
    assert.equal(detail.status, "draft");
    assert.match(detail.summary, /no separate inventory prepare step/i);
    assert.equal(detail.nextAction, "Open Inventory");
  });

  it("treats missing Event Order draft with a valid package ref as recoverable Draft, not Unavailable", () => {
    const detail = setupReadinessDetail(base({
      step: "event_order",
      inheritedRefs: { eventOrderTemplateId: "eo-1" },
      templateNames: { planning: null, timeline: null, inventory: null, eventOrder: "Classic package" },
    }));
    assert.equal(detail.status, "draft");
    assert.match(detail.summary, /not an invoice/i);
    assert.equal(detail.nextAction, "Open Event Order");
  });

  it("surfaces a Setup Profile configuration gap when Event Order is included without a package ref", () => {
    const detail = setupReadinessDetail(base({
      step: "event_order",
      inheritedRefs: {},
      templateNames: { planning: null, timeline: null, inventory: null, eventOrder: null },
    }));
    assert.equal(detail.status, "needs_action");
    assert.match(detail.summary, /no starting package selected/i);
    assert.match(detail.summary, /package-only/i);
    assert.match(detail.summary, /Skip this area/i);
    assert.equal(detail.nextAction, "Open Setup Profiles");
  });

  it("surfaces a Setup Profile configuration gap when Inventory is included without an offering ref", () => {
    const detail = setupReadinessDetail(base({
      step: "inventory",
      inheritedRefs: {},
      templateNames: { planning: null, timeline: null, inventory: null, eventOrder: null },
    }));
    assert.equal(detail.status, "needs_action");
    assert.match(detail.summary, /no starting offering selected/i);
    assert.equal(detail.nextAction, "Open Setup Profiles");
  });

  it("does not treat missing optional highlights as a Vendor Network failure", () => {
    const detail = setupReadinessDetail(base({
      step: "vendors",
      vendorRecommendationCount: 0,
      inheritedRefs: { recommendedVendorIds: ["v1", "v2"] },
    }));
    assert.equal(detail.status, "included");
    assert.match(detail.summary, /Vendor Network classifications/i);
    assert.match(detail.summary, /No vendors highlighted for this event yet/i);
  });

  it("floor-plan offers without working layouts remain Included with init copy", () => {
    const detail = setupReadinessDetail(base({
      step: "floor_plans",
      floorPlanOfferCount: 1,
      operationalFloorPlanCount: 0,
      preferredFloorPlanName: "Ceremony",
    }));
    assert.equal(detail.status, "included");
    assert.match(detail.summary, /offered to the client/i);
    assert.match(detail.summary, /Working layout initializes/i);
  });
});

