"use client";

/**
 * Week View — Calendar Integration Phase 3.
 *
 * Chronological, time-aware: scheduled activities/events show their actual
 * time-of-day; due dates (Requests, Contracts, Documents, Payments,
 * due-date-only Planning — none of the latter appear on Month view either,
 * unchanged here) render as all-day items, exactly like Month view already
 * treats them. Same data, same items, same links — only the window and
 * layout change (§ "Preserve" — no business logic here at all).
 */
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatTime, ItemRow, TYPE_META } from "@/components/calendar/calendar-shared";
import type { CalendarItem } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function WeekView({
  weekStart, items, today,
}: {
  /** ISO date of this week's Sunday. */
  weekStart: string;
  items: CalendarItem[];
  today: string;
}) {
  const router = useRouter();
  const [y, m, d] = weekStart.split("-").map(Number);
  const start = new Date(y, m - 1, d);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const dateStr = toIso(date);
    const dayItems = items.filter((it) => it.date === dateStr)
      .sort((a, b) => (a.time ?? "99:99") < (b.time ?? "99:99") ? -1 : 1);
    return { date, dateStr, dayItems };
  });

  function navigate(deltaWeeks: number) {
    const next = new Date(start);
    next.setDate(next.getDate() + deltaWeeks * 7);
    router.push(`/calendar?view=week&weekStart=${toIso(next)}`);
  }

  const rangeLabel = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[6].date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-heading text-lg font-medium text-heading min-w-[220px] text-center">{rangeLabel}</h2>
          <Button type="button" variant="outline" size="icon" onClick={() => navigate(1)} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-7">
        {days.map(({ date, dateStr, dayItems }) => (
          <div key={dateStr} className={cn(
            "rounded-xl border border-border p-2 space-y-2 min-h-[140px]",
            dateStr === today && "ring-1 ring-inset ring-primary/30 bg-primary/5",
          )}>
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {DAY_NAMES[date.getDay()].slice(0, 3)}
              </p>
              <p className={cn("text-sm font-medium", dateStr === today ? "text-primary" : "text-foreground")}>
                {date.getDate()}
              </p>
            </div>
            <div className="space-y-1.5">
              {dayItems.length === 0 && (
                <p className="text-center text-[11px] text-muted-foreground py-2">—</p>
              )}
              {dayItems.map((item) => {
                const meta = TYPE_META[item.type];
                const Icon = meta.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.link}
                    className="flex items-start gap-1.5 rounded-md border border-border/60 bg-card p-1.5 hover:bg-muted/40 transition-colors"
                  >
                    <Icon className="mt-0.5 h-3 w-3 shrink-0" style={{ color: meta.dotColor }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-foreground">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground">{item.time ? formatTime(item.time) : "All day"}</p>
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
        <div className="space-y-2">
          <p className="text-sm font-medium text-heading">This week, in full</p>
          <div className="space-y-2">
            {days.flatMap((d) => d.dayItems).map((item) => <ItemRow key={item.id} item={item} showDate />)}
          </div>
        </div>
      )}
    </div>
  );
}
