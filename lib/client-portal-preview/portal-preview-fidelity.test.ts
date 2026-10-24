/**
 * Staff Client Portal Preview must reuse couple-facing presentation and
 * portal visibility rules — never a parallel mockup or mutating ensure path.
 * Nav is Event Setup planning only: Planning → Timeline → Floor Plans → Vendors.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const preview = readFileSync(resolve("components/events/client-portal-preview.tsx"), "utf8");
const loader = readFileSync(resolve("lib/client-portal-preview/load-preview.ts"), "utf8");
const timelinePreview = readFileSync(resolve("components/portal/timeline-preview-view.tsx"), "utf8");
const fpView = readFileSync(resolve("components/portal/floor-plan-view.tsx"), "utf8");
const planningView = readFileSync(resolve("components/portal/planning-tasks-view.tsx"), "utf8");

describe("Client portal preview fidelity", () => {
  it("preview nav is exactly Planning → Timeline → Floor Plans → Vendors", () => {
    const tabsMatch = preview.match(
      /export const CLIENT_PORTAL_PREVIEW_TABS = \[([\s\S]*?)\] as const/,
    );
    assert.ok(tabsMatch, "CLIENT_PORTAL_PREVIEW_TABS export missing");
    const tabsBlock = tabsMatch[1];
    assert.match(tabsBlock, /\["planning", "Planning"\]/);
    assert.match(tabsBlock, /\["timeline", "Timeline"\]/);
    assert.match(tabsBlock, /\["floor-plans", "Floor Plans"\]/);
    assert.match(tabsBlock, /\["vendors", "Vendors"\]/);
    const order = [
      tabsBlock.indexOf('["planning", "Planning"]'),
      tabsBlock.indexOf('["timeline", "Timeline"]'),
      tabsBlock.indexOf('["floor-plans", "Floor Plans"]'),
      tabsBlock.indexOf('["vendors", "Vendors"]'),
    ];
    assert.ok(order.every((i) => i >= 0), `tab labels missing: ${tabsBlock}`);
    assert.deepEqual(
      [...order].sort((a, b) => a - b),
      order,
      "tab order must be Planning → Timeline → Floor Plans → Vendors",
    );
    assert.equal((tabsBlock.match(/\["/g) ?? []).length, 4, "exactly four preview tabs");
    assert.match(preview, /useState<ClientPortalPreviewTab>\("planning"\)/);
    assert.doesNotMatch(preview, /portal-preview-tab-event-order|portal-preview-tab-inventory/);
    assert.doesNotMatch(preview, /\["event-order", "Event Order"\]|\["inventory", "Inventory"\]/);
    assert.doesNotMatch(preview, /EventOrderPortalView|InventoryPortalView/);
  });

  it("Timeline preview is read-only and does not call mutating timeline sync", () => {
    assert.match(preview, /TimelinePortalPreviewView/);
    assert.match(loader, /timelineRepo\.getTimelineEntries/);
    assert.match(loader, /venueItemVisibleToClient/);
    // Must not use the service helper — it runs schedule sync (mutates).
    assert.doesNotMatch(loader, /@\/lib\/timeline\/service/);
    assert.doesNotMatch(loader, /shareTimelineWithCouple|submitPortalTimeline/);
    assert.match(timelinePreview, /No timeline shared yet/);
    assert.match(timelinePreview, /timeline-portal-preview/);
    assert.doesNotMatch(timelinePreview, /fetch\(|\/api\/portal\/timeline/);
  });

  it("Floor Plans preview only presents shared plans + offers (not unshared operational alone)", () => {
    assert.match(loader, /sharedWithCouple/);
    assert.match(fpView, /Waiting on a layout from your venue|No Floor Plan shared yet/);
    assert.match(fpView, /Choose your layout/);
    assert.match(fpView, /Choose this layout \(preview only\)/);
  });

  it("Planning excludes venue-owned tasks and never selects notes", () => {
    assert.match(loader, /\.eq\("owner_type", "couple"\)/);
    assert.match(loader, /client_visible|client_owned/);
    assert.doesNotMatch(loader, /select\([^)]*notes/);
    assert.match(planningView, /formatEventRelativeDue/);
    assert.match(preview, /Venue\/internal tasks are never shown/);
  });

  it("Vendors use read-only getEventRecommendations (no ensure seed)", () => {
    assert.match(loader, /getEventRecommendations/);
    assert.doesNotMatch(loader, /getOrEnsureEventRecommendations/);
    assert.match(preview, /VendorsPortalPreviewView/);
  });

  it("preview payments link is inert (no couple navigation side channel)", () => {
    // Commercial EO removed from preview — paymentsHref must not reappear via EO view.
    assert.doesNotMatch(preview, /paymentsHref/);
  });

  it("preview locks light tokens so dark staff theme cannot wash out cream surfaces", () => {
    assert.match(preview, /data-theme-lock="light"/);
    assert.match(preview, /PUBLIC_FORM_LIGHT_VARS/);
    assert.match(preview, /natural-cream|PUBLIC_FORM_LIGHT_VARS/);
    assert.doesNotMatch(preview, /bg-\[#F7F5F1\]/);
  });

  it("preview loader no longer loads commercial Event Order or Inventory", () => {
    assert.doesNotMatch(loader, /getEventOrder|getEventInventory|event_order_share_snapshots/);
    assert.doesNotMatch(loader, /eventOrder:|inventory:/);
  });
});
