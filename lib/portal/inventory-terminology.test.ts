/**
 * Couple portal Inventory terminology — tab, empty state, and item-level
 * included vs additional fee labels. Must not imply every item is package-included.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const shell = readFileSync(resolve("components/portal/portal-shell.tsx"), "utf8");
const invView = readFileSync(resolve("components/portal/inventory-view.tsx"), "utf8");
const preview = readFileSync(resolve("components/events/client-portal-preview.tsx"), "utf8");
const tasks = readFileSync(resolve("lib/portal/unified-tasks.ts"), "utf8");
const service = readFileSync(resolve("lib/event-inventory/service.ts"), "utf8");

describe("Client portal Inventory terminology", () => {
  it("nav tab and home entry are Inventory, not Included", () => {
    assert.match(shell, /id: "inventory"[^]*label: "Inventory"/);
    assert.match(shell, /shortLabel: "Inventory"/);
    assert.doesNotMatch(shell, /shortLabel: "Included"/);
    assert.match(shell, /portal-home-inventory-entry/);
    assert.match(shell, /Open Inventory/);
    assert.match(shell, /package items and add-ons/);
    assert.doesNotMatch(shell, /is including for your event/);
  });

  it("empty state stays not-shared and does not claim inventory is package-only", () => {
    assert.match(invView, /inventory-portal-empty/);
    assert.match(invView, /Not shared yet/);
    assert.match(invView, /has not shared this event&apos;s inventory yet/);
    assert.match(invView, /not\s+your Event Order/);
    assert.doesNotMatch(invView, /what your venue is including for this celebration/);
  });

  it("shared view uses neutral Inventory intro and accurate item labels", () => {
    assert.match(invView, /inventory-portal-intro/);
    assert.match(
      invView,
      /View the items your venue has listed for your event, including package-included items and available add-ons/,
    );
    assert.match(invView, /selectMode \? "Your inventory choices" : "Inventory"/);
    assert.doesNotMatch(invView, /What.?s included in your event/);
    assert.match(invView, /Included — no extra charge/);
    assert.match(invView, /inventory-item-included-label/);
    assert.match(invView, /Additional fee —/);
    assert.match(invView, /inventory-item-additional-label/);
    assert.match(invView, /isIncluded/);
  });

  it("staff preview reuses the same InventoryPortalView (no parallel Included branding)", () => {
    assert.match(preview, /InventoryPortalView/);
    assert.match(preview, /\["inventory", "Inventory"\]/);
  });

  it("task CTA and share notice say inventory, not what's included", () => {
    assert.match(tasks, /actionLabel: "Review inventory"/);
    assert.doesNotMatch(tasks, /Review what's included/);
    assert.match(service, /shared your event inventory/);
    assert.doesNotMatch(service, /shared what's included/);
  });
});
