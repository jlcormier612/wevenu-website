/**
 * Staff Client Portal Preview must reuse couple-facing presentation and
 * portal visibility rules — never a parallel mockup or mutating ensure path.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const preview = readFileSync(resolve("components/events/client-portal-preview.tsx"), "utf8");
const loader = readFileSync(resolve("lib/client-portal-preview/load-preview.ts"), "utf8");
const eoSection = readFileSync(resolve("components/portal/event-order-section.tsx"), "utf8");
const eoView = readFileSync(resolve("components/portal/event-order-view.tsx"), "utf8");
const invSection = readFileSync(resolve("components/portal/inventory-section.tsx"), "utf8");
const invView = readFileSync(resolve("components/portal/inventory-view.tsx"), "utf8");
const fpView = readFileSync(resolve("components/portal/floor-plan-view.tsx"), "utf8");
const planningView = readFileSync(resolve("components/portal/planning-tasks-view.tsx"), "utf8");

describe("Client portal preview fidelity", () => {
  it("Event Order portal section and preview share EventOrderPortalView", () => {
    assert.match(eoSection, /EventOrderPortalView/);
    assert.match(preview, /EventOrderPortalView/);
    assert.match(eoView, /Not shared yet/);
    assert.match(eoView, /What you&apos;re receiving/);
    assert.match(eoView, /eventOrderPortalLineMoneyLabel/);
    assert.match(eoView, /eventOrderPortalAdditionalReferenceTotal/);
    assert.match(eoView, /Additional total \(for reference\)/);
    assert.doesNotMatch(eoView, /Delivery subtotal \(for reference\)/);
  });

  it("Inventory portal section and preview share InventoryPortalView", () => {
    assert.match(invSection, /InventoryPortalView/);
    assert.match(preview, /InventoryPortalView/);
    assert.match(invView, /Not shared yet/);
    assert.match(invView, /has not shared this event&apos;s inventory yet/);
    assert.match(invView, /Included — no extra charge/);
    assert.match(invView, /Additional fee/);
    assert.match(invView, /package-included items and available add-ons/);
    assert.match(invView, /collaborationMode/);
    assert.doesNotMatch(invView, /What.?s included in your event/);
    assert.doesNotMatch(invView, /what your venue is including for this celebration/);
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
    assert.match(preview, /paymentsHref=\{null\}/);
  });

  it("preview locks light tokens so dark staff theme cannot wash out cream surfaces", () => {
    assert.match(preview, /data-theme-lock="light"/);
    assert.match(preview, /PUBLIC_FORM_LIGHT_VARS/);
    assert.match(preview, /natural-cream|PUBLIC_FORM_LIGHT_VARS/);
    assert.doesNotMatch(preview, /bg-\[#F7F5F1\]/);
  });
});
