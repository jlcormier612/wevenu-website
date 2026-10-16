"use client";

/**
 * Direct month/year jump for calendar headers (venue Calendar + public
 * availability calendars). Year bounds match lib/calendar/types so UI
 * options stay within the same range the venue Calendar resolver honours.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CALENDAR_MAX_YEAR, CALENDAR_MIN_YEAR } from "@/lib/calendar/types";
import { yearOptionsForRange } from "@/lib/calendar/month-year-range";

export { clampMonthYear, yearOptionsForRange } from "@/lib/calendar/month-year-range";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Jump straight to a distant month/year instead of walking there one
 * chevron-click at a time. `month` is 1–12 (January = 1), matching the
 * venue Calendar URL param convention.
 */
export function MonthYearPicker({
  year,
  month,
  onChange,
  minYear = CALENDAR_MIN_YEAR,
  maxYear = CALENDAR_MAX_YEAR,
}: {
  year: number;
  /** 1–12 */
  month: number;
  onChange: (year: number, month: number) => void;
  minYear?: number;
  maxYear?: number;
}) {
  const years = yearOptionsForRange(minYear, maxYear);
  const safeYear = years.includes(year) ? year : years[0]!;
  const safeMonth = month >= 1 && month <= 12 ? month : 1;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5" data-testid="month-year-picker">
      <Select
        value={String(safeMonth)}
        onValueChange={(v) => onChange(safeYear, Number(v))}
        items={Object.fromEntries(MONTH_NAMES.map((m, i) => [String(i + 1), m]))}
      >
        <SelectTrigger className="h-9 w-[9.5rem]" aria-label="Month" data-testid="calendar-month-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTH_NAMES.map((m, i) => (
            <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(safeYear)}
        onValueChange={(v) => onChange(Number(v), safeMonth)}
        items={Object.fromEntries(years.map((y) => [String(y), String(y)]))}
      >
        <SelectTrigger className="h-9 w-[6rem]" aria-label="Year" data-testid="calendar-year-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
