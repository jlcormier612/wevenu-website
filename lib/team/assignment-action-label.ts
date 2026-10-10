/**
 * Label from the persisted assignment only:
 * saved owner → "Edit assignment"; none → "Save assignment".
 * An unsaved dropdown change must not flip the label.
 */
export function assignmentActionLabel(
  persistedStaffId: string | null | undefined,
): "Edit assignment" | "Save assignment" {
  return persistedStaffId?.trim() ? "Edit assignment" : "Save assignment";
}
