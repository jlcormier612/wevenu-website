/**
 * Server-side validation for Client Choices answers against a frozen definition.
 * Required groups cannot be bypassed by omitting options in the browser payload.
 * Inactive dependent groups (dependsOnOptionIds) do not block submit; orphan
 * answers on inactive children are rejected.
 */
import {
  isChoiceGroupActive,
  reconcileAnswersForDependencies,
} from "@/lib/client-choices/conditional-groups";
import type { ChoicesAnswers, ChoicesDefinition } from "@/lib/client-choices/types";
import { impossibleSelectionGroupMessage } from "@/lib/event-order-templates/guided-setup";

export type ChoicesAnswersValidation =
  | { ok: true }
  | { ok: false; message: string; groupId?: string; groupName?: string };

/**
 * Enforce min/max select and single-mode exclusivity. Unknown option ids are rejected.
 * Parent/child: validate only active groups; reject answers on inactive dependents.
 */
export function validateChoicesAnswers(
  definition: ChoicesDefinition,
  answers: ChoicesAnswers | null | undefined,
): ChoicesAnswersValidation {
  const safeAnswers = answers ?? {};
  const optionsByGroup = new Map<string, Set<string>>();
  for (const opt of definition.options) {
    const set = optionsByGroup.get(opt.groupId) ?? new Set<string>();
    set.add(opt.id);
    optionsByGroup.set(opt.groupId, set);
  }

  for (const group of definition.groups) {
    const allowed = optionsByGroup.get(group.id) ?? new Set<string>();
    const raw = safeAnswers[group.id]?.optionIds ?? [];
    const optionIds = raw.filter((id) => typeof id === "string");
    const active = isChoiceGroupActive(group, safeAnswers);

    if (!active) {
      if (optionIds.length > 0) {
        return {
          ok: false,
          message: `“${group.name}” is not available for the current selections.`,
          groupId: group.id,
          groupName: group.name,
        };
      }
      continue;
    }

    for (const id of optionIds) {
      if (!allowed.has(id)) {
        return {
          ok: false,
          message: `“${group.name}” includes an option that is not part of this selection request.`,
          groupId: group.id,
          groupName: group.name,
        };
      }
    }
    const unique = [...new Set(optionIds)];
    const count = unique.length;

    if (group.selectionMode === "single" && count > 1) {
      return {
        ok: false,
        message: `“${group.name}” allows only one selection.`,
        groupId: group.id,
        groupName: group.name,
      };
    }
    if (count < group.minSelect) {
      return {
        ok: false,
        message:
          group.minSelect === 1
            ? `Choose an option for “${group.name}” before submitting.`
            : `“${group.name}” requires at least ${group.minSelect} selections.`,
        groupId: group.id,
        groupName: group.name,
      };
    }
    if (group.maxSelect != null && count > group.maxSelect) {
      return {
        ok: false,
        message: `“${group.name}” allows at most ${group.maxSelect} selections.`,
        groupId: group.id,
        groupName: group.name,
      };
    }
    // Optional with an exact configured count: skip entirely, or satisfy the count.
    // Partial answers (e.g. 1 of 2) must not submit.
    if (
      group.minSelect === 0 &&
      group.maxSelect != null &&
      group.maxSelect > 0 &&
      count > 0 &&
      count < group.maxSelect
    ) {
      return {
        ok: false,
        message: `“${group.name}” requires exactly ${group.maxSelect} selections, or leave it blank to skip.`,
        groupId: group.id,
        groupName: group.name,
      };
    }
  }
  return { ok: true };
}

/**
 * A required group with fewer options than it demands can never be answered,
 * so the couple could never submit or approve. Returns the first such message.
 */
export function unanswerableRequiredGroupMessage(definition: ChoicesDefinition): string | null {
  const optionCount = new Map<string, number>();
  for (const opt of definition.options) {
    optionCount.set(opt.groupId, (optionCount.get(opt.groupId) ?? 0) + 1);
  }
  for (const group of definition.groups) {
    const message = impossibleSelectionGroupMessage(group, optionCount.get(group.id) ?? 0);
    if (message) return message;
  }
  return null;
}

/** Reconcile then validate — preferred before save/submit from UI. */
export function reconcileAndValidateChoicesAnswers(
  definition: ChoicesDefinition,
  answers: ChoicesAnswers | null | undefined,
): ChoicesAnswersValidation & { answers: ChoicesAnswers } {
  const reconciled = reconcileAnswersForDependencies(definition, answers);
  const validated = validateChoicesAnswers(definition, reconciled);
  return { ...validated, answers: reconciled };
}
