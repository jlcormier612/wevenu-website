/**
 * Map an Event Order starter master onto the template shape used by preview,
 * completeness, and isolated provisioning tests. Mirrors insertStarterFromMaster
 * field mapping without writing to a venue.
 */
import type { EventOrderStarterMaster } from "@/lib/event-order-templates/starters";
import type {
  EventOrderTemplateGroup,
  EventOrderTemplateLine,
  EventOrderTemplateOption,
  EventOrderTemplateSection,
  EventOrderTemplateWithDetails,
} from "@/lib/event-order-templates/types";

const NOW = "2026-01-01T00:00:00.000Z";

export function eventOrderStarterMasterToTemplate(
  master: EventOrderStarterMaster,
  ids?: { templateId?: string; venueId?: string },
): EventOrderTemplateWithDetails {
  const templateId = ids?.templateId ?? `starter-${master.key.toLowerCase()}`;
  const venueId = ids?.venueId ?? "fixture-new-venue";
  const sections: EventOrderTemplateSection[] = [];
  const lines: EventOrderTemplateLine[] = [];
  const groups: EventOrderTemplateGroup[] = [];
  const options: EventOrderTemplateOption[] = [];
  const optionIdByName = new Map<string, string>();
  let lineN = 0;
  let groupN = 0;
  let optionN = 0;

  master.sections.forEach((sec, sIdx) => {
    const sectionId = `${templateId}-sec-${sIdx}`;
    sections.push({
      id: sectionId,
      templateId,
      venueId,
      name: sec.name,
      guidance: sec.guidance ?? null,
      sortOrder: sIdx,
      createdAt: NOW,
      updatedAt: NOW,
    });
    for (const offering of sec.offerings ?? []) {
      lines.push({
        id: `${templateId}-line-${lineN}`,
        templateId,
        venueId,
        sectionId,
        description: offering.name,
        descriptionDetail: offering.description ?? null,
        quantity: offering.defaultQuantity ?? 1,
        unitPrice: offering.unitPrice ?? null,
        pricingModel: offering.pricingModel,
        unit: offering.unit ?? null,
        includedByDefault: offering.includedByDefault ?? false,
        offeringId: null,
        sortOrder: lineN,
        createdAt: NOW,
        updatedAt: NOW,
      });
      lineN += 1;
    }
    for (const g of sec.choiceGroups ?? []) {
      const groupId = `${templateId}-g-${groupN}`;
      const dependsOnOptionIds = (g.dependsOnOptionNames ?? [])
        .map((name) => optionIdByName.get(name.trim()))
        .filter((id): id is string => Boolean(id));
      groups.push({
        id: groupId,
        templateId,
        venueId,
        sectionId,
        name: g.name,
        instructions: g.instructions ?? null,
        selectionMode: g.selectionMode,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        allowQuantity: g.allowQuantity ?? false,
        dependsOnOptionIds,
        sortOrder: groupN,
        createdAt: NOW,
        updatedAt: NOW,
      });
      g.options.forEach((opt, oIdx) => {
        const id = `${templateId}-opt-${optionN}`;
        const isIncluded = opt.isIncluded ?? false;
        if (!optionIdByName.has(opt.name.trim())) {
          optionIdByName.set(opt.name.trim(), id);
        }
        options.push({
          id,
          templateId,
          venueId,
          groupId,
          offeringId: null,
          label: opt.name,
          description: opt.description ?? null,
          isIncluded,
          unitPrice: isIncluded ? 0 : (opt.unitPrice ?? null),
          isDefault: opt.isDefault ?? false,
          imageUrl: null,
          sortOrder: oIdx,
          createdAt: NOW,
          updatedAt: NOW,
        });
        optionN += 1;
      });
      groupN += 1;
    }
  });

  return {
    id: templateId,
    venueId,
    name: master.name,
    description: master.description,
    sourceMasterKey: master.key,
    isArchived: false,
    createdAt: NOW,
    updatedAt: NOW,
    sections,
    lines,
    groups,
    options,
  };
}
