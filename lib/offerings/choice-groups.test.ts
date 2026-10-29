import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  catalogGroupsAvailableToInclude,
  eligibleChildrenNotInGroup,
  groupsForParent,
  memberOfferingsForGroup,
  orderCatalogListWithChoiceGroups,
  sanitizeChoiceGroupName,
  type OfferingChoiceGroup,
} from "@/lib/offerings/choice-groups";
import type { OfferingWithCategory } from "@/lib/offerings/types";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261426000000_offering_choice_groups.sql"),
  "utf8",
);

function offering(
  partial: Partial<OfferingWithCategory> & Pick<OfferingWithCategory, "id" | "name">,
): OfferingWithCategory {
  return {
    venueId: "v1",
    categoryId: null,
    parentOfferingId: partial.parentOfferingId ?? null,
    parentOfferingIds: partial.parentOfferingIds ?? [],
    description: null,
    unit: null,
    defaultUnitPrice: null,
    inventoryItemId: null,
    imageUrl: null,
    isArchived: false,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    categoryName: null,
    ...partial,
  };
}

function group(
  partial: Partial<OfferingChoiceGroup> & Pick<OfferingChoiceGroup, "id" | "name" | "parentOfferingId">,
): OfferingChoiceGroup {
  return {
    venueId: "v1",
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    memberOfferingIds: [],
    ...partial,
  };
}

describe("offering choice groups migration", () => {
  it("creates catalog group + membership tables and optional template FK", () => {
    assert.match(migration, /create table if not exists public\.offering_choice_groups/);
    assert.match(migration, /create table if not exists public\.offering_choice_group_members/);
    assert.match(migration, /offering_choice_group_id/);
    assert.match(migration, /validate_offering_choice_group/);
    assert.match(migration, /must belong under the group parent/);
    assert.match(migration, /current_user_venue_id\(\)/);
  });
});

describe("choice group helpers", () => {
  it("lists groups for a parent in sort order", () => {
    const groups = [
      group({ id: "g2", name: "Desserts", parentOfferingId: "p1", sortOrder: 1 }),
      group({ id: "g1", name: "Entrées", parentOfferingId: "p1", sortOrder: 0 }),
      group({ id: "g3", name: "Other", parentOfferingId: "p2", sortOrder: 0 }),
    ];
    assert.deepEqual(
      groupsForParent(groups, "p1").map((g) => g.id),
      ["g1", "g2"],
    );
  });

  it("filters catalog groups already included under a parent option", () => {
    const catalog = [
      group({ id: "g-entree", name: "Entrées", parentOfferingId: "plated" }),
      group({ id: "g-dessert", name: "Desserts", parentOfferingId: "plated" }),
    ];
    const available = catalogGroupsAvailableToInclude(catalog, "plated", "opt-plated", [
      {
        id: "tg1",
        offeringChoiceGroupId: "g-entree",
        dependsOnOptionIds: ["opt-plated"],
      },
    ]);
    assert.deepEqual(
      available.map((g) => g.id),
      ["g-dessert"],
    );
  });

  it("resolves members and eligible children without inventing parents", () => {
    const catalog = [
      offering({
        id: "steak",
        name: "Steak",
        parentOfferingId: "plated",
        parentOfferingIds: ["plated"],
      }),
      offering({
        id: "fish",
        name: "Fish",
        parentOfferingId: "plated",
        parentOfferingIds: ["plated"],
      }),
      offering({
        id: "cake",
        name: "Cake",
        parentOfferingId: "buffet",
        parentOfferingIds: ["buffet"],
      }),
    ];
    const g = group({
      id: "g1",
      name: "Entrées",
      parentOfferingId: "plated",
      memberOfferingIds: ["steak"],
    });
    assert.deepEqual(
      memberOfferingsForGroup(g, catalog).map((o) => o.id),
      ["steak"],
    );
    assert.deepEqual(
      eligibleChildrenNotInGroup(catalog, "plated", g).map((o) => o.id),
      ["fish"],
    );
  });

  it("sanitizes group names", () => {
    assert.equal(sanitizeChoiceGroupName("  Entrées  "), "Entrées");
    assert.equal(sanitizeChoiceGroupName("   "), "");
  });

  it("orders catalog list as major → choice group → members → ungrouped children", () => {
    const catalog = [
      offering({ id: "plated", name: "Plated Dinner" }),
      offering({
        id: "chicken",
        name: "Chicken Marsala",
        parentOfferingId: "plated",
        parentOfferingIds: ["plated"],
      }),
      offering({
        id: "veg",
        name: "Vegetarian entrée",
        parentOfferingId: "plated",
        parentOfferingIds: ["plated"],
      }),
      offering({
        id: "cake",
        name: "Cheesecake",
        parentOfferingId: "plated",
        parentOfferingIds: ["plated"],
      }),
    ];
    const groups = [
      group({
        id: "g-entree",
        name: "Entrées",
        parentOfferingId: "plated",
        sortOrder: 0,
        memberOfferingIds: ["chicken", "veg"],
      }),
      group({
        id: "g-dessert",
        name: "Desserts",
        parentOfferingId: "plated",
        sortOrder: 1,
        memberOfferingIds: ["cake"],
      }),
    ];
    const rows = orderCatalogListWithChoiceGroups(catalog, groups);
    assert.deepEqual(
      rows.map((r) =>
        r.kind === "choice-group"
          ? `group:${r.group.name}`
          : `offering:${r.offering.name}:${r.nestUnderGroupId ?? "none"}`,
      ),
      [
        "offering:Plated Dinner:none",
        "group:Entrées",
        "offering:Chicken Marsala:g-entree",
        "offering:Vegetarian entrée:g-entree",
        "group:Desserts",
        "offering:Cheesecake:g-dessert",
      ],
    );
  });

  it("keeps ungrouped legacy children visible under the major", () => {
    const catalog = [
      offering({ id: "plated", name: "Plated Dinner" }),
      offering({
        id: "chicken",
        name: "Chicken Marsala",
        parentOfferingId: "plated",
        parentOfferingIds: ["plated"],
      }),
      offering({
        id: "legacy",
        name: "Legacy side",
        parentOfferingId: "plated",
        parentOfferingIds: ["plated"],
      }),
    ];
    const groups = [
      group({
        id: "g-entree",
        name: "Entrées",
        parentOfferingId: "plated",
        memberOfferingIds: ["chicken"],
      }),
    ];
    const rows = orderCatalogListWithChoiceGroups(catalog, groups);
    const legacy = rows.find(
      (r) => r.kind === "offering" && r.offering.id === "legacy",
    );
    assert.ok(legacy && legacy.kind === "offering");
    assert.equal(legacy.nestUnderParentId, "plated");
    assert.equal(legacy.nestUnderGroupId, null);
  });
});

describe("builder catalog include path", () => {
  it("package panel selects catalog groups instead of inventing names", () => {
    const panel = readFileSync(
      join(process.cwd(), "components/event-order-templates/package-choices-panel.tsx"),
      "utf8",
    );
    assert.match(panel, /includeCatalogChoiceGroupAction/);
    assert.match(panel, /Include existing group/);
    assert.doesNotMatch(panel, /New selection group name/);
    assert.doesNotMatch(panel, /eo-new-child-group-name-/);
  });

  it("offerings library exposes choice group editor and list hierarchy for parents", () => {
    const lib = readFileSync(
      join(process.cwd(), "components/offerings/offerings-library-section.tsx"),
      "utf8",
    );
    assert.match(lib, /OfferingChoiceGroupsEditor/);
    assert.match(lib, /orderCatalogListWithChoiceGroups/);
    assert.match(lib, /offering-manage-groups-/);
    assert.match(lib, /offering-choice-group-row-/);
  });
});
