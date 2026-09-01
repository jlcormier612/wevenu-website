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
import { CALENDAR_MAX_YEAR, CALENDAR_MIN_YEAR, type CalendarItem } from "@/lib/calendar/types";
import { getCurrentVenue } from "@/lib/venue/service";
import { venueToday } from "@/lib/venue/timezone";

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

/** Defaults come from the venue's own today, so an out-of-range param can't fall back to the server's month. */
function safeYearMonth(yearParam: string | undefined, monthParam: string | undefined, todayIso: string): { year: number; month: number } {
  const [defaultYear, defaultMonth] = todayIso.split("-").map(Number);
  const year = Number(yearParam ?? defaultYear);
  const month = Number(monthParam ?? defaultMonth);
  return {
    year: Number.isFinite(year) && year >= CALENDAR_MIN_YEAR && year <= CALENDAR_MAX_YEAR ? year : defaultYear,
    month: Number.isFinite(month) && month >= 1 && month <= 12 ? month : defaultMonth,
  };
}

export async function resolveCalendarView(params: CalendarViewParams) {
  const now = new Date();
  // "Today" is the venue's calendar day, not the server's. This drove which
  // cell the Calendar highlights and which day it opens on, so on a
  // UTC-deployed server an Eastern venue could open the Calendar in the
  // evening and land on tomorrow. getCurrentVenue() is request-cached, so
  // this adds no query to a render that already resolves the venue.
  const venue = await getCurrentVenue();
  const today = venueToday(venue?.timezone ?? null, now);
  const view: ViewMode = (["month", "week", "day", "agenda"] as const).includes(params.view as ViewMode) ? (params.view as ViewMode) : "month";

  let items: CalendarItem[];
  let weekStart = params.weekStart ?? today;
  const dayDate = params.date ?? today;
  // The returned year/month must always describe whatever period is
  // actually being viewed — for Week/Day that's derived from weekStart/
  // dayDate, never from params.year/month, which Week/Day navigation never
  // sets. Deriving it from the URL's own generic year/month params here
  // was the bug: switching to Month/Agenda from a Week/Day view that had
  // navigated away from the current month silently landed back on today's
  // real month instead of the one being viewed.
  let safeYear: number;
  let safeMonth: number;

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
    safeYear = startMonth.year;
    safeMonth = startMonth.month;
    const data1 = await getCalendarData(startMonth.year, startMonth.month);
    const data2 = startMonth.month === endMonth.month && startMonth.year === endMonth.year
      ? null
      : await getCalendarData(endMonth.year, endMonth.month);
    items = mergeItems(data1.items, data2?.items ?? []);
  } else if (view === "day") {
    const { year: dy, month: dm } = monthOf(dayDate);
    safeYear = dy;
    safeMonth = dm;
    const data = await getCalendarData(dy, dm);
    items = data.items;
  } else if (view === "agenda") {
    ({ year: safeYear, month: safeMonth } = safeYearMonth(params.year, params.month, today));
    // Rolling ~60-day upcoming window: current month plus next.
    const data1 = await getCalendarData(safeYear, safeMonth);
    const nextMonth = safeMonth === 12 ? 1 : safeMonth + 1;
    const nextYear = safeMonth === 12 ? safeYear + 1 : safeYear;
    const data2 = await getCalendarData(nextYear, nextMonth);
    items = mergeItems(data1.items, data2.items);
  } else {
    ({ year: safeYear, month: safeMonth } = safeYearMonth(params.year, params.month, today));
    const data = await getCalendarData(safeYear, safeMonth);
    items = data.items;
  }

  return { view, year: safeYear, month: safeMonth, weekStart, dayDate, items, today };
}
