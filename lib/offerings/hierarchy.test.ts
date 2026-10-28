import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  childOfferings,
  filterOfferingsForAuthoringContext,
  formatParentOfferingNames,
  hasParents,
  majorOfferingIds,
  offeringRole,
  orderOfferingsHierarchically,
  parentIdsOf,
  topLevelOfferings,
} from "@/lib/offerings/hierarchy";
import { defaultGroupInputForPattern, dependentCategoryGroupInput } from "@/lib/event-order-templates/guided-setup";
import { resolveSelectedOptions } from "@/lib/client-choices/apply-to-event-order";
import type { ChoicesDefinition } from "@/lib/client-choices/types";

const migrationParent = readFileSync(
  join(process.cwd(), "supabase/migrations/20261425200000_offerings_parent_hierarchy.sql"),
  "utf8",
);
const migrationLinks = readFileSync(
  join(process.cwd(), "supabase/migrations/20261425700000_offering_major_links.sql"),
  "utf8",
);
const library = readFileSync(
  join(process.cwd(), "components/offerings/offerings-library-section.tsx"),
  "utf8",
);
const choiceGroups = readFileSync(
  join(process.cwd(), "components/event-order-templates/event-order-template-choice-groups.tsx"),
  "utf8",
);
const typesSrc = readFileSync(join(process.cwd(), "lib/offerings/types.ts"), "utf8");
const repoSrc = readFileSync(join(process.cwd(), "lib/offerings/repository.ts"), "utf8");

const catalog = [
  { id: "buffet", name: "Buffet-style dinner", categoryId: "cat", parentOfferingId: null },
  { id: "plated", name: "Plated Dinner", categoryId: "cat", parentOfferingId: null },
  { id: "chicken", name: "Chicken", categoryId: "cat", parentOfferingId: "buffet" },
  { id: "salad", name: "Salad", categoryId: "cat", parentOfferingId: "plated" },
  { id: "bar-pkg", name: "Premium open bar", categoryId: "bar", parentOfferingId: null },
];

const multiParentCatalog = [
  { id: "buffet", name: "Buffet Dinner", categoryId: "cat", parentOfferingIds: [] as string[] },
  { id: "plated", name: "Plated Dinner", categoryId: "cat", parentOfferingIds: [] as string[] },
  {
    id: "cheesecake",
    name: "Cheesecake",
    categoryId: "cat",
    parentOfferingIds: ["plated", "buffet"],
  },
  {
    id: "chicken",
    name: "Chicken",
    categoryId: "cat",
    parentOfferingIds: ["buffet"],
  },
  {
    id: "salmon",
    name: "Salmon",
    categoryId: "cat",
    parentOfferingIds: ["plated"],
  },
  { id: "standalone", name: "Cake cutting", categoryId: "cat", parentOfferingIds: [] as string[] },
];

describe("Offerings hierarchy helpers", () => {
  it("classifies majors vs items and filters authoring contexts", () => {
    const majors = majorOfferingIds(catalog);
    assert.ok(majors.has("buffet"));
    assert.ok(majors.has("plated"));
    assert.equal(offeringRole(catalog[0]!, majors), "major");
    assert.equal(offeringRole(catalog[2]!, majors), "item");
    assert.equal(offeringRole(catalog[4]!, majors), "standalone");
    assert.deepEqual(
      topLevelOfferings(catalog).map((o) => o.id).sort(),
      ["bar-pkg", "buffet", "plated"],
    );
    assert.deepEqual(childOfferings(catalog, "buffet").map((o) => o.id), ["chicken"]);
    const primary = filterOfferingsForAuthoringContext(catalog, { kind: "primary" });
    assert.ok(primary.items.every((o) => !hasParents(o)));
    const under = filterOfferingsForAuthoringContext(catalog, {
      kind: "underMajor",
      parentOfferingId: "buffet",
    });
    assert.equal(under.usedFallback, false);
    assert.deepEqual(under.items.map((o) => o.id), ["chicken"]);
  });

  it("orders children under parents", () => {
    const ordered = orderOfferingsHierarchically(catalog).map((p) => p.offering.id);
    assert.ok(ordered.indexOf("buffet") < ordered.indexOf("chicken"));
    assert.ok(ordered.indexOf("plated") < ordered.indexOf("salad"));
  });
});

describe("Offerings multi-parent associations", () => {
  it("associates one offering with two major choices without duplicating the catalog row", () => {
    const cake = multiParentCatalog.find((o) => o.id === "cheesecake")!;
    assert.deepEqual(parentIdsOf(cake).sort(), ["buffet", "plated"]);
    assert.equal(hasParents(cake), true);
    const underPlated = childOfferings(multiParentCatalog, "plated").map((o) => o.id).sort();
    const underBuffet = childOfferings(multiParentCatalog, "buffet").map((o) => o.id).sort();
    assert.deepEqual(underPlated, ["cheesecake", "salmon"]);
    assert.deepEqual(underBuffet, ["cheesecake", "chicken"]);
    // Still one row in the catalog list
    assert.equal(multiParentCatalog.filter((o) => o.id === "cheesecake").length, 1);
  });

  it("lists multiple offerings under the same major", () => {
    assert.deepEqual(
      childOfferings(multiParentCatalog, "plated").map((o) => o.name).sort(),
      ["Cheesecake", "Salmon"],
    );
  });

  it("removing one of two associations preserves the other (in-memory model)", () => {
    const afterRemoveBuffet = multiParentCatalog.map((o) =>
      o.id === "cheesecake" ? { ...o, parentOfferingIds: ["plated"] } : o,
    );
    assert.deepEqual(parentIdsOf(afterRemoveBuffet.find((o) => o.id === "cheesecake")!), ["plated"]);
    assert.ok(childOfferings(afterRemoveBuffet, "plated").some((o) => o.id === "cheesecake"));
    assert.ok(!childOfferings(afterRemoveBuffet, "buffet").some((o) => o.id === "cheesecake"));
  });

  it("offering with no parent remains valid standalone/major", () => {
    const alone = multiParentCatalog.find((o) => o.id === "standalone")!;
    assert.deepEqual(parentIdsOf(alone), []);
    assert.ok(topLevelOfferings(multiParentCatalog).some((o) => o.id === "standalone"));
    assert.equal(
      offeringRole(alone, majorOfferingIds(multiParentCatalog)),
      "standalone",
    );
  });

  it("orders multi-parent item under every associated major", () => {
    const placements = orderOfferingsHierarchically(multiParentCatalog);
    const cakePlacements = placements.filter((p) => p.offering.id === "cheesecake");
    assert.equal(cakePlacements.length, 2);
    assert.deepEqual(
      cakePlacements.map((p) => p.nestUnderParentId).sort(),
      ["buffet", "plated"],
    );
    // Still one Offering record identity in the source catalog
    assert.equal(multiParentCatalog.filter((o) => o.id === "cheesecake").length, 1);
    const ids = placements.map((p) => p.offering.id);
    const buffetIdx = ids.indexOf("buffet");
    const platedIdx = ids.indexOf("plated");
    const cakeUnderBuffet = placements.findIndex(
      (p) => p.offering.id === "cheesecake" && p.nestUnderParentId === "buffet",
    );
    const cakeUnderPlated = placements.findIndex(
      (p) => p.offering.id === "cheesecake" && p.nestUnderParentId === "plated",
    );
    assert.ok(buffetIdx < cakeUnderBuffet && cakeUnderBuffet < platedIdx);
    assert.ok(platedIdx < cakeUnderPlated);
  });

  it("Whiskey-style dual bar parents place the item under both majors", () => {
    const catalog = [
      { id: "guest", name: "Guest Paid Bar Offering", categoryId: "bar", parentOfferingIds: [] as string[] },
      { id: "premium", name: "Premium open bar", categoryId: "bar", parentOfferingIds: [] as string[] },
      {
        id: "whiskey",
        name: "Whiskey",
        categoryId: "bar",
        parentOfferingIds: ["guest", "premium"],
      },
    ];
    const placements = orderOfferingsHierarchically(catalog);
    const whiskey = placements.filter((p) => p.offering.id === "whiskey");
    assert.equal(whiskey.length, 2);
    assert.ok(whiskey.some((p) => p.nestUnderParentId === "guest"));
    assert.ok(whiskey.some((p) => p.nestUnderParentId === "premium"));
  });

  it("formats multiple parent names for display", () => {
    assert.equal(formatParentOfferingNames(["Plated Dinner", "Buffet Dinner"]), "Plated Dinner, Buffet Dinner");
    assert.equal(formatParentOfferingNames([]), null);
  });

  it("authoring under Plated does not surface Buffet-only items", () => {
    const under = filterOfferingsForAuthoringContext(multiParentCatalog, {
      kind: "underMajor",
      parentOfferingId: "plated",
    });
    const ids = under.items.map((o) => o.id);
    assert.ok(ids.includes("cheesecake"));
    assert.ok(ids.includes("salmon"));
    assert.ok(!ids.includes("chicken"));
  });

  it("shared catalog offering on two options only charges when the active path is selected", () => {
    const definition: ChoicesDefinition = {
      sections: [],
      groups: [
        {
          id: "g-dinner",
          name: "Dinner style",
          sectionId: null,
          instructions: null,
          selectionMode: "single",
          minSelect: 1,
          maxSelect: 1,
          allowQuantity: false,
          sortOrder: 0,
        },
        {
          id: "g-plated-dessert",
          name: "Plated dessert",
          sectionId: null,
          instructions: null,
          selectionMode: "single",
          minSelect: 0,
          maxSelect: 1,
          allowQuantity: false,
          sortOrder: 1,
          dependsOnOptionIds: ["o-plated"],
        },
        {
          id: "g-buffet-dessert",
          name: "Buffet dessert",
          sectionId: null,
          instructions: null,
          selectionMode: "single",
          minSelect: 0,
          maxSelect: 1,
          allowQuantity: false,
          sortOrder: 2,
          dependsOnOptionIds: ["o-buffet"],
        },
      ],
      options: [
        {
          id: "o-plated", groupId: "g-dinner", offeringId: "plated", label: "Plated Dinner",
          description: null, unitPrice: 0, isIncluded: true, sortOrder: 0,
        },
        {
          id: "o-buffet", groupId: "g-dinner", offeringId: "buffet", label: "Buffet Dinner",
          description: null, unitPrice: 0, isIncluded: true, sortOrder: 1,
        },
        {
          id: "o-cake-plated", groupId: "g-plated-dessert", offeringId: "cheesecake", label: "Cheesecake",
          description: null, unitPrice: 8, isIncluded: false, sortOrder: 0,
        },
        {
          id: "o-cake-buffet", groupId: "g-buffet-dessert", offeringId: "cheesecake", label: "Cheesecake",
          description: null, unitPrice: 6, isIncluded: false, sortOrder: 0,
        },
      ],
    };

    const platedOnly = resolveSelectedOptions(definition, {
      "g-dinner": { optionIds: ["o-plated"] },
      "g-plated-dessert": { optionIds: ["o-cake-plated"] },
      "g-buffet-dessert": { optionIds: ["o-cake-buffet"] },
    });
    // Buffet dessert group inactive when Plated selected — cake charged once at plated option price
    assert.equal(platedOnly.length, 2);
    assert.deepEqual(
      platedOnly.map((l) => l.offeringId).sort(),
      ["cheesecake", "plated"],
    );
    const cakeLine = platedOnly.find((l) => l.offeringId === "cheesecake")!;
    assert.equal(cakeLine.unitPrice, 8);
    assert.equal(cakeLine.amount, 8);
    assert.equal(cakeLine.optionId, "o-cake-plated");
  });
});

describe("Offerings hierarchy migration + UI seams", () => {
  it("adds parent_offering_id with one-level validation", () => {
    assert.match(migrationParent, /parent_offering_id/);
    assert.match(migrationParent, /one nesting level/i);
    assert.match(migrationParent, /same category/);
  });

  it("adds offering_major_links with backfill and venue RLS", () => {
    assert.match(migrationLinks, /offering_major_links/);
    assert.match(migrationLinks, /unique \(offering_id, parent_offering_id\)/);
    assert.match(migrationLinks, /insert into public\.offering_major_links/);
    assert.match(migrationLinks, /parent_offering_id is not null/);
    assert.match(migrationLinks, /current_user_venue_id/);
    assert.match(migrationLinks, /on delete cascade/i);
  });

  it("app model uses parentOfferingIds and replaces links on write", () => {
    assert.match(typesSrc, /parentOfferingIds/);
    assert.match(repoSrc, /replaceOfferingMajorLinks/);
    assert.match(repoSrc, /offering_major_links/);
  });

  it("catalog UI exposes multi major association without duplicating dependency model", () => {
    assert.match(library, /Belongs under major choices/);
    assert.match(library, /offerings-parents|offering-parents/);
    assert.match(library, /type="checkbox"/);
    assert.match(library, /Removing a check removes only that association/);
    assert.match(library, /data-nest-under/);
    assert.match(library, /orderOfferingsHierarchically/);
    assert.match(choiceGroups, /Select where this belongs/);
    assert.doesNotMatch(choiceGroups, /Select question or category/);
  });

  it("guided defaults no longer invent Catering choices labels", () => {
    const one = defaultGroupInputForPattern("choose_one", "s1", "Catering");
    assert.equal(one?.name, "Catering");
    assert.doesNotMatch(one?.name ?? "", /choices$/i);
    const dep = dependentCategoryGroupInput(
      "s1",
      { id: "opt", label: "Buffet-style dinner" } as never,
      "Main courses",
      { selectCount: 2, required: true },
    );
    assert.equal(dep.name, "Main courses");
    const depFallback = dependentCategoryGroupInput(
      "s1",
      { id: "opt", label: "Buffet-style dinner" } as never,
      "",
      { selectCount: 1, required: true },
    );
    assert.match(depFallback.name, /menu$/i);
    assert.doesNotMatch(depFallback.name, /choices$/i);
  });
});
