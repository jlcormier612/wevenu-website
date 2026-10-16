/**
 * Shared year-range helpers for MonthYearPicker (venue Calendar + public
 * availability calendars). Bounds align with CALENDAR_MIN_YEAR / MAX_YEAR.
 */
import { CALENDAR_MAX_YEAR, CALENDAR_MIN_YEAR } from "@/lib/calendar/types";

export function yearOptionsForRange(
  minYear: number = CALENDAR_MIN_YEAR,
  maxYear: number = CALENDAR_MAX_YEAR,
): number[] {
  const lo = Math.min(minYear, maxYear);
  const hi = Math.max(minYear, maxYear);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

/** Clamp a 0-indexed month + year into [minYear, maxYear] without wrapping past bounds. */
export function clampMonthYear(
  month0: number,
  year: number,
  minYear: number,
  maxYear: number,
): { month: number; year: number } {
  let m = month0;
  let y = year;
  while (m < 0) { m += 12; y -= 1; }
  while (m > 11) { m -= 12; y += 1; }
  if (y < minYear) return { month: 0, year: minYear };
  if (y > maxYear) return { month: 11, year: maxYear };
  return { month: m, year: y };
}
