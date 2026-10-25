import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  categoryMatchesSection,
  dependentGroupsForOption,
  filterOfferingsForSectionPicker,
  groupsForSection,
  sectionCompletenessIssues,
} from "@/lib/event-order-templates/section-workspace";
import type {
  EventOrderTemplateGroup,
  EventOrderTemplateOption,
} from "@/lib/event-order-templates/types";
import type { OfferingWithCategory } from "@/lib/offerings/types";

function group(
  partial: Partial<EventOrderTemplateGroup> & Pick<EventOrderTemplateGroup, "id" | "name">,
): EventOrderTemplateGroup {
  return {
    templateId: "t1",
    venueId: "v1",
    sectionId: "sec-catering",
    instructions: null,
    selectionMode: "single",
    minSelect: 1,
    maxSelect: 1,
    allowQuantity: false,
    sortOrder: 0,
    dependsOnOptionIds: [],
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

function option(
  partial: Partial<EventOrderTemplateOption> & Pick<EventOrderTemplateOption, "id" | "groupId" | "label">,
): EventOrderTemplateOption {
  return {
    templateId: "t1",
    venueId: "v1",
    offeringId: null,
    description: null,
    isIncluded: false,
    unitPrice: null,
    isDefault: false,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

function offering(
  partial: Partial<OfferingWithCategory> & Pick<OfferingWithCategory, "id" | "name">,
): OfferingWithCategory {
  return {
    venueId: "v1",
    categoryId: null,
    categoryName: null,
    description: null,
    unit: null,
    defaultUnitPrice: null,
    inventoryItemId: null,
    isArchived: false,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("categoryMatchesSection — discovery only", () => {
  it("matches exact and alias labels without inventing links", () => {
    assert.equal(categoryMatchesSection("Catering", "Catering"), true);
    assert.equal(categoryMatchesSection("Bar", "Bar Service"), true);
    assert.equal(categoryMatchesSection("Services", "Day-of Services"), true);
    assert.equal(categoryMatchesSection("Rentals", "Catering"), false);
  });
});

describe("section workspace grouping", () => {
  it("scopes groups to a section and nests dependents under parent options", () => {
    const plated = option({ id: "opt-plated", groupId: "g-dinner", label: "Plated Dinner" });
    const buffet = option({ id: "opt-buffet", groupId: "g-dinner", label: "Buffet Dinner" });
    const dinner = group({ id: "g-dinner", name: "Dinner service", sectionId: "sec-catering" });
    const platedDetails = group({
      id: "g-plated",
      name: "Plated dinner details",
      sectionId: "sec-catering",
      dependsOnOptionIds: ["opt-plated"],
    });
    const buffetDetails = group({
      id: "g-buffet",
      name: "Buffet dinner details",
      sectionId: "sec-catering",
      dependsOnOptionIds: ["opt-buffet"],
    });
    const bar = group({ id: "g-bar", name: "Bar package", sectionId: "sec-bar" });

    const catering = groupsForSection([dinner, platedDetails, buffetDetails, bar], "sec-catering");
    assert.equal(catering.length, 3);
    assert.deepEqual(
      dependentGroupsForOption(catering, "opt-plated").map((g) => g.id),
      ["g-plated"],
    );
    assert.deepEqual(
      dependentGroupsForOption(catering, "opt-buffet").map((g) => g.id),
      ["g-buffet"],
    );
    assert.equal(dependentGroupsForOption(catering, "opt-plated").some((g) => g.id === "g-buffet"), false);
    void plated;
    void buffet;
  });

  it("flags empty dependent branches as incomplete", () => {
    const g = group({
      id: "g-plated",
      name: "Plated dinner details",
      dependsOnOptionIds: ["opt-plated"],
    });
    const issues = sectionCompletenessIssues([g], []);
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.kind, "empty-dependent");
    assert.match(issues[0]?.message ?? "", /no follow-up options/i);
  });
});

describe("filterOfferingsForSectionPicker", () => {
  it("prefers category-matched offerings and does not silently dump all categories", () => {
    const items = [
      offering({ id: "1", name: "Chicken Marsala", categoryId: "c1", categoryName: "Catering" }),
      offering({ id: "2", name: "Bartender service", categoryId: "c2", categoryName: "Services" }),
      offering({ id: "3", name: "Chiavari chair", categoryId: "c3", categoryName: "Rentals" }),
    ];
    const preferred = filterOfferingsForSectionPicker(items, "Catering", "preferred");
    assert.equal(preferred.usedFallbackAll, false);
    assert.equal(preferred.preferredEmpty, false);
    assert.deepEqual(preferred.items.map((o) => o.id), ["1"]);

    const none = filterOfferingsForSectionPicker(items, "Photography", "preferred");
    assert.equal(none.usedFallbackAll, false);
    assert.equal(none.preferredEmpty, true);
    assert.equal(none.items.length, 0);

    const all = filterOfferingsForSectionPicker(items, "Catering", "all");
    assert.equal(all.items.length, 3);
  });
});

