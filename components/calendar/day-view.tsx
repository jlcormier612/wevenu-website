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

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FilterBar, ItemRow, PerspectiveSwitcher } from "@/components/calendar/calendar-shared";
import { activePerspectiveId, applyPerspectiveLinkOverrides } from "@/components/calendar/perspectives";
import { useCalendarFilters } from "@/components/calendar/use-calendar-filters";
import type { CalendarItem } from "@/lib/calendar/types";

export function DayView({ date, items, today }: { date: string; items: CalendarItem[]; today: string }) {
  const router = useRouter();
  const { filters, setFilters, filteredItems, presentTypes, staffOptions, spaceOptions } = useCalendarFilters(items, "day");
  const displayItems = applyPerspectiveLinkOverrides(filteredItems, activePerspectiveId(filters));
  const [y, m, d] = date.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const label = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const dayItems = displayItems.filter((it) => it.date === date)
    .sort((a, b) => (a.time ?? "99:99") < (b.time ?? "99:99") ? -1 : 1);

  function navigate(deltaDays: number) {
    const next = new Date(dateObj);
    next.setDate(next.getDate() + deltaDays);
    const nextIso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
    router.push(`/calendar?view=day&date=${nextIso}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-heading text-lg font-medium text-heading min-w-[260px] text-center">{label}</h2>
          <Button type="button" variant="outline" size="icon" onClick={() => navigate(1)} aria-label="Next day">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {date !== today && (
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push(`/calendar?view=day&date=${today}`)}>
            Today
          </Button>
        )}
      </div>

      <PerspectiveSwitcher filters={filters} onChange={setFilters} />
      <FilterBar filters={filters} onChange={setFilters} presentTypes={presentTypes} staffOptions={staffOptions} spaceOptions={spaceOptions} />

      {dayItems.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Nothing scheduled.</p>
      ) : (
        <div className="space-y-2 max-w-2xl">
          {dayItems.map((item) => <ItemRow key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}
