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

describe("Inventory & Event Order portal discoverability (P2-D Documents-first)", () => {
  it("keeps Inventory and Event Order as mountable sections with capability labels", () => {
    assert.match(shell, /id: "inventory"/);
    assert.match(shell, /id: "event-order"/);
    assert.match(shell, /label: "Inventory"/);
    assert.match(shell, /shortLabel: "Inventory"/);
    assert.match(shell, /label: "Event Order"/);
    assert.doesNotMatch(shell, /shortLabel: "Included"/);
  });

  it("gates nav with P2-D helpers — not permanent share-only Order tabs", () => {
    assert.match(shell, /coupleChoicesNavVisible/);
    assert.match(shell, /coupleInventoryNavVisible/);
    assert.match(shell, /coupleEventOrderNavVisible/);
    assert.match(shell, /item\.id !== "event-order" \|\| showEventOrderNav/);
    assert.match(shell, /item\.id !== "inventory" \|\| showInventoryNav/);
    assert.match(shell, /item\.id !== "choices" \|\| showChoicesNav/);
    // Pre-P2-D permanent "shared ⇒ always show Order tab" gate must stay gone.
    assert.doesNotMatch(
      shell,
      /item\.id !== "event-order" \|\| hasSharedEventOrder/,
    );
  });

  it("home entries stay for active inventory / acceptance; Documents for shared final EO", () => {
    assert.match(shell, /portal-home-inventory-order/);
    assert.match(shell, /portal-home-inventory-entry/);
    assert.match(shell, /portal-home-event-order-entry/);
    assert.match(shell, /portal-home-event-order-docs-entry/);
    assert.match(shell, /Open Inventory/);
    assert.match(shell, /Open Documents/);
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

  it("client views distinguish empty vs shared; EO stays read-only; inventory select is gated", () => {
    assert.match(invView, /inventory-portal-empty/);
    assert.match(invView, /Not shared yet/);
    assert.match(invView, /read-only/);
    assert.match(eoView, /event-order-portal-empty/);
    assert.match(eoView, /Not shared yet/);
    assert.doesNotMatch(eoView, /onSave|contentEditable|type="submit"/);
    assert.match(invView, /inventory-save-draft/);
    assert.match(invView, /inventory-submit/);
    assert.match(invView, /canEdit/);
  });

  it("inventory and event_order portal sections are always on (not Portal Setup gates)", () => {
    assert.match(caps, /case "inventory"/);
    assert.match(caps, /case "event-order"/);
    assert.match(caps, /COMMERCIAL_PORTAL_ALWAYS_ON/);
    // Portal entry must not depend on planning capability toggles.
    const inventoryCase = caps.slice(caps.indexOf('case "inventory"'), caps.indexOf('case "event-order"'));
    assert.match(inventoryCase, /return true/);
    const eoCase = caps.slice(caps.indexOf('case "event-order"'), caps.indexOf('case "questionnaire"'));
    assert.match(eoCase, /return true/);
  });

  it("deep links still mount sections when nav is hidden", () => {
    assert.match(shell, /activeSection === "inventory"/);
    assert.match(shell, /activeSection === "event-order"/);
    assert.match(shell, /activeSection === "choices"/);
    assert.match(shell, /Documents-first|P2-D/);
  });
});
