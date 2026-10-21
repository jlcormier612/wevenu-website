/**
 * Phase 3: Setup Profile inventory / Event Order preset coverage seams.
 * Book-time remains reference-only; Event Setup starts drafts explicitly.
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
  it("booking inherit never creates inventory or Event Order records", () => {
    const inherit = read("lib/event-setup/inherit.ts");
    assert.doesNotMatch(inherit, /startOrApplyEventOrderTemplate/);
    assert.doesNotMatch(inherit, /applyTemplateItems/);
    assert.doesNotMatch(inherit, /event_inventor/);
    assert.doesNotMatch(inherit, /from\("event_orders"\)/);
    assert.match(inherit, /intentional reminders only/);
  });

  it("Setup Profile UI states template selection does not create event drafts", () => {
    const profiles = read("components/settings/setup-profiles-section.tsx");
    assert.match(profiles, /does not create an inventory draft on any event/);
    assert.match(profiles, /does not create, share, or invoice an Event Order/);
    assert.match(profiles, /Drafts start from Event Setup/);
  });

  it("Event Setup can start drafts from inherited refs without share/invoice side effects", () => {
    const panel = read("components/events/event-setup-panel.tsx");
    assert.match(panel, /ensureEventInventoryAction/);
    assert.match(panel, /ensureEventOrderAction/);
    assert.match(panel, /inventoryTemplateId && !hasEventInventory/);
    assert.match(panel, /eventOrderTemplateId && !eventOrder/);
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

  it("Readiness treats a profile ref without records as startable draft work, not completion", () => {
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
    assert.equal(inv.status, "needs_action");
    assert.equal(isOutstandingFollowUp("set_up", inv.status), true);
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
    assert.equal(eo.status, "needs_action");
    assert.match(eo.nextAction ?? "", /Event Order draft/);
  });

  it("skipped Event Order is not outstanding follow-up", () => {
    assert.equal(isOutstandingFollowUp("skipped", "not_included"), false);
    assert.equal(isOutstandingFollowUp(null, "needs_action"), false);
  });
});
