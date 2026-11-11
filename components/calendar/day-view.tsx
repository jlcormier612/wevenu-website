"use client";

/**
 * Day View — Calendar Integration Phase 3.
 *
 * "The view a coordinator opens each morning" (§3) — every capability's
 * items for one day, full width, chronological. Read-only, same items and
 * links as Month view's own day-detail sidebar; this is that same panel
 * promoted to its own page with date navigation, not a new aggregation.
 */
import * as React from "react";

import { CalendarDays } from "lucide-react";

import { FilterBar, ItemRow } from "@/components/calendar/calendar-shared";
import { useCalendarFilters } from "@/components/calendar/use-calendar-filters";
import type { CalendarItem } from "@/lib/calendar/types";

export function DayView({
  date, items, today, onEditBlock, onViewBlock, onDeleteBlock, deletingId, deletePending, tastingEnabled = false,
  showSpaceFilter = false,
  venueSpaces = [],
}: {
  date: string;
  items: CalendarItem[];
  today: string;
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
  const dayItems = displayItems.filter((it) => it.date === date)
    .sort((a, b) => (a.time ?? "99:99") < (b.time ?? "99:99") ? -1 : 1);

  return (
    <div className="htc-calendar-day" data-cal-day="">
      {/* Date navigation lives in the shared Phase 11C linen toolbar (calendar-view). */}
      <FilterBar filters={filters} onChange={setFilters} presentTypes={presentTypes} staffOptions={staffOptions} spaceOptions={spaceOptions} items={items} />

      {dayItems.length === 0 ? (
        <div data-cal-day-empty="">
          <CalendarDays className="mx-auto mb-2 h-7 w-7 text-muted-foreground" aria-hidden />
          <p>Nothing scheduled for this day. Add a schedule item, or book a tour from Tours.</p>
        </div>
      ) : (
        <div data-cal-day-board="">
          <div className="space-y-2">
            {dayItems.map((item) => (
              <ItemRow
                key={item.id} item={item}
                onEditBlock={onEditBlock} onViewBlock={onViewBlock} onDeleteBlock={onDeleteBlock}
                deleting={!!deletePending && deletingId === item.rawId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
