/**
 * Explicit Offering attach / template-only semantics — Increment 2.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  attachOfferingPreservingSnapshot,
  clearOfferingLinkPreservingSnapshot,
  choicesOptionDraftFromOffering,
  isCatalogBackedChoicesOption,
  optionCatalogLinkStatus,
  offeringsAvailableForAttach,
  updateOptionFieldsPreservingOfferingLink,
} from "@/lib/client-choices-templates/option-catalog";
import { selectionDefinitionFromEventOrderTemplate } from "@/lib/event-order-templates/selection-definition";
import type { EventOrderTemplateOption, EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";
import type { Offering } from "@/lib/offerings/types";

const ts = "2026-01-01T00:00:00Z";

function offering(partial: Partial<Offering> & Pick<Offering, "id" | "name">): Offering {
  return {
    venueId: "venue-a",
    categoryId: null,
    description: null,
    unit: null,
    defaultUnitPrice: 12,
    inventoryItemId: null,
    isArchived: false,
    sortOrder: 0,
    createdAt: ts,
    updatedAt: ts,
    ...partial,
  };
}

function option(
  partial: Partial<EventOrderTemplateOption> & Pick<EventOrderTemplateOption, "id" | "label">,
): EventOrderTemplateOption {
  return {
    templateId: "tmpl-1",
    venueId: "venue-a",
    groupId: "g1",
    offeringId: null,
    description: null,
    isIncluded: false,
    unitPrice: 25,
    isDefault: false,
    sortOrder: 0,
    createdAt: ts,
    updatedAt: ts,
    ...partial,
  };
}

describe("optionCatalogLinkStatus", () => {
  it("marks template-only when offering_id is null", () => {
    const status = optionCatalogLinkStatus(option({ id: "o1", label: "Plated Dinner" }), null);
    assert.equal(status.kind, "template-only");
    assert.equal(status.summary, "Template-only");
    assert.equal(isCatalogBackedChoicesOption(option({ id: "o1", label: "x" })), false);
  });

  it("shows catalog name and label difference", () => {
    const off = offering({ id: "off-1", name: "Chiavari Chair Rental", defaultUnitPrice: 8 });
    const opt = option({
      id: "o1",
      label: "Gold Chiavari (ceremony)",
      offeringId: "off-1",
      unitPrice: 9,
    });
    const status = optionCatalogLinkStatus(opt, off);
    assert.equal(status.kind, "catalog");
    assert.equal(status.summary, "From catalog · Chiavari Chair Rental");
    assert.equal(status.labelDiffersFromOffering, true);
  });

  it("preserves archived link with clear status", () => {
    const off = offering({ id: "off-1", name: "Arbor Rental", isArchived: true });
    const status = optionCatalogLinkStatus(
      option({ id: "o1", label: "Arbor", offeringId: "off-1" }),
      off,
    );
    assert.equal(status.kind, "catalog-archived");
    assert.match(status.summary, /archived — link preserved/);
  });

  it("does not unlink when offering missing from loaded catalog", () => {
    const status = optionCatalogLinkStatus(
      option({ id: "o1", label: "Arbor", offeringId: "off-gone" }),
      undefined,
    );
    assert.equal(status.kind, "catalog-missing");
    assert.match(status.summary, /link preserved/);
  });
});

describe("attach / clear / edit preserving snapshot", () => {
  it("attaches offering_id without changing label or price", () => {
    const opt = option({
      id: "o1",
      label: "Venue Plated Dinner wording",
      unitPrice: 95,
      isIncluded: false,
      isDefault: true,
      description: "Keep me",
    });
    const write = attachOfferingPreservingSnapshot(opt, "off-plated");
    assert.equal(write.offeringId, "off-plated");
    assert.equal(write.label, "Venue Plated Dinner wording");
    assert.equal(write.unitPrice, "95");
    assert.equal(write.isIncluded, false);
    assert.equal(write.isDefault, true);
    assert.equal(write.description, "Keep me");
    assert.equal(write.groupId, "g1");
  });

  it("clears offering link and keeps template-only snapshots", () => {
    const opt = option({
      id: "o1",
      label: "Custom bar",
      offeringId: "off-bar",
      unitPrice: 40,
    });
    const write = clearOfferingLinkPreservingSnapshot(opt);
    assert.equal(write.offeringId, null);
    assert.equal(write.label, "Custom bar");
    assert.equal(write.unitPrice, "40");
  });

  it("edits label without losing offering link", () => {
    const opt = option({
      id: "o1",
      label: "Old",
      offeringId: "off-1",
      unitPrice: 10,
    });
    const write = updateOptionFieldsPreservingOfferingLink(opt, { label: "New label" });
    assert.equal(write.offeringId, "off-1");
    assert.equal(write.label, "New label");
    assert.equal(write.unitPrice, "10");
  });

  it("new-option draft may snapshot catalog price once; attach path does not refresh", () => {
    const off = offering({ id: "off-1", name: "Snack", defaultUnitPrice: 12 });
    const draft = choicesOptionDraftFromOffering(off);
    assert.equal(draft.offeringId, "off-1");
    assert.equal(draft.unitPrice, 12);
    const existing = option({
      id: "o1",
      label: "Late snack",
      unitPrice: 99,
      offeringId: null,
    });
    const attached = attachOfferingPreservingSnapshot(existing, off.id);
    assert.equal(attached.unitPrice, "99");
    assert.notEqual(attached.unitPrice, String(off.defaultUnitPrice));
  });
});

describe("picker and no name-based attach", () => {
  it("excludes archived offerings from attach picker", () => {
    const list = offeringsAvailableForAttach([
      offering({ id: "a", name: "Active" }),
      offering({ id: "b", name: "Old", isArchived: true }),
    ]);
    assert.deepEqual(list.map((o) => o.id), ["a"]);
  });

  it("module source has no name-based attach helper", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/client-choices-templates/option-catalog.ts"),
      "utf8",
    );
    assert.equal(src.includes("function findOffering"), false);
    assert.equal(src.includes("matchOfferingByName"), false);
    assert.equal(src.includes("attachByName"), false);
    assert.match(src, /never auto-link by name/i);
    assert.match(src, /Explicit offeringId only/);
  });
});

describe("freeze / provenance carry-through", () => {
  it("selection freeze retains offeringId for catalog-backed options and null for template-only", () => {
    const template: EventOrderTemplateWithDetails = {
      id: "tmpl-1",
      venueId: "venue-a",
      name: "Inc2",
      description: null,
      sourceMasterKey: null,
      isArchived: false,
      createdAt: ts,
      updatedAt: ts,
      sections: [],
      lines: [],
      groups: [
        {
          id: "g1",
          templateId: "tmpl-1",
          venueId: "venue-a",
          sectionId: null,
          name: "Rentals",
          instructions: null,
          selectionMode: "multi",
          minSelect: 0,
          maxSelect: null,
          allowQuantity: false,
          dependsOnOptionIds: [],
          sortOrder: 0,
          createdAt: ts,
          updatedAt: ts,
        },
      ],
      options: [
        option({ id: "o-linked", label: "Chairs", offeringId: "off-chair", unitPrice: 5 }),
        option({ id: "o-only", label: "Plated Dinner", offeringId: null, unitPrice: 0, isIncluded: true }),
      ],
    };
    const def = selectionDefinitionFromEventOrderTemplate(template);
    assert.equal(def.options.find((o) => o.id === "o-linked")?.offeringId, "off-chair");
    assert.equal(def.options.find((o) => o.id === "o-only")?.offeringId, null);
  });
});
