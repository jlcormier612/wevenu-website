"use client";

/**
 * Coordinator Tour Scheduling — the Lead owns the scheduling workflow.
 * "Open Lead → Schedule Tour → choose an available slot → Save → Done."
 * Calendar remains a read-only consumer of whatever this writes to
 * tour_appointments — this panel never touches Calendar or duplicates its
 * own copy of "is this slot available"; every slot shown here comes from
 * the same conflict-checked engine the public booking widget uses (see
 * lib/tours/service.ts's getCoordinatorTourSlots).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  getCoordinatorTourSlotsAction, rescheduleTourAction, scheduleTourAction, updateTourStatusAction,
} from "@/app/(app)/leads/[id]/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { TourAppointment, TourSlot } from "@/lib/tours/types";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const STATUS_META: Record<TourAppointment["status"], { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "bg-warning/15 text-warning-foreground" },
  confirmed: { label: "Confirmed", className: "bg-primary/15 text-primary" },
  completed: { label: "Completed", className: "bg-success/15 text-success" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
  no_show:   { label: "No-show",   className: "bg-destructive/15 text-destructive" },
};

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function CalendarGrid({ availableDates, selectedDate, onSelect, month, year, onMonthChange }: {
  availableDates: Set<string>; selectedDate: string | null; onSelect: (d: string) => void;
  month: number; year: number; onMonthChange: (m: number, y: number) => void;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() { if (month === 0) onMonthChange(11, year - 1); else onMonthChange(month - 1, year); }
  function nextMonth() { if (month === 11) onMonthChange(0, year + 1); else onMonthChange(month + 1, year); }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={prevMonth} aria-label="Previous month" className="p-2 rounded-lg hover:bg-muted transition-colors"><ChevronLeft className="h-4 w-4" /></button>
        <p className="text-sm font-semibold text-heading">{MONTHS[month]} {year}</p>
        <button type="button" onClick={nextMonth} aria-label="Next month" className="p-2 rounded-lg hover:bg-muted transition-colors"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {DAYS.map((d) => <p key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</p>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const iso = isoDate(year, month, day);
          const isAvail = availableDates.has(iso);
          const isPast = new Date(year, month, day) < today;
          const isSel = iso === selectedDate;
          return (
            <button key={iso} type="button" disabled={!isAvail || isPast} onClick={() => onSelect(iso)}
              className={`rounded-lg py-2 text-sm font-medium transition-colors text-center ${
                isSel ? "bg-primary text-primary-foreground" : isAvail && !isPast ? "bg-primary/10 text-heading hover:bg-primary/20" : "text-muted-foreground/40"
              }`}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimeSlotGrid({ slots, selectedSlot, onSelect }: { slots: TourSlot[]; selectedSlot: TourSlot | null; onSelect: (s: TourSlot) => void }) {
  if (!slots.length) return <p className="text-sm text-muted-foreground text-center py-6">No available times on this date.</p>;
  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((slot) => {
        const isSel = selectedSlot?.start === slot.start;
        return (
          <button key={slot.start} type="button" onClick={() => onSelect(slot)}
            className={`rounded-lg border py-2.5 text-sm font-medium transition-colors ${isSel ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:border-primary/40"}`}>
            <Clock className="h-3.5 w-3.5 inline mr-1 opacity-60" />{slot.time}
          </button>
        );
      })}
    </div>
  );
}

// Fresh state every time the sheet opens comes from remounting via `key`
// (see SlotPickerSheet below), not from an effect that resets state when
// `open` flips true — React Compiler treats setState-inside-an-effect as
// the thing to avoid; a key-driven remount needs no effect for this at all.
function SlotPickerBody({
  leadId, rescheduleAppointmentId, now, onClose, onDone,
}: {
  leadId: string; rescheduleAppointmentId: string | null; now: string;
  onClose: () => void; onDone: () => void;
}) {
  const today = new Date(now);
  const [month, setMonth] = React.useState(today.getMonth());
  const [year, setYear] = React.useState(today.getFullYear());
  const [slots, setSlots] = React.useState<TourSlot[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<TourSlot | null>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async (m: number, y: number) => {
    setLoading(true);
    const start = isoDate(y, m, 1);
    const end = isoDate(y, m, new Date(y, m + 1, 0).getDate());
    const result = await getCoordinatorTourSlotsAction(start, end);
    setSlots(result);
    setLoading(false);
  }, []);

  React.useEffect(() => { void load(month, year); }, [month, year, load]);

  const availableDates = new Set(slots.map((s) => s.date));
  const slotsForDate = selectedDate ? slots.filter((s) => s.date === selectedDate) : [];

  async function confirm() {
    if (!selectedSlot) return;
    setSaving(true);
    const result = rescheduleAppointmentId
      ? await rescheduleTourAction(rescheduleAppointmentId, leadId, selectedSlot.start)
      : await scheduleTourAction(leadId, selectedSlot.start);
    setSaving(false);
    if (result.ok) {
      toast.success(rescheduleAppointmentId ? "Tour rescheduled." : "Tour scheduled — confirmation sent.");
      onClose();
      onDone();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <SheetHeader className="px-5 pt-5 pb-4 border-b">
        <SheetTitle>{rescheduleAppointmentId ? "Reschedule Tour" : "Schedule Tour"}</SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <CalendarGrid availableDates={availableDates} selectedDate={selectedDate}
            onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
            month={month} year={year}
            onMonthChange={(m, y) => { setMonth(m); setYear(y); }} />
        )}
        {selectedDate && !loading && (
          <div className="space-y-2 border-t border-border/60 pt-4">
            <p className="text-xs font-medium text-muted-foreground">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <TimeSlotGrid slots={slotsForDate} selectedSlot={selectedSlot} onSelect={setSelectedSlot} />
          </div>
        )}
      </div>
      <SheetFooter className="px-5 pb-5 pt-3 border-t">
        <Button className="w-full" disabled={!selectedSlot || saving} onClick={() => void confirm()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </SheetFooter>
    </>
  );
}

function SlotPickerSheet({
  open, onOpenChange, leadId, rescheduleAppointmentId, now, instanceKey, onDone,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; leadId: string;
  rescheduleAppointmentId: string | null; now: string; instanceKey: number; onDone: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-md p-0">
        {open && (
          <SlotPickerBody
            key={instanceKey}
            leadId={leadId} rescheduleAppointmentId={rescheduleAppointmentId} now={now}
            onClose={() => onOpenChange(false)} onDone={onDone}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function CancelDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = React.useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => onOpenChange(false)}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-heading">Cancel this tour?</p>
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="text-sm" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Never mind</Button>
          <Button variant="destructive" size="sm" onClick={() => { onConfirm(reason); onOpenChange(false); setReason(""); }}>Cancel Tour</Button>
        </div>
      </div>
    </div>
  );
}

function AppointmentRow({ appt, leadId, now, onReschedule, onChanged }: { appt: TourAppointment; leadId: string; now: string; onReschedule: (id: string) => void; onChanged: () => void }) {
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const meta = STATUS_META[appt.status];
  const d = new Date(appt.scheduledAt);
  const isActive = appt.status === "scheduled" || appt.status === "confirmed";
  const isPast = d.getTime() < new Date(now).getTime();

  async function setStatus(status: "confirmed" | "completed" | "no_show" | "cancelled", reason?: string) {
    setPending(true);
    const result = await updateTourStatusAction(appt.id, leadId, status, reason);
    setPending(false);
    if (result.ok) { toast.success("Tour updated."); onChanged(); }
    else toast.error(result.error);
  }

  return (
    <div className="py-3 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <p className="text-sm font-medium text-heading">
          {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <p className="text-xs text-muted-foreground">
          {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {appt.durationMinutes} min
        </p>
        {appt.status === "cancelled" && appt.cancellationReason && (
          <p className="text-xs text-muted-foreground mt-0.5">Reason: {appt.cancellationReason}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${meta.className}`}>{meta.label}</span>
        {isActive && (
          <>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => onReschedule(appt.id)}>Reschedule</Button>
            {appt.status === "scheduled" && (
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => void setStatus("confirmed")}>Confirm</Button>
            )}
            {isPast && (
              <>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => void setStatus("completed")}>Completed</Button>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => void setStatus("no_show")}>No-show</Button>
              </>
            )}
            <Button variant="ghost" size="sm" disabled={pending} className="text-destructive" onClick={() => setCancelOpen(true)}>Cancel</Button>
          </>
        )}
      </div>
      <CancelDialog open={cancelOpen} onOpenChange={setCancelOpen} onConfirm={(reason) => void setStatus("cancelled", reason)} />
    </div>
  );
}

export function TourPanel({ leadId, tourAppointments, now }: { leadId: string; tourAppointments: TourAppointment[]; now: string }) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [rescheduleId, setRescheduleId] = React.useState<string | null>(null);
  const [instanceKey, setInstanceKey] = React.useState(0);
  const router = useRouter();

  // A fresh instanceKey each open remounts SlotPickerBody with clean state
  // — see the comment above it — rather than an effect resetting state
  // whenever `open` flips true.
  function openSchedule() { setRescheduleId(null); setInstanceKey((k) => k + 1); setSheetOpen(true); }
  function openReschedule(id: string) { setRescheduleId(id); setInstanceKey((k) => k + 1); setSheetOpen(true); }

  const sorted = [...tourAppointments].sort((a, b) => (a.scheduledAt < b.scheduledAt ? 1 : -1));

  return (
    <div className="mt-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Tours</CardTitle>
          <Button size="sm" onClick={openSchedule}>
            <CalendarClock className="mr-1.5 h-3.5 w-3.5" /> Schedule Tour
          </Button>
        </CardHeader>
        {sorted.length > 0 && (
          <CardContent className="divide-y divide-border/50 pt-0">
            {sorted.map((appt) => (
              <AppointmentRow key={appt.id} appt={appt} leadId={leadId} now={now} onReschedule={openReschedule} onChanged={router.refresh} />
            ))}
          </CardContent>
        )}
      </Card>
      <SlotPickerSheet
        open={sheetOpen} onOpenChange={setSheetOpen} leadId={leadId} now={now} instanceKey={instanceKey}
        rescheduleAppointmentId={rescheduleId} onDone={router.refresh}
      />
    </div>
  );
}
