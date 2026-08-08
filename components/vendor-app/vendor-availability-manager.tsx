"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  blockDateAction,
  loadAvailabilityMonthAction,
  unblockDateAction,
  updateAvailabilitySettingsAction,
} from "@/app/vendor/availability/actions";
import type { VendorAvailability } from "@/lib/vendors/types";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

type DayEntry = { id: string; note: string | null };

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function splitAvailability(rows: VendorAvailability[]): {
  manual: Map<string, DayEntry>;
  booked: Map<string, DayEntry>;
} {
  const manual = new Map<string, DayEntry>();
  const booked = new Map<string, DayEntry>();
  for (const a of rows) {
    const entry = { id: a.id, note: a.note };
    if (a.source === "event") booked.set(a.date, entry);
    else manual.set(a.date, entry);
  }
  return { manual, booked };
}

export function VendorAvailabilityManager({
  availability: initial,
  year: initialYear,
  month: initialMonth,
  acceptingInquiries: initialAccepting,
  availabilityNotes: initialNotes,
}: {
  availability:        VendorAvailability[];
  year:                number;
  month:               number;
  acceptingInquiries:  boolean;
  availabilityNotes:   string | null;
}) {
  const initialSplit = React.useMemo(() => splitAvailability(initial), [initial]);
  const [year, setYear]   = React.useState(initialYear);
  const [month, setMonth] = React.useState(initialMonth);
  const [manual, setManual] = React.useState<Map<string, DayEntry>>(() => initialSplit.manual);
  const [booked, setBooked] = React.useState<Map<string, DayEntry>>(() => initialSplit.booked);
  const [pendingDate, setPendingDate] = React.useState<string | null>(null);

  const [accepting, setAccepting]   = React.useState(initialAccepting);
  const [notes, setNotes]           = React.useState(initialNotes ?? "");
  const [settingsSaving, startSettings] = React.useTransition();
  const [monthLoading, setMonthLoading] = React.useState(false);
  const skipFirstMonthLoad = React.useRef(true);

  React.useEffect(() => {
    const next = splitAvailability(initial);
    setManual(next.manual);
    setBooked(next.booked);
  }, [initial]);

  React.useEffect(() => {
    if (skipFirstMonthLoad.current) {
      skipFirstMonthLoad.current = false;
      return;
    }
    let cancelled = false;
    setMonthLoading(true);
    void loadAvailabilityMonthAction(year, month).then((rows) => {
      if (cancelled) return;
      const next = splitAvailability(rows);
      setManual(next.manual);
      setBooked(next.booked);
      setMonthLoading(false);
    }).catch(() => {
      if (!cancelled) setMonthLoading(false);
    });
    return () => { cancelled = true; };
  }, [year, month]);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const today = new Date().toISOString().slice(0, 10);

  async function handleDayClick(dateStr: string) {
    if (pendingDate === dateStr) return;

    const bookedEntry = booked.get(dateStr);
    if (bookedEntry) {
      const label = bookedEntry.note?.trim() || "an event";
      toast.message(`Booked — ${label}`);
      return;
    }

    setPendingDate(dateStr);
    try {
      if (manual.has(dateStr)) {
        const id = manual.get(dateStr)!.id;
        const result = await unblockDateAction(id);
        if (!result.ok) { toast.error(result.message ?? "Could not unblock date."); return; }
        setManual((m) => { const n = new Map(m); n.delete(dateStr); return n; });
      } else {
        const result = await blockDateAction(dateStr, "");
        if (!result.ok) { toast.error(result.message ?? "Could not block date."); return; }
        if (result.ok && "id" in result && result.id) {
          setManual((m) => new Map(m).set(dateStr, { id: result.id as string, note: null }));
        }
      }
    } finally {
      setPendingDate(null);
    }
  }

  function saveSettings() {
    startSettings(async () => {
      const result = await updateAvailabilitySettingsAction({ acceptingInquiries: accepting, availabilityNotes: notes });
      if (result.ok) toast.success("Settings saved.");
      else toast.error(result.message ?? "Could not save settings.");
    });
  }

  const daysInMonth  = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfWeek(year, month);
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-6">
      {/* Settings */}
      <div className="rounded-sm border border-border bg-card p-5 space-y-4">
        <p className="text-sm font-medium text-heading">Availability Settings</p>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Open for new bookings</p>
            <p className="text-xs text-muted-foreground">
              Signals to partner venues and prospective clients that you&apos;re available for more events. This isn&apos;t a public inquiry inbox.
            </p>
          </div>
          <Switch checked={accepting} onCheckedChange={setAccepting} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="avail-notes">Seasonal availability notes</Label>
          <Textarea
            id="avail-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Fully booked June–August 2026. Taking inquiries for fall."
          />
        </div>

        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={saveSettings} disabled={settingsSaving}>
            {settingsSaving ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save Settings"}
          </Button>
        </div>
      </div>

      {/* Calendar */}
      <div className="rounded-sm border border-border bg-card p-5 space-y-4">
        {/* Month nav */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            {MONTH_NAMES[month]} {year}
            {monthLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
          </p>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-green-100 border border-green-300 inline-block" />Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-100 border border-red-300 inline-block" />Blocked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-amber-100 border border-amber-300 inline-block" />Booked
          </span>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const dateStr  = toDateString(year, month, day);
            const bookedEntry = booked.get(dateStr);
            const isBooked  = Boolean(bookedEntry);
            const isBlocked = !isBooked && manual.has(dateStr);
            const isPast    = dateStr < today;
            const isPending = pendingDate === dateStr;
            const eventLabel = bookedEntry?.note?.trim() || null;
            const stateLabel = isBooked
              ? ` (booked${eventLabel ? `: ${eventLabel}` : ""})`
              : isBlocked ? " (blocked)" : "";

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => !isPast && handleDayClick(dateStr)}
                disabled={isPast || isPending}
                aria-label={`${dateStr}${stateLabel}`}
                title={isBooked ? `Booked — ${eventLabel || "event"}` : undefined}
                className={[
                  "relative flex flex-col items-center justify-center rounded-lg text-xs font-medium aspect-square transition-all px-0.5",
                  isPast
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : isBooked
                    ? "bg-amber-100 text-amber-900 border border-amber-300 cursor-default"
                    : isBlocked
                    ? "bg-red-100 text-red-700 border border-red-300 hover:bg-red-200"
                    : "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100",
                  dateStr === today ? "ring-2 ring-primary ring-offset-1" : "",
                  isPending ? "opacity-50" : "",
                ].join(" ")}
              >
                {isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <span>{day}</span>
                    {eventLabel ? (
                      <span className="mt-0.5 max-w-full truncate text-[8px] leading-tight font-normal text-amber-800/90">
                        {eventLabel}
                      </span>
                    ) : null}
                  </>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          Click Available ↔ Blocked to toggle. Booked days come from secured events and can’t be cleared here.
        </p>
      </div>
    </div>
  );
}
