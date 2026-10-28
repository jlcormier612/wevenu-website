/**
 * Couple-facing selection progress + max-capacity helpers.
 * Uses frozen ChoicesDefinition group rules (minSelect / maxSelect / selectionMode).
 */
import type { ChoicesDefinitionGroup } from "@/lib/client-choices/types";

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
 * Examples:
 * - Choose exactly 2 — 0 of 2 selected
 * - Choose exactly 3 — 2 of 3 selected
 * - Choose 2–4 — 3 selected
 * - Optional — choose up to 2 — 1 selected
 * - Pick one · required — 1 of 1 selected
 */
export function selectionProgressLabel(
  group: Pick<ChoicesDefinitionGroup, "selectionMode" | "minSelect" | "maxSelect">,
  selectedCount: number,
): string {
  const count = Math.max(0, selectedCount);

  if (group.selectionMode === "single") {
    const required = group.minSelect > 0;
    const base = required ? "Pick one · required" : "Optional — choose up to 1";
    return `${base} — ${count} of 1 selected`;
  }

  const min = group.minSelect;
  const max = group.maxSelect;

  if (min > 0 && max != null && min === max) {
    return `Choose exactly ${min} — ${count} of ${min} selected`;
  }
  if (min > 0 && max != null) {
    return `Choose ${min}–${max} — ${count} selected`;
  }
  if (min > 0 && max == null) {
    return `Choose at least ${min} — ${count} selected`;
  }
  if (min === 0 && max != null) {
    return `Optional — choose up to ${max} — ${count} of ${max} selected`;
  }
  return `Optional — choose any — ${count} selected`;
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
    requirementMet: count >= group.minSelect,
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
