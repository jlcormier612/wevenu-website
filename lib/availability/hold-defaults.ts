/**
 * Date hold defaults — desired event date is the authoritative source when
 * placing a hold from a lead. Hold date is a calendar date (YYYY-MM-DD),
 * not a timestamp; do not reparse through Date/timezone converters.
 */

/** Returns YYYY-MM-DD when `desiredEventDate` is a valid calendar date; otherwise "". */
export function defaultHoldDateFromDesiredEventDate(
  desiredEventDate: string | null | undefined,
): string {
  if (typeof desiredEventDate !== "string") return "";
  const trimmed = desiredEventDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "";
  const [y, m, d] = trimmed.split("-").map(Number);
  if (!y || !m || !d) return "";
  // Reject impossible calendar dates without timezone shifting.
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    return "";
  }
  return trimmed;
}
