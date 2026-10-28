/**
 * Inventory catalog photos must reach shared client portal inventory —
 * snapshot on event items + portal RPC/API/UI — without exposing unshared catalogs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const mig = readFileSync(
  resolve("supabase/migrations/20261425600000_event_inventory_item_image_url.sql"),
  "utf8",
);
const types = readFileSync(resolve("lib/event-inventory/types.ts"), "utf8");
const repo = readFileSync(resolve("lib/event-inventory/repository.ts"), "utf8");
const portalApi = readFileSync(resolve("app/api/portal/inventory/route.ts"), "utf8");
const portalView = readFileSync(resolve("components/portal/inventory-view.tsx"), "utf8");
const catalog = readFileSync(resolve("lib/event-inventory/template-catalog.ts"), "utf8");

describe("Event inventory client-facing photos", () => {
  it("migration snapshots image_url and extends portal RPC with item_image_url", () => {
    assert.match(mig, /add column if not exists image_url text/);
    assert.match(mig, /item_image_url text/);
    assert.match(mig, /coalesce\(eii\.image_url, ii\.image_url\)/);
    assert.match(mig, /status in \('shared', 'submitted', 'changes_requested', 'confirmed', 'finalized'\)/);
    assert.match(mig, /access_level in \('couple', 'planner'\)/);
    assert.match(mig, /cps\.venue_id/);
  });

  it("event inventory domain carries imageUrl and resolves catalog on insert/apply", () => {
    assert.match(types, /imageUrl: string \| null/);
    assert.match(repo, /resolveCatalogImageUrl/);
    assert.match(repo, /image_url: imageUrl/);
    assert.match(repo, /image_url: t\.inventoryItemId \? \(imageByCatalogId/);
    assert.match(catalog, /imageUrl: catalogItem\.imageUrl/);
  });

  it("portal API maps item_image_url and UI renders only when present", () => {
    assert.match(portalApi, /item_image_url/);
    assert.match(portalApi, /imageUrl:/);
    assert.match(portalView, /imageUrl\?:/);
    assert.match(portalView, /data-testid="inventory-item-photo"/);
    assert.match(portalView, /function ItemPhoto/);
    assert.match(portalView, /if \(!src\) return null/);
  });

  it("missing photos stay clean — no broken placeholder markup", () => {
    assert.doesNotMatch(portalView, /placeholder\.png|broken.?image|No photo/i);
    assert.match(portalView, /alt=\{alt\}/);
  });
});
