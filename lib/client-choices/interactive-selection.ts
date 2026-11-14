/**
 * In-memory selection mutations for the couple Choices runtime.
 * Used by the portal and by Preview as Client. Does not persist.
 */
import { reconcileAnswersForDependencies } from "@/lib/client-choices/conditional-groups";
import {
  isAtSelectionMaximum,
  selectionMaximumReachedMessage,
} from "@/lib/client-choices/selection-progress";
import type { ChoicesAnswers, ChoicesDefinition } from "@/lib/client-choices/types";

export type ToggleChoiceResult = {
  answers: ChoicesAnswers;
  blockedMessage: string | null;
};

export function toggleChoiceOption(
  definition: ChoicesDefinition,
  answers: ChoicesAnswers,
  groupId: string,
  optionId: string,
): ToggleChoiceResult {
  const group = definition.groups.find((g) => g.id === groupId);
  if (!group) return { answers, blockedMessage: null };
  const current = answers[groupId]?.optionIds ?? [];
  const alreadySelected = current.includes(optionId);
  if (
    group.selectionMode === "multi"
    && !alreadySelected
    && isAtSelectionMaximum(group, current.length)
  ) {
    return { answers, blockedMessage: selectionMaximumReachedMessage(group) };
  }

  let nextIds: string[];
  if (group.selectionMode === "single") {
    nextIds = alreadySelected ? [] : [optionId];
  } else {
    nextIds = alreadySelected
      ? current.filter((id) => id !== optionId)
      : [...current, optionId];
  }
  const quantities = { ...(answers[groupId]?.quantities ?? {}) };
  if (!nextIds.includes(optionId)) delete quantities[optionId];
  const tentative: ChoicesAnswers = {
    ...answers,
    [groupId]: {
      ...answers[groupId],
      optionIds: nextIds,
      ...(Object.keys(quantities).length > 0 ? { quantities } : {}),
    },
  };
  return {
    answers: reconcileAnswersForDependencies(definition, tentative),
    blockedMessage: null,
  };
}

export function setChoiceOptionQuantity(
  definition: ChoicesDefinition,
  answers: ChoicesAnswers,
  groupId: string,
  optionId: string,
  quantity: number,
): ChoicesAnswers {
  const group = definition.groups.find((g) => g.id === groupId);
  if (!group?.allowQuantity) return answers;
  const current = answers[groupId] ?? { optionIds: [] };
  if (!current.optionIds.includes(optionId)) return answers;
  const nextQty = Math.max(1, Math.trunc(Number(quantity) || 1));
  const tentative: ChoicesAnswers = {
    ...answers,
    [groupId]: {
      ...current,
      quantities: { ...current.quantities, [optionId]: nextQty },
    },
  };
  return reconcileAnswersForDependencies(definition, tentative);
}
