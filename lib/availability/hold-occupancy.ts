/**
 * Date Hold occupancy — resources + date + time window.
 *
 * Mirrors event operational-window overlap (windowsOverlap / event_operational_window).
 * Holds do not invent setup/teardown or turnaround; those remain booked-Event rules.
 *
 * Whole venue: empty spaceIds (and null legacy spaceId).
 * Null start/end: all-day 00:00–23:59.
 */

import {
  operationalWindow,
  windowsOverlap,
  type OccupancyEvent,
} from "@/lib/availability/event-occupancy";

export type HoldOccupancyRow = {
  id?: string;
  leadId?: string | null;
  holdDate: string;
  startTime?: string | null;
  endTime?: string | null;
  /** Empty = whole venue. Legacy single spaceId is folded into this set. */
  spaceIds: string[];
};

export function holdSpaceIds(input: {
  spaceIds?: readonly string[] | null;
  spaceId?: string | null;
}): string[] {
  const fromList = (input.spaceIds ?? [])
    .map((id) => id?.trim())
    .filter((id): id is string => !!id);
  if (fromList.length > 0) return [...new Set(fromList)];
  const legacy = input.spaceId?.trim();
  return legacy ? [legacy] : [];
}

export function isWholeVenueHold(spaceIds: readonly string[]): boolean {
  return spaceIds.length === 0;
}

/** Hold occupancy window: start/end only (no setup/teardown). */
export function holdOperationalWindow(hold: {
  startTime?: string | null;
  endTime?: string | null;
}): { start: string; end: string } {
  return operationalWindow({
    setupTime: null,
    startTime: hold.startTime,
    endTime: hold.endTime,
    teardownTime: null,
  });
}

export function eventOccupiedSpaceIds(event: {
  spaceId?: string | null;
  spaceIds?: readonly string[] | null;
}): string[] {
  const fromList = (event.spaceIds ?? [])
    .map((id) => id?.trim())
    .filter((id): id is string => !!id);
  const primary = event.spaceId?.trim();
  const set = new Set(fromList);
  if (primary) set.add(primary);
  return [...set];
}

/**
 * Whether a hold's resources collide with a candidate space set.
 * Whole-venue holds collide with every candidate.
 * Simple venue (max < 2): any hold collides (one venue slot).
 * Simultaneous (max ≥ 2): collide only when space sets intersect, or candidate
 * has no spaces (inquiry / unspecified) against a whole-venue hold only —
 * for inquiry with max≥2, space-specific holds are evaluated per space.
 */
export function holdResourcesCollide(opts: {
  holdSpaceIds: readonly string[];
  candidateSpaceIds: readonly string[];
  effectiveMax: number;
}): boolean {
  const max = opts.effectiveMax < 1 ? 1 : Math.trunc(opts.effectiveMax);
  if (isWholeVenueHold(opts.holdSpaceIds)) return true;
  if (max < 2) return true;
  if (opts.candidateSpaceIds.length === 0) {
    // Preferred-date / inquiry without a space: space-specific holds do not
    // close the whole date; caller checks per-space availability.
    return false;
  }
  return opts.candidateSpaceIds.some((id) => opts.holdSpaceIds.includes(id));
}

export function holdWindowsOverlap(
  hold: { startTime?: string | null; endTime?: string | null },
  candidate: {
    setupTime?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    teardownTime?: string | null;
  },
): boolean {
  return windowsOverlap(holdOperationalWindow(hold), operationalWindow(candidate));
}

export function holdConflictsWithCandidate(
  hold: HoldOccupancyRow,
  candidate: {
    date: string;
    spaceIds?: readonly string[];
    setupTime?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    teardownTime?: string | null;
  },
  effectiveMax: number,
): boolean {
  if (hold.holdDate !== candidate.date) return false;
  if (!holdWindowsOverlap(hold, candidate)) return false;
  return holdResourcesCollide({
    holdSpaceIds: hold.spaceIds,
    candidateSpaceIds: candidate.spaceIds ?? [],
    effectiveMax,
  });
}

/** Active foreign holds that conflict with a booking/preferred-date check. */
export function conflictingForeignHolds(
  holds: HoldOccupancyRow[],
  candidate: {
    date: string;
    spaceIds?: readonly string[];
    setupTime?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    teardownTime?: string | null;
  },
  effectiveMax: number,
  excludeLeadId?: string | null,
): HoldOccupancyRow[] {
  const owner = excludeLeadId?.trim() || null;
  return holds.filter((h) => {
    if (owner && h.leadId === owner) return false;
    return holdConflictsWithCandidate(h, candidate, effectiveMax);
  });
}

/**
 * Inquiry / preferred date with no space: available when at least one active
 * space is free of overlapping holds (and caller still checks event occupancy).
 * Simple venue: any overlapping foreign hold closes the date.
 */
export function inquiryDateBlockedByHolds(
  holds: HoldOccupancyRow[],
  date: string,
  effectiveMax: number,
  activeSpaceIds: readonly string[],
  excludeLeadId?: string | null,
): boolean {
  const max = effectiveMax < 1 ? 1 : Math.trunc(effectiveMax);
  const foreign = holds.filter((h) => {
    const owner = excludeLeadId?.trim() || null;
    if (owner && h.leadId === owner) return false;
    return h.holdDate === date;
  });

  if (foreign.length === 0) return false;

  if (max < 2) {
    return foreign.some((h) =>
      holdConflictsWithCandidate(
        h,
        { date, spaceIds: [], startTime: null, endTime: null },
        max,
      ),
    );
  }

  if (activeSpaceIds.length === 0) return true;

  return !activeSpaceIds.some((spaceId) => {
    const blocked = foreign.some((h) =>
      holdConflictsWithCandidate(
        h,
        { date, spaceIds: [spaceId], startTime: null, endTime: null },
        max,
      ),
    );
    return !blocked;
  });
}

/** Hold vs booked event (for createHold pre-check). */
export function holdConflictsWithBookedEvent(
  hold: HoldOccupancyRow,
  event: OccupancyEvent,
  effectiveMax: number,
): boolean {
  if (event.status === "cancelled") return false;
  const dates: string[] = [];
  const end = event.eventEndDate && event.eventEndDate > event.eventDate
    ? event.eventEndDate
    : event.eventDate;
  const cur = new Date(`${event.eventDate}T12:00:00`);
  const stop = new Date(`${end}T12:00:00`);
  while (cur <= stop) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  if (!dates.includes(hold.holdDate)) return false;
  if (!holdWindowsOverlap(hold, event)) return false;
  return holdResourcesCollide({
    holdSpaceIds: hold.spaceIds,
    candidateSpaceIds: eventOccupiedSpaceIds(event),
    effectiveMax,
  });
}

/** Hold vs other active hold (createHold pre-check). Same lead is included — two holds for one lead conflict only when resources and windows overlap. Same-owner exclusion applies to booking/availability checks, not hold-vs-hold. */
export function holdsConflictWithEachOther(
  a: HoldOccupancyRow,
  b: HoldOccupancyRow,
  effectiveMax: number,
): boolean {
  if (a.holdDate !== b.holdDate) return false;
  if (!windowsOverlap(holdOperationalWindow(a), holdOperationalWindow(b))) return false;
  if (isWholeVenueHold(a.spaceIds) || isWholeVenueHold(b.spaceIds)) return true;
  const max = effectiveMax < 1 ? 1 : Math.trunc(effectiveMax);
  if (max < 2) return true;
  return a.spaceIds.some((id) => b.spaceIds.includes(id));
}

/** Default hold spaces from lead ceremony/reception venue_space preferences. */
export function defaultHoldSpaceIdsFromPreferences(
  prefs: ReadonlyArray<{ preferenceKind: string; spaceId: string | null }>,
): string[] {
  const ids: string[] = [];
  for (const p of prefs) {
    if (p.preferenceKind !== "venue_space") continue;
    const id = p.spaceId?.trim();
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
