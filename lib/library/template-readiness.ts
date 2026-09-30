/**
 * Shared Template readiness — structural unfinished signals only.
 * Do not invent price/token validation; unpriced EO lines remain valid.
 */

export function isEventOrderTemplateUnfinished(
  lineCount: number,
  groupCount = 0,
): boolean {
  return lineCount <= 0 && groupCount <= 0;
}

export function isInventoryTemplateUnfinished(itemCount: number): boolean {
  return itemCount <= 0;
}

export function isChoicesTemplateUnfinished(
  groupCount: number,
  optionCount: number,
): boolean {
  return groupCount <= 0 || optionCount <= 0;
}

export const INCOMPLETE_TEMPLATE_WARNING_TITLE = "This template isn’t finished yet.";
export const INCOMPLETE_TEMPLATE_WARNING_BODY =
  "You can go back and finish it, or apply it anyway.";
