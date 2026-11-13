/**
 * C2 — Library clarity: three commercial heroes; Packages ≠ EO plans;
 * starting lists apply on event (share from event workspace).
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

  it("keeps Packages & Pricing distinct from Event Order plans", () => {
    assert.match(hub, /Packages & Pricing/);
    assert.match(hub, /Event Order plans/);
    assert.match(hub, /Choices catalog/);
  });

  it("presents Available Inventory with saved starting lists secondary", () => {
    assert.match(hub, /Available Inventory/);
    assert.match(hub, /Saved starting lists/);
  });

  it("does not peer Offerings or Inventory Templates as commercial heroes", () => {
    assert.doesNotMatch(hub, /title="Offerings"/);
    assert.doesNotMatch(hub, /title="Inventory Templates"/);
    assert.doesNotMatch(hub, /title="Event Order Templates"/);
  });

  it("Choices Templates remain absent from the hub", () => {
    assert.doesNotMatch(hub, /title="Choices Templates"/);
    assert.doesNotMatch(hub, /href="\/library\/choices-templates"/);
  });
});

describe("C2 Library clarity — collection pages", () => {
  it("Saved starting lists emphasize Use on event; share from the event", () => {
    const page = read("app/(app)/library/inventory-templates/page.tsx");
    assert.match(page, /Saved starting lists/);
    assert.match(page, /LibraryDependencyNote[\s\S]*tone="calm"/);
    assert.match(page, /Use on event<\/strong>/);
    assert.match(page, /Share quantities with the couple from the event workspace/);
    assert.doesNotMatch(page, /Send to client/);
    const list = read("components/event-inventory/inventory-template-list.tsx");
    assert.doesNotMatch(list, /id: "send"/);
    assert.match(list, /ensureEventInventoryAction/);
  });

  it("Event Order plans remain distinct from sales Packages", () => {
    const page = read("app/(app)/library/event-order-templates/page.tsx");
    assert.match(page, /Distinct from sales Packages/i);
    assert.match(page, /Send is only for\s+plans with client choice groups/i);
    assert.match(page, /neither creates an invoice/i);
  });

  it("Packages page points sales packages away from Event Order authoring", () => {
    const page = read("app/(app)/packages/page.tsx");
    assert.match(page, /Packages & Pricing/);
    assert.match(page, /not Event Order choices/i);
    assert.match(page, /Event Order plans/);
    assert.match(page, /not selected from the choices catalog/);
  });

  it("Available Inventory and choices catalog remain editable without Use Template CTAs", () => {
    const inventory = read("app/(app)/library/inventory/page.tsx");
    assert.match(inventory, /does not share with clients/i);
    assert.doesNotMatch(inventory, /Use Template/);
    assert.match(inventory, /Saved starting lists/);
    const offerings = read("components/offerings/offerings-page-client.tsx");
    assert.match(offerings, /Choices catalog/);
    assert.match(offerings, /power Event Order plans/);
    assert.doesNotMatch(offerings, /Use Template/);
    assert.match(offerings, /Open Event Order plans/);
  });

  it("Choices Templates route remains a redirect to Event Order templates", () => {
    const page = read("app/(app)/library/choices-templates/page.tsx");
    assert.match(page, /redirect\("\/library\/event-order-templates"\)/);
  });
});
