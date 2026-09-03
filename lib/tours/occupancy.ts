/**
 * K.7 Phase 4 — Tour capacity rules.
 *
 * Canonical evaluation of whether a Tour appointment may occupy a venue.
 * Postgres `_is_tour_slot_blocked` / `tour_appointments_enforce_availability`
 * is write-path authority. This module is a mirror/test seam, not a
 * competing write-path.
 *
 * Tours are not Events. Capacity is venue_capacity_rules.max_simultaneous_tours
 * only. Occupancy truth is tour_appointments with status distinct from
 * cancelled. Interval overlap is duration-based; touching endpoints do not
 * overlap. Buffer is a slot-generation step, not an overlap widening.
 *
 * Event conflict uses Phase 2 event_operational_window on each protected
 * day — not a date-only Event-day closure.
 */
import {
  addClockMinutes,
  normalizeClock,
} from "@/lib/availability/event-occupancy";

export type TourCapacityCode = "tour_at_capacity";

export type TourCapacityResult =
  | { ok: true }
  | { ok: false; code: TourCapacityCode; message: string };

const TOUR_CAPACITY_CODES: ReadonlySet<string> = new Set(["tour_at_capacity"]);

export const TOUR_CAPACITY_REFUSAL = "This tour time is no longer available.";

export function isTourCapacityCode(value: string | null | undefined): value is TourCapacityCode {
  return !!value && TOUR_CAPACITY_CODES.has(value);
}

export class TourCapacityWriteError extends Error {
  readonly code: TourCapacityCode;
  constructor(code: TourCapacityCode, message: string) {
    super(message);
    this.name = "TourCapacityWriteError";
    this.code = code;
  }
}

export function tourCapacityFailureFromUnknown(err: unknown): Extract<TourCapacityResult, { ok: false }> | null {
  if (err instanceof TourCapacityWriteError) {
    return { ok: false, code: err.code, message: err.message };
  }
  if (!err || typeof err !== "object") return null;
  const e = err as { hint?: unknown; details?: unknown; message?: unknown };
  const hint = typeof e.hint === "string" ? e.hint : "";
  const message = typeof e.message === "string" ? e.message : "";
  if (isTourCapacityCode(hint) && message) {
    return { ok: false, code: hint, message };
  }
  if (/no longer available/i.test(message)) {
    return { ok: false, code: "tour_at_capacity", message: TOUR_CAPACITY_REFUSAL };
  }
  return null;
}

export function effectiveMaxSimultaneousTours(
  rules: { maxSimultaneousTours?: number | null } | null | undefined,
): number {
  const n = rules?.maxSimultaneousTours;
  if (n == null || !Number.isFinite(n) || n < 1) return 1;
  return n;
}

export type TourInterval = {
  id?: string;
  status: string;
  scheduledAtMs: number;
  durationMinutes: number;
};

/** Existing write-path overlap: start < otherEnd AND otherStart < end. */
export function tourIntervalsOverlap(a: TourInterval, b: TourInterval): boolean {
  const aEnd = a.scheduledAtMs + a.durationMinutes * 60_000;
  const bEnd = b.scheduledAtMs + b.durationMinutes * 60_000;
  return a.scheduledAtMs < bEnd && b.scheduledAtMs < aEnd;
}

export function occupyingTour(status: string): boolean {
  return status !== "cancelled";
}

export function evaluateTourCapacity(input: {
  rules: { maxSimultaneousTours?: number | null } | null | undefined;
  existing: TourInterval[];
  candidate: TourInterval;
  excludeId?: string | null;
}): TourCapacityResult {
  const max = effectiveMaxSimultaneousTours(input.rules);
  const overlapping = input.existing.filter((t) => {
    if (!occupyingTour(t.status)) return false;
    if (input.excludeId && t.id === input.excludeId) return false;
    if (input.candidate.id && t.id === input.candidate.id) return false;
    return tourIntervalsOverlap(t, input.candidate);
  });
  if (overlapping.length >= max) {
    return { ok: false, code: "tour_at_capacity", message: TOUR_CAPACITY_REFUSAL };
  }
  return { ok: true };
}

/** UTC wall-clock date+time of a timestamptz, matching `_tour_slot_fits_window`. */
export function utcClockFromMs(ms: number): { date: string; time: string } {
  const iso = new Date(ms).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export type TourWindow = { dayOfWeek: number; startTime: string; endTime: string };

/**
 * Write-path `_tour_slot_fits_window`: the Tour duration must sit entirely
 * inside a configured window on that UTC weekday. Crossing midnight fails.
 * Buffer is not applied here.
 */
export function tourFitsAvailabilityWindow(opts: {
  date: string;
  startTime: string;
  durationMinutes: number;
  windows: TourWindow[];
}): boolean {
  const start = normalizeClock(opts.startTime);
  if (!start || opts.durationMinutes <= 0) return false;
  const added = addClockMinutes(start, opts.durationMinutes);
  if (added.dayOffset !== 0) return false;
  const [y, mo, d] = opts.date.split("-").map(Number);
  if (!y || !mo || !d) return false;
  const dow = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).getUTCDay();
  return opts.windows.some((w) => {
    if (w.dayOfWeek !== dow) return false;
    const ws = normalizeClock(w.startTime);
    const we = normalizeClock(w.endTime);
    if (!ws || !we) return false;
    return start >= ws && added.clock <= we;
  });
}
