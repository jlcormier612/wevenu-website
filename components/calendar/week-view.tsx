"use client";

/**
 * Week View — Calendar Integration Phase 3.
 *
 * Chronological, time-aware: scheduled activities/events show their actual
 * time-of-day; all-day schedule items (events, holds, blocks) render as
 * all-day rows. Same venue Calendar data as Month (Slice 1: scheduled /
 * reserved / blocked only) — only the window and layout change.
 */
import * as React from "react";

import Link from "next/link";

import { FilterBar, formatTime, ItemRow, resolveItemMeta } from "@/components/calendar/calendar-shared";
import { useCalendarFilters } from "@/components/calendar/use-calendar-filters";
import type { CalendarItem } from "@/lib/calendar/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function WeekView({
  weekStart, items, today, onEditBlock, onViewBlock, onDeleteBlock, deletingId, deletePending, tastingEnabled = false,
  showSpaceFilter = false,
  venueSpaces = [],
}: {
  /** ISO date of this week's Sunday. */
  weekStart: string;
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
  const [y, m, d] = weekStart.split("-").map(Number);
  const start = new Date(y, m - 1, d);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const dateStr = toIso(date);
    const dayItems = displayItems.filter((it) => it.date === dateStr)
      .sort((a, b) => (a.time ?? "99:99") < (b.time ?? "99:99") ? -1 : 1);
    return { date, dateStr, dayItems };
  });

  return (
    <div className="htc-calendar-week" data-cal-week="">
      {/* Date navigation lives in the shared Phase 11C linen toolbar (calendar-view). */}
      <FilterBar filters={filters} onChange={setFilters} presentTypes={presentTypes} staffOptions={staffOptions} spaceOptions={spaceOptions} items={items} />

      <div data-cal-week-grid="">
        {days.map(({ date, dateStr, dayItems }) => (
          <div
            key={dateStr}
            data-cal-week-day=""
            data-today={dateStr === today ? "true" : "false"}
          >
            <p data-cal-week-day-name="">{DAY_NAMES[date.getDay()].slice(0, 3)}</p>
            <p
              data-cal-week-day-num=""
              data-today={dateStr === today ? "true" : "false"}
            >
              {date.getDate()}
            </p>
            <div className="space-y-1.5">
              {dayItems.length === 0 && (
                <p data-cal-week-empty="">Nothing scheduled</p>
              )}
              {dayItems.map((item) => {
                const meta = resolveItemMeta(item);
                const Icon = meta.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.link}
                    data-cal-week-event=""
                  >
                    <Icon className="mt-0.5 h-3 w-3 shrink-0" style={{ color: meta.dotColor }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-foreground">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.time
                          ? (item.endTime ? `${formatTime(item.time)} – ${formatTime(item.endTime)}` : formatTime(item.time))
                          : "All day"}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Full item detail for whichever day has the most going on, reusing the same row rendering as Month view's day detail — same identity, tighter window. */}
      {days.some((d) => d.dayItems.length > 0) && (
        <div data-cal-week-full="">
          <p data-cal-week-full-title="">This week, in full</p>
          <div className="space-y-2">
            {days.flatMap((d) => d.dayItems).map((item) => (
              <ItemRow
                key={item.id} item={item} showDate
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
