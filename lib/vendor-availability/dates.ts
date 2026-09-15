/**
 * Calendar date helpers for vendor availability.
 * All values are civil YYYY-MM-DD strings — never local Date midnight.
 */

export function monthDateRange(year: number, month1to12: number): { start: string; end: string } {
  if (month1to12 < 1 || month1to12 > 12) {
    throw new Error("month must be 1–12");
  }
  const mm = String(month1to12).padStart(2, "0");
  const start = `${year}-${mm}-01`;
  const lastDay = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
  const end = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function localTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseCivil(date: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

function fromUtcNoon(date: string): Date | null {
  const p = parseCivil(date);
  if (!p) return null;
  return new Date(Date.UTC(p.y, p.m - 1, p.d, 12, 0, 0));
}

function toCivil(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

/** Inclusive start..end civil dates. Empty if invalid or end < start. */
export function datesInInclusiveRange(start: string, end: string, maxDays = 366): string[] {
  const a = fromUtcNoon(start);
  const b = fromUtcNoon(end);
  if (!a || !b || b < a) return [];
  const dates: string[] = [];
  const cur = new Date(a);
  while (cur <= b) {
    dates.push(toCivil(cur));
    if (dates.length > maxDays) return dates.slice(0, maxDays);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

export type RecurrenceWeekdays =
  | { kind: "weekends" }
  | { kind: "days"; days: number[] };

/**
 * days: 0=Sunday … 6=Saturday (JS getUTCDay).
 * Inclusive start; optional end. Dates outside the range are never generated.
 */
export function recurringUnavailableDates(input: {
  start: string;
  end?: string | null;
  weekdays: RecurrenceWeekdays;
  maxDays?: number;
}): string[] {
  const maxDays = input.maxDays ?? 400;
  const start = fromUtcNoon(input.start);
  if (!start) return [];
  const end = input.end ? fromUtcNoon(input.end) : fromUtcNoon(input.start);
  if (!end || end < start) return [];

  const wanted = new Set<number>();
  if (input.weekdays.kind === "weekends") {
    wanted.add(0);
    wanted.add(6);
  } else {
    for (const d of input.weekdays.days) {
      if (d >= 0 && d <= 6) wanted.add(d);
    }
  }
  if (wanted.size === 0) return [];

  const dates: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    if (wanted.has(cur.getUTCDay())) {
      dates.push(toCivil(cur));
      if (dates.length >= maxDays) break;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

export function formatCivilDateLabel(date: string): string {
  const p = parseCivil(date);
  if (!p) return date;
  return new Date(Date.UTC(p.y, p.m - 1, p.d, 12, 0, 0)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
