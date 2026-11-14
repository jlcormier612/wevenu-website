/**
 * Apply-sheet copy for a template section: fixed Event Order lines vs
 * client-selectable choice groups vs a genuinely empty category.
 * Presentation only — does not change apply architecture or pricing.
 */

export function applySectionAbsenceCopy(lineCount: number, choiceGroupCount: number): string {
  if (choiceGroupCount > 0) {
    const groups =
      choiceGroupCount === 1
        ? "1 choice group"
        : `${choiceGroupCount} choice groups`;
    return `Clients choose options in ${groups} here. Applying adds this category — it does not pick their options or create an invoice.`;
  }
  return "This category has no Event Order lines and no client choice groups yet.";
}

export function applySectionChoiceNote(choiceGroupCount: number): string | null {
  if (choiceGroupCount <= 0) return null;
  const groups =
    choiceGroupCount === 1
      ? "1 choice group"
      : `${choiceGroupCount} choice groups`;
  return `Clients also choose options in ${groups} after you send selections.`;
}

export function applyTemplateStructureCopy(lineCount: number, choiceGroupCount: number): string | null {
  if (lineCount > 0) return null;
  if (choiceGroupCount > 0) {
    return "This plan uses client selections rather than fixed Event Order lines. Applying adds the categories. Send selections when you want the couple to choose — that is not an invoice.";
  }
  return "This template has categories but no Event Order lines and no client choice groups yet. Applying adds those categories to the Event Order.";
}
