import type { Metadata } from "next";

import { CalendarView } from "@/components/calendar/calendar-view";
import { PageHeader } from "@/components/shell/module-placeholder";
import { getCalendarData } from "@/lib/calendar/service";

export const metadata: Metadata = { title: "Calendar" };

type Props = { searchParams: Promise<{ year?: string; month?: string }> };

/**
 * Unified calendar — aggregates events, tours, follow-ups, payment due dates,
 * and client key dates into a single month-grid view.
 *
 * Month navigation uses URL search params (?year=&month=) so each month is
 * server-rendered with fresh data. Day selection is managed client-side in
 * CalendarView with no URL change.
 */
export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year ?? now.getFullYear());
  const month = Number(params.month ?? now.getMonth() + 1);

  // Clamp to valid values
  const safeYear = Number.isFinite(year) && year >= 2020 && year <= 2040 ? year : now.getFullYear();
  const safeMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1;

  const data = await getCalendarData(safeYear, safeMonth);

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Every important date across your events, leads, and clients — in one view."
      />
      <CalendarView
        year={safeYear}
        month={safeMonth}
        items={data.items}
        today={today}
      />
    </div>
  );
}
