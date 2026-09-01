/**
 * Schedule-item recurrence expansion.
 *
 * Extracted from lib/calendar/service.ts's inline block-expansion loop so the
 * rules are testable on their own and so Month/Week/Day/Agenda cannot drift
 * apart by each re-deriving them.
 *
 * Two things this fixes about the original inline version:
 *
 *   1. It only understood daily/weekly/annual at a fixed interval of one,
 *      with an optional end date. "Every two weeks," "every month," and "ten
 *      times, then stop" were not expressible.
 *   2. It did date arithmetic with `new Date(iso + "T12:00:00")` (server-local)
 *      and read dates back with `.toISOString().slice(0, 10)` (UTC). The noon
 *      anchor hid the mismatch for most zones but not all, and it made the
 *      expansion quietly dependent on the server's timezone. Everything here
 *      is plain UTC arithmetic on calendar dates, which is what a `date`
 *      column holds — a schedule item on the 14th is on the 14th regardless of
 *      where the process runs.
 */
import type { RecurrenceRule } from "@/lib/availability/types";

export type RecurrenceSpec = {
  rule: RecurrenceRule;
  /** "Every N" multiplier. Values below 1 are treated as 1. */
  interval: number;
  /** Inclusive last date the series may start on. Mutually exclusive with count. */
  endsOn: string | null;
  /** Total number of occurrences, counted from the first. Mutually exclusive with endsOn. */
  count: number | null;
};

/**
 * A repeating item with no end condition still has to stop being generated
 * somewhere. Expansion is always bounded by the requested window, so this cap
 * only guards against a pathological spec (a daily series whose start is
 * decades before the window) burning CPU — it is never reached in normal use.
 */
const MAX_ITERATIONS = 10_000;

function toUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function toIso(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function addDays(ms: number, n: number): number {
  return ms + n * 86_400_000;
}

/**
 * Month/year steps land on the same day-of-month, clamped to the last day of
 * a shorter target month — Jan 31 monthly gives Feb 28, not Mar 3, and Feb 29
 * annually gives Feb 28 in common years. Clamping (rather than overflowing)
 * is what every calendar application does and what a coordinator means by
 * "the 31st of each month."
 */
function addMonths(ms: number, n: number): number {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const targetY = y + Math.floor((m + n) / 12);
  const targetM = ((m + n) % 12 + 12) % 12;
  const daysInTarget = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
  return Date.UTC(targetY, targetM, Math.min(day, daysInTarget));
}

/**
 * Every occurrence START date whose span overlaps [windowStart, windowEnd].
 *
 * `durationDays` is the item's own length (0 for a single-day item), so a
 * multi-day item that begins before the window but runs into it is still
 * returned — otherwise a week-long block would vanish from the month it ends in.
 */
export function expandOccurrenceStarts(
  startDate: string,
  spec: RecurrenceSpec,
  windowStart: string,
  windowEnd: string,
  durationDays = 0,
): string[] {
  if (!startDate) return [];

  const first = toUtc(startDate);
  const winStart = toUtc(windowStart);
  const winEnd = toUtc(windowEnd);
  const span = Math.max(0, durationDays) * 86_400_000;

  if (spec.rule === "none") {
    return first <= winEnd && first + span >= winStart ? [toIso(first)] : [];
  }

  const interval = Math.max(1, Math.trunc(spec.interval || 1));
  const hardEnd = spec.endsOn ? toUtc(spec.endsOn) : null;
  const maxCount = spec.count && spec.count > 0 ? Math.trunc(spec.count) : null;

  const starts: string[] = [];
  let cursor = first;
  let emitted = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // Stop conditions are evaluated against every occurrence, including ones
    // that fall before the window — an "after 10 times" series must count the
    // occurrences the caller never sees, or a later window would keep
    // producing an eleventh.
    if (hardEnd !== null && cursor > hardEnd) break;
    if (maxCount !== null && emitted >= maxCount) break;
    if (cursor > winEnd) break;

    if (cursor + span >= winStart) starts.push(toIso(cursor));
    emitted++;

    if (spec.rule === "daily") cursor = addDays(cursor, interval);
    else if (spec.rule === "weekly") cursor = addDays(cursor, 7 * interval);
    else if (spec.rule === "monthly") cursor = addMonths(cursor, interval);
    else if (spec.rule === "annual") cursor = addMonths(cursor, 12 * interval);
    else break;
  }

  return starts;
}

/** Whole days from start to end inclusive-of-span (a single-day item is 0). */
export function durationInDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  return Math.max(0, Math.round((toUtc(endDate) - toUtc(startDate)) / 86_400_000));
}

/** Every date an occurrence covers, from its start through its span. */
export function occurrenceDates(startIso: string, durationDays: number): string[] {
  const start = toUtc(startIso);
  const out: string[] = [];
  for (let i = 0; i <= Math.max(0, durationDays); i++) out.push(toIso(addDays(start, i)));
  return out;
}

const RULE_NOUN: Record<Exclude<RecurrenceRule, "none">, string> = {
  daily: "day", weekly: "week", monthly: "month", annual: "year",
};

/** Plain-language summary of a recurrence, for the form's own confirmation line. */
export function describeRecurrence(spec: RecurrenceSpec): string {
  if (spec.rule === "none") return "Does not repeat";
  const interval = Math.max(1, Math.trunc(spec.interval || 1));
  const noun = RULE_NOUN[spec.rule];
  const every = interval === 1 ? `Every ${noun}` : `Every ${interval} ${noun}s`;
  if (spec.count && spec.count > 0) return `${every}, ${spec.count} time${spec.count === 1 ? "" : "s"}`;
  if (spec.endsOn) return `${every}, until ${spec.endsOn}`;
  return every;
}
