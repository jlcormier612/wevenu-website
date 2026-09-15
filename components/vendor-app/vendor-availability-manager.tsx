"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  blockDateAction,
  blockDatesAction,
  loadAvailabilityMonthAction,
  unblockDateAction,
  unblockDatesAction,
  updateAvailabilitySettingsAction,
} from "@/app/vendor/(workspace)/availability/actions";
import {
  datesInInclusiveRange,
  formatCivilDateLabel,
  localTodayIso,
  monthDateRange,
  recurringUnavailableDates,
} from "@/lib/vendor-availability/dates";
import type { VendorAvailability } from "@/lib/vendors/types";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const WEEKDAY_OPTIONS: Array<{ day: number; label: string }> = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 0, label: "Sunday" },
];

type DayEntry = { id: string; note: string | null };

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 1)).getUTCDay();
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

function previewDates(dates: string[]): string {
  if (dates.length === 0) return "No dates in this selection.";
  const shown = dates.slice(0, 8).map(formatCivilDateLabel);
  const extra = dates.length > 8 ? ` and ${dates.length - 8} more` : "";
  return `${dates.length} date${dates.length === 1 ? "" : "s"}: ${shown.join(", ")}${extra}`;
}

function mergeMonthInto(
  prev: Map<string, DayEntry>,
  nextMonth: Map<string, DayEntry>,
  start: string,
  end: string,
): Map<string, DayEntry> {
  const out = new Map(prev);
  for (const key of [...out.keys()]) {
    if (key >= start && key <= end) out.delete(key);
  }
  for (const [key, value] of nextMonth) out.set(key, value);
  return out;
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
  const [bulkPending, setBulkPending] = React.useState(false);

  const [accepting, setAccepting]   = React.useState(initialAccepting);
  const [notes, setNotes]           = React.useState(initialNotes ?? "");
  const [settingsSaving, startSettings] = React.useTransition();
  const [monthLoading, setMonthLoading] = React.useState(false);
  const skipFirstMonthLoad = React.useRef(true);
  const loadGen = React.useRef(0);

  const [selectMode, setSelectMode] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [rangeOpen, setRangeOpen] = React.useState(false);
  const [rangeStart, setRangeStart] = React.useState("");
  const [rangeEnd, setRangeEnd] = React.useState("");
  const [rangeMode, setRangeMode] = React.useState<"block" | "unblock">("block");
  const [recurOpen, setRecurOpen] = React.useState(false);
  const [recurStart, setRecurStart] = React.useState("");
  const [recurEnd, setRecurEnd] = React.useState("");
  const [recurDays, setRecurDays] = React.useState<Set<number>>(new Set([0, 6]));

  React.useEffect(() => {
    if (skipFirstMonthLoad.current) {
      skipFirstMonthLoad.current = false;
      return;
    }
    const gen = ++loadGen.current;
    let cancelled = false;
    setMonthLoading(true);
    void loadAvailabilityMonthAction(year, month).then((rows) => {
      if (cancelled || gen !== loadGen.current) return;
      const next = splitAvailability(rows);
      const { start, end } = monthDateRange(year, month + 1);
      setManual((prev) => mergeMonthInto(prev, next.manual, start, end));
      setBooked((prev) => mergeMonthInto(prev, next.booked, start, end));
      setMonthLoading(false);
    }).catch(() => {
      if (!cancelled && gen === loadGen.current) setMonthLoading(false);
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

  const today = localTodayIso();
  const calendarBusy = monthLoading || bulkPending;

  function applyIds(ids: Record<string, string>) {
    setManual((m) => {
      const n = new Map(m);
      for (const [date, id] of Object.entries(ids)) n.set(date, { id, note: null });
      return n;
    });
  }

  async function persistBlock(dates: string[]) {
    const toBlock = dates.filter((d) => d >= today && !booked.has(d));
    if (toBlock.length === 0) {
      toast.error("No available dates in that selection.");
      return false;
    }
    setBulkPending(true);
    try {
      const result = await blockDatesAction(toBlock);
      if (!result.ok) {
        toast.error(result.message ?? "Could not block dates.");
        return false;
      }
      if (result.ids) applyIds(result.ids);
      toast.success(`Blocked ${toBlock.length} date${toBlock.length === 1 ? "" : "s"}.`);
      return true;
    } finally {
      setBulkPending(false);
    }
  }

  async function persistUnblock(dates: string[]) {
    const toClear = dates.filter((d) => manual.has(d) && !booked.has(d));
    if (toClear.length === 0) {
      toast.error("No blocked dates in that selection.");
      return false;
    }
    setBulkPending(true);
    try {
      const result = await unblockDatesAction(toClear);
      if (!result.ok) {
        toast.error(result.message ?? "Could not unblock dates.");
        return false;
      }
      setManual((m) => {
        const n = new Map(m);
        for (const d of toClear) n.delete(d);
        return n;
      });
      toast.success(`Unblocked ${toClear.length} date${toClear.length === 1 ? "" : "s"}.`);
      return true;
    } finally {
      setBulkPending(false);
    }
  }

  async function handleDayClick(dateStr: string) {
    if (calendarBusy || pendingDate === dateStr) return;

    const bookedEntry = booked.get(dateStr);
    if (bookedEntry) {
      const label = bookedEntry.note?.trim() || "an event";
      toast.message(`Booked — ${label}`);
      return;
    }

    if (selectMode) {
      setSelected((prev) => {
        const n = new Set(prev);
        if (n.has(dateStr)) n.delete(dateStr);
        else n.add(dateStr);
        return n;
      });
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

  const rangeDates = datesInInclusiveRange(rangeStart, rangeEnd);
  const recurDates = recurringUnavailableDates({
    start: recurStart,
    end: recurEnd || recurStart,
    weekdays: { kind: "days", days: [...recurDays] },
  });

  const daysInMonth  = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfWeek(year, month);
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-6">
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

      <div className="rounded-sm border border-border bg-card p-5 space-y-4">
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

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={calendarBusy}
            onClick={() => {
              setRangeMode("block");
              setRangeOpen(true);
            }}
          >
            Block dates
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={calendarBusy}
            onClick={() => setRecurOpen(true)}
          >
            Block recurring dates
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={calendarBusy}
            onClick={() => {
              setRangeMode("unblock");
              setRangeOpen(true);
            }}
          >
            Unblock
          </Button>
          <Button
            type="button"
            size="sm"
            variant={selectMode ? "default" : "outline"}
            disabled={calendarBusy}
            onClick={() => {
              setSelectMode((v) => !v);
              setSelected(new Set());
            }}
          >
            {selectMode ? "Done selecting" : "Select dates"}
          </Button>
        </div>

        {selectMode ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground flex-1">
              {selected.size === 0
                ? "Click dates to add them, then block or unblock the selection."
                : `${selected.size} date${selected.size === 1 ? "" : "s"} selected.`}
            </p>
            <Button
              type="button"
              size="sm"
              disabled={selected.size === 0 || calendarBusy}
              onClick={() => void persistBlock([...selected]).then((ok) => { if (ok) setSelected(new Set()); })}
            >
              Block selected
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={selected.size === 0 || calendarBusy}
              onClick={() => void persistUnblock([...selected]).then((ok) => { if (ok) setSelected(new Set()); })}
            >
              Unblock selected
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-green-100 border border-green-300 inline-block" aria-hidden />
            Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-100 border border-red-300 inline-block" aria-hidden />
            Blocked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-amber-100 border border-amber-300 inline-block" aria-hidden />
            Booked
          </span>
        </div>

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
            const isChosen  = selected.has(dateStr);
            const eventLabel = bookedEntry?.note?.trim() || null;
            const stateLabel = isBooked
              ? ` (booked${eventLabel ? `: ${eventLabel}` : ""})`
              : isBlocked ? " (blocked)" : isChosen ? " (selected)" : " (available)";

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => !isPast && handleDayClick(dateStr)}
                disabled={isPast || isPending || calendarBusy}
                aria-label={`${dateStr}${stateLabel}`}
                aria-pressed={isBlocked || isChosen}
                title={isBooked ? `Booked — ${eventLabel || "event"}` : isBlocked ? "Blocked" : "Available"}
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
                  isPending || calendarBusy ? "opacity-50" : "",
                  isChosen ? "ring-2 ring-foreground" : "",
                ].join(" ")}
              >
                {isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <span>{day}</span>
                    {isBooked ? (
                      <span className="mt-0.5 max-w-full truncate text-[8px] leading-tight font-normal text-amber-800/90">
                        {eventLabel || "Booked"}
                      </span>
                    ) : isBlocked ? (
                      <span className="mt-0.5 text-[8px] leading-tight font-normal">Blocked</span>
                    ) : (
                      <span className="mt-0.5 text-[8px] leading-tight font-normal text-green-800/80">Open</span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          Click an available date to block it, or a blocked date to unblock it. Booked days come from Hello to Cheers events and can&apos;t be cleared here.
        </p>
      </div>

      <Dialog open={rangeOpen} onOpenChange={setRangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rangeMode === "block" ? "Block dates" : "Unblock dates"}</DialogTitle>
            <DialogDescription>
              {rangeMode === "block"
                ? "Choose an inclusive start and end date. Every date in that range will be marked unavailable."
                : "Choose an inclusive start and end date. Manual blocks in that range will be cleared. Booked event dates stay booked."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="range-start">Start date</Label>
              <Input id="range-start" type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="range-end">End date</Label>
              <Input id="range-end" type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{previewDates(rangeDates)}</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRangeOpen(false)}>Cancel</Button>
            <Button
              type="button"
              disabled={rangeDates.length === 0 || calendarBusy}
              onClick={() => {
                void (rangeMode === "block" ? persistBlock(rangeDates) : persistUnblock(rangeDates)).then((ok) => {
                  if (ok) setRangeOpen(false);
                });
              }}
            >
              {rangeMode === "block" ? "Block dates" : "Unblock dates"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recurOpen} onOpenChange={setRecurOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block recurring dates</DialogTitle>
            <DialogDescription>
              Recurring unavailability is saved as individual blocked dates on your calendar — the same records as clicking a day.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="recur-start">Start date</Label>
              <Input id="recur-start" type="date" value={recurStart} onChange={(e) => setRecurStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recur-end">End date</Label>
              <Input id="recur-end" type="date" value={recurEnd} onChange={(e) => setRecurEnd(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setRecurDays(new Set([0, 6]))}>Weekends</Button>
            {WEEKDAY_OPTIONS.map((opt) => (
              <label key={opt.day} className="inline-flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={recurDays.has(opt.day)}
                  onCheckedChange={(v) => {
                    setRecurDays((prev) => {
                      const n = new Set(prev);
                      if (v === true) n.add(opt.day);
                      else n.delete(opt.day);
                      return n;
                    });
                  }}
                />
                {opt.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{previewDates(recurDates)}</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRecurOpen(false)}>Cancel</Button>
            <Button
              type="button"
              disabled={recurDates.length === 0 || calendarBusy}
              onClick={() => {
                void persistBlock(recurDates).then((ok) => {
                  if (ok) setRecurOpen(false);
                });
              }}
            >
              Block dates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
