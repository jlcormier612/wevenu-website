"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  MapPin,
  Phone,
  Plus,
  Star,
  Trash2,
} from "lucide-react";

import { createBlockAction, deleteBlockAction } from "@/app/(app)/availability/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { BLOCK_REASONS } from "@/lib/availability/constants";
import { toast } from "sonner";
import type { CalendarItem, CalendarItemType } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";

// ---- type meta ---------------------------------------------------------------

// dotColor uses CSS custom properties (defined in globals.css) so dark-mode
// overrides in .dark { } work automatically — no JS dark-mode detection needed.
const TYPE_META: Record<CalendarItemType, {
  label: string;
  icon: React.ElementType;
  dotColor: string;  // CSS var reference, e.g. "var(--cal-event)"
  textClass: string;
}> = {
  event:          { label: "Event",       icon: CalendarDays,  dotColor: "var(--cal-event)",       textClass: "text-primary" },
  tour:           { label: "Tour",        icon: MapPin,        dotColor: "var(--cal-tour)",        textClass: "text-muted-foreground" },
  follow_up:      { label: "Follow-up",   icon: Phone,         dotColor: "var(--cal-follow-up)",   textClass: "text-muted-foreground" },
  payment_due:    { label: "Payment Due", icon: DollarSign,    dotColor: "var(--cal-payment-due)", textClass: "text-destructive" },
  key_date:       { label: "Key Date",    icon: Star,          dotColor: "var(--cal-key-date)",    textClass: "text-heading" },
  date_hold:      { label: "Date Hold",   icon: Clock,         dotColor: "var(--cal-date-hold)",   textClass: "text-warning-foreground" },
  calendar_block: { label: "Blocked",     icon: AlertTriangle, dotColor: "var(--cal-blocked)",     textClass: "text-destructive" },
  planning_activity: { label: "Planning", icon: CalendarClock, dotColor: "var(--cal-planning-activity)", textClass: "text-heading" },
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

function DayDetail({ date, items, onBlockDeleted }: { date: string | null; items: CalendarItem[]; onBlockDeleted: () => void }) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deletePending, startDelete] = React.useTransition();

  function handleDeleteBlock(blockId: string) {
    setDeletingId(blockId);
    startDelete(async () => {
      const result = await deleteBlockAction(blockId);
      if (result.ok) {
        toast.success("Block removed.");
        onBlockDeleted();
      } else {
        toast.error("Could not remove block.");
      }
      setDeletingId(null);
    });
  }

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
            const isBlock = item.type === "calendar_block";

            const inner = (
              <>
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `color-mix(in oklch, ${meta.dotColor} 18%, transparent)`, color: meta.dotColor }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn("text-xs font-semibold uppercase tracking-wide", meta.textClass)}>
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
              </>
            );

            if (isBlock && item.rawId) {
              return (
                <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                  {inner}
                  <button
                    type="button"
                    onClick={() => handleDeleteBlock(item.rawId!)}
                    disabled={deletePending && deletingId === item.rawId}
                    className="ml-1 mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete block"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.link}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/40 transition-colors"
              >
                {inner}
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
  const [showBlockForm, setShowBlockForm] = React.useState(false);
  const [blockTitle, setBlockTitle] = React.useState("");
  const [blockReason, setBlockReason] = React.useState<string>("other");
  const [blockStart, setBlockStart] = React.useState(today);
  const [blockEnd, setBlockEnd] = React.useState(today);
  const [blockIsAllDay, setBlockIsAllDay] = React.useState(true);
  const [blockStartTime, setBlockStartTime] = React.useState("09:00");
  const [blockEndTime, setBlockEndTime] = React.useState("17:00");
  const [blockRecurrence, setBlockRecurrence] = React.useState<string>("none");
  const [blockRecurrenceEnd, setBlockRecurrenceEnd] = React.useState("");
  const [blockPending, startBlock] = React.useTransition();

  function resetBlockForm() {
    setBlockTitle(""); setBlockReason("other"); setBlockStart(today); setBlockEnd(today);
    setBlockIsAllDay(true); setBlockStartTime("09:00"); setBlockEndTime("17:00");
    setBlockRecurrence("none"); setBlockRecurrenceEnd("");
  }

  function handleAddBlock() {
    if (!blockTitle.trim() || !blockStart) return;
    startBlock(async () => {
      const result = await createBlockAction({
        title: blockTitle.trim(),
        reason: blockReason as import("@/lib/availability/types").BlockReason,
        startDate: blockStart,
        endDate: blockEnd || blockStart,
        isAllDay: blockIsAllDay,
        startTime: blockIsAllDay ? "" : blockStartTime,
        endTime: blockIsAllDay ? "" : blockEndTime,
        notes: "",
        recurrenceRule: blockRecurrence as import("@/lib/availability/types").RecurrenceRule,
        recurrenceEndsOn: blockRecurrence !== "none" && blockRecurrenceEnd ? blockRecurrenceEnd : null,
      });
      if (result.ok) {
        toast.success("Block added.");
        setShowBlockForm(false);
        resetBlockForm();
        router.refresh();
      } else {
        toast.error("ok" in result && !result.ok ? result.message ?? "Could not add block." : "Could not add block.");
      }
    });
  }

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
        <Button type="button" variant="outline" size="sm" onClick={() => setShowBlockForm(!showBlockForm)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Block
        </Button>
      </div>

      {/* Add Block inline form */}
      {showBlockForm && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-3">
          <p className="text-sm font-medium text-heading">Add Calendar Block</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Title *</Label>
              <Input value={blockTitle} onChange={(e) => setBlockTitle(e.target.value)} placeholder="Closed for maintenance…" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason</Label>
              <Select value={blockReason} onValueChange={setBlockReason} items={BLOCK_REASONS}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BLOCK_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Start date *</Label>
              <Input type="date" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End date</Label>
              <Input type="date" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} min={blockStart} />
            </div>
          </div>

          {/* All-day toggle + time inputs */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={blockIsAllDay} onChange={(e) => setBlockIsAllDay(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary" />
              <span className="text-xs text-foreground">All day</span>
            </label>
          </div>
          {!blockIsAllDay && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Start time</Label>
                <Input type="time" value={blockStartTime} onChange={(e) => setBlockStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End time</Label>
                <Input type="time" value={blockEndTime} onChange={(e) => setBlockEndTime(e.target.value)} />
              </div>
            </div>
          )}

          {/* Recurrence */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Repeat</Label>
              <Select
                value={blockRecurrence}
                onValueChange={setBlockRecurrence}
                items={{ none: "Does not repeat", daily: "Every day", weekly: "Every week (same day)", annual: "Every year (same date)" }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Does not repeat</SelectItem>
                  <SelectItem value="daily">Every day</SelectItem>
                  <SelectItem value="weekly">Every week (same day)</SelectItem>
                  <SelectItem value="annual">Every year (same date)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {blockRecurrence !== "none" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Repeat until (optional)</Label>
                <Input type="date" value={blockRecurrenceEnd} onChange={(e) => setBlockRecurrenceEnd(e.target.value)} min={blockStart} placeholder="No end date" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setShowBlockForm(false); resetBlockForm(); }} disabled={blockPending}>Cancel</Button>
            <Button type="button" size="sm" disabled={!blockTitle.trim() || !blockStart || blockPending} onClick={handleAddBlock}>
              {blockPending ? "Adding…" : "Add Block"}
            </Button>
          </div>
        </div>
      )}

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
            <DayDetail date={selectedDate || null} items={items} onBlockDeleted={() => router.refresh()} />
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
