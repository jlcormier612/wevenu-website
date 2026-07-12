"use client";

/**
 * Agenda View — Calendar Integration Phase 3.
 *
 * A flat chronological list, not a grid — scanable regardless of
 * day-of-week (§3). Filterable by item type, client-side only; no editing,
 * same items/links as every other view. Grouped by date for readability
 * over a multi-week window.
 */
import * as React from "react";

import { ItemRow, TYPE_META } from "@/components/calendar/calendar-shared";
import type { CalendarItem, CalendarItemType } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";

export function AgendaView({ items, today }: { items: CalendarItem[]; today: string }) {
  const presentTypes = React.useMemo(
    () => (Object.keys(TYPE_META) as CalendarItemType[]).filter((t) => items.some((i) => i.type === t)),
    [items],
  );
  const [activeTypes, setActiveTypes] = React.useState<Set<CalendarItemType>>(new Set(presentTypes));

  // If the underlying items change (e.g. navigated to a new window) and a
  // previously-absent type shows up, default it to visible rather than
  // silently hidden. Adjusted during render, not an effect, per React's own
  // guidance for state that depends on a changed prop.
  const [seenItems, setSeenItems] = React.useState(items);
  if (items !== seenItems) {
    setSeenItems(items);
    setActiveTypes((prev) => new Set([...prev, ...presentTypes.filter((t) => !prev.has(t))]));
  }

  function toggle(type: CalendarItemType) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  const upcoming = items.filter((i) => i.date >= today && activeTypes.has(i.type));
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
      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {presentTypes.map((type) => {
          const meta = TYPE_META[type];
          const active = activeTypes.has(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggle(type)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                active ? "border-transparent bg-muted text-foreground" : "border-border text-muted-foreground opacity-50",
              )}
            >
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: meta.dotColor }} />
              {meta.label}
            </button>
          );
        })}
      </div>

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
