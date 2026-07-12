/**
 * Shared view-window resolution for Calendar Month/Week/Day/Agenda
 * (Calendar Integration Phase 3, extracted in Phase 4 so the print view can
 * reuse the exact same window logic instead of a second copy of it).
 *
 * getCalendarData() itself stays month-scoped and unchanged — Week/Agenda,
 * which can span a month boundary, are handled here by fetching the 1-2
 * months a given window actually touches and merging the results.
 */
import { getCalendarData } from "@/lib/calendar/service";
import type { CalendarItem } from "@/lib/calendar/types";

export type ViewMode = "month" | "week" | "day" | "agenda";

export type CalendarViewParams = {
  view?: string;
  year?: string;
  month?: string;
  weekStart?: string;
  date?: string;
};

function mergeItems(...lists: CalendarItem[][]): CalendarItem[] {
  const seen = new Set<string>();
  const merged: CalendarItem[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

function monthOf(dateIso: string): { year: number; month: number } {
  const [y, m] = dateIso.split("-").map(Number);
  return { year: y, month: m };
}

export async function resolveCalendarView(params: CalendarViewParams) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const view: ViewMode = (["month", "week", "day", "agenda"] as const).includes(params.view as ViewMode) ? (params.view as ViewMode) : "month";

  const year = Number(params.year ?? now.getFullYear());
  const month = Number(params.month ?? now.getMonth() + 1);
  const safeYear = Number.isFinite(year) && year >= 2020 && year <= 2040 ? year : now.getFullYear();
  const safeMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1;

  let items: CalendarItem[];
  let weekStart = params.weekStart ?? today;
  const dayDate = params.date ?? today;

  if (view === "week") {
    // Normalize to the Sunday of whatever week was requested.
    const [wy, wm, wd] = weekStart.split("-").map(Number);
    const start = new Date(wy, wm - 1, wd);
    start.setDate(start.getDate() - start.getDay());
    weekStart = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const startMonth = monthOf(weekStart);
    const endMonth = { year: end.getFullYear(), month: end.getMonth() + 1 };
    const data1 = await getCalendarData(startMonth.year, startMonth.month);
    const data2 = startMonth.month === endMonth.month && startMonth.year === endMonth.year
      ? null
      : await getCalendarData(endMonth.year, endMonth.month);
    items = mergeItems(data1.items, data2?.items ?? []);
  } else if (view === "day") {
    const { year: dy, month: dm } = monthOf(dayDate);
    const data = await getCalendarData(dy, dm);
    items = data.items;
  } else if (view === "agenda") {
    // Rolling ~60-day upcoming window: current month plus next.
    const data1 = await getCalendarData(safeYear, safeMonth);
    const nextMonth = safeMonth === 12 ? 1 : safeMonth + 1;
    const nextYear = safeMonth === 12 ? safeYear + 1 : safeYear;
    const data2 = await getCalendarData(nextYear, nextMonth);
    items = mergeItems(data1.items, data2.items);
  } else {
    const data = await getCalendarData(safeYear, safeMonth);
    items = data.items;
  }

  return { view, year: safeYear, month: safeMonth, weekStart, dayDate, items, today };
}
