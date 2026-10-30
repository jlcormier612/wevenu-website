/**
 * Offerings catalog page copy — concise description + one HowItWorks block,
 * dependency links retained, no redundant list blurbs or implementation jargon.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

describe("Offerings page copy", () => {
  const page = read("components/offerings/offerings-page-client.tsx");
  const section = read("components/offerings/offerings-library-section.tsx");

  it("uses the approved title and page description", () => {
    assert.match(page, /title="Offerings"/);
    assert.match(
      page,
      /description="Organize the services, packages, and options your venue offers\. Group related items under choices, such as dinner styles or bar packages, so you can reuse them across Event Order Templates\."/,
    );
  });

  it("explains Offerings once in LibraryHowItWorks", () => {
    assert.match(page, /LibraryHowItWorks/);
    assert.match(page, /How Offerings work/);
    assert.match(page, /Maintain your\s+catalog here/s);
    assert.match(
      page,
      /Event Order Templates use these offerings to define what&apos;s included and\s+which choices or additional items clients can select/s,
    );
    assert.equal((page.match(/<LibraryHowItWorks>/g) ?? []).length, 1);
  });

  it("keeps EO Templates and Available Inventory links with unique inventory guidance", () => {
    assert.match(page, /Open Event Order Templates/);
    assert.match(page, /Manage Available Inventory/);
    assert.match(page, /Stock is reserved when the couple approves the Event Order/);
    assert.doesNotMatch(page, /does not reserve stock/);
    assert.match(page, /Distinct from Available Inventory/);
    assert.match(page, /Used by Event Order Templates/);
  });

  it("removes redundant / implementation-centric page language", () => {
    assert.doesNotMatch(page, /without duplicating records/);
    assert.doesNotMatch(page, /included lines/);
    assert.doesNotMatch(page, /follow-ups/);
    assert.doesNotMatch(page, /Client selection and Event Order finalization/);
    assert.doesNotMatch(page, /Catalog edits do not change what a couple must select/);
    assert.doesNotMatch(section, /without duplicating catalog rows/);
    assert.doesNotMatch(section, /What this venue sells, organized by service category/);
    assert.doesNotMatch(section, /Catalog maintenance is separate from/);
  });

  it("preserves New Offering, archive controls, and catalog list seams", () => {
    assert.match(page, /\+ New Offering/);
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
