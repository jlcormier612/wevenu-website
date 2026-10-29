/**
 * Freeze an Event Order Template into the selection definition shape
 * used by client_choices runtime (portal / Use / Send / finalize).
 */
import type { ChoicesAnswers, ChoicesDefinition } from "@/lib/client-choices/types";
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
    // Fixed offerings travel with the selection request so the couple sees the
    // complete proposed event — not only stripped-down choice groups.
    fixedLines: template.lines.map((line) => ({
      id: line.id,
      sectionId: line.sectionId,
      description: line.description,
      descriptionDetail: line.descriptionDetail,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      unit: line.unit,
      pricingModel: line.pricingModel,
      includedByDefault: line.includedByDefault,
      sortOrder: line.sortOrder,
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
      dependsOnOptionIds: g.dependsOnOptionIds ?? [],
    })),
    options: template.options.map((o) => ({
      id: o.id,
      groupId: o.groupId,
      offeringId: o.offeringId,
      label: o.label,
      description: o.description,
      isIncluded: o.isIncluded,
      unitPrice: o.isIncluded ? 0 : o.unitPrice,
      imageUrl: o.imageUrl?.trim() ? o.imageUrl.trim() : null,
      sortOrder: o.sortOrder,
    })),
  };
}

/**
 * True when the frozen packet is missing offerings the Event Order Template
 * still carries (legacy / partial freeze), OR when the template's selectable
 * structure has drifted (group/option ids, selection mode, min/max).
 *
 * Drift detection lets venue Resend / staff open re-freeze the packet and
 * prune stale draft answers after the venue changes options on the linked
 * template — without rebuilding from the catalog on every couple render.
 * Finalized packets never hydrate (caller short-circuits).
 */
export function selectionDefinitionNeedsHydration(
  definition: ChoicesDefinition,
  template: EventOrderTemplateWithDetails,
): boolean {
  const fixedCount = definition.fixedLines?.length ?? 0;
  if (template.lines.length > 0 && fixedCount === 0) return true;
  if (template.groups.length > 0 && definition.groups.length === 0) return true;
  if (template.options.length > 0 && definition.options.length === 0) return true;

  const defGroupIds = new Set(definition.groups.map((g) => g.id));
  const tmplGroupIds = new Set(template.groups.map((g) => g.id));
  if (defGroupIds.size !== tmplGroupIds.size) return true;
  for (const id of tmplGroupIds) {
    if (!defGroupIds.has(id)) return true;
  }

  const defByGroup = new Map(definition.groups.map((g) => [g.id, g]));
  for (const g of template.groups) {
    const frozen = defByGroup.get(g.id);
    if (!frozen) return true;
    if (frozen.selectionMode !== g.selectionMode) return true;
    if (frozen.minSelect !== g.minSelect) return true;
    if (frozen.maxSelect !== g.maxSelect) return true;
  }

  const defOptionIds = new Set(definition.options.map((o) => o.id));
  const tmplOptionIds = new Set(template.options.map((o) => o.id));
  if (defOptionIds.size !== tmplOptionIds.size) return true;
  for (const id of tmplOptionIds) {
    if (!defOptionIds.has(id)) return true;
  }

  return false;
}

/** Keep answers whose groups/options still exist after a re-freeze. */
export function pruneAnswersToDefinition(
  answers: ChoicesAnswers,
  definition: ChoicesDefinition,
): ChoicesAnswers {
  const groupIds = new Set(definition.groups.map((g) => g.id));
  const optionIdsByGroup = new Map<string, Set<string>>();
  for (const opt of definition.options) {
    const set = optionIdsByGroup.get(opt.groupId) ?? new Set<string>();
    set.add(opt.id);
    optionIdsByGroup.set(opt.groupId, set);
  }
  const next: ChoicesAnswers = {};
  for (const [groupId, answer] of Object.entries(answers)) {
    if (!groupIds.has(groupId)) continue;
    const allowed = optionIdsByGroup.get(groupId) ?? new Set<string>();
    const optionIds = (answer.optionIds ?? []).filter((id) => allowed.has(id));
    const quantities = answer.quantities
      ? Object.fromEntries(
          Object.entries(answer.quantities).filter(([id]) => allowed.has(id)),
        )
      : undefined;
    next[groupId] = {
      ...answer,
      optionIds,
      ...(quantities && Object.keys(quantities).length > 0 ? { quantities } : {}),
    };
  }
  return next;
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
