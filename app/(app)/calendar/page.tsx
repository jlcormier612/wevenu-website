import type { Metadata } from "next";
import Link from "next/link";
import { Printer } from "lucide-react";

import { CalendarView } from "@/components/calendar/calendar-view";
import { PageHeader } from "@/components/shell/module-placeholder";
import { resolveCalendarView, type CalendarViewParams } from "@/lib/calendar/view-data";

export const metadata: Metadata = { title: "Calendar" };

type Props = { searchParams: Promise<CalendarViewParams> };

/**
 * Unified calendar — Month/Week/Day/Agenda views over the same underlying
 * getCalendarData() aggregation (Calendar Integration Phase 3). Month
 * navigation and the new view-specific navigation (weekStart/date) all use
 * URL search params so every view is server-rendered with fresh data.
 * Window resolution (including the month-boundary merge for Week/Agenda)
 * lives in lib/calendar/view-data.ts, shared with the print page.
 */
export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams;
  const { view, year, month, weekStart, dayDate, items, today } = await resolveCalendarView(params);

  const printHref = `/calendar/print?view=${view}&year=${year}&month=${month}&weekStart=${weekStart}&date=${dayDate}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Calendar"
          description="Every important date across your events, leads, and clients — in one view."
        />
        <Link
          href={printHref}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
        >
          <Printer className="h-3.5 w-3.5" /> Print / Export
        </Link>
      </div>
      <CalendarView
        view={view}
        year={year}
        month={month}
        weekStart={weekStart}
        dayDate={dayDate}
        items={items}
        today={today}
      />
    </div>
  );
}
