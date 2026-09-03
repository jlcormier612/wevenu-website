/**
 * Historical cutover records use existing Event status `complete` (past
 * dates only) after an explicit human review — never a silent occupancy skip.
 */
export const HISTORICAL_RECORD_ELIGIBLE = "historical_record_eligible";

export const HISTORICAL_RECORD_LABEL =
  "Import as historical record — will not affect future availability.";

export function utcTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isPastEventDate(eventDate: string | null | undefined, today = utcTodayIso()): boolean {
  if (!eventDate?.trim()) return false;
  return eventDate.trim().slice(0, 10) < today;
}

export function historicalRecordReviewMessage(engineMessage: string): string {
  return `${HISTORICAL_RECORD_ELIGIBLE}: ${HISTORICAL_RECORD_LABEL} (${engineMessage})`;
}

export function isHistoricalRecordEligibleError(errors: string[] | null | undefined): boolean {
  return (errors ?? []).some((e) => e.includes(HISTORICAL_RECORD_ELIGIBLE));
}

const LIVE_AVAILABILITY_CONFLICT = /already booked|not available|Assign an Event Space|calendar is blocked|No Event Space named|space is already booked|Maximum simultaneous|missing_space|invalid_space|no_spaces|venue_at_capacity|space_overlap/i;

/** Future/live occupancy, space, or block failures — never "Import anyway". */
export function isLiveAvailabilityConflictError(errors: string[] | null | undefined): boolean {
  if (isHistoricalRecordEligibleError(errors)) return false;
  return (errors ?? []).some((e) => LIVE_AVAILABILITY_CONFLICT.test(e));
}
