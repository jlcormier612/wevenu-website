import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  alwaysOnOfferingIds,
  choiceSetsForSection,
  coupleChoiceOfferingIds,
  defaultChildGroupName,
  defaultChoiceSetName,
  newChildGroupUnderParentInput,
  newRootChoiceSetInput,
  offeringsAvailableForCoupleChoices,
  optionInputFromOffering,
  optionInputWriteIn,
  packageBuilderPriceLabel,
  parentChoiceView,
} from "@/lib/event-order-templates/offering-package-builder";
import type {
  EventOrderTemplateGroup,
  EventOrderTemplateLine,
  EventOrderTemplateOption,
} from "@/lib/event-order-templates/types";
import type { OfferingWithCategory } from "@/lib/offerings/types";

function offering(
  partial: Partial<OfferingWithCategory> & Pick<OfferingWithCategory, "id" | "name">,
): OfferingWithCategory {
  return {
    venueId: "v",
    categoryId: "cat",
    categoryName: "Catering",
    parentOfferingId: null,
    parentOfferingIds: [],
    description: null,
    unit: "guest",
    defaultUnitPrice: null,
    inventoryItemId: null,
    isArchived: false,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("offering-package-builder", () => {
  it("names choice sets and child groups without question vocabulary", () => {
    assert.equal(defaultChoiceSetName("Catering"), "Catering choices");
    assert.equal(defaultChildGroupName("Buffet Style Dinner"), "Buffet Style Dinner options");
    assert.doesNotMatch(defaultChoiceSetName("Catering"), /question/i);
  });

  it("builds root and child group inputs with depends_on wiring", () => {
    const root = newRootChoiceSetInput("sec-1", "Catering");
    assert.equal(root.sectionId, "sec-1");
    assert.equal(root.selectionMode, "single");
    assert.equal(root.minSelect, 1);
    assert.deepEqual(root.dependsOnOptionIds, []);

    const child = newChildGroupUnderParentInput(
      "sec-1",
      {
        id: "opt-buffet",
        label: "Buffet Style Dinner",
      },
      "Entrées",
      { selectCount: 2, required: true },
    );
    assert.deepEqual(child.dependsOnOptionIds, ["opt-buffet"]);
    assert.equal(child.name, "Entrées");
    assert.equal(child.selectionMode, "multi");
    assert.equal(child.minSelect, 2);
    assert.equal(child.maxSelect, 2);
  });

  it("drafts write-in options without creating catalog offerings", () => {
    const writeIn = optionInputWriteIn("g-spirits", "House specialty cocktail");
    assert.equal(writeIn.offeringId, null);
    assert.equal(writeIn.label, "House specialty cocktail");
    assert.equal(writeIn.isIncluded, true);
  });

  it("drafts options from catalog Offerings with price snapshots", () => {
    const priced = optionInputFromOffering(
      "g1",
      offering({ id: "o1", name: "Arbor", defaultUnitPrice: 250 }),
    );
    assert.equal(priced.offeringId, "o1");
    assert.equal(priced.label, "Arbor");
    assert.equal(priced.isIncluded, false);
    assert.equal(priced.unitPrice, "250");

    const free = optionInputFromOffering(
      "g1",
      offering({ id: "o2", name: "Buffet Style Dinner", defaultUnitPrice: null }),
    );
    assert.equal(free.isIncluded, true);
    assert.equal(free.unitPrice, "0");
  });

  it("keeps always-on and couple-choice offering ids distinct for picker filtering", () => {
    const lines: EventOrderTemplateLine[] = [
      {
        id: "l1",
        templateId: "t",
        venueId: "v",
        sectionId: "sec",
        description: "Caesar",
        descriptionDetail: null,
        quantity: 1,
        unitPrice: 0,
        pricingModel: "flat",
        unit: null,
        includedByDefault: true,
        offeringId: "off-caesar",
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const groups: EventOrderTemplateGroup[] = [
      {
        id: "g1",
        templateId: "t",
        venueId: "v",
        sectionId: "sec",
        name: "Catering choices",
        instructions: null,
        selectionMode: "single",
        minSelect: 1,
        maxSelect: 1,
        allowQuantity: false,
        dependsOnOptionIds: [],
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const options: EventOrderTemplateOption[] = [
      {
        id: "opt1",
        templateId: "t",
        venueId: "v",
        groupId: "g1",
        offeringId: "off-buffet",
        label: "Buffet",
        description: null,
        isIncluded: true,
        unitPrice: 0,
        isDefault: false,
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
      },
    ];

    assert.ok(alwaysOnOfferingIds(lines, "sec").has("off-caesar"));
    assert.ok(coupleChoiceOfferingIds(groups, options, "sec").has("off-buffet"));

    const catalog = [
      offering({ id: "off-caesar", name: "Caesar salad" }),
      offering({ id: "off-buffet", name: "Buffet Style Dinner" }),
      offering({ id: "off-plated", name: "Plated Dinner" }),
      offering({
        id: "off-ziti",
        name: "Baked Ziti",
        parentOfferingIds: ["off-buffet"],
        parentOfferingId: "off-buffet",
      }),
    ];
    const available = offeringsAvailableForCoupleChoices(
      catalog,
      { lines, groups, options },
      "sec",
    );
    assert.deepEqual(
      available.map((o) => o.id).sort(),
      ["off-plated"],
    );
  });

  it("exposes parent/child views for couple choice UI without duplicating catalog rows", () => {
    const catalog = [
      offering({ id: "buffet", name: "Buffet Style Dinner" }),
      offering({ id: "plated", name: "Plated Dinner" }),
      offering({
        id: "ziti",
        name: "Baked Ziti",
        parentOfferingIds: ["buffet"],
        parentOfferingId: "buffet",
      }),
      offering({
        id: "marsala",
        name: "Chicken Marsala",
        parentOfferingIds: ["plated", "buffet"],
        parentOfferingId: "plated",
      }),
    ];
    const groups: EventOrderTemplateGroup[] = [
      {
        id: "root",
        templateId: "t",
        venueId: "v",
        sectionId: "sec",
        name: "Catering choices",
        instructions: "Choose Buffet or Plated",
        selectionMode: "single",
        minSelect: 1,
        maxSelect: 1,
        allowQuantity: false,
        dependsOnOptionIds: [],
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "dep",
        templateId: "t",
        venueId: "v",
        sectionId: "sec",
        name: "Buffet options",
        instructions: null,
        selectionMode: "multi",
        minSelect: 2,
        maxSelect: 2,
        allowQuantity: false,
        dependsOnOptionIds: ["opt-buffet"],
        sortOrder: 1,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const options: EventOrderTemplateOption[] = [
      {
        id: "opt-buffet",
        templateId: "t",
        venueId: "v",
        groupId: "root",
        offeringId: "buffet",
        label: "Buffet Style Dinner",
        description: null,
        isIncluded: true,
        unitPrice: 0,
        isDefault: false,
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "opt-ziti",
        templateId: "t",
        venueId: "v",
        groupId: "dep",
        offeringId: "ziti",
        label: "Baked Ziti",
        description: null,
        isIncluded: true,
        unitPrice: 0,
        isDefault: false,
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
      },
    ];

    const sets = choiceSetsForSection({ groups, options }, "sec");
    assert.equal(sets.length, 1);
    assert.equal(sets[0]!.options.length, 1);

    const view = parentChoiceView(options[0]!, catalog, groups, options);
    assert.equal(view.role, "major");
    assert.equal(view.catalogChildren.length, 2);
    assert.ok(view.selectedChildOfferingIds.has("ziti"));
    assert.equal(view.selectedChildOfferingIds.has("marsala"), false);
    assert.equal(view.dependentGroups.length, 1);
  });

  it("price labels do not imply free merely because an item is on the package", () => {
    assert.equal(packageBuilderPriceLabel(250, false), "$250");
    assert.equal(packageBuilderPriceLabel(null, true), "No extra charge");
    assert.equal(packageBuilderPriceLabel(null, false), "No price set");
  });
});
