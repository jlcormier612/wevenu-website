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

  it("shows client planning draft as Draft, not Shared", () => {
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
    assert.match(detail.summary, /not yet visible/i);
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

  it("keeps vendor directory discoverable when recommendations are empty", () => {
    const detail = setupReadinessDetail(base({
      step: "vendors",
      vendorRecommendationCount: 0,
    }));
    assert.equal(detail.status, "included");
    assert.match(detail.summary, /available for client discovery by default/i);
    assert.match(detail.summary, /No optional recommendations/i);
  });

  it("treats questionnaire drafts as not client-visible", () => {
    const detail = setupReadinessDetail(base({
      step: "questionnaires",
      questionnaires: [{ kind: "final_details", status: "draft" }],
    }));
    assert.equal(detail.status, "draft");
    assert.match(detail.summary, /not visible to the client until sent/i);
  });

  it("does not treat a starting inventory template as a commitment", () => {
    const detail = setupReadinessDetail(base({
      step: "inventory",
      inheritedRefs: { inventoryTemplateId: "inv-1" },
      templateNames: { planning: null, timeline: null, inventory: "Starter kit", eventOrder: null },
    }));
    assert.equal(detail.status, "included");
    assert.match(detail.summary, /reference/i);
    assert.match(detail.summary, /does not commit/i);
  });

  it("does not treat a starting event-order package as an invoice", () => {
    const detail = setupReadinessDetail(base({
      step: "event_order",
      inheritedRefs: { eventOrderTemplateId: "eo-1" },
      templateNames: { planning: null, timeline: null, inventory: null, eventOrder: "Classic package" },
    }));
    assert.equal(detail.status, "included");
    assert.match(detail.summary, /not the invoice/i);
  });
});
