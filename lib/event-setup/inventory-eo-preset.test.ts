/**
 * Booking-to-portal: Inventory / Event Order auto-preset; no separate prepare CTAs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { setupReadinessDetail } from "@/lib/event-setup/readiness-detail";
import { isOutstandingFollowUp } from "@/lib/event-setup/outstanding-follow-ups";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("inventory and Event Order profile preset coverage", () => {
  it("booking inherit ensures inventory and Event Order drafts when Included with a template", () => {
    const inherit = read("lib/event-setup/inherit.ts");
    assert.match(inherit, /applyInheritedInventoryAndEventOrder/);
    assert.match(inherit, /ensureEventInventory/);
    assert.match(inherit, /ensureEventOrder/);
    assert.doesNotMatch(inherit, /shareEventInventory/);
    assert.doesNotMatch(inherit, /shareEventOrderWithClient/);
    assert.doesNotMatch(inherit, /createInvoice/);
  });

  it("Setup Profile UI states booking prepares drafts without sharing or invoicing", () => {
    const profiles = read("components/settings/setup-profiles-section.tsx");
    assert.match(profiles, /inventory draft is prepared automatically/);
    assert.match(profiles, /Event Order draft is prepared automatically/);
  });

  it("Event Setup recovers missing drafts only via Release to client portal", () => {
    const panel = read("components/events/event-setup-panel.tsx");
    assert.match(panel, /prepareAndReleasePortalAction/);
    assert.match(panel, /Release to client portal/);
    assert.doesNotMatch(panel, /ensureEventInventoryAction/);
    assert.doesNotMatch(panel, /ensureEventOrderAction/);
    assert.doesNotMatch(panel, /Start inventory draft/);
    assert.doesNotMatch(panel, /Start Event Order draft/);
    assert.doesNotMatch(panel, /startProfileDraft/);
  });

  it("ensure paths are idempotent (existing record short-circuits)", () => {
    const inventory = read("lib/event-inventory/service.ts");
    const orders = read("lib/event-orders/service.ts");
    assert.match(inventory, /if \(existing\) return \{ ok: true, eventInventoryId: existing\.id \}/);
    assert.match(orders, /if \(existing\) return \{ ok: true, eventOrderId: existing\.id \}/);
  });

  it("Readiness marks missing drafts with template refs as Draft + Open workspace, not Unavailable", () => {
    const inv = setupReadinessDetail({
      step: "inventory",
      decision: "set_up",
      inheritedRefs: { inventoryTemplateId: "inv-1" },
      playbookApplications: [],
      hasTimeline: false,
      timelineItemCount: 0,
      questionnaires: [],
      vendorRecommendationCount: 0,
      floorPlanOfferCount: 0,
      preferredFloorPlanName: null,
      hasEventInventory: false,
      eventOrder: null,
      templateNames: { planning: null, timeline: null, inventory: "Bar basics", eventOrder: null },
    });
    assert.equal(inv.status, "draft");
    assert.equal(isOutstandingFollowUp("set_up", inv.status, "inventory"), false);
    assert.equal(inv.nextAction, "Open Inventory");
    assert.doesNotMatch(inv.nextAction ?? "", /Release to client portal/i);

    const eo = setupReadinessDetail({
      step: "event_order",
      decision: "set_up",
      inheritedRefs: { eventOrderTemplateId: "eo-1" },
      playbookApplications: [],
      hasTimeline: false,
      timelineItemCount: 0,
      questionnaires: [],
      vendorRecommendationCount: 0,
      floorPlanOfferCount: 0,
      preferredFloorPlanName: null,
      hasEventInventory: false,
      eventOrder: null,
      templateNames: { planning: null, timeline: null, inventory: null, eventOrder: "Classic" },
    });
    assert.equal(eo.status, "draft");
    assert.equal(eo.nextAction, "Open Event Order");
    assert.equal(isOutstandingFollowUp("set_up", eo.status, "event_order"), false);
  });

  it("questionnaire and prepared drafts do not block portal settle", () => {
    assert.equal(isOutstandingFollowUp("set_up", "draft", "questionnaires"), false);
    assert.equal(isOutstandingFollowUp("set_up", "draft", "event_order"), false);
    assert.equal(isOutstandingFollowUp("set_up", "draft", "planning"), false);
    assert.equal(isOutstandingFollowUp("set_up", "draft", "inventory"), false);
  });
});
