/**
 * Isolated Checkpoint 2 fixtures — not starter library data.
 * Labels are prefixed so screenshots and tests stay identifiable as examples.
 */
import type { ChoicesAnswers, ChoicesDefinition } from "@/lib/client-choices/types";
import { selectionDefinitionFromEventOrderTemplate } from "@/lib/event-order-templates/selection-definition";
import { EVENT_ORDER_STARTER_MASTERS } from "@/lib/event-order-templates/starters";
import { eventOrderStarterMasterToTemplate } from "@/lib/event-order-templates/starter-to-template";
import type {
  EventOrderTemplateGroup,
  EventOrderTemplateLine,
  EventOrderTemplateOption,
  EventOrderTemplateSection,
  EventOrderTemplateWithDetails,
} from "@/lib/event-order-templates/types";

const NOW = "2026-01-01T00:00:00.000Z";

function section(
  id: string,
  name: string,
  sortOrder: number,
  guidance: string,
): EventOrderTemplateSection {
  return {
    id,
    templateId: "fixture-eo-c2",
    venueId: "fixture-venue",
    name,
    guidance,
    sortOrder,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function line(
  partial: Partial<EventOrderTemplateLine> & Pick<EventOrderTemplateLine, "id" | "description">,
): EventOrderTemplateLine {
  return {
    templateId: "fixture-eo-c2",
    venueId: "fixture-venue",
    sectionId: "sec-catering",
    descriptionDetail: null,
    quantity: 1,
    unitPrice: null,
    pricingModel: "none",
    unit: null,
    includedByDefault: true,
    offeringId: null,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

function group(
  partial: Partial<EventOrderTemplateGroup> & Pick<EventOrderTemplateGroup, "id" | "name">,
): EventOrderTemplateGroup {
  return {
    templateId: "fixture-eo-c2",
    venueId: "fixture-venue",
    sectionId: "sec-catering",
    instructions: null,
    selectionMode: "single",
    minSelect: 1,
    maxSelect: 1,
    allowQuantity: false,
    dependsOnOptionIds: [],
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

function option(
  partial: Partial<EventOrderTemplateOption> & Pick<EventOrderTemplateOption, "id" | "groupId" | "label">,
): EventOrderTemplateOption {
  return {
    templateId: "fixture-eo-c2",
    venueId: "fixture-venue",
    offeringId: null,
    description: null,
    isDefault: false,
    isIncluded: false,
    unitPrice: null,
    imageUrl: null,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

/** Representative three-level dinner service used only in Checkpoint 2 tests. */
export function platedBuffetFixtureTemplate(): EventOrderTemplateWithDetails {
  return {
    id: "fixture-eo-c2",
    venueId: "fixture-venue",
    name: "Fixture — Dinner service preview",
    description: "TEST FIXTURE — not starter library data.",
    sourceMasterKey: null,
    isArchived: false,
    createdAt: NOW,
    updatedAt: NOW,
    sections: [
      section("sec-catering", "Catering", 0, "Choose a dinner service. Follow-up categories appear for that choice."),
      section("sec-bar", "Bar", 1, "Independent of dinner service."),
    ],
    lines: [
      line({
        id: "line-cake",
        description: "Cake cutting",
        unitPrice: 0,
        pricingModel: "none",
        includedByDefault: true,
        sortOrder: 0,
      }),
    ],
    groups: [
      group({
        id: "g-dinner",
        name: "Dinner Service",
        instructions: "Choose one dinner service.",
        selectionMode: "single",
        minSelect: 1,
        maxSelect: 1,
        sortOrder: 0,
      }),
      group({
        id: "g-plated-entrees",
        name: "Entrées",
        instructions: "Choose one entrée.",
        selectionMode: "single",
        minSelect: 1,
        maxSelect: 1,
        dependsOnOptionIds: ["opt-plated"],
        sortOrder: 1,
      }),
      group({
        id: "g-plated-sides",
        name: "Sides",
        instructions: "Choose one or two sides.",
        selectionMode: "multi",
        minSelect: 1,
        maxSelect: 2,
        dependsOnOptionIds: ["opt-plated"],
        sortOrder: 2,
      }),
      group({
        id: "g-plated-desserts",
        name: "Desserts",
        instructions: "Optional dessert.",
        selectionMode: "single",
        minSelect: 0,
        maxSelect: 1,
        dependsOnOptionIds: ["opt-plated"],
        sortOrder: 3,
      }),
      group({
        id: "g-buffet-entrees",
        name: "Buffet Entrées",
        instructions: "Choose two buffet entrées.",
        selectionMode: "multi",
        minSelect: 2,
        maxSelect: 2,
        dependsOnOptionIds: ["opt-buffet"],
        sortOrder: 4,
      }),
      group({
        id: "g-buffet-sides",
        name: "Buffet Sides",
        selectionMode: "multi",
        minSelect: 1,
        maxSelect: 2,
        dependsOnOptionIds: ["opt-buffet"],
        sortOrder: 5,
      }),
      group({
        id: "g-buffet-desserts",
        name: "Buffet Desserts",
        selectionMode: "single",
        minSelect: 0,
        maxSelect: 1,
        dependsOnOptionIds: ["opt-buffet"],
        sortOrder: 6,
      }),
      group({
        id: "g-bar",
        name: "Bar package",
        sectionId: "sec-bar",
        instructions: "Independent of dinner service.",
        selectionMode: "single",
        minSelect: 0,
        maxSelect: 1,
        sortOrder: 7,
      }),
    ],
    options: [
      option({
        id: "opt-plated",
        groupId: "g-dinner",
        label: "Plated Dinner",
        description: "Per person — TEST FIXTURE",
        unitPrice: 85,
        sortOrder: 0,
      }),
      option({
        id: "opt-buffet",
        groupId: "g-dinner",
        label: "Buffet Dinner",
        description: "Per person — TEST FIXTURE",
        unitPrice: 72,
        sortOrder: 1,
      }),
      option({ id: "opt-chicken", groupId: "g-plated-entrees", label: "Chicken", isIncluded: true, unitPrice: 0, sortOrder: 0 }),
      option({ id: "opt-beef", groupId: "g-plated-entrees", label: "Beef", isIncluded: true, unitPrice: 0, sortOrder: 1 }),
      option({ id: "opt-veg", groupId: "g-plated-entrees", label: "Vegetarian", isIncluded: true, unitPrice: 0, sortOrder: 2 }),
      option({ id: "opt-potatoes", groupId: "g-plated-sides", label: "Roasted Potatoes", isIncluded: true, unitPrice: 0, sortOrder: 0 }),
      option({ id: "opt-veg-side", groupId: "g-plated-sides", label: "Seasonal Vegetables", isIncluded: true, unitPrice: 0, sortOrder: 1 }),
      option({ id: "opt-cake", groupId: "g-plated-desserts", label: "Chocolate Cake", unitPrice: 6, sortOrder: 0 }),
      option({ id: "opt-cheesecake", groupId: "g-plated-desserts", label: "Cheesecake", unitPrice: 6, sortOrder: 1 }),
      option({ id: "opt-buffet-chicken", groupId: "g-buffet-entrees", label: "Chicken", isIncluded: true, unitPrice: 0, sortOrder: 0 }),
      option({ id: "opt-buffet-pasta", groupId: "g-buffet-entrees", label: "Pasta", isIncluded: true, unitPrice: 0, sortOrder: 1 }),
      option({ id: "opt-buffet-rice", groupId: "g-buffet-sides", label: "Rice", isIncluded: true, unitPrice: 0, sortOrder: 0 }),
      option({ id: "opt-buffet-veg", groupId: "g-buffet-sides", label: "Vegetables", isIncluded: true, unitPrice: 0, sortOrder: 1 }),
      option({ id: "opt-buffet-dessert", groupId: "g-buffet-desserts", label: "Assorted Desserts", isIncluded: true, unitPrice: 0, sortOrder: 0 }),
      option({ id: "opt-wine", groupId: "g-bar", label: "Wine service", unitPrice: 28, sortOrder: 0 }),
    ],
  };
}

export function platedBuffetFixtureDefinition(): ChoicesDefinition {
  return selectionDefinitionFromEventOrderTemplate(platedBuffetFixtureTemplate());
}

export function incompleteStarterLikeTemplate(): EventOrderTemplateWithDetails {
  const full = platedBuffetFixtureTemplate();
  return {
    ...full,
    id: "fixture-eo-c2-incomplete",
    name: "Fixture — incomplete nested categories",
    groups: full.groups.filter((g) =>
      ["g-dinner", "g-plated-entrees", "g-plated-sides", "g-plated-desserts"].includes(g.id),
    ),
    options: full.options.filter((o) => o.groupId === "g-dinner"),
  };
}

export const emptyPreviewAnswers: ChoicesAnswers = {};

/**
 * Wedding Reception starter SOURCE rendered as a preview template.
 * Not a venue copy and not a catalog write.
 */
export function weddingReceptionStarterPreviewTemplate(): EventOrderTemplateWithDetails {
  const master = EVENT_ORDER_STARTER_MASTERS.find((m) => m.key === "EO-D-01");
  if (!master) throw new Error("EO-D-01 starter missing");
  const template = eventOrderStarterMasterToTemplate(master, {
    templateId: "fixture-eo-c2-starter",
    venueId: "fixture-venue",
  });
  return {
    ...template,
    description: `STARTER SOURCE PREVIEW — ${master.description} Not a venue copy.`,
  };
}
