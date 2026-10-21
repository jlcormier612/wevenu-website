/**
 * Booking-to-portal: Inventory / Event Order auto-preset at booking.
 * Drafts are prepared when Included with a template; share/invoice stay separate.
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
    assert.doesNotMatch(inherit, /startOrApplyEventOrderTemplate/);
  });

  it("Setup Profile UI states booking prepares drafts without sharing or invoicing", () => {
    const profiles = read("components/settings/setup-profiles-section.tsx");
    assert.match(profiles, /inventory draft is prepared automatically/);
    assert.match(profiles, /Event Order draft is prepared automatically/);
    assert.match(profiles, /does not create invoices/);
    assert.match(profiles, /not an invoice/);
    assert.match(profiles, /does not change existing events/);
  });

  it("Event Setup can recover missing drafts from inherited refs without share/invoice side effects", () => {
    const panel = read("components/events/event-setup-panel.tsx");
    assert.match(panel, /ensureEventInventoryAction/);
    assert.match(panel, /ensureEventOrderAction/);
    assert.match(panel, /inventoryTemplateId && !hasEventInventory/);
    assert.match(panel, /eventOrderTemplateId && !eventOrder/);
    assert.match(panel, /prepareAndReleasePortalAction/);
    assert.doesNotMatch(panel, /shareEventInventoryAction/);
    assert.doesNotMatch(panel, /finalizeEventInventoryAction/);
    assert.doesNotMatch(panel, /finalizeEventOrderAction/);
    assert.doesNotMatch(panel, /createInvoice/);
  });

  it("empty module panels preselect the profile starting template", () => {
    const inventory = read("components/event-inventory/event-inventory-panel.tsx");
    const orders = read("components/event-orders/event-order-panel.tsx");
    const detail = read("components/events/event-detail.tsx");
    assert.match(inventory, /preferredTemplateId/);
    assert.match(orders, /preferredTemplateId/);
    assert.match(detail, /preferredTemplateId=\{eventSetup\.inheritedTemplateRefs\?\.inventoryTemplateId/);
    assert.match(detail, /preferredTemplateId=\{eventSetup\.inheritedTemplateRefs\?\.eventOrderTemplateId/);
  });

  it("ensure paths are idempotent (existing record short-circuits)", () => {
    const inventory = read("lib/event-inventory/service.ts");
    const orders = read("lib/event-orders/service.ts");
    assert.match(inventory, /if \(existing\) return \{ ok: true, eventInventoryId: existing\.id \}/);
    assert.match(orders, /if \(existing\) return \{ ok: true, eventOrderId: existing\.id \}/);
  });

  it("Readiness treats a profile ref without records as unavailable preparation gap", () => {
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
    assert.equal(inv.status, "unavailable");
    assert.equal(isOutstandingFollowUp("set_up", inv.status, "inventory"), true);
    assert.match(inv.nextAction ?? "", /inventory draft/);

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
    assert.equal(eo.status, "unavailable");
    assert.match(eo.nextAction ?? "", /Event Order draft/);
  });

  it("skipped Event Order is not outstanding follow-up", () => {
    assert.equal(isOutstandingFollowUp("skipped", "not_included"), false);
    assert.equal(isOutstandingFollowUp(null, "needs_action"), false);
  });

  it("questionnaire drafts and Event Order drafts do not block portal settle", () => {
    assert.equal(isOutstandingFollowUp("set_up", "draft", "questionnaires"), false);
    assert.equal(isOutstandingFollowUp("set_up", "draft", "event_order"), false);
    assert.equal(isOutstandingFollowUp("set_up", "draft", "planning"), true);
  });
});
