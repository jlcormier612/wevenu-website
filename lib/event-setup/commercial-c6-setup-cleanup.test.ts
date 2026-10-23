/**
 * Setup / commercial separation — no Send-as-EO; Inventory/EO out of Setup.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("C6 Setup no longer shows Send-as-EO or invoice create", () => {
  it("Overview Setup panel has no commercial Send/Share/Create Invoice CTAs", () => {
    const panel = read("components/events/event-setup-panel.tsx");
    assert.match(panel, /Release to client portal/);
    assert.doesNotMatch(panel, /Send to [Cc]lient/);
    assert.doesNotMatch(panel, /Send Event Order/);
    assert.doesNotMatch(panel, /Share with Client/);
    assert.doesNotMatch(panel, /Create Invoice/);
    assert.doesNotMatch(panel, /shareEventOrderWithClient/);
    assert.doesNotMatch(panel, /createInvoiceFromEventOrderAction/);
    assert.doesNotMatch(panel, /sendClientChoices/);
    assert.doesNotMatch(panel, /Open Inventory/);
    assert.doesNotMatch(panel, /Open Event Order/);
    assert.match(panel, /event Inventory and Event Order tabs|Inventory and Event Order tabs/);
  });

  it("Release success copy does not create or claim commercial share/invoice", () => {
    const prepare = read("lib/event-setup/prepare-release.ts");
    assert.doesNotMatch(prepare, /ensureEventInventory/);
    assert.doesNotMatch(prepare, /ensureEventOrder/);
    assert.match(prepare, /commercial workflows/);
    assert.match(prepare, /did not send an invitation or create an invoice/);
  });

  it("Inventory and Event Order workspace editors stay draft-only when present", () => {
    const inv = read("components/events/event-inventory-setup-editor.tsx");
    const eo = read("components/events/event-order-setup-editor.tsx");
    assert.doesNotMatch(inv, /shareEventInventoryAction/);
    assert.doesNotMatch(inv, /Send to [Cc]lient/);
    assert.doesNotMatch(inv, /createInvoice/);
    assert.doesNotMatch(eo, /shareEventOrderWithClient/);
    assert.doesNotMatch(eo, /finalizeEventOrderAction/);
    assert.doesNotMatch(eo, /createInvoiceFromEventOrderAction/);
    assert.doesNotMatch(eo, /Send to [Cc]lient/);
  });

  it("Setup Profiles do not configure Inventory/Event Order templates", () => {
    const section = read("components/settings/setup-profiles-section.tsx");
    assert.doesNotMatch(section, /Starting inventory template/);
    assert.doesNotMatch(section, /Starting Event Order template/);
    assert.doesNotMatch(section, /Send to [Cc]lient/);
    assert.doesNotMatch(section, /Create Invoice/);
    assert.doesNotMatch(section, /Share with Client/);
    assert.doesNotMatch(section, /Send Event Order/);
    assert.match(section, /commercial workflows/);
  });

  it("readiness helpers still know Inventory/EO destinations for commercial tabs", () => {
    const detail = read("lib/event-setup/readiness-detail.ts");
    assert.match(detail, /nextAction: "Open Inventory"/);
    assert.match(detail, /nextAction: "Open Event Order"/);
    assert.doesNotMatch(detail, /nextAction: "Send/);
    assert.doesNotMatch(detail, /nextAction: "Create Invoice"/);
    assert.doesNotMatch(detail, /nextAction: "Share with Client"/);
  });
});
