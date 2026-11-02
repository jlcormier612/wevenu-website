/**
 * Short “what’s included vs what you choose” summary before couple approve.
 */
import { orderedVisibleChoiceGroups } from "@/lib/client-choices/conditional-groups";
import type { ChoicesAnswers, ChoicesDefinition } from "@/lib/client-choices/types";

export type CoupleApproveSummaryLine = {
  id: string;
  description: string;
};

export type CoupleApproveSummaryChoice = {
  groupId: string;
  groupName: string;
  optionLabels: string[];
};

export type CoupleApproveSummary = {
  included: CoupleApproveSummaryLine[];
  choices: CoupleApproveSummaryChoice[];
};

export function buildCoupleApproveSummary(input: {
  lines: Array<{ id: string; description: string; sectionId: string | null }>;
  definition: ChoicesDefinition | null;
  answers: ChoicesAnswers;
}): CoupleApproveSummary {
  const included = input.lines.map((l) => ({
    id: l.id,
    description: l.description,
  }));

  const choices: CoupleApproveSummaryChoice[] = [];
  if (input.definition) {
    const visible = orderedVisibleChoiceGroups(input.definition, input.answers);
    for (const group of visible) {
      const selectedIds = input.answers[group.id]?.optionIds ?? [];
      if (selectedIds.length === 0) continue;
      const optionLabels = input.definition.options
        .filter((o) => o.groupId === group.id && selectedIds.includes(o.id))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((o) => o.label);
      if (optionLabels.length === 0) continue;
      choices.push({
        groupId: group.id,
        groupName: group.name,
        optionLabels,
      });
    }
  }

  return { included, choices };
}
