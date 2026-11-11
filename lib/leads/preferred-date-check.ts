/**
 * Pure helpers for New Lead preferred-date availability UX.
 * Availability interpretation stays in checkAvailability / buildAvailabilityConflicts.
 */
import type { AvailabilityStatus, ConflictItem } from "@/lib/availability/types";

export const PREFERRED_EVENT_DATE_LABEL = "Preferred event date";

export const PREFERRED_EVENT_DATE_HINT =
  "This is the date the prospect prefers. It does not reserve or book the date.";

export function blockingPreferredDateConflicts(
  status: AvailabilityStatus | null | undefined,
): ConflictItem[] {
  if (!status) return [];
  return status.conflicts.filter((c) => c.severity === "error");
}

/** Drop a late response when a newer date check was started. */
export function isStalePreferredDateResult(
  requestId: number,
  latestRequestId: number,
  resultDate: string,
  currentDate: string,
): boolean {
  return requestId !== latestRequestId || resultDate !== currentDate;
}

/**
 * Save may skip the soft dialog only when the user already acknowledged
 * conflicts for this exact preferred date.
 */
export function saveMaySkipPreferredDateDialog(opts: {
  date: string;
  acknowledgedDate: string | null;
  blocking: ConflictItem[];
}): boolean {
  if (opts.blocking.length === 0) return true;
  return opts.acknowledgedDate === opts.date;
}

export function preferredDateOverrideValid(
  acknowledgedDate: string | null,
  currentDate: string,
): boolean {
  return !!acknowledgedDate && acknowledgedDate === currentDate;
}
