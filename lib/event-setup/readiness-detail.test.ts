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

  it("keeps vendor directory discoverable from Vendor Network classifications", () => {
    const detail = setupReadinessDetail(base({
      step: "vendors",
      vendorRecommendationCount: 0,
    }));
    assert.equal(detail.status, "included");
    assert.match(detail.summary, /available for client discovery by default/i);
    assert.match(detail.summary, /Vendor Network classifications/i);
  });

  it("treats questionnaire drafts as separately scheduled, not portal blockers", () => {
    const detail = setupReadinessDetail(base({
      step: "questionnaires",
      questionnaires: [{ kind: "final_details", status: "draft" }],
    }));
    assert.equal(detail.status, "draft");
    assert.match(detail.summary, /scheduled or authorized send/i);
    assert.match(detail.summary, /not sent by portal release/i);
  });

  it("flags missing inventory draft and routes recovery to Prepare and release portal", () => {
    const detail = setupReadinessDetail(base({
      step: "inventory",
      inheritedRefs: { inventoryTemplateId: "inv-1" },
      templateNames: { planning: null, timeline: null, inventory: "Starter kit", eventOrder: null },
    }));
    assert.equal(detail.status, "unavailable");
    assert.match(detail.summary, /no separate inventory prepare step/i);
    assert.equal(detail.nextAction, "Prepare and release portal");
  });

  it("flags missing Event Order draft without a separate prepare CTA", () => {
    const detail = setupReadinessDetail(base({
      step: "event_order",
      inheritedRefs: { eventOrderTemplateId: "eo-1" },
      templateNames: { planning: null, timeline: null, inventory: null, eventOrder: "Classic package" },
    }));
    assert.equal(detail.status, "unavailable");
    assert.match(detail.summary, /not an invoice/i);
    assert.equal(detail.nextAction, "Prepare and release portal");
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
  });
});
