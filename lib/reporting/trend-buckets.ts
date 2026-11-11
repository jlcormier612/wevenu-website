/**
 * Adaptive reporting trend granularity.
 *
 * Charts previously always used calendar months, so "This Month" rendered a
 * single enormous bar. Bucket by day / week / month from the selected window
 * while still including zero-activity periods.
 */

export type TrendGranularity = "day" | "week" | "month";

export type TrendBucket = {
  /** Stable grouping key (YYYY-MM-DD for day/week start, YYYY-MM for month). */
  key: string;
  label: string;
  granularity: TrendGranularity;
};

function parseDateOnly(iso: string): Date {
  // Local calendar date — matches resolveDateRange / report windows.
  return new Date(`${iso.slice(0, 10)}T12:00:00`);
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inclusive day count between YYYY-MM-DD bounds. */
export function inclusiveDayCount(from: string, to: string): number {
  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/**
 * Choose readable granularity for the selected range.
 * Defaults (date range stays independent of this choice):
 * - ≤ 7 days → day
 * - ≤ 120 days (This/Last Month, ~90 days) → week
 * - longer (6–12 months, year) → month
 */
export function resolveTrendGranularity(from: string, to: string): TrendGranularity {
  const days = inclusiveDayCount(from, to);
  if (days <= 7) return "day";
  if (days <= 120) return "week";
  return "month";
}

/** Granularity options that remain meaningful for the selected window. */
export function availableTrendGranularities(
  from: string,
  to: string,
): TrendGranularity[] {
  const days = inclusiveDayCount(from, to);
  const options: TrendGranularity[] = [];
  // Day is only useful when the window is short enough that bars stay readable.
  if (days <= 62) options.push("day");
  if (days >= 8 && days <= 210) options.push("week");
  if (days >= 28) options.push("month");
  // Always expose at least the auto default.
  const auto = resolveTrendGranularity(from, to);
  if (!options.includes(auto)) options.unshift(auto);
  return options.length > 0 ? options : [auto];
}

export function parseTrendGranularity(
  raw: string | null | undefined,
  from: string,
  to: string,
): TrendGranularity {
  const allowed = availableTrendGranularities(from, to);
  if (raw === "day" || raw === "week" || raw === "month") {
    if (allowed.includes(raw)) return raw;
  }
  return resolveTrendGranularity(from, to);
}

function startOfWeekSunday(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function dayLabel(d: Date, includeYear: boolean): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  });
}

function weekLabel(start: Date, endInclusive: Date): string {
  const sameMonth = start.getMonth() === endInclusive.getMonth();
  const left = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const right = endInclusive.toLocaleDateString("en-US", {
    month: sameMonth ? undefined : "short",
    day: "numeric",
  });
  return `${left}–${right}`;
}

function monthLabel(d: Date, includeYear: boolean): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  });
}

/** Every bucket from `from` to `to` inclusive for the chosen (or auto) granularity. */
export function buildTrendBuckets(
  from: string,
  to: string,
  granularity: TrendGranularity = resolveTrendGranularity(from, to),
): TrendBucket[] {
  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  const buckets: TrendBucket[] = [];
  const spanDays = inclusiveDayCount(from, to);
  const includeYear = start.getFullYear() !== end.getFullYear() || spanDays > 180;

  if (granularity === "day") {
    const cursor = new Date(start);
    let guard = 0;
    while (cursor <= end && guard < 62) {
      buckets.push({
        key: isoDate(cursor),
        label: dayLabel(cursor, includeYear),
        granularity,
      });
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
    return buckets;
  }

  if (granularity === "week") {
    let cursor = startOfWeekSunday(start);
    let guard = 0;
    while (cursor <= end && guard < 30) {
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const clippedEnd = weekEnd > end ? end : weekEnd;
      buckets.push({
        key: isoDate(cursor),
        label: weekLabel(cursor, clippedEnd),
        granularity,
      });
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 7);
      guard++;
    }
    return buckets;
  }

  // month
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  let guard = 0;
  while (cursor <= last && guard < 36) {
    buckets.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      label: monthLabel(cursor, includeYear || spanDays > 90),
      granularity,
    });
    cursor.setMonth(cursor.getMonth() + 1);
    guard++;
  }
  return buckets;
}

/** Map an event/payment/booking timestamp onto the bucket key for the given plan. */
export function bucketKeyForTimestamp(
  isoTimestamp: string,
  granularity: TrendGranularity,
): string {
  const d = parseDateOnly(isoTimestamp.slice(0, 10));
  if (granularity === "day") return isoDate(d);
  if (granularity === "week") return isoDate(startOfWeekSunday(d));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function trendGranularityCaption(granularity: TrendGranularity): string {
  if (granularity === "day") return "Daily";
  if (granularity === "week") return "Weekly";
  return "Monthly";
}
