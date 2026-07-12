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

import { FilterBar, ItemRow } from "@/components/calendar/calendar-shared";
import { useCalendarFilters } from "@/components/calendar/use-calendar-filters";
import type { CalendarItem } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";

export function AgendaView({ items, today }: { items: CalendarItem[]; today: string }) {
  const { filters, setFilters, filteredItems, presentTypes, staffOptions, spaceOptions } = useCalendarFilters(items, "agenda");

  const upcoming = filteredItems.filter((i) => i.date >= today);
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
