/**
 * C6 — Setup / readiness cleanup contracts.
 * Remove misleading Send/invoice CTAs from Setup; keep Included readiness + profile refs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("C6 Setup no longer shows Send-as-EO or invoice create", () => {
  it("Overview Setup panel has Open deep links without Send/Share/Create Invoice CTAs", () => {
    const panel = read("components/events/event-setup-panel.tsx");
    assert.match(panel, /Open Inventory/);
    assert.match(panel, /Open Event Order/);
    assert.match(panel, /data-testid=\{`event-setup-open-\$\{step\}`\}/);
    assert.match(panel, /Release to client portal/);
    // No authoritative commercial send/share/invoice actions on the setup panel.
    assert.doesNotMatch(panel, /Send to [Cc]lient/);
    assert.doesNotMatch(panel, /Send Event Order/);
    assert.doesNotMatch(panel, /Share with Client/);
    assert.doesNotMatch(panel, /Create Invoice/);
    assert.doesNotMatch(panel, /shareEventOrderWithClient/);
    assert.doesNotMatch(panel, /createInvoiceFromEventOrderAction/);
    assert.doesNotMatch(panel, /sendClientChoices/);
    // Release explicitly is not Inventory/EO share or invoicing.
    assert.match(panel, /share Inventory or the Event Order/);
    assert.match(panel, /create invoices/);
    assert.match(panel, /event Inventory and Event Order tabs/);
  });

  it("Release success copy does not claim EO/Inventory share or invoice creation", () => {
    const prepare = read("lib/event-setup/prepare-release.ts");
    assert.match(prepare, /Does NOT invite, send questionnaires/);
    assert.match(prepare, /share inventory\/Event Order/);
    assert.match(prepare, /Inventory and Event Order stay unshared drafts/);
    assert.match(prepare, /did not send an invitation or create an invoice/);
  });

  it("Inventory and Event Order setup editors remain draft-only (no Send-as-EO)", () => {
    const inv = read("components/events/event-inventory-setup-editor.tsx");
    const eo = read("components/events/event-order-setup-editor.tsx");
    assert.doesNotMatch(inv, /shareEventInventoryAction/);
    assert.doesNotMatch(inv, /Send to [Cc]lient/);
    assert.doesNotMatch(inv, /createInvoice/);
    assert.doesNotMatch(eo, /shareEventOrderWithClient/);
    assert.doesNotMatch(eo, /finalizeEventOrderAction/);
    assert.doesNotMatch(eo, /createInvoiceFromEventOrderAction/);
    assert.doesNotMatch(eo, /Send to [Cc]lient/);
    assert.match(eo, /Sharing, finalization, and invoices stay in the Event Order workspace/);
  });

  it("Setup Profiles retain starting template refs without Send/invoice actions", () => {
    const section = read("components/settings/setup-profiles-section.tsx");
    assert.match(section, /Starting inventory template/);
    assert.match(section, /Starting Event Order template/);
    assert.match(section, /does not create invoices/);
    assert.match(section, /not an invoice/);
    assert.doesNotMatch(section, /Send to [Cc]lient/);
    assert.doesNotMatch(section, /Create Invoice/);
    assert.doesNotMatch(section, /Share with Client/);
    assert.doesNotMatch(section, /Send Event Order/);
  });

  it("readiness rows keep Inventory/EO Included deep links (not deleted)", () => {
    const detail = read("lib/event-setup/readiness-detail.ts");
    assert.match(detail, /nextAction: "Open Inventory"/);
    assert.match(detail, /nextAction: "Open Event Order"/);
    assert.match(detail, /not from this checklist/);
    assert.match(detail, /Not an invoice/);
    assert.doesNotMatch(detail, /nextAction: "Send/);
    assert.doesNotMatch(detail, /nextAction: "Create Invoice"/);
    assert.doesNotMatch(detail, /nextAction: "Share with Client"/);
  });
});
