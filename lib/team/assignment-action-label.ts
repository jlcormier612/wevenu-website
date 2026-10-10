/**
 * Explicit-save owner assignment button label.
 *
 * Prefer "Edit/Save Assignment" when it fits one line; otherwise "Edit/Save".
 * Label does not depend on dirty vs clean selection — persistence still
 * requires an explicit click. Auto-save / one-shot flows must not use this.
 */
export type AssignmentActionLabel = "Edit/Save Assignment" | "Edit/Save";

/** Full label when width allows; short fallback for narrow controls. */
export function assignmentActionLabel(
  _persistedStaffId?: string | null | undefined,
  opts?: { compact?: boolean },
): AssignmentActionLabel {
  if (opts?.compact) return "Edit/Save";
  return "Edit/Save Assignment";
}

/** Minimum control width (px) that can hold the full label on one line. */
export const ASSIGNMENT_FULL_LABEL_MIN_WIDTH_PX = 148;
