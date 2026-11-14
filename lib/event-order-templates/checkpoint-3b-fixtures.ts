/**
 * Isolated Checkpoint 3B fixtures — not starter library data.
 * Prices here verify optional paid-service and parent/child commercial behavior.
 */
import { getEventOrderStarterMaster } from "@/lib/event-order-templates/starters";
import { eventOrderStarterMasterToTemplate } from "@/lib/event-order-templates/starter-to-template";
import type {
  EventOrderTemplateOption,
  EventOrderTemplateWithDetails,
} from "@/lib/event-order-templates/types";

const NOW = "2026-01-01T00:00:00.000Z";

function cloneTemplate(template: EventOrderTemplateWithDetails): EventOrderTemplateWithDetails {
  return structuredClone(template);
}

function option(
  partial: Partial<EventOrderTemplateOption> & Pick<EventOrderTemplateOption, "id" | "groupId" | "label">,
): EventOrderTemplateOption {
  return {
    templateId: "fixture-c3b-parent",
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

/** Wedding Reception starter mapped as a new venue would receive it. */
export function newVenueUnconfiguredStarterTemplate(): EventOrderTemplateWithDetails {
  const master = getEventOrderStarterMaster("EO-D-01")!;
  const template = eventOrderStarterMasterToTemplate(master, {
    templateId: "fixture-c3b-new-venue",
    venueId: "fixture-new-venue",
  });
  template.name = "Wedding Reception";
  return template;
}

/** Isolated: Day-of Coordination as Additional $1,200. Other examples stay unconfigured. */
export function dayOfCoordinationAdditionalFixture(): EventOrderTemplateWithDetails {
  const template = cloneTemplate(newVenueUnconfiguredStarterTemplate());
  template.id = "fixture-c3b-dayof";
  template.name = "FIXTURE — Day-of Coordination Additional $1,200";
  template.description = "TEST FIXTURE — not starter library data.";
  const dayOf = template.options.find((o) => o.label === "Day-of Coordination");
  if (dayOf) {
    dayOf.unitPrice = 1200;
    dayOf.isIncluded = false;
    dayOf.description = "Flat fee";
  }
  return template;
}

/**
 * Isolated: priced parent dinner with included child choices and one paid upgrade.
 * Not inserted into the starter.
 */
export function pricedParentChildFixture(): EventOrderTemplateWithDetails {
  return {
    id: "fixture-c3b-parent",
    venueId: "fixture-venue",
    name: "FIXTURE — Priced parent with included children",
    description: "TEST FIXTURE — Plated Dinner $85 per person. Not starter library data.",
    sourceMasterKey: null,
    isArchived: false,
    createdAt: NOW,
    updatedAt: NOW,
    sections: [
      {
        id: "sec-catering",
        templateId: "fixture-c3b-parent",
        venueId: "fixture-venue",
        name: "Catering",
        guidance: "Isolated parent/child pricing fixture.",
        sortOrder: 0,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    lines: [],
    groups: [
      {
        id: "g-dinner",
        templateId: "fixture-c3b-parent",
        venueId: "fixture-venue",
        sectionId: "sec-catering",
        name: "Dinner service",
        instructions: null,
        selectionMode: "single",
        minSelect: 1,
        maxSelect: 1,
        allowQuantity: false,
        dependsOnOptionIds: [],
        sortOrder: 0,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: "g-entrees",
        templateId: "fixture-c3b-parent",
        venueId: "fixture-venue",
        sectionId: "sec-catering",
        name: "Entrées",
        instructions: null,
        selectionMode: "single",
        minSelect: 1,
        maxSelect: 1,
        allowQuantity: false,
        dependsOnOptionIds: ["opt-plated"],
        sortOrder: 1,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    options: [
      option({
        id: "opt-plated",
        groupId: "g-dinner",
        label: "Plated Dinner",
        description: "Per person",
        unitPrice: 85,
        sortOrder: 0,
      }),
      option({
        id: "opt-chicken",
        groupId: "g-entrees",
        label: "Herb-Roasted Chicken",
        isIncluded: true,
        unitPrice: 0,
        sortOrder: 0,
      }),
      option({
        id: "opt-beef",
        groupId: "g-entrees",
        label: "Braised Beef",
        isIncluded: true,
        unitPrice: 0,
        sortOrder: 1,
      }),
      option({
        id: "opt-veg",
        groupId: "g-entrees",
        label: "Seasonal Vegetarian Entrée",
        isIncluded: true,
        unitPrice: 0,
        sortOrder: 2,
      }),
      option({
        id: "opt-filet",
        groupId: "g-entrees",
        label: "Premium Filet",
        description: "Per person",
        unitPrice: 15,
        sortOrder: 3,
      }),
    ],
  };
}

/** Existing venue copy that already has customized prices — must not be overwritten by starter source. */
export function existingVenueCustomizedCopyFixture(): EventOrderTemplateWithDetails {
  const template = cloneTemplate(newVenueUnconfiguredStarterTemplate());
  template.id = "existing-venue-copy";
  template.venueId = "existing-venue";
  template.name = "Wedding Reception (existing venue copy)";
  const farm = template.options.find((o) => o.label === "Farm Table");
  if (farm) {
    farm.unitPrice = 85;
    farm.isIncluded = false;
  }
  const dayOf = template.options.find((o) => o.label === "Day-of Coordination");
  if (dayOf) {
    dayOf.isIncluded = true;
    dayOf.unitPrice = 0;
  }
  return template;
}

export function configureOption(
  template: EventOrderTemplateWithDetails,
  label: string,
  patch: Partial<Pick<EventOrderTemplateOption, "isIncluded" | "unitPrice" | "label">>,
): EventOrderTemplateWithDetails {
  const next = cloneTemplate(template);
  const opt = next.options.find((o) => o.label === label);
  if (!opt) throw new Error(`Missing option ${label}`);
  Object.assign(opt, patch);
  return next;
}

export function removeOptionByLabel(
  template: EventOrderTemplateWithDetails,
  label: string,
): EventOrderTemplateWithDetails {
  const next = cloneTemplate(template);
  next.options = next.options.filter((o) => o.label !== label);
  return next;
}

/** Drop a delivery section and its groups/options — existing Event Orders stay untouched. */
export function removeSectionByName(
  template: EventOrderTemplateWithDetails,
  sectionName: string,
): EventOrderTemplateWithDetails {
  const next = cloneTemplate(template);
  const section = next.sections.find((s) => s.name === sectionName);
  if (!section) return next;
  const groupIds = new Set(next.groups.filter((g) => g.sectionId === section.id).map((g) => g.id));
  next.sections = next.sections.filter((s) => s.id !== section.id);
  next.groups = next.groups.filter((g) => g.sectionId !== section.id);
  next.options = next.options.filter((o) => !groupIds.has(o.groupId));
  next.lines = next.lines.filter((l) => l.sectionId !== section.id);
  return next;
}
