/**
 * EO Template → selection definition freeze (Use / Send / finalize runtime).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  defaultAnswersFromEventOrderTemplate,
  selectionDefinitionFromEventOrderTemplate,
  templateHasSelectableGroups,
} from "@/lib/event-order-templates/selection-definition";
import type { EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";

const root = process.cwd();

function template(
  partial: Partial<EventOrderTemplateWithDetails> = {},
): EventOrderTemplateWithDetails {
  return {
    id: "eo-tmpl-1",
    venueId: "venue-a",
    name: "Premium Wedding Dinner",
    description: "Bar + entrée choices",
    sourceMasterKey: null,
    isArchived: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    sections: [
      {
        id: "sec-1",
        templateId: "eo-tmpl-1",
        venueId: "venue-a",
        name: "Food & Beverage",
        guidance: null,
        sortOrder: 0,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
    lines: [
      {
        id: "line-1",
        templateId: "eo-tmpl-1",
        venueId: "venue-a",
        sectionId: "sec-1",
        description: "House bread service",
        descriptionDetail: null,
        quantity: 1,
        unitPrice: 0,
        pricingModel: "flat",
        unit: null,
        includedByDefault: true,
        offeringId: null,
        sortOrder: 0,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
    groups: [
      {
        id: "grp-bar",
        templateId: "eo-tmpl-1",
        venueId: "venue-a",
        sectionId: "sec-1",
        name: "Bar package",
        instructions: "Choose one",
        selectionMode: "single",
        minSelect: 1,
        maxSelect: 1,
        allowQuantity: false,
        sortOrder: 0,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "grp-addons",
        templateId: "eo-tmpl-1",
        venueId: "venue-a",
        sectionId: "sec-1",
        name: "Optional add-ons",
        instructions: null,
        selectionMode: "multi",
        minSelect: 0,
        maxSelect: null,
        allowQuantity: true,
        sortOrder: 1,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
    options: [
      {
        id: "opt-premium",
        templateId: "eo-tmpl-1",
        venueId: "venue-a",
        groupId: "grp-bar",
        offeringId: "off-1",
        label: "Premium Bar",
        description: null,
        isIncluded: false,
        unitPrice: 45,
        isDefault: true,
        sortOrder: 0,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "opt-beer",
        templateId: "eo-tmpl-1",
        venueId: "venue-a",
        groupId: "grp-bar",
        offeringId: null,
        label: "Beer & Wine",
        description: null,
        isIncluded: false,
        unitPrice: 28,
        isDefault: false,
        sortOrder: 1,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "opt-champagne",
        templateId: "eo-tmpl-1",
        venueId: "venue-a",
        groupId: "grp-addons",
        offeringId: null,
        label: "Champagne toast",
        description: null,
        isIncluded: false,
        unitPrice: 8,
        isDefault: true,
        sortOrder: 0,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
    ...partial,
  };
}

describe("selectionDefinitionFromEventOrderTemplate", () => {
  it("freezes sections, groups, and options into ChoicesDefinition shape", () => {
    const def = selectionDefinitionFromEventOrderTemplate(template());
    assert.equal(def.sections.length, 1);
    assert.equal(def.sections[0]!.name, "Food & Beverage");
    assert.equal(def.groups.length, 2);
    assert.equal(def.groups[0]!.selectionMode, "single");
    assert.equal(def.groups[0]!.minSelect, 1);
    assert.equal(def.options.length, 3);
    assert.equal(def.options[0]!.label, "Premium Bar");
    assert.equal(def.options[0]!.unitPrice, 45);
    assert.equal(def.options[0]!.offeringId, "off-1");
  });

  it("zeros unitPrice for included options", () => {
    const t = template({
      options: [
        {
          id: "opt-inc",
          templateId: "eo-tmpl-1",
          venueId: "venue-a",
          groupId: "grp-bar",
          offeringId: null,
          label: "Water service",
          description: null,
          isIncluded: true,
          unitPrice: 12,
          isDefault: false,
          sortOrder: 0,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    });
    const def = selectionDefinitionFromEventOrderTemplate(t);
    assert.equal(def.options[0]!.isIncluded, true);
    assert.equal(def.options[0]!.unitPrice, 0);
  });
});

describe("defaultAnswersFromEventOrderTemplate", () => {
  it("pre-selects isDefault options; single mode takes first default only", () => {
    const answers = defaultAnswersFromEventOrderTemplate(template());
    assert.deepEqual(answers["grp-bar"]?.optionIds, ["opt-premium"]);
    assert.deepEqual(answers["grp-addons"]?.optionIds, ["opt-champagne"]);
  });

  it("omits groups with no defaults", () => {
    const answers = defaultAnswersFromEventOrderTemplate(
      template({
        options: template().options.map((o) => ({ ...o, isDefault: false })),
      }),
    );
    assert.deepEqual(answers, {});
  });
});

describe("templateHasSelectableGroups", () => {
  it("is true when groups exist", () => {
    assert.equal(templateHasSelectableGroups(template()), true);
  });

  it("is false for fixed-only templates", () => {
    assert.equal(templateHasSelectableGroups(template({ groups: [], options: [] })), false);
  });
});

describe("Phase 1 migration presence", () => {
  it("ships event_order_template_groups / options and client_choices.event_order_template_id", () => {
    const sql = readFileSync(
      join(root, "supabase/migrations/20261410000000_event_order_template_choice_groups.sql"),
      "utf8",
    );
    assert.match(sql, /create table public\.event_order_template_groups/);
    assert.match(sql, /create table public\.event_order_template_options/);
    assert.match(sql, /event_order_template_id/);
    assert.match(sql, /selection_mode/);
    assert.match(sql, /is_default/);
    assert.match(sql, /offering_id/);
  });
});
