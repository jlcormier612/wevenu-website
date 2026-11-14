/**
 * Choices catalog (Offerings) page copy — powers Event Order plans.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

describe("Offerings / choices catalog page copy", () => {
  const page = read("components/offerings/offerings-page-client.tsx");
  const section = read("components/offerings/offerings-library-section.tsx");

  it("uses Offerings Catalog title and Event Order Template framing", () => {
    assert.match(page, /title="Offerings Catalog"/);
    assert.match(page, /does not send choices to clients/i);
  });

  it("explains the catalog once in a calm guidance card", () => {
    assert.match(page, /LibraryDependencyNote/);
    assert.match(page, /How Offerings Catalog works/);
    assert.equal((page.match(/<LibraryDependencyNote\b/g) ?? []).length, 1);
    assert.match(page, /LibraryDependencyNote[\s\S]*tone="calm"/);
    assert.doesNotMatch(page, /LibraryHowItWorks/);
  });

  it("keeps Event Order Templates and Available Inventory links", () => {
    assert.match(page, /Open Event Order Templates/);
    assert.match(page, /Manage Available Inventory/);
    assert.match(page, /Distinct from Available Inventory/);
  });

  it("preserves create CTA and catalog list seams", () => {
    assert.match(page, /\+ New choice/);
    assert.match(section, /Show archived|Hide archived/);
    assert.match(section, /data-testid="offerings-library"/);
    assert.match(section, /data-testid="offerings-list"/);
    assert.doesNotMatch(page, /Use Template/);
  });
});

describe("Offerings → Event Order snapshot evidence (supporting claim)", () => {
  it("apply snapshots offerings; later catalog price change does not rewrite event lines", () => {
    const integration = read("lib/library/template-catalog-integration.test.ts");
    assert.match(integration, /later master offering price change does not mutate existing event snapshot/);
    assert.match(integration, /eventPriceAfterTemplateCatalogChange\(45, 99\), 45/);
    const eoTypes = read("lib/event-order-templates/types.ts");
    assert.match(eoTypes, /Applying \/ Use \/ Send freezes snapshots into the event-specific Event Order/);
  });
});
