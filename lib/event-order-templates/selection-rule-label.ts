/**
 * Venue- and client-facing selection-rule wording from stored min/max.
 * Optional max-N means up to N, not exactly N or skip.
 */

export type SelectionRuleGroup = {
  selectionMode: "single" | "multi";
  minSelect: number;
  maxSelect: number | null;
  allowQuantity?: boolean;
};

export function selectionRuleLabel(group: SelectionRuleGroup): string {
  const required = group.minSelect > 0;
  const tone = required ? "Required" : "Optional";
  if (group.allowQuantity) {
    return `Choose items and quantities · ${tone}`;
  }
  if (group.selectionMode === "single") {
    return required ? `Choose 1 · ${tone}` : `Choose 1 or skip · ${tone}`;
  }
  const min = group.minSelect;
  const max = group.maxSelect;
  if (required && max != null && min === max) {
    return `Choose ${min} · ${tone}`;
  }
  if (required && max != null) {
    return `Choose ${min}–${max} · ${tone}`;
  }
  if (required && max == null) {
    return `Choose at least ${min} · ${tone}`;
  }
  if (!required && max === 0) {
    return `No selections · ${tone}`;
  }
  if (!required && max != null) {
    return `Choose up to ${max} · ${tone}`;
  }
  return `Choose any · ${tone}`;
}
