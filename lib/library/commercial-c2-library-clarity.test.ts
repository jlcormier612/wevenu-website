/**
 * C2 — Library clarity contracts: catalogs vs templates; Packages ≠ EO;
 * Use vs Send without implying false share/invoice behavior.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("C2 Library clarity — hub cards", () => {
  const hub = read("app/(app)/library/page.tsx");

  it("keeps Packages distinct from Event Order Templates", () => {
    assert.match(hub, /title="Packages"/);
    assert.match(hub, /Distinct from Event Order Templates/);
    assert.match(hub, /title="Event Order Templates"/);
    assert.match(hub, /Distinct from sales Packages/);
  });

  it("Inventory Templates Use vs Send without invoice claim", () => {
    assert.match(hub, /title="Inventory Templates"/);
    assert.match(hub, /Use applies a draft/);
    assert.match(hub, /Send also shares/);
    assert.match(hub, /Neither creates an invoice/);
  });

  it("Available Inventory is catalog, not an event packing list", () => {
    assert.match(hub, /title="Available Inventory"/);
    assert.match(hub, /not an event packing list/i);
  });

  it("Offerings catalog edits are not client selection or EO apply", () => {
    assert.match(hub, /title="Offerings"/);
    assert.match(hub, /does not send choices to clients/i);
  });

  it("Choices Templates remain absent from the hub", () => {
    assert.doesNotMatch(hub, /title="Choices Templates"/);
    assert.doesNotMatch(hub, /href="\/library\/choices-templates"/);
  });
});

describe("C2 Library clarity — collection pages", () => {
  it("Inventory Templates page distinguishes Use (no share) from Send to client (share)", () => {
    const page = read("app/(app)/library/inventory-templates/page.tsx");
    assert.match(page, /Reusable starting lists for the inventory you typically provide at an event/);
    assert.match(page, /Use<\/strong> applies the list to an event without\s+sharing it/s);
    assert.match(page, /Send to client<\/strong> applies it if needed and\s+shares the event inventory for the couple to review/s);
    assert.doesNotMatch(page, /Event Order handoff/);
    assert.doesNotMatch(page, /parallel payment/);
    assert.doesNotMatch(page, /draft snapshot/);
    const list = read("components/event-inventory/inventory-template-list.tsx");
    assert.doesNotMatch(list, /Event Order handoff/);
    assert.doesNotMatch(list, /parallel payment stack/);
    assert.match(list, /sendInventoryTemplateAction/);
    assert.match(list, /ensureEventInventoryAction/);
    assert.match(list, /LIBRARY_LABELS\.sendToClient/);
  });

  it("Event Order Templates remain distinct from sales Packages", () => {
    const page = read("app/(app)/library/event-order-templates/page.tsx");
    assert.match(page, /Distinct from sales Packages/i);
    assert.match(page, /Send is only for templates with client choice groups/i);
    assert.match(page, /Neither creates an invoice/i);
  });

  it("Packages page points sales packages away from Event Order authoring", () => {
    const page = read("app/(app)/packages/page.tsx");
    assert.match(page, /Distinct from Event Order Templates/i);
    assert.match(page, /not where you author or send an Event Order/i);
    assert.match(page, /use Event Order Templates/i);
    assert.match(page, /not selected from the Offerings catalog/);
  });

  it("Available Inventory and Offerings remain editable catalogs without Use Template CTAs", () => {
    const inventory = read("app/(app)/library/inventory/page.tsx");
    assert.match(inventory, /does not share with clients/i);
    assert.doesNotMatch(inventory, /Use Template/);
    assert.match(inventory, /Open Inventory Templates/);
    const offerings = read("components/offerings/offerings-page-client.tsx");
    assert.match(offerings, /do not request client selections/i);
    assert.doesNotMatch(offerings, /Use Template/);
    assert.match(offerings, /Open Event Order Templates/);
  });

  it("Choices Templates route remains a redirect to Event Order Templates", () => {
    const page = read("app/(app)/library/choices-templates/page.tsx");
    assert.match(page, /redirect\("\/library\/event-order-templates"\)/);
  });
});
