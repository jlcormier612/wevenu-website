import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const shell = readFileSync(resolve("components/portal/portal-shell.tsx"), "utf8");
const invApi = readFileSync(resolve("app/api/portal/inventory/route.ts"), "utf8");
const eoApi = readFileSync(resolve("app/api/portal/event-order/route.ts"), "utf8");
const invView = readFileSync(resolve("components/portal/inventory-view.tsx"), "utf8");
const eoView = readFileSync(resolve("components/portal/event-order-view.tsx"), "utf8");
const caps = readFileSync(resolve("lib/playbooks/capabilities.ts"), "utf8");
const eoShare = readFileSync(resolve("lib/event-orders/representation.ts"), "utf8");
const invService = readFileSync(resolve("lib/event-inventory/service.ts"), "utf8");
const eoPortalRpc = readFileSync(
  resolve("supabase/migrations/20261361000000_offerings_and_event_order_model.sql"),
  "utf8",
);
const invPortalRpc = readFileSync(
  resolve("supabase/migrations/20261248000000_event_inventory_foundation.sql"),
  "utf8",
);

describe("Inventory & Event Order portal discoverability", () => {
  it("lists Inventory and Event Order in venue nav without requiring prior share", () => {
    assert.match(shell, /id: "inventory"/);
    assert.match(shell, /id: "event-order"/);
    assert.match(shell, /label: "Inventory"/);
    assert.match(shell, /label: "Event Order"/);
    // Previous gap: Event Order nav was gated on hasSharedEventOrder — must not return.
    assert.doesNotMatch(
      shell,
      /item\.id !== "event-order" \|\| hasSharedEventOrder/,
    );
  });

  it("exposes Home Working-with-venue entry points for Inventory and Event Order", () => {
    assert.match(shell, /portal-home-inventory-order/);
    assert.match(shell, /portal-home-inventory-entry/);
    assert.match(shell, /portal-home-event-order-entry/);
    assert.match(shell, /Open Inventory/);
    assert.match(shell, /Open Event Order/);
  });

  it("keeps server sharing boundaries for portal reads", () => {
    assert.match(invApi, /get_event_inventory_for_portal/);
    assert.match(eoApi, /get_event_order_for_portal/);
    assert.match(invPortalRpc, /ei\.status in \('shared', 'finalized'\)/);
    assert.match(eoPortalRpc, /eo\.shared_at is not null/);
    assert.match(eoShare, /insertShareSnapshot/);
    assert.match(eoShare, /setSharedAt/);
    assert.match(invService, /shareEventInventory/);
    assert.match(invService, /"shared"/);
  });

  it("client views are read-only and distinguish empty vs shared", () => {
    assert.match(invView, /inventory-portal-empty/);
    assert.match(invView, /Not shared yet/);
    assert.match(invView, /read-only/);
    assert.match(eoView, /event-order-portal-empty/);
    assert.match(eoView, /Not shared yet/);
    assert.doesNotMatch(invView, /onSave|contentEditable|type="submit"/);
    assert.doesNotMatch(eoView, /onSave|contentEditable|type="submit"/);
  });

  it("planning capabilities still gate inventory and event_order sections", () => {
    assert.match(caps, /case "inventory"/);
    assert.match(caps, /case "event-order"/);
    assert.match(caps, /return caps\.inventory/);
    assert.match(caps, /return caps\.eventOrder/);
  });
});
