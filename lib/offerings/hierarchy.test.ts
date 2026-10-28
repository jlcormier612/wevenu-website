import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  childOfferings,
  filterOfferingsForAuthoringContext,
  majorOfferingIds,
  offeringRole,
  orderOfferingsHierarchically,
  topLevelOfferings,
} from "@/lib/offerings/hierarchy";
import { defaultGroupInputForPattern, dependentCategoryGroupInput } from "@/lib/event-order-templates/guided-setup";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261425200000_offerings_parent_hierarchy.sql"),
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

const catalog = [
  { id: "buffet", name: "Buffet-style dinner", categoryId: "cat", parentOfferingId: null },
  { id: "plated", name: "Plated Dinner", categoryId: "cat", parentOfferingId: null },
  { id: "chicken", name: "Chicken", categoryId: "cat", parentOfferingId: "buffet" },
  { id: "salad", name: "Salad", categoryId: "cat", parentOfferingId: "plated" },
  { id: "bar-pkg", name: "Premium open bar", categoryId: "bar", parentOfferingId: null },
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
    assert.ok(primary.items.every((o) => !o.parentOfferingId));
    const under = filterOfferingsForAuthoringContext(catalog, {
      kind: "underMajor",
      parentOfferingId: "buffet",
    });
    assert.equal(under.usedFallback, false);
    assert.deepEqual(under.items.map((o) => o.id), ["chicken"]);
  });

  it("orders children under parents", () => {
    const ordered = orderOfferingsHierarchically(catalog).map((o) => o.id);
    assert.ok(ordered.indexOf("buffet") < ordered.indexOf("chicken"));
    assert.ok(ordered.indexOf("plated") < ordered.indexOf("salad"));
  });
});

describe("Offerings hierarchy migration + UI seams", () => {
  it("adds parent_offering_id with one-level validation", () => {
    assert.match(migration, /parent_offering_id/);
    assert.match(migration, /one nesting level/i);
    assert.match(migration, /same category/);
  });

  it("catalog UI exposes major/item structure without duplicating dependency model", () => {
    assert.match(library, /Belongs under major choice/);
    assert.match(library, /Add item under major choice|top-level major choice/);
    assert.match(library, /offerings-library/);
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
