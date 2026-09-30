/**
 * Freeze an Event Order Template into the selection definition shape
 * used by client_choices runtime (portal / Use / Send / finalize).
 */
import type { ChoicesDefinition } from "@/lib/client-choices/types";
import type { EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";

export function selectionDefinitionFromEventOrderTemplate(
  template: EventOrderTemplateWithDetails,
): ChoicesDefinition {
  return {
    sections: template.sections.map((s) => ({
      id: s.id,
      name: s.name,
      guidance: s.guidance,
      sortOrder: s.sortOrder,
    })),
    groups: template.groups.map((g) => ({
      id: g.id,
      sectionId: g.sectionId,
      name: g.name,
      instructions: g.instructions,
      selectionMode: g.selectionMode,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      allowQuantity: g.allowQuantity,
      sortOrder: g.sortOrder,
    })),
    options: template.options.map((o) => ({
      id: o.id,
      groupId: o.groupId,
      offeringId: o.offeringId,
      label: o.label,
      description: o.description,
      isIncluded: o.isIncluded,
      unitPrice: o.isIncluded ? 0 : o.unitPrice,
      sortOrder: o.sortOrder,
    })),
  };
}

/** Default answers from isDefault options (Use / first open). */
export function defaultAnswersFromEventOrderTemplate(
  template: EventOrderTemplateWithDetails,
): Record<string, { optionIds: string[]; quantities?: Record<string, number> }> {
  const answers: Record<string, { optionIds: string[]; quantities?: Record<string, number> }> = {};
  for (const group of template.groups) {
    const defaults = template.options
      .filter((o) => o.groupId === group.id && o.isDefault)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (defaults.length === 0) continue;
    const optionIds =
      group.selectionMode === "single" ? [defaults[0]!.id] : defaults.map((o) => o.id);
    answers[group.id] = { optionIds };
  }
  return answers;
}

export function templateHasSelectableGroups(template: EventOrderTemplateWithDetails): boolean {
  return template.groups.length > 0;
}
