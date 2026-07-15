"use client";

/**
 * Agenda View — Calendar Integration Phase 3, filtering extended Phase 4.
 *
 * A flat chronological list, not a grid — scanable regardless of
 * day-of-week (§3). Filterable by type/assignee/space (shared FilterBar,
 * persisted via useCalendarFilters), client-side only; no editing, same
 * items/links as every other view. Grouped by date for readability over a
 * multi-week window.
 */
import * as React from "react";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FilterBar, ItemRow, PerspectiveSwitcher } from "@/components/calendar/calendar-shared";
import { activePerspectiveId, applyPerspectiveLinkOverrides } from "@/components/calendar/perspectives";
import { useCalendarFilters } from "@/components/calendar/use-calendar-filters";
import type { CalendarItem } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function AgendaView({
  items, today, year, month,
}: { items: CalendarItem[]; today: string; year: number; month: number }) {
  const router = useRouter();
  const { filters, setFilters, filteredItems, presentTypes, staffOptions, spaceOptions } = useCalendarFilters(items, "agenda");
  const displayItems = applyPerspectiveLinkOverrides(filteredItems, activePerspectiveId(filters));

  // Same ±1-month semantics as the "ArrowLeft"/"ArrowRight" keyboard
  // shortcut already uses for this view (calendar-view.tsx) — the on-screen
  // controls this adds are a second way to trigger the identical navigation,
  // not a new one.
  function navigate(delta: number) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1)  { newMonth = 12; newYear--; }
    router.push(`/calendar?view=agenda&year=${newYear}&month=${newMonth}`);
  }

  const now = new Date();
  const isCurrentWindow = year === now.getFullYear() && month === now.getMonth() + 1;

  const upcoming = displayItems.filter((i) => i.date >= today);
  const byDate = React.useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of upcoming) {
      const existing = map.get(item.date) ?? [];
      map.set(item.date, [...existing, item]);
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }, [upcoming]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-heading text-lg font-medium text-heading min-w-[160px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          <Button type="button" variant="outline" size="icon" onClick={() => navigate(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {!isCurrentWindow && (
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push(`/calendar?view=agenda&year=${now.getFullYear()}&month=${now.getMonth() + 1}`)}>
            Today
          </Button>
        )}
      </div>

      <PerspectiveSwitcher filters={filters} onChange={setFilters} />
      <FilterBar filters={filters} onChange={setFilters} presentTypes={presentTypes} staffOptions={staffOptions} spaceOptions={spaceOptions} />

      {byDate.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Nothing upcoming in this window.</p>
      ) : (
        <div className="space-y-5">
          {byDate.map(([date, dateItems]) => {
            const [y, m, d] = date.split("-").map(Number);
            const label = new Date(y, m - 1, d).toLocaleDateString("en-US", {
              weekday: "long", month: "long", day: "numeric",
            });
            return (
              <div key={date} className="space-y-2">
                <p className={cn("text-xs font-semibold uppercase tracking-wide", date === today ? "text-primary" : "text-muted-foreground")}>
                  {date === today ? `Today — ${label}` : label}
                </p>
                <div className="space-y-2">
                  {dateItems.map((item) => <ItemRow key={item.id} item={item} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
