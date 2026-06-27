"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  MapPin,
  Phone,
  Star,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { CalendarItem, CalendarItemType } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";

// ---- type meta ---------------------------------------------------------------

const TYPE_META: Record<CalendarItemType, {
  label: string;
  icon: React.ElementType;
  dotColor: string;  // exact palette hex
  textClass: string;
}> = {
  event:       { label: "Event",       icon: CalendarDays, dotColor: "#5D6F5D", textClass: "text-primary" },
  tour:        { label: "Tour",        icon: MapPin,       dotColor: "#B9D1C2", textClass: "text-muted-foreground" },
  follow_up:   { label: "Follow-up",   icon: Phone,        dotColor: "#B8AEA1", textClass: "text-muted-foreground" },
  payment_due: { label: "Payment Due", icon: DollarSign,   dotColor: "#D8A7AA", textClass: "text-destructive" },
  key_date:    { label: "Key Date",    icon: Star,         dotColor: "#4F5F4F", textClass: "text-heading" },
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function formatTime(hhmm: string | null): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(0, 0, 0, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ---- Calendar grid ----------------------------------------------------------

function CalendarGrid({
  year,
  month,
  items,
  selectedDate,
  today,
  onSelectDate,
}: {
  year: number;
  month: number;
  items: CalendarItem[];
  selectedDate: string | null;
  today: string;
  onSelectDate: (date: string) => void;
}) {
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const byDate = React.useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const existing = map.get(item.date) ?? [];
      map.set(item.date, [...existing, item]);
    }
    return map;
  }, [items]);

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - firstDay + 1;
    if (dayNum < 1 || dayNum > daysInMonth) return null;
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    return { dayNum, dateStr, items: byDate.get(dateStr) ?? [] };
  });

  return (
    <div className="select-none">
      {/* Day-name header */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
        {cells.map((cell, i) =>
          cell === null ? (
            <div key={i} className="bg-muted/20 min-h-[72px]" />
          ) : (
            <button
              key={cell.dateStr}
              type="button"
              onClick={() => onSelectDate(cell.dateStr === selectedDate ? "" : cell.dateStr)}
              className={cn(
                "bg-background min-h-[72px] p-1.5 text-left transition-colors hover:bg-muted/40 focus:outline-none focus:bg-muted/40",
                cell.dateStr === selectedDate && "bg-primary/5 ring-1 ring-inset ring-primary/30",
              )}
            >
              {/* Day number */}
              <span className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                cell.dateStr === today
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground",
              )}>
                {cell.dayNum}
              </span>
              {/* Item dots */}
              {cell.items.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {cell.items.slice(0, 4).map((item) => (
                    <span
                      key={item.id}
                      className="block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: TYPE_META[item.type].dotColor }}
                      title={`${TYPE_META[item.type].label}: ${item.title}`}
                    />
                  ))}
                  {cell.items.length > 4 && (
                    <span className="text-[9px] text-muted-foreground leading-none mt-0.5">
                      +{cell.items.length - 4}
                    </span>
                  )}
                </div>
              )}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

// ---- Day detail panel -------------------------------------------------------

function DayDetail({ date, items }: { date: string | null; items: CalendarItem[] }) {
  if (!date) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CalendarDays className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Select a day to see what&apos;s scheduled.</p>
      </div>
    );
  }

  const dateItems = items.filter((i) => i.date === date);
  const [y, m, d] = date.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-3">
      <p className="font-heading text-base font-medium text-heading">{label}</p>
      {dateItems.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Nothing scheduled.</p>
      ) : (
        <div className="space-y-2">
          {dateItems.map((item) => {
            const meta = TYPE_META[item.type];
            const Icon = meta.icon;
            return (
              <Link
                key={item.id}
                href={item.link}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/40 transition-colors"
              >
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${TYPE_META[item.type].dotColor}20`, color: TYPE_META[item.type].dotColor }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: meta.dotColor }}>
                      {meta.label}
                    </p>
                    {item.time && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />{formatTime(item.time)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  {item.subtitle && (
                    <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Legend -----------------------------------------------------------------

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {(Object.entries(TYPE_META) as [CalendarItemType, typeof TYPE_META[CalendarItemType]][]).map(
        ([type, meta]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: meta.dotColor }} />
            <span className="text-xs text-muted-foreground">{meta.label}</span>
          </div>
        ),
      )}
    </div>
  );
}

// ---- Main CalendarView ------------------------------------------------------

export function CalendarView({
  year,
  month,
  items,
  today,
}: {
  year: number;
  month: number;
  items: CalendarItem[];
  today: string;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = React.useState<string>(today);

  function navigate(delta: number) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1)  { newMonth = 12; newYear--; }
    router.push(`/calendar?year=${newYear}&month=${newMonth}`);
  }

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;
  const isCurrentMonth =
    year === new Date().getFullYear() && month === new Date().getMonth() + 1;

  return (
    <div className="space-y-5">
      {/* Month navigation */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-heading text-xl font-medium text-heading min-w-[160px] text-center">
            {monthLabel}
          </h2>
          <Button type="button" variant="outline" size="icon" onClick={() => navigate(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {!isCurrentMonth && (
          <Button type="button" variant="ghost" size="sm"
            onClick={() => {
              const now = new Date();
              router.push(`/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
            }}>
            Today
          </Button>
        )}
      </div>

      {/* Legend */}
      <Legend />

      {/* Main grid + detail */}
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        {/* Calendar grid */}
        <CalendarGrid
          year={year} month={month} items={items}
          selectedDate={selectedDate} today={today}
          onSelectDate={setSelectedDate}
        />

        {/* Day detail */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <DayDetail date={selectedDate || null} items={items} />
          </CardContent>
        </Card>
      </div>

      {/* This month summary */}
      {items.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {MONTH_NAMES[month - 1]} at a glance — {items.length} item{items.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(TYPE_META) as CalendarItemType[]).map((type) => {
                const count = items.filter((i) => i.type === type).length;
                if (count === 0) return null;
                const meta = TYPE_META[type];
                const Icon = meta.icon;
                return (
                  <div key={type} className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${meta.dotColor}20`, color: meta.dotColor }}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="text-sm text-foreground">
                      {count} {meta.label}{count !== 1 ? "s" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
