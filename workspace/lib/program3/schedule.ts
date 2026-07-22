/**
 * Absolute vs relative scheduling for sequence (and workflow) steps.
 * Default timezone: America/New_York.
 */

export const DEFAULT_SEQUENCE_TIMEZONE = "America/New_York";

export type ScheduleMode = "relative" | "absolute";

/** Normalize datetime-local / ISO local strings to `YYYY-MM-DDTHH:mm:ss`. */
export function normalizeLocalDateTime(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return new Date(trimmed).toISOString();
  }
  const [datePart, timePart = "00:00:00"] = trimmed.split("T");
  const time = timePart.length === 5 ? `${timePart}:00` : timePart.slice(0, 8);
  return `${datePart}T${time}`;
}

/**
 * Convert a wall-clock datetime in `timeZone` to a UTC ISO string.
 * Accepts `YYYY-MM-DDTHH:mm`, `YYYY-MM-DDTHH:mm:ss`, or a full ISO with offset/Z.
 */
export function zonedLocalToUtcIso(
  localDateTime: string,
  timeZone: string = DEFAULT_SEQUENCE_TIMEZONE,
): string {
  const trimmed = localDateTime.trim();
  if (!trimmed) return new Date().toISOString();

  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return new Date(trimmed).toISOString();
  }

  const normalized = normalizeLocalDateTime(trimmed);
  const [datePart, timePart = "00:00:00"] = normalized.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second = 0] = timePart.split(":").map(Number);

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second || 0);
  const offsetMs = tzOffsetMs(new Date(utcGuess), timeZone);
  // Desired local = UTC + offset → UTC = local_as_utc_components - offset
  return new Date(utcGuess - offsetMs).toISOString();
}

/** Format a UTC instant as datetime-local value in the given timezone. */
export function utcIsoToZonedLocalInput(
  iso: string,
  timeZone: string = DEFAULT_SEQUENCE_TIMEZONE,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  let hour = get("hour");
  if (hour === 24) hour = 0;
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
  return asIfUtc - date.getTime();
}

export function addHoursIso(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Compute when a step should fire.
 * - absolute: wall clock in timezone → UTC (fixed calendar moment)
 * - relative: baseInstant + delayHours
 */
export function computeScheduledFor(opts: {
  scheduleMode: ScheduleMode;
  delayHours?: number;
  absoluteAt?: string;
  timezone?: string;
  /** Enrollment time or previous step completedAt — base for relative delays. */
  baseInstant: string;
}): string {
  const tz = opts.timezone || DEFAULT_SEQUENCE_TIMEZONE;
  if (opts.scheduleMode === "absolute" && opts.absoluteAt) {
    return zonedLocalToUtcIso(opts.absoluteAt, tz);
  }
  return addHoursIso(opts.baseInstant, opts.delayHours ?? 0);
}
