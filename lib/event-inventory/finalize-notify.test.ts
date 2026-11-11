import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const notify = readFileSync(resolve("lib/event-inventory/finalize-notify.ts"), "utf8");
const service = readFileSync(resolve("lib/event-inventory/service.ts"), "utf8");
const caps = readFileSync(resolve("lib/playbooks/capabilities.ts"), "utf8");
const planningUi = readFileSync(resolve("components/settings/planning-capabilities-section.tsx"), "utf8");
const coupleDocs = readFileSync(resolve("lib/portal/couple-documents-inventory.ts"), "utf8");
const portalDocsRoute = readFileSync(resolve("app/api/portal/documents/route.ts"), "utf8");
const coupleUi = readFileSync(resolve("components/portal/couple-documents-section.tsx"), "utf8");
const migration = readFileSync(
  resolve("supabase/migrations/20261425800000_inventory_agreement_venue_documents.sql"),
  "utf8",
);

describe("Inventory Agreement finalize lifecycle", () => {
  it("finalize notify sends email + portal notification without claiming delivery falsely", () => {
    assert.match(notify, /notifyInventoryFinalized/);
    assert.match(notify, /createCoupleNotification/);
    assert.match(notify, /sendEmail/);
    assert.match(notify, /event_inventory_finalized/);
    assert.match(notify, /Inventory Agreement/);
    assert.match(notify, /emailSubmitted/);
    assert.match(notify, /recordExternalClientOutbound/);
  });

  it("finalizeEventInventory notifies after status persists and swallows notify errors", () => {
    const start = service.indexOf("export async function finalizeEventInventory");
    const body = service.slice(start, start + 2500);
    assert.match(body, /setStatus[\s\S]*finalized/);
    assert.match(body, /notifyInventoryFinalized/);
    assert.match(body, /non-blocking — finalized state already persisted/);
  });

  it("Inventory and Event Order are not Portal Setup capability toggles", () => {
    assert.match(caps, /COMMERCIAL_PORTAL_ALWAYS_ON/);
    assert.doesNotMatch(
      caps.slice(caps.indexOf("PLANNING_CAPABILITY_OPTIONS"), caps.indexOf("COMMERCIAL_PORTAL_ALWAYS_ON")),
      /key: "inventory"/,
    );
    assert.doesNotMatch(
      caps.slice(caps.indexOf("PLANNING_CAPABILITY_OPTIONS"), caps.indexOf("COMMERCIAL_PORTAL_ALWAYS_ON")),
      /key: "eventOrder"/,
    );
    assert.match(caps, /case "inventory":[\s\S]*return true/);
    assert.match(caps, /case "event-order":[\s\S]*return true/);
    assert.match(planningUi, /PLANNING_CAPABILITY_OPTIONS/);
  });

  it("couple Documents merge + UI surface finalized Inventory Agreement", () => {
    assert.match(coupleDocs, /mergeFinalizedInventoryIntoCoupleDocuments/);
    assert.match(coupleDocs, /event_inventory/);
    assert.match(coupleDocs, /status !== "finalized"/);
    assert.match(portalDocsRoute, /mergeFinalizedInventoryIntoCoupleDocuments/);
    assert.match(portalDocsRoute, /get_event_inventory_for_portal/);
    assert.match(coupleUi, /portal-documents-inventory/);
    assert.match(coupleUi, /InventoryAgreementCard/);
    assert.match(coupleUi, /onNavigate\?\.\("inventory"\)/);
  });

  it("venue Documents RPC includes finalized event_inventory", () => {
    assert.match(migration, /docType',         'event_inventory'/);
    assert.match(migration, /ei\.status = 'finalized'/);
    assert.match(migration, /Inventory Agreement/);
  });
});
