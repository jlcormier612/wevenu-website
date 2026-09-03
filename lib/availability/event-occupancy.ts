/**
 * K.7 Phase 2 — Event occupancy rules.
 *
 * Canonical evaluation of whether a dated Event may occupy a venue. The
 * Postgres function `assert_event_availability` must stay aligned with this
 * module. Phase 3 write enforcement is the `events_enforce_availability`
 * trigger, which calls that function in the same transaction as the INSERT/
 * UPDATE. This TypeScript module is a mirror/test seam, not a competing
 * write-path authority.
 *
 * Occupancy truth is `events` (non-cancelled). Not Event status confirmed,
 * not Booking.Confirmed, not calendar_blocks, not holds, not tours.
 * Covering calendar_blocks are a separate Event write constraint (any type,
 * including recurring occurrences), enforced after occupancy locks in
 * `events_enforce_availability` via covering_calendar_block_title. They are
 * not merged into occupancy / capacity.
 */

export type OccupancyCode =
  | "missing_space"
  | "no_spaces"
  | "invalid_space"
  | "space_overlap"
  | "venue_at_capacity"
  | "event_turnaround";

export type OccupancyResult =
  | { ok: true }
  | { ok: false; code: OccupancyCode; message: string };

const OCCUPANCY_CODES: ReadonlySet<string> = new Set([
  "missing_space",
  "no_spaces",
  "invalid_space",
  "space_overlap",
  "venue_at_capacity",
  "event_turnaround",
]);

export function isOccupancyCode(value: string | null | undefined): value is OccupancyCode {
  return !!value && OCCUPANCY_CODES.has(value);
}

/** Raised when a same-transaction occupancy trigger refuses an Event write. */
export class OccupancyWriteError extends Error {
  readonly code: OccupancyCode;
  constructor(code: OccupancyCode, message: string) {
    super(message);
    this.name = "OccupancyWriteError";
    this.code = code;
  }
}

export function occupancyFailureFromUnknown(err: unknown): Extract<OccupancyResult, { ok: false }> | null {
  if (err instanceof OccupancyWriteError) {
    return { ok: false, code: err.code, message: err.message };
  }
  if (!err || typeof err !== "object") return null;
  const e = err as { hint?: unknown; details?: unknown; message?: unknown };
  const hint = typeof e.hint === "string" ? e.hint : "";
  const message = typeof e.message === "string" ? e.message : "";
  if (isOccupancyCode(hint) && message) {
    return { ok: false, code: hint, message };
  }
  if (typeof e.details === "string") {
    try {
      const parsed = JSON.parse(e.details) as { ok?: unknown; code?: unknown; message?: unknown };
      if (parsed && parsed.ok === false && isOccupancyCode(String(parsed.code ?? "")) && typeof parsed.message === "string") {
        return { ok: false, code: parsed.code as OccupancyCode, message: parsed.message };
      }
    } catch {
      // not occupancy JSON
    }
  }
  return null;
}

/** Calendar-block Event write refusal — not an occupancy code. */
export class CalendarBlockWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarBlockWriteError";
  }
}

export function calendarBlockFailureFromUnknown(err: unknown): { message: string } | null {
  if (err instanceof CalendarBlockWriteError) return { message: err.message };
  if (!err || typeof err !== "object") return null;
  const e = err as { hint?: unknown; message?: unknown };
  const hint = typeof e.hint === "string" ? e.hint : "";
  const message = typeof e.message === "string" ? e.message : "";
  if (hint === "calendar_blocked" && message) return { message };
  if (/calendar is blocked/i.test(message)) return { message };
  return null;
}

export type OccupancyEvent = {
  id: string;
  name?: string;
  status: string;
  eventDate: string;
  eventEndDate: string | null;
  spaceId: string | null;
  setupTime: string | null;
  startTime: string | null;
  endTime: string | null;
  teardownTime: string | null;
};

export type OccupancyInput = {
  eventDate: string;
  eventEndDate?: string | null;
  spaceId?: string | null;
  setupTime?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  teardownTime?: string | null;
  excludeEventId?: string | null;
};

export type OccupancyVenue = {
  /** Already resolved: missing venue_capacity_rules row → 1. */
  effectiveMax: number;
  /** Active Event Spaces (Decision 2: zero active spaces + max ≥ 2 → refuse). */
  activeSpaceIds: string[];
  /**
   * All Event Spaces on the venue (assignment validity). Inactive spaces
   * remain assignable when the venue still has at least one active space —
   * an Event already on an inactivated space must still be editable. Zero
   * active spaces is `no_spaces` and blocks new dated Events.
   */
  allSpaceIds: string[];
  /** 0 / missing / negative → no turnaround requirement. */
  minTurnaroundHours?: number;
};

const ALL_DAY_START = "00:00";
const ALL_DAY_END = "23:59";

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

/** HH:MM comparison — lexicographic, matching the occupancy SQL clock window. */
export function normalizeClock(value: string | null | undefined): string | null {
  const raw = blankToNull(value);
  if (!raw) return null;
  return raw.slice(0, 5);
}

/**
 * Operational window: setup/start → end/teardown.
 * All four empty → 00:00–23:59 (occupy the day).
 */
export function operationalWindow(input: {
  setupTime?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  teardownTime?: string | null;
}): { start: string; end: string } {
  return {
    start: normalizeClock(input.setupTime) || normalizeClock(input.startTime) || ALL_DAY_START,
    end: normalizeClock(input.teardownTime) || normalizeClock(input.endTime) || ALL_DAY_END,
  };
}

export function windowsOverlap(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Add minutes to HH:MM. dayOffset is 1 when the result crosses midnight. */
export function addClockMinutes(start: string, minutes: number): { clock: string; dayOffset: number } {
  const norm = normalizeClock(start) || ALL_DAY_START;
  const [h, m] = norm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const dayOffset = Math.floor(total / (24 * 60));
  const rem = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  return {
    clock: `${String(Math.floor(rem / 60)).padStart(2, "0")}:${String(rem % 60).padStart(2, "0")}`,
    dayOffset,
  };
}

export function protectedEndDate(eventDate: string, eventEndDate?: string | null): string {
  const end = blankToNull(eventEndDate);
  return end && end > eventDate ? end : eventDate;
}

/** Inclusive YYYY-MM-DD days from start through coalesce(end, start). */
export function datesInProtectedRange(eventDate: string, eventEndDate?: string | null): string[] {
  const last = protectedEndDate(eventDate, eventEndDate);
  const dates: string[] = [];
  const cur = new Date(`${eventDate}T12:00:00`);
  const stop = new Date(`${last}T12:00:00`);
  while (cur <= stop) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export function dateRangesOverlap(
  aStart: string, aEnd: string | null | undefined,
  bStart: string, bEnd: string | null | undefined,
): boolean {
  const aLast = protectedEndDate(aStart, aEnd);
  const bLast = protectedEndDate(bStart, bEnd);
  return aStart <= bLast && bStart <= aLast;
}

/**
 * Tour vs Event occupancy: the Tour interval overlaps the Event's
 * operational window on a protected day. Same clock-window rule as
 * event_operational_window / windowsOverlap. Touching endpoints do not
 * overlap. Cancelled Events do not occupy. Missing Event times occupy
 * 00:00–23:59 on each protected day.
 */
export function eventOccupancyOverlapsTour(
  event: OccupancyEvent,
  tour: { date: string; startTime: string; durationMinutes: number },
): boolean {
  if (event.status === "cancelled") return false;
  if (!datesInProtectedRange(event.eventDate, event.eventEndDate).includes(tour.date)) {
    return false;
  }
  const eventWin = operationalWindow(event);
  const start = normalizeClock(tour.startTime) || ALL_DAY_START;
  const added = addClockMinutes(start, tour.durationMinutes);
  const tourEnd = added.dayOffset > 0 ? "24:00" : added.clock;
  return windowsOverlap(eventWin, { start, end: tourEnd });
}

/** Decision 4: missing rules row is never unlimited. */
export function effectiveMaxSimultaneousEvents(
  rules: { maxSimultaneousEvents?: number | null } | null | undefined,
): number {
  const n = rules?.maxSimultaneousEvents;
  if (n == null || !Number.isFinite(n) || n < 1) return 1;
  return Math.trunc(n);
}

export function isSimpleOperatingModel(effectiveMax: number): boolean {
  return effectiveMax < 2;
}

/** null / missing / ≤ 0 → no turnaround requirement. Do not invent a default. */
export function effectiveMinTurnaroundHours(
  rules: { minTurnaroundHours?: number | null } | null | undefined,
): number {
  const n = rules?.minTurnaroundHours;
  if (n == null || !Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function clockToMinutes(clock: string): number {
  const [h, m] = (normalizeClock(clock) || ALL_DAY_START).split(":").map(Number);
  return h * 60 + m;
}

/** Calendar-date + HH:MM as minutes from UTC epoch (timezone-naive operational clock). */
export function operationalInstantMinutes(date: string, clock: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  return Math.floor(Date.UTC(y, mo - 1, d, 0, 0) / 60_000) + clockToMinutes(clock);
}

export type OperationalInterval = {
  date: string;
  start: number;
  end: number;
};

export function eventOperationalIntervals(event: {
  eventDate: string;
  eventEndDate?: string | null;
  setupTime?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  teardownTime?: string | null;
}): OperationalInterval[] {
  const win = operationalWindow(event);
  return datesInProtectedRange(event.eventDate, event.eventEndDate).map((date) => ({
    date,
    start: operationalInstantMinutes(date, win.start),
    end: operationalInstantMinutes(date, win.end),
  }));
}

export function formatOperationalInstant(totalMinutes: number): string {
  const ms = totalMinutes * 60_000;
  const iso = new Date(ms).toISOString();
  const date = iso.slice(0, 10);
  const clock = iso.slice(11, 16);
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = clock.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  const month = new Date(Date.UTC(y, mo - 1, d)).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return `${month} ${d} at ${hour12}:${String(mi).padStart(2, "0")} ${ampm}`;
}

function formatTurnaroundHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : String(hours);
}

/**
 * Sequential (non-overlapping) intervals violate turnaround when
 * next_start < prev_end + hours. Touching the boundary is allowed.
 * Returns the later-event constraint when the candidate follows the other.
 */
export function turnaroundViolation(
  candidate: OperationalInterval[],
  other: OperationalInterval[],
  hours: number,
): { earliestStart: number; otherIsBefore: boolean } | null {
  if (hours <= 0) return null;
  const gap = hours * 60;
  let found: { earliestStart: number; otherIsBefore: boolean } | null = null;
  for (const a of candidate) {
    for (const b of other) {
      if (a.start < b.end && b.start < a.end) continue;
      if (b.end <= a.start) {
        const earliest = b.end + gap;
        if (a.start < earliest) {
          if (!found || earliest > found.earliestStart) {
            found = { earliestStart: earliest, otherIsBefore: true };
          }
        }
      } else if (a.end <= b.start) {
        const needed = a.end + gap;
        if (b.start < needed) {
          if (!found) found = { earliestStart: needed, otherIsBefore: false };
        }
      }
    }
  }
  return found;
}

function occupyingEvents(existing: OccupancyEvent[], excludeEventId?: string | null): OccupancyEvent[] {
  return existing.filter((e) => {
    if (e.status === "cancelled") return false;
    if (excludeEventId && e.id === excludeEventId) return false;
    return true;
  });
}

function eventOverlapsCandidate(event: OccupancyEvent, input: OccupancyInput, candidateWindow: { start: string; end: string }): boolean {
  if (!dateRangesOverlap(event.eventDate, event.eventEndDate, input.eventDate, input.eventEndDate)) {
    return false;
  }
  const other = operationalWindow(event);
  return windowsOverlap(candidateWindow, other);
}

export function evaluateEventOccupancy(
  input: OccupancyInput,
  venue: OccupancyVenue,
  existing: OccupancyEvent[],
): OccupancyResult {
  const effectiveMax = venue.effectiveMax < 1 ? 1 : Math.trunc(venue.effectiveMax);
  const spaceId = blankToNull(input.spaceId);
  const simultaneous = effectiveMax >= 2;

  if (simultaneous) {
    if (venue.activeSpaceIds.length === 0) {
      return {
        ok: false,
        code: "no_spaces",
        message: "Add an Event Space in Availability settings before booking. This venue can host more than one event at the same time.",
      };
    }
    if (!spaceId) {
      return {
        ok: false,
        code: "missing_space",
        message: "Assign an Event Space before booking. This venue can host more than one event at the same time.",
      };
    }
    if (!venue.allSpaceIds.includes(spaceId)) {
      return {
        ok: false,
        code: "invalid_space",
        message: "That Event Space does not belong to this venue.",
      };
    }
  }

  const candidateWindow = operationalWindow(input);
  const occupying = occupyingEvents(existing, input.excludeEventId);
  const overlapping: OccupancyEvent[] = [];
  for (const event of occupying) {
    if (eventOverlapsCandidate(event, input, candidateWindow)) overlapping.push(event);
  }

  if (simultaneous && spaceId) {
    const sameSpace = overlapping.find((e) => e.spaceId === spaceId);
    if (sameSpace) {
      const label = sameSpace.name?.trim() || "another event";
      return {
        ok: false,
        code: "space_overlap",
        message: `This space is already booked for "${label}" at an overlapping time.`,
      };
    }
  }

  if (overlapping.length >= effectiveMax) {
    return {
      ok: false,
      code: "venue_at_capacity",
      message: effectiveMax === 1
        ? "This date is already booked for an overlapping event."
        : `Maximum simultaneous events (${effectiveMax}) reached for this time.`,
    };
  }

  const turnaroundHours = effectiveMinTurnaroundHours({
    minTurnaroundHours: venue.minTurnaroundHours,
  });
  if (turnaroundHours > 0) {
    const candidateIntervals = eventOperationalIntervals(input);
    for (const event of occupying) {
      if (simultaneous && spaceId && event.spaceId !== spaceId) continue;
      const violation = turnaroundViolation(
        candidateIntervals,
        eventOperationalIntervals(event),
        turnaroundHours,
      );
      if (violation) {
        const label = event.name?.trim() || "another event";
        const hoursLabel = formatTurnaroundHours(turnaroundHours);
        let message = `This event is too close to "${label}". A ${hoursLabel}-hour turnaround is required between events.`;
        if (violation.otherIsBefore) {
          message += ` The earliest available start is ${formatOperationalInstant(violation.earliestStart)}.`;
        }
        return { ok: false, code: "event_turnaround", message };
      }
    }
  }

  return { ok: true };
}

/**
 * Date-level inquiry / choose_available check: would a dated Event occupying
 * this calendar day (missing times → 00:00–23:59) be refused by occupancy?
 *
 * Simultaneous venues: available if at least one active Event Space would
 * accept a full-day Event. Zero active spaces → unavailable (`no_spaces`).
 * Does not create an Event. Calendar blocks are a separate check.
 */
export function isInquiryEventDateAvailable(
  date: string,
  venue: OccupancyVenue,
  existing: OccupancyEvent[],
): boolean {
  const simultaneous = (venue.effectiveMax < 1 ? 1 : Math.trunc(venue.effectiveMax)) >= 2;
  if (simultaneous) {
    if (venue.activeSpaceIds.length === 0) return false;
    return venue.activeSpaceIds.some((spaceId) =>
      evaluateEventOccupancy({ eventDate: date, spaceId }, venue, existing).ok,
    );
  }
  return evaluateEventOccupancy({ eventDate: date }, venue, existing).ok;
}
