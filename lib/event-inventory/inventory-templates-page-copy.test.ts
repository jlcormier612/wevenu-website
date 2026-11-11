/**
 * Approved Inventory Templates page language — consolidated calm guidance,
 * no “Event Order handoff” / parallel-payment terminology on this surface.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

describe("Inventory Templates page copy", () => {
  const page = read("app/(app)/library/inventory-templates/page.tsx");
  const list = read("components/event-inventory/inventory-template-list.tsx");

  it("uses the approved title and page description", () => {
    assert.match(page, /title="Inventory Templates"/);
    assert.match(
      page,
      /description="Reusable starting lists for the inventory you typically provide at an event\. Apply one to an event, then customize that event’s inventory as needed\."/,
    );
  });

  it("explains Use and Send to client once in calm guidance", () => {
    assert.match(page, /LibraryDependencyNote/);
    assert.match(page, /tone="calm"/);
    assert.match(page, /<strong className="font-medium text-heading">Use<\/strong>/);
    assert.match(page, /<strong className="font-medium text-heading">Send to client<\/strong>/);
    assert.match(page, /applies the list to an event without\s+sharing it/s);
    assert.match(page, /applies it if needed and\s+shares the event inventory for the couple to review/s);
    assert.doesNotMatch(page, /LibraryHowItWorks/);
    assert.doesNotMatch(
      page,
      /description="[^"]*Use applies/,
    );
  });

  it("keeps catalog dependency guidance in the same calm card", () => {
    assert.match(page, /Built from your Available Inventory catalog/);
    assert.match(page, /Manage Available Inventory/);
    assert.equal((page.match(/<LibraryDependencyNote\b/g) ?? []).length, 1);
  });

  it("removes obsolete handoff / payment-stack / draft-snapshot wording from this page surface", () => {
    assert.doesNotMatch(page, /Event Order handoff/);
    assert.doesNotMatch(page, /parallel payment/);
    assert.doesNotMatch(page, /draft snapshot/);
    assert.doesNotMatch(page, /packing lists for a kind of event/);
    assert.doesNotMatch(list, /Event Order handoff/);
    assert.doesNotMatch(list, /parallel payment stack/);
    assert.doesNotMatch(list, /Reusable packing lists\. Use applies/);
  });

  it("preserves Use vs Send workflows and Send to client label", () => {
    assert.match(list, /sendInventoryTemplateAction/);
    assert.match(list, /ensureEventInventoryAction/);
    assert.match(list, /LIBRARY_LABELS\.sendToClient/);
    assert.match(list, /LIBRARY_LABELS\.useTemplate|Use Template/);
  });
});
