/**
 * Venue-local scheduling for Automation step offsets and related delayed sends.
 *
 * "N days later" means N calendar days on the venue's clock, at a predictable
 * morning send time — not N × 24h from the enrollment instant in UTC.
 * Offset 0 stays immediate (acknowledgment / same-moment follow-up).
 */
import { utcToVenueLocalParts, venueLocalToUtcIso } from "@/lib/venue/timezone";

/** Default local wall-clock for delayed Automation / relationship follow-ups. */
export const AUTOMATION_DEFAULT_SEND_TIME = "10:00";

/** Add whole calendar days to a YYYY-MM-DD string (UTC date arithmetic). */
export function addCalendarDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Instant for a delayed send: venue-local calendar day of `from` + offsetDays,
 * at `sendTime` in the venue timezone. Offset ≤ 0 returns `from` unchanged.
 */
export function computeDelayedSendIso(
  from: Date,
  offsetDays: number,
  timezone: string | null,
  sendTime: string = AUTOMATION_DEFAULT_SEND_TIME,
): string {
  if (offsetDays <= 0) return from.toISOString();
  const { date } = utcToVenueLocalParts(from.toISOString(), timezone);
  const targetDate = addCalendarDays(date, offsetDays);
  return venueLocalToUtcIso(targetDate, sendTime, timezone);
}

/**
 * Absolute send times for each Automation step, chained from enrollment.
 * Each step's offset is relative to the previous step's scheduled instant
 * (or enrollment for the first step) — same product rule as before, with
 * venue calendar days instead of fixed 86400000 ms chunks.
 */
export function computeEnrollmentStepScheduleIsos(
  steps: ReadonlyArray<{ offsetDays: number }>,
  enrolledAt: Date,
  timezone: string | null,
): string[] {
  const out: string[] = [];
  let cursor = enrolledAt;
  for (const step of steps) {
    const whenIso = computeDelayedSendIso(cursor, step.offsetDays, timezone);
    out.push(whenIso);
    cursor = new Date(whenIso);
  }
  return out;
}
