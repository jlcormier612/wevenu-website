import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  clientsCanSelectLabel,
  editorLevelCopy,
  overviewCardForSection,
  sectionEditorHref,
  sectionOverviewCards,
  sectionOverviewSummary,
  simpleSelectionFromGroup,
  simpleSelectionLabel,
  simpleSelectionToFields,
  templateReadiness,
} from "@/lib/event-order-templates/editor-presentation";
import type {
  EventOrderTemplateGroup,
  EventOrderTemplateLine,
  EventOrderTemplateOption,
  EventOrderTemplateSection,
  EventOrderTemplateWithDetails,
} from "@/lib/event-order-templates/types";

function template(
  partial: Partial<EventOrderTemplateWithDetails> = {},
): EventOrderTemplateWithDetails {
  return {
    id: "t1",
    venueId: "v1",
    name: "Wedding Reception",
    description: null,
    sourceMasterKey: "EO-D-01",
    isArchived: false,
    createdAt: "",
    updatedAt: "",
    sections: [],
    lines: [],
    groups: [],
    options: [],
    ...partial,
  };
}

function section(
  partial: Partial<EventOrderTemplateSection> & Pick<EventOrderTemplateSection, "id" | "name">,
): EventOrderTemplateSection {
  return {
    templateId: "t1",
    venueId: "v1",
    guidance: null,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

function line(
  partial: Partial<EventOrderTemplateLine> & Pick<EventOrderTemplateLine, "id" | "description">,
): EventOrderTemplateLine {
  return {
    templateId: "t1",
    venueId: "v1",
    sectionId: "sec-catering",
    descriptionDetail: null,
    quantity: 1,
    unitPrice: null,
    pricingModel: "none",
    unit: null,
    includedByDefault: true,
    offeringId: null,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

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
    imageUrl: null,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("Event Order editor presentation helpers", () => {
  it("counts included items and root client-selection groups from actual data", () => {
    const t = template({
      sections: [
        section({ id: "sec-catering", name: "Catering", sortOrder: 1 }),
        section({ id: "sec-bar", name: "Bar & Beverages", sortOrder: 2 }),
      ],
      lines: [
        line({ id: "l1", description: "Cake cutting", includedByDefault: true }),
        line({ id: "l2", description: "Staff extra", includedByDefault: false }),
      ],
      groups: [
        group({ id: "g-dinner", name: "Dinner service" }),
        group({
          id: "g-entrees",
          name: "Entrées",
          dependsOnOptionIds: ["opt-plated"],
          selectionMode: "multi",
          minSelect: 2,
          maxSelect: 2,
        }),
      ],
      options: [
        option({ id: "opt-plated", groupId: "g-dinner", label: "Plated Dinner" }),
      ],
    });
    const cards = sectionOverviewCards(t);
    assert.equal(cards[0]?.name, "Catering");
    assert.equal(cards[0]?.includedCount, 1);
    assert.equal(cards[0]?.clientSelectionCount, 1);
    assert.equal(cards[1]?.includedCount, 0);
    assert.equal(cards[1]?.clientSelectionCount, 0);
  });

  it("marks a section as needing attention only when a group is structurally incomplete", () => {
    const complete = overviewCardForSection(
      template({
        sections: [section({ id: "sec-catering", name: "Catering" })],
        groups: [group({ id: "g-dinner", name: "Dinner service" })],
        options: [
          option({ id: "opt-plated", groupId: "g-dinner", label: "Plated Dinner", unitPrice: 85 }),
        ],
      }),
      section({ id: "sec-catering", name: "Catering" }),
    );
    assert.equal(complete.needsAttention, false);

    const empty = overviewCardForSection(
      template({
        sections: [section({ id: "sec-catering", name: "Catering" })],
        groups: [group({ id: "g-dinner", name: "Dinner service" })],
      }),
      section({ id: "sec-catering", name: "Catering" }),
    );
    assert.equal(empty.needsAttention, true);
    assert.equal(empty.attentionSummary, "Add a client option");
  });

  it("names the incomplete nested branch instead of a generic parent warning", () => {
    const card = overviewCardForSection(
      template({
        sections: [section({ id: "sec-catering", name: "Catering" })],
        groups: [
          group({ id: "g-dinner", name: "Dinner service" }),
          group({
            id: "g-plated-entrees",
            name: "Entrées",
            dependsOnOptionIds: ["opt-plated"],
          }),
        ],
        options: [option({ id: "opt-plated", groupId: "g-dinner", label: "Plated Dinner" })],
      }),
      section({ id: "sec-catering", name: "Catering" }),
    );
    assert.equal(card.needsAttention, true);
    assert.equal(card.attentionSummary, "Plated Dinner needs at least one choice in Entrées.");
  });

  it("maps simple selection controls onto existing group fields", () => {
    assert.deepEqual(
      simpleSelectionToFields({ kind: "choose_one", required: true, limit: "exactly", count: 1 }),
      { selectionMode: "single", minSelect: 1, maxSelect: 1, allowQuantity: false },
    );
    assert.deepEqual(
      simpleSelectionToFields({
        kind: "choose_multiple",
        required: true,
        limit: "exactly",
        count: 2,
      }),
      { selectionMode: "multi", minSelect: 2, maxSelect: 2, allowQuantity: false },
    );
    assert.deepEqual(
      simpleSelectionToFields({
        kind: "choose_multiple",
        required: false,
        limit: "up_to",
        count: 2,
      }),
      { selectionMode: "multi", minSelect: 0, maxSelect: 2, allowQuantity: false },
    );
    assert.deepEqual(
      simpleSelectionToFields({
        kind: "choose_quantities",
        required: false,
        limit: "any",
        count: null,
      }),
      { selectionMode: "multi", minSelect: 0, maxSelect: null, allowQuantity: true },
    );
  });

  it("reads existing group fields back into simple labels", () => {
    assert.equal(
      simpleSelectionLabel({
        selectionMode: "single",
        minSelect: 1,
        maxSelect: 1,
        allowQuantity: false,
      }),
      "Choose 1 · Required",
    );
    const multiple = simpleSelectionFromGroup({
      selectionMode: "multi",
      minSelect: 0,
      maxSelect: 2,
      allowQuantity: false,
    });
    assert.equal(multiple.kind, "choose_multiple");
    assert.equal(multiple.required, false);
    assert.equal(clientsCanSelectLabel(multiple), "Up to 2");
  });

  it("treats an empty template as Draft and a complete one as Ready", () => {
    assert.equal(templateReadiness(template()).status, "draft");
    const ready = templateReadiness(
      template({
        sections: [section({ id: "sec-catering", name: "Catering" })],
        lines: [line({ id: "l1", description: "Cake cutting" })],
        groups: [group({ id: "g-dinner", name: "Dinner service" })],
        options: [
          option({
            id: "opt-plated",
            groupId: "g-dinner",
            label: "Plated Dinner",
            unitPrice: 85,
          }),
        ],
      }),
    );
    assert.equal(ready.status, "ready");
  });

  it("keeps templates Draft when a client option has no price and is not Included", () => {
    const draft = templateReadiness(
      template({
        sections: [section({ id: "sec-catering", name: "Catering" })],
        groups: [group({ id: "g-dinner", name: "Dinner service" })],
        options: [option({ id: "opt-plated", groupId: "g-dinner", label: "Plated Dinner" })],
      }),
    );
    assert.equal(draft.status, "draft");
    assert.match(draft.reason ?? "", /price or an Included decision/);
  });

  it("builds section-scoped editor hrefs that preserve Back/refresh focus", () => {
    assert.equal(
      sectionEditorHref("t1", "sec-catering"),
      "/library/event-order-templates/t1/sections/sec-catering",
    );
    assert.equal(
      sectionEditorHref("t1", "sec-catering", {
        choice: "g-dinner",
        offering: "opt-plated",
        category: "g-entrees",
      }),
      "/library/event-order-templates/t1/sections/sec-catering?choice=g-dinner&offering=opt-plated&category=g-entrees",
    );
  });

  it("summarizes overview rows and focused editor prompts in venue language", () => {
    const empty = overviewCardForSection(
      template({
        sections: [section({ id: "sec-catering", name: "Catering" })],
      }),
      section({ id: "sec-catering", name: "Catering" }),
    );
    assert.equal(sectionOverviewSummary(empty), "No included items · no client selections");
    assert.equal(
      editorLevelCopy({ sectionName: "Catering" }).prompt,
      "Choose what’s included and what clients can select.",
    );
    assert.equal(
      editorLevelCopy({ sectionName: "Catering", choiceName: "Dinner Service" }).prompt,
      "Choose which options to offer.",
    );
    assert.equal(
      editorLevelCopy({
        sectionName: "Catering",
        choiceName: "Dinner Service",
        offeringName: "Plated Dinner",
      }).prompt,
      "Configure the categories available when Plated Dinner is selected.",
    );
    assert.equal(
      editorLevelCopy({
        sectionName: "Catering",
        choiceName: "Dinner Service",
        offeringName: "Plated Dinner",
        categoryName: "Entrées",
      }).prompt,
      "Choose the options clients can select.",
    );
  });

  it("library Delivery uses equal Event Order Templates and Offerings Catalog destinations", () => {
    const hub = readFileSync(join(process.cwd(), "app/(app)/library/page.tsx"), "utf8");
    assert.match(hub, /title="Event Order Templates"/);
    assert.match(hub, /Create and manage reusable client selection experiences\./);
    assert.match(hub, /title="Offerings Catalog"/);
    assert.match(
      hub,
      /Manage the services, packages, upgrades, and choices available for clients to select\./,
    );
    assert.match(hub, /href="\/library\/event-order-templates"/);
    assert.match(hub, /href="\/library\/offerings"/);
    assert.doesNotMatch(hub, /Choices catalog/);
    assert.doesNotMatch(hub, /secondaryHref="\/library\/offerings"/);
    assert.match(hub, /title="Available Inventory"/);
    assert.match(hub, /Group title="Stock"/);
    assert.match(hub, /Group title="Delivery"/);
  });
});
