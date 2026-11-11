/**
 * Event Order template builder — top choice → category → items.
 * Regression: choosing Plated Dinner must never offer the sibling Buffet as
 * something "under" it, and venues can add categories + counts + instructions
 * per category without leaving the template.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { itemsEligibleForCategory } from "@/lib/event-order-templates/offering-package-builder";
import { filterOfferingsForAuthoringContext } from "@/lib/offerings/hierarchy";
import type { OfferingWithCategory } from "@/lib/offerings/types";

function off(id: string, name: string, parents: string[] = []): OfferingWithCategory {
  return {
    id,
    name,
    venueId: "v1",
    categoryId: "catering",
    categoryName: "Catering",
    parentOfferingId: parents[0] ?? null,
    parentOfferingIds: parents,
    description: null,
    unit: null,
    defaultUnitPrice: null,
    inventoryItemId: null,
    imageUrl: null,
    isArchived: false,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
  };
}

const plated = off("plated", "Plated Dinner");
const buffet = off("buffet", "Buffet Style Dinner");
const chicken = off("chicken", "Chicken", ["plated"]);
const beef = off("beef", "Beef", ["plated"]);
const fish = off("fish", "Fish", ["plated"]);
const cheesecake = off("cheesecake", "Cheesecake", ["plated", "buffet"]);
const catalog = [plated, buffet, chicken, beef, fish, cheesecake];

const panel = readFileSync(
  join(process.cwd(), "components/event-order-templates/package-choices-panel.tsx"),
  "utf8",
);

describe("three-level template builder", () => {
  it("items under Plated never include Buffet (with or without nested items)", () => {
    const under = filterOfferingsForAuthoringContext(catalog, { kind: "underMajor", parentOfferingId: "plated" });
    assert.deepEqual(under.items.map((o) => o.id).sort(), ["beef", "cheesecake", "chicken", "fish"]);
    const bare = filterOfferingsForAuthoringContext([plated, buffet], { kind: "underMajor", parentOfferingId: "plated" });
    assert.deepEqual(bare.items, []);
  });

  it("category item picker is limited to that category's members when it has any", () => {
    const underPlated = [chicken, beef, fish, cheesecake];
    assert.deepEqual(
      itemsEligibleForCategory(underPlated, { memberOfferingIds: ["chicken", "beef", "fish"] }).map((o) => o.id),
      ["chicken", "beef", "fish"],
    );
    assert.deepEqual(itemsEligibleForCategory(underPlated, { memberOfferingIds: [] }).length, 4);
    assert.deepEqual(itemsEligibleForCategory(underPlated, null).length, 4);
  });

  it("builder labels top choices vs categories and can create a category in place", () => {
    assert.match(panel, /Add another top choice/);
    assert.match(panel, /categories the couple picks from/);
    assert.match(panel, /eo-create-category-/);
    assert.match(
      panel,
      /createOfferingChoiceGroupAction\(parentOfferingId, name\)[\s\S]{0,400}includeCatalogChoiceGroupAction\(/,
    );
  });

  it("each category has its own instructions and count, and its item picker is not section-name filtered", () => {
    assert.match(panel, /eo-child-instructions-/);
    assert.match(panel, /onSaveGroup\(group, \{ instructions \}\)/);
    assert.match(panel, /eo-child-select-count-/);
    assert.match(panel, /sectionName=\{null\}[\s\S]{0,600}kind: "underMajor"/);
    assert.match(panel, /itemsEligibleForCategory\(/);
  });
});
