/**
 * Catalog-first Inventory / Choices template helpers.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  eventPriceAfterTemplateCatalogChange,
  snapshotTemplateOfferingForEvent,
  templateAppliedLineProvenance,
} from "@/lib/event-order-templates/offerings";
import type { EventOrderTemplateLine } from "@/lib/event-order-templates/types";
import {
  catalogItemDisplayName,
  customTemplateItemInput,
  isCatalogBackedTemplateItem,
  templateItemInputFromCatalog,
} from "@/lib/event-inventory/template-catalog";
import {
  choicesOptionDraftFromOffering,
  customChoicesOptionDraft,
  isCatalogBackedChoicesOption,
  withChoicesOptionLabel,
} from "@/lib/client-choices-templates/option-catalog";
import type { Offering } from "@/lib/offerings/types";
import type { InventoryItemWithCategory } from "@/lib/inventory/types";

const catalogItem: InventoryItemWithCategory = {
  id: "inv-1",
  venueId: "v1",
  categoryId: "c1",
  name: "Chiavari Chair",
  quantityAvailable: 100,
  width: null,
  length: null,
  height: null,
  shape: null,
  color: null,
  imageUrl: null,
  printableName: null,
  isArchived: false,
  availableForFloorPlans: true,
  createdAt: "",
  updatedAt: "",
  categoryName: "Seating",
};

const offering: Offering = {
  id: "off-1",
  venueId: "v1",
  categoryId: null,
  name: "Premium Open Bar",
  description: "Full bar",
  unit: null,
  defaultUnitPrice: 45,
  inventoryItemId: null,
  isArchived: false,
  sortOrder: 0,
  createdAt: "",
  updatedAt: "",
};

describe("Inventory Template — catalog-backed vs custom", () => {
  it("catalog select persists inventoryItemId and prefills name/category", () => {
    const input = templateItemInputFromCatalog(catalogItem, { quantity: "60" });
    assert.equal(input.inventoryItemId, "inv-1");
    assert.equal(input.name, "Chiavari Chair");
    assert.equal(input.category, "Seating");
    assert.equal(input.quantity, "60");
    assert.equal(isCatalogBackedTemplateItem({ inventoryItemId: input.inventoryItemId }), true);
  });

  it("uses printableName when present", () => {
    assert.equal(
      catalogItemDisplayName({ ...catalogItem, printableName: "Gold Chiavari" }),
      "Gold Chiavari",
    );
  });

  it("custom item persists null inventoryItemId", () => {
    const input = customTemplateItemInput({
      name: "One-off centerpiece",
      category: "Decor",
      quantity: "12",
      unitPrice: "",
      isIncluded: true,
    });
    assert.equal(input.inventoryItemId, null);
    assert.equal(isCatalogBackedTemplateItem({ inventoryItemId: null }), false);
  });

  it("never invents a catalog link from a matching name", () => {
    // Authoring path requires an explicit catalog id — free-text custom stays null.
    const custom = customTemplateItemInput({
      name: "Chiavari Chair",
      category: "Seating",
      quantity: "1",
      unitPrice: "",
      isIncluded: true,
    });
    assert.equal(custom.inventoryItemId, null);
    assert.notEqual(custom.inventoryItemId, catalogItem.id);
  });

  it("apply path copies inventory_item_id from template item (repository contract)", () => {
    const apply = readFileSync(resolve("lib/event-inventory/repository.ts"), "utf8");
    assert.match(apply, /inventory_item_id: t\.inventoryItemId/);
    assert.match(apply, /name: t\.name/);
  });

  it("template editor uses catalog primary / custom secondary actions", () => {
    const ui = readFileSync(resolve("components/event-inventory/inventory-template-detail.tsx"), "utf8");
    assert.match(ui, /Add from Available Inventory/);
    assert.match(ui, /Add custom item/);
    assert.match(ui, /templateItemInputFromCatalog/);
    assert.match(ui, /From catalog/);
    assert.match(ui, /Custom/);
  });
});

describe("Event Order Template — offering provenance + snapshot", () => {
  function line(overrides: Partial<EventOrderTemplateLine> = {}): EventOrderTemplateLine {
    return {
      id: "l1",
      templateId: "t1",
      venueId: "v1",
      sectionId: "s1",
      description: "Premium Open Bar",
      descriptionDetail: "Full bar",
      quantity: 1,
      unitPrice: 45,
      pricingModel: "flat",
      unit: null,
      includedByDefault: true,
      offeringId: "off-1",
      sortOrder: 0,
      createdAt: "",
      updatedAt: "",
      ...overrides,
    };
  }

  it("catalog-backed line keeps offering_id through event snapshot", () => {
    const snap = snapshotTemplateOfferingForEvent(line());
    assert.equal(snap.offeringId, "off-1");
    assert.equal(snap.provenance, "offering");
    assert.equal(snap.unitPrice, "45");
    assert.equal(templateAppliedLineProvenance("off-1"), "offering");
  });

  it("custom line keeps null offering_id", () => {
    const snap = snapshotTemplateOfferingForEvent(line({ offeringId: null, description: "One-off" }));
    assert.equal(snap.offeringId, null);
    assert.equal(snap.provenance, "custom");
  });

  it("later master offering price change does not mutate existing event snapshot", () => {
    assert.equal(eventPriceAfterTemplateCatalogChange(45, 99), 45);
  });

  it("editor presents Select from Offerings as primary path", () => {
    const ui = readFileSync(resolve("components/event-order-templates/offering-editor-sheet.tsx"), "utf8");
    assert.match(ui, /Select from Offerings/);
    assert.match(ui, /Or add a custom offering/);
    assert.doesNotMatch(ui, /Start from a Library offering \(optional\)/);
  });
});

describe("Choices Template — offering-first + label independence", () => {
  it("selecting offering persists offeringId and prefills label/price", () => {
    const draft = choicesOptionDraftFromOffering(offering);
    assert.equal(draft.offeringId, "off-1");
    assert.equal(draft.label, "Premium Open Bar");
    assert.equal(draft.isIncluded, false);
    assert.equal(draft.unitPrice, 45);
    assert.equal(isCatalogBackedChoicesOption(draft), true);
  });

  it("label can change without clearing offeringId", () => {
    const draft = withChoicesOptionLabel(choicesOptionDraftFromOffering(offering), "Premium Bar");
    assert.equal(draft.label, "Premium Bar");
    assert.equal(draft.offeringId, "off-1");
  });

  it("custom option persists null offeringId", () => {
    const draft = customChoicesOptionDraft("House specialty");
    assert.equal(draft.offeringId, null);
    assert.equal(isCatalogBackedChoicesOption(draft), false);
  });

  it("definition freeze and EO apply carry offeringId (service/apply contracts)", () => {
    const service = readFileSync(resolve("lib/client-choices/service.ts"), "utf8");
    assert.match(service, /offeringId: o\.offeringId/);
    const apply = readFileSync(resolve("lib/client-choices/apply-to-event-order.ts"), "utf8");
    assert.match(apply, /offeringId: opt\.offeringId/);
  });

  it("EO choice-group editor uses Select Offering primary / custom secondary", () => {
    const ui = readFileSync(resolve("components/event-order-templates/event-order-template-choice-groups.tsx"), "utf8");
    assert.match(ui, /Select Offering/);
    assert.match(ui, /Add custom option/);
    assert.doesNotMatch(ui, /Optional: link Offering/);
  });
});

describe("Library guidance — catalog-first copy", () => {
  it("Inventory Templates no longer say checklist is authored separately from catalog", () => {
    const src = readFileSync(resolve("app/(app)/library/inventory-templates/page.tsx"), "utf8");
    assert.match(src, /Built from your Available Inventory catalog/);
    assert.doesNotMatch(src, /Checklist lines \(name, quantity, price\) are authored/);
  });

  it("Event Order Templates guidance emphasizes catalog-first fixed + selectable", () => {
    const eo = readFileSync(resolve("app/(app)/library/event-order-templates/page.tsx"), "utf8");
    assert.match(eo, /Built from your Offerings catalog/);
    assert.match(eo, /select offerings from your catalog first/i);
    const ch = readFileSync(resolve("app/(app)/library/choices-templates/page.tsx"), "utf8");
    assert.match(ch, /redirect\("\/library\/event-order-templates"\)/);
    assert.doesNotMatch(ch, /ChoicesTemplateList/);
  });
});
