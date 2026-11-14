/**
 * Couple-facing selection progress + max-capacity helpers.
 * Uses frozen ChoicesDefinition group rules (minSelect / maxSelect / selectionMode).
 */
import type { ChoicesDefinitionGroup } from "@/lib/client-choices/types";
import { selectionRuleLabel } from "@/lib/event-order-templates/selection-rule-label";

export type SelectionProgress = {
  /** Short rule + live count for the group header. */
  label: string;
  selectedCount: number;
  /** True when another unselected option must not be added. */
  atMaximum: boolean;
  /** True when selectedCount meets min (or group has no min). */
  requirementMet: boolean;
};

/** Whether selecting one more option would exceed maxSelect. */
export function isAtSelectionMaximum(
  group: Pick<ChoicesDefinitionGroup, "selectionMode" | "maxSelect">,
  selectedCount: number,
): boolean {
  if (group.selectionMode === "single") return selectedCount >= 1;
  if (group.maxSelect == null) return false;
  return selectedCount >= group.maxSelect;
}

/**
 * Live progress wording from the configured rule.
 * Optional max-N allows 0 through N.
 */
export function selectionProgressLabel(
  group: Pick<ChoicesDefinitionGroup, "selectionMode" | "minSelect" | "maxSelect">,
  selectedCount: number,
): string {
  const count = Math.max(0, selectedCount);
  const base = selectionRuleLabel(group);
  if (group.selectionMode === "single") {
    return `${base} — ${count} of 1 selected`;
  }
  const max = group.maxSelect;
  if (group.minSelect > 0 && max != null && group.minSelect === max) {
    return `${base} — ${count} of ${max} selected`;
  }
  if (group.minSelect === 0 && max != null && max > 0) {
    return `${base} — ${count} of ${max} selected`;
  }
  return `${base} — ${count} selected`;
}

function isSelectionRequirementMet(
  group: Pick<ChoicesDefinitionGroup, "minSelect" | "maxSelect">,
  count: number,
): boolean {
  if (count < group.minSelect) return false;
  if (group.maxSelect != null && count > group.maxSelect) return false;
  return true;
}

export function selectionProgressForGroup(
  group: Pick<ChoicesDefinitionGroup, "selectionMode" | "minSelect" | "maxSelect">,
  selectedCount: number,
): SelectionProgress {
  const count = Math.max(0, selectedCount);
  return {
    label: selectionProgressLabel(group, count),
    selectedCount: count,
    atMaximum: isAtSelectionMaximum(group, count),
    requirementMet: isSelectionRequirementMet(group, count),
  };
}

/** Message when the couple tries to exceed max without deselecting first. */
export function selectionMaximumReachedMessage(
  group: Pick<ChoicesDefinitionGroup, "name" | "maxSelect" | "selectionMode" | "minSelect">,
): string {
  if (group.selectionMode === "single") {
    return `“${group.name}” allows only one selection. Deselect the current choice to pick a different one.`;
  }
  const max = group.maxSelect;
  if (max == null) return `“${group.name}” cannot accept another selection.`;
  if (group.minSelect > 0 && group.minSelect === max) {
    return `“${group.name}” is limited to ${max} selections. Deselect one to choose a different option.`;
  }
  return `“${group.name}” allows at most ${max} selections. Deselect one to choose a different option.`;
}
