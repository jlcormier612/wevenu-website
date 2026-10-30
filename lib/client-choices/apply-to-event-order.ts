/**
 * Map finalized Client Choices answers onto Event Order lines.
 * Does NOT touch invoices — callers surface existing EO → invoice paths.
 */
import {
  isChoiceGroupActive,
  reconcileAnswersForDependencies,
} from "@/lib/client-choices/conditional-groups";
import type {
  ChoicesAnswers,
  ChoicesDefinition,
  ChoicesDefinitionOption,
} from "@/lib/client-choices/types";

export type AppliedChoiceLine = {
  optionId: string;
  groupId: string;
  offeringId: string | null;
  description: string;
  quantity: number;
  unitPrice: number | null;
  isIncluded: boolean;
  amount: number;
};

export function resolveSelectedOptions(
  definition: ChoicesDefinition,
  answers: ChoicesAnswers,
): AppliedChoiceLine[] {
  const byId = new Map(definition.options.map((o) => [o.id, o]));
  const lines: AppliedChoiceLine[] = [];
  const activeAnswers = reconcileAnswersForDependencies(definition, answers);

  for (const group of definition.groups) {
    if (!isChoiceGroupActive(group, activeAnswers)) continue;
    const answer = activeAnswers[group.id];
    if (!answer?.optionIds?.length) continue;
    for (const optionId of answer.optionIds) {
      const opt = byId.get(optionId);
      if (!opt) continue;
      const qty = group.allowQuantity
        ? Math.max(1, Number(answer.quantities?.[optionId] ?? 1) || 1)
        : 1;
      const unitPrice = effectiveUnitPrice(opt);
      const amount = unitPrice == null ? 0 : Number((qty * unitPrice).toFixed(2));
      lines.push({
        optionId: opt.id,
        groupId: group.id,
        offeringId: opt.offeringId,
        description: opt.label,
        quantity: qty,
        unitPrice,
        isIncluded: opt.isIncluded,
        amount,
      });
    }
  }
  return lines;
}

export function effectiveUnitPrice(opt: ChoicesDefinitionOption): number | null {
  if (opt.isIncluded) return 0;
  return opt.unitPrice;
}

/** Net financial delta for selected lines (additional-cost only). */
export function financialDeltaFromLines(lines: AppliedChoiceLine[]): number {
  return Number(lines.reduce((sum, l) => sum + (l.isIncluded ? 0 : l.amount), 0).toFixed(2));
}

/**
 * Price-neutral: no additional-cost amount change vs previous applied selection.
 * Used to avoid financial noise when only labels/options swap at $0.
 */
export function isPriceNeutralChange(
  previousDelta: number,
  nextDelta: number,
): boolean {
  return Math.abs(previousDelta - nextDelta) < 0.02;
}

export function choicesLineNotes(clientChoicesId: string, optionId: string): string {
  return `choices:${clientChoicesId}:${optionId}`;
}

export function parseChoicesLineNotes(
  notes: string | null | undefined,
): { clientChoicesId: string; optionId: string } | null {
  if (!notes) return null;
  const m = /^choices:([0-9a-f-]{36}):([0-9a-f-]{36})$/i.exec(notes.trim());
  if (!m) return null;
  return { clientChoicesId: m[1], optionId: m[2] };
}

function normalizeLineDescription(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Required pick-one groups must not leave prior billable dinner (etc.) lines
 * alongside the newly selected option. Returns Event Order line ids whose
 * description matches any option label in a single-select group that has an
 * answer in this finalize — so applying "Plated Dinner" clears legacy
 * "Buffet Dinner" / duplicate "Plated Dinner" from earlier package applies.
 *
 * Multi-select groups stay on appliedLineIds replacement only (venue-authored
 * optional lines with the same name are not wiped by an empty multi answer).
 */
export function conflictingSingleSelectLineIds(input: {
  definition: ChoicesDefinition;
  answers: ChoicesAnswers;
  eventOrderLines: Array<{ id: string; description: string }>;
  /** Already scheduled for removal (prior appliedLineIds) — skipped here. */
  alreadyRemovingIds?: Iterable<string>;
}): string[] {
  const already = new Set(input.alreadyRemovingIds ?? []);
  const byId = new Map(input.definition.options.map((o) => [o.id, o]));
  const conflictLabels = new Set<string>();

  const activeAnswers = reconcileAnswersForDependencies(input.definition, input.answers);
  for (const group of input.definition.groups) {
    if (group.selectionMode !== "single") continue;
    if (!isChoiceGroupActive(group, activeAnswers)) continue;
    const answer = activeAnswers[group.id];
    if (!answer?.optionIds?.length) continue;
    for (const opt of input.definition.options) {
      if (opt.groupId !== group.id) continue;
      conflictLabels.add(normalizeLineDescription(opt.label));
    }
    // Ensure selected option labels are included even if options array is sparse.
    for (const optionId of answer.optionIds) {
      const opt = byId.get(optionId);
      if (opt) conflictLabels.add(normalizeLineDescription(opt.label));
    }
  }

  if (conflictLabels.size === 0) return [];

  const out: string[] = [];
  for (const line of input.eventOrderLines) {
    if (already.has(line.id)) continue;
    if (conflictLabels.has(normalizeLineDescription(line.description))) {
      out.push(line.id);
    }
  }
  return out;
}

/**
 * Pick-any add-ons the couple selected replace an Event Order line with the
 * same name in the same section, so an add-on already on the order is not
 * added a second time. Only selected options count — unselected or empty
 * pick-any answers never remove venue-authored lines.
 */
export function duplicateMultiSelectLineIds(input: {
  definition: ChoicesDefinition;
  answers: ChoicesAnswers;
  eventOrderLines: Array<{ id: string; description: string; sectionId: string | null }>;
  /** Event Order section id for each choice group (matched by section name). */
  sectionIdByGroup: Map<string, string>;
  /** Already scheduled for removal (prior appliedLineIds, pick-one conflicts) — skipped here. */
  alreadyRemovingIds?: Iterable<string>;
}): string[] {
  const already = new Set(input.alreadyRemovingIds ?? []);
  const multiGroupIds = new Set(
    input.definition.groups.filter((g) => g.selectionMode !== "single").map((g) => g.id),
  );
  const selectedKeys = new Set<string>();
  for (const line of resolveSelectedOptions(input.definition, input.answers)) {
    if (!multiGroupIds.has(line.groupId)) continue;
    const sectionId = input.sectionIdByGroup.get(line.groupId) ?? null;
    selectedKeys.add(`${sectionId ?? ""}::${normalizeLineDescription(line.description)}`);
  }
  if (selectedKeys.size === 0) return [];

  const out: string[] = [];
  for (const line of input.eventOrderLines) {
    if (already.has(line.id)) continue;
    if (selectedKeys.has(`${line.sectionId ?? ""}::${normalizeLineDescription(line.description)}`)) {
      out.push(line.id);
    }
  }
  return out;
}
