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

import { CalendarDays } from "lucide-react";

import { FilterBar, ItemRow } from "@/components/calendar/calendar-shared";
import { useCalendarFilters } from "@/components/calendar/use-calendar-filters";
import type { CalendarItem } from "@/lib/calendar/types";

export function AgendaView({
  items, today, year, month, onEditBlock, onViewBlock, onDeleteBlock, deletingId, deletePending, tastingEnabled = false,
  showSpaceFilter = false,
  venueSpaces = [],
}: {
  items: CalendarItem[];
  today: string;
  year: number;
  month: number;
  onEditBlock?: (blockId: string) => void;
  onViewBlock?: (blockId: string) => void;
  onDeleteBlock?: (blockId: string) => void;
  deletingId?: string | null;
  deletePending?: boolean;
  tastingEnabled?: boolean;
  showSpaceFilter?: boolean;
  venueSpaces?: Array<{ id: string; name: string; isActive?: boolean }>;
}) {
  const { filters, setFilters, filteredItems, presentTypes, staffOptions, spaceOptions } = useCalendarFilters(
    items,
    undefined,
    { showSpaceFilter, venueSpaces },
  );
  const displayItems = filteredItems;

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
    <div className="htc-calendar-agenda" data-cal-agenda="">
      {/* Date navigation lives in the shared Phase 11C linen toolbar (calendar-view). */}
      <FilterBar filters={filters} onChange={setFilters} presentTypes={presentTypes} staffOptions={staffOptions} spaceOptions={spaceOptions} items={items} />

      {byDate.length === 0 ? (
        <div data-cal-agenda-empty="">
          <CalendarDays className="mx-auto mb-2 h-7 w-7 text-muted-foreground" aria-hidden />
          <p>Nothing upcoming in this window.</p>
        </div>
      ) : (
        <div data-cal-agenda-groups="">
          {byDate.map(([date, dateItems]) => {
            const [y, m, d] = date.split("-").map(Number);
            const label = new Date(y, m - 1, d).toLocaleDateString("en-US", {
              weekday: "long", month: "long", day: "numeric",
            });
            return (
              <div key={date} data-cal-agenda-group="">
                <p
                  data-cal-agenda-date=""
                  data-today={date === today ? "true" : "false"}
                >
                  {date === today ? `Today — ${label}` : label}
                </p>
                <div data-cal-agenda-items="">
                  {dateItems.map((item) => (
                    <ItemRow
                      key={item.id} item={item}
                      onEditBlock={onEditBlock} onViewBlock={onViewBlock} onDeleteBlock={onDeleteBlock}
                      deleting={!!deletePending && deletingId === item.rawId}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
