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
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  getCoordinatorTourSlotsAction, getLeadPublicTourSchedulingUrlAction, previewRescheduleTourEmailAction, previewScheduleTourEmailAction, previewTourConfirmationRequestAction, requestTourConfirmationAction, rescheduleTourAction, scheduleTourAction, updateTourStatusAction,
} from "@/app/(app)/leads/[id]/actions";
import { TourSendPreview } from "@/components/leads/tour-send-preview";
import { MonthYearPicker } from "@/components/shared/month-year-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CALENDAR_MAX_YEAR } from "@/lib/calendar/types";
import { clampMonthYear } from "@/lib/calendar/month-year-range";
import type { TourAppointment, TourCustomerSendPreview, TourSlot } from "@/lib/tours/types";
import { tourDisplayClockIso } from "@/lib/tours/list-order";
import { prefillActualFromScheduled, tourActualDiffersFromScheduled } from "@/lib/tours/occurrence-clock";
import { isTourSlotConflictError } from "@/lib/tours/slot-conflict";
import { formatVenueLocalTourDisplay, utcToVenueLocalParts } from "@/lib/venue/timezone";
import { Input } from "@/components/ui/input";

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

/** Labels only — visual chrome uses shared `.htc-tours-status-badge` (2D-A). */
const STATUS_LABEL: Record<TourAppointment["status"], string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
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
  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate());
  const minYear = today.getFullYear();
  const maxYear = CALENDAR_MAX_YEAR;
  const atPastFloor = year < minYear || (year === minYear && month <= today.getMonth());
  const atFutureCeiling = year > maxYear || (year === maxYear && month >= 11);
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);

  function jumpTo(month0: number, nextYear: number) {
    const clamped = clampMonthYear(month0, nextYear, minYear, maxYear);
    if (clamped.year === minYear && clamped.month < today.getMonth()) {
      onMonthChange(today.getMonth(), minYear);
      return;
    }
    onMonthChange(clamped.month, clamped.year);
  }

  return (
    <div className="htc-tour-slot-calendar space-y-3" data-testid="tour-availability-calendar">
      <div className="htc-tour-slot-calendar-nav flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={atPastFloor}
          onClick={() => jumpTo(month - 1, year)}
          aria-label="Previous month"
          className="htc-tour-slot-calendar-nav-btn p-2 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <MonthYearPicker
          year={year}
          month={month + 1}
          minYear={minYear}
          maxYear={maxYear}
          onChange={(y, m1) => jumpTo(m1 - 1, y)}
        />
        <button
          type="button"
          disabled={atFutureCeiling}
          onClick={() => jumpTo(month + 1, year)}
          aria-label="Next month"
          className="htc-tour-slot-calendar-nav-btn p-2 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="htc-tour-slot-calendar-grid grid grid-cols-7 gap-1">
        {DAYS.map((d) => <p key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</p>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const iso = isoDate(year, month, day);
          const isAvail = availableDates.has(iso);
          const isPast = new Date(year, month, day) < today;
          const isSel = iso === selectedDate;
          const isToday = iso === todayIso;
          return (
            <button
              key={iso}
              type="button"
              disabled={!isAvail || isPast}
              onClick={() => onSelect(iso)}
              data-tour-cal-day={iso}
              data-tour-cal-available={isAvail && !isPast ? "true" : "false"}
              data-tour-cal-selected={isSel ? "true" : "false"}
              data-tour-cal-today={isToday ? "true" : "false"}
              className="htc-tour-slot-cal-day"
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function tourSlotDurationMinutes(slot: TourSlot): number | null {
  const start = Date.parse(slot.start);
  const end = Date.parse(slot.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.round((end - start) / 60000);
}

function TimeSlotGrid({ slots, selectedSlot, onSelect }: { slots: TourSlot[]; selectedSlot: TourSlot | null; onSelect: (s: TourSlot) => void }) {
  if (!slots.length) {
    return (
      <p className="htc-tour-slot-empty" data-testid="tour-slot-empty">
        No available times on this date.
      </p>
    );
  }
  return (
    <div className="htc-tour-slot-time-grid" data-testid="tour-slot-time-grid">
      {slots.map((slot) => {
        const isSel = selectedSlot?.start === slot.start;
        return (
          <button
            key={slot.start}
            type="button"
            onClick={() => onSelect(slot)}
            data-tour-slot-start={slot.start}
            data-tour-slot-selected={isSel ? "true" : "false"}
            className="htc-tour-slot-time-chip"
          >
            <Clock className="h-3.5 w-3.5 opacity-60" aria-hidden />
            <span>{slot.time}</span>
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
  const [preview, setPreview] = React.useState<TourCustomerSendPreview | null>(null);
  const [previewing, setPreviewing] = React.useState(false);

  const load = React.useCallback(async (m: number, y: number) => {
    setLoading(true);
    const start = isoDate(y, m, 1);
    const end = isoDate(y, m, new Date(y, m + 1, 0).getDate());
    const result = await getCoordinatorTourSlotsAction(start, end, rescheduleAppointmentId);
    setSlots(result);
    setLoading(false);
  }, [rescheduleAppointmentId]);

  React.useEffect(() => { void load(month, year); }, [month, year, load]);

  const availableDates = new Set(slots.map((s) => s.date));
  const slotsForDate = selectedDate ? slots.filter((s) => s.date === selectedDate) : [];
  const durationMinutes = selectedSlot
    ? tourSlotDurationMinutes(selectedSlot)
    : (slotsForDate[0] ? tourSlotDurationMinutes(slotsForDate[0]) : null);

  async function review() {
    if (!selectedSlot) return;
    setPreviewing(true);
    const result = rescheduleAppointmentId
      ? await previewRescheduleTourEmailAction(rescheduleAppointmentId, selectedSlot.start)
      : await previewScheduleTourEmailAction(leadId, selectedSlot.start);
    setPreviewing(false);
    if (result.ok) setPreview(result.preview);
    else toast.error(result.error);
  }

  async function confirm() {
    if (!selectedSlot) return;
    setSaving(true);
    const result = rescheduleAppointmentId
      ? await rescheduleTourAction(rescheduleAppointmentId, leadId, selectedSlot.start)
      : await scheduleTourAction(leadId, selectedSlot.start);
    setSaving(false);
    if (result.ok) {
      toast.success(rescheduleAppointmentId ? "Tour rescheduled." : "Tour scheduled.");
      if (result.confirmationEmail.ok) toast.success("Confirmation email sent.");
      else toast.error(result.confirmationEmail.message);
      onClose();
      onDone();
      return;
    }
    toast.error(result.error);
    if (isTourSlotConflictError(result.error)) {
      // Decision H: refresh authority, keep sheet + date, clear invalid time/preview.
      setSelectedSlot(null);
      setPreview(null);
      await load(month, year);
    }
  }

  return (
    <div className="htc-tour-slot-sheet flex h-full min-h-0 flex-col" data-testid="tour-slot-picker-body">
      <SheetHeader className="htc-tour-slot-sheet-header px-5 pt-5 pb-4 border-b shrink-0">
        <SheetTitle>{rescheduleAppointmentId ? "Reschedule Tour" : "Schedule Tour"}</SheetTitle>
      </SheetHeader>
      <div className="htc-tour-slot-sheet-body flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
        <div className="htc-tour-slot-guidance" data-testid="tour-slot-availability-guidance">
          <p className="htc-tour-slot-guidance-title">Available tour times</p>
          <p className="htc-tour-slot-guidance-copy">
            Only times that are available for this venue are shown.
          </p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <CalendarGrid availableDates={availableDates} selectedDate={selectedDate}
            onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); setPreview(null); }}
            month={month} year={year}
            onMonthChange={(m, y) => { setMonth(m); setYear(y); }} />
        )}
        {selectedDate && !loading && !preview && (
          <div className="htc-tour-slot-times space-y-2 border-t border-border/60 pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              {durationMinutes != null ? (
                <p className="htc-tour-slot-duration" data-testid="tour-slot-duration-info">
                  {durationMinutes}-minute tour
                </p>
              ) : null}
            </div>
            <TimeSlotGrid slots={slotsForDate} selectedSlot={selectedSlot} onSelect={(slot) => { setSelectedSlot(slot); setPreview(null); }} />
          </div>
        )}
        {preview && <TourSendPreview preview={preview} />}
      </div>
      <SheetFooter className="htc-tour-slot-sheet-footer px-5 pb-5 pt-3 border-t shrink-0">
        {preview ? (
          <div className="htc-tour-slot-sheet-footer-row flex w-full gap-2">
            <Button
              variant="outline"
              className="htc-tour-slot-footer-secondary flex-1"
              disabled={saving}
              onClick={() => setPreview(null)}
            >
              Back
            </Button>
            <Button
              className="htc-tour-slot-footer-primary flex-1"
              disabled={saving}
              onClick={() => void confirm()}
              data-testid="tour-slot-confirm"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : rescheduleAppointmentId ? "Reschedule tour" : "Schedule tour"}
            </Button>
          </div>
        ) : (
          <Button
            className="htc-tour-slot-footer-primary w-full"
            disabled={!selectedSlot || previewing}
            onClick={() => void review()}
            data-testid="tour-slot-review-email"
          >
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Review email"}
          </Button>
        )}
      </SheetFooter>
    </div>
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
      <SheetContent
        side="right"
        className="htc-tour-slot-sheet-content flex flex-col w-full sm:max-w-md p-0"
        data-testid="tour-slot-picker-sheet"
      >
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

const OUTCOME_NOTE_MAX = 500;

type ActualOccurrenceFields = {
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
};

type OutcomeDialogProps = {
  open: boolean;
  title: string;
  body: string;
  summary?: string | null;
  noteLabel: string;
  notePlaceholder: string;
  primaryLabel: string;
  secondaryLabel: string;
  primaryVariant?: "default" | "destructive";
  pending?: boolean;
  initialNote?: string;
  /** Completed dialog only — optional venue-local actual occurrence. */
  actualOccurrence?: ActualOccurrenceFields | null;
  onClose: () => void;
  onConfirm: (note: string) => void;
};

function OutcomeConfirmDialog({
  open, title, body, summary, noteLabel, notePlaceholder,
  primaryLabel, secondaryLabel, primaryVariant = "default",
  pending, initialNote = "", actualOccurrence = null, onClose, onConfirm,
}: OutcomeDialogProps) {
  const [note, setNote] = React.useState(initialNote);
  React.useEffect(() => {
    if (open) setNote(initialNote);
  }, [open, initialNote]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => { if (!pending) onClose(); }}
      data-testid="tour-outcome-dialog-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-outcome-dialog-title"
        className="w-full max-w-[440px] rounded-xl border border-border bg-card p-5 md:p-6 space-y-3 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        data-testid="tour-outcome-dialog"
      >
        <p id="tour-outcome-dialog-title" className="text-sm font-semibold text-heading">{title}</p>
        <p className="text-[13px] text-muted-foreground leading-snug">{body}</p>
        {summary ? (
          <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-heading" data-testid="tour-outcome-dialog-summary">
            {summary}
          </p>
        ) : null}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{noteLabel}</Label>
          <Textarea
            rows={3}
            value={note}
            maxLength={OUTCOME_NOTE_MAX}
            onChange={(e) => setNote(e.target.value.slice(0, OUTCOME_NOTE_MAX))}
            placeholder={notePlaceholder}
            className="text-sm min-h-20"
            data-testid="tour-outcome-dialog-note"
          />
          <p className="text-[11px] text-muted-foreground text-right">{note.length}/{OUTCOME_NOTE_MAX}</p>
        </div>
        {actualOccurrence ? (
          <div className="space-y-2" data-testid="tour-outcome-actual-occurrence">
            <p className="text-xs font-medium text-heading">Actually occurred (optional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="tour-actual-date" className="text-xs text-muted-foreground">Date</Label>
                <Input
                  id="tour-actual-date"
                  type="date"
                  value={actualOccurrence.date}
                  onChange={(e) => actualOccurrence.onDateChange(e.target.value)}
                  data-testid="tour-outcome-actual-date"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tour-actual-time" className="text-xs text-muted-foreground">Time</Label>
                <Input
                  id="tour-actual-time"
                  type="time"
                  value={actualOccurrence.time}
                  onChange={(e) => actualOccurrence.onTimeChange(e.target.value)}
                  data-testid="tour-outcome-actual-time"
                />
              </div>
            </div>
          </div>
        ) : null}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 sm:min-h-9"
            disabled={pending}
            onClick={onClose}
            data-testid="tour-outcome-dialog-secondary"
          >
            {secondaryLabel}
          </Button>
          <Button
            type="button"
            variant={primaryVariant}
            className="min-h-11 sm:min-h-9"
            disabled={pending}
            onClick={() => onConfirm(note)}
            data-testid="tour-outcome-dialog-primary"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditOutcomeDialog({
  open, appt, venueTimezone, pending, onClose, onSave,
}: {
  open: boolean;
  appt: TourAppointment;
  venueTimezone: string | null;
  pending: boolean;
  onClose: () => void;
  onSave: (status: TourAppointment["status"], note: string) => void;
}) {
  const [status, setStatus] = React.useState<TourAppointment["status"]>(appt.status);
  const [note, setNote] = React.useState(appt.notes ?? appt.cancellationReason ?? "");
  React.useEffect(() => {
    if (!open) return;
    setStatus(appt.status);
    setNote(appt.notes ?? appt.cancellationReason ?? "");
  }, [open, appt]);
  if (!open) return null;
  const scheduled = appt.scheduledAt
    ? formatVenueLocalTourDisplay(appt.scheduledAt, venueTimezone)
    : null;
  const options: TourAppointment["status"][] = ["scheduled", "completed", "no_show", "cancelled"];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { if (!pending) onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[440px] rounded-xl border border-border bg-card p-5 md:p-6 space-y-3 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        data-testid="tour-edit-outcome-dialog"
      >
        <p className="text-sm font-semibold text-heading">Update tour outcome</p>
        {scheduled ? (
          <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-heading">
            {scheduled.dateLabel} · {scheduled.timeLabel}
            <span className="text-muted-foreground"> · Current: {STATUS_LABEL[appt.status]}</span>
          </p>
        ) : null}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tour status</Label>
          <select
            className="w-full min-h-11 rounded-md border border-border bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as TourAppointment["status"])}
            data-testid="tour-edit-outcome-status"
          >
            {options.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Note (optional)</Label>
          <Textarea
            rows={3}
            value={note}
            maxLength={OUTCOME_NOTE_MAX}
            onChange={(e) => setNote(e.target.value.slice(0, OUTCOME_NOTE_MAX))}
            placeholder="Add or update a note for your team."
            className="text-sm min-h-20"
            data-testid="tour-edit-outcome-note"
          />
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button type="button" variant="outline" className="min-h-11 sm:min-h-9" disabled={pending} onClick={onClose}>
            Keep current status
          </Button>
          <Button
            type="button"
            className="min-h-11 sm:min-h-9"
            disabled={pending}
            onClick={() => onSave(status, note)}
            data-testid="tour-edit-outcome-save"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function recordedLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function AppointmentRow({
  appt, leadId, now, venueTimezone, onReschedule, onScheduleAnother, onChanged,
}: {
  appt: TourAppointment;
  leadId: string;
  now: string;
  venueTimezone: string | null;
  onReschedule: (id: string) => void;
  onScheduleAnother: () => void;
  onChanged: () => void;
}) {
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [completeOpen, setCompleteOpen] = React.useState(false);
  const [noShowOpen, setNoShowOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [requestPreview, setRequestPreview] = React.useState<TourCustomerSendPreview | null>(null);
  const scheduledParts = appt.scheduledAt
    ? utcToVenueLocalParts(appt.scheduledAt, venueTimezone)
    : { date: "", time: "" };
  const [actualDate, setActualDate] = React.useState(scheduledParts.date);
  const [actualTime, setActualTime] = React.useState(scheduledParts.time);
  const statusLabel = STATUS_LABEL[appt.status];
  const clockIso = tourDisplayClockIso(appt);
  const d = clockIso ? new Date(clockIso) : new Date(0);
  const { dateLabel, timeLabel } = formatVenueLocalTourDisplay(clockIso ?? new Date(0).toISOString(), venueTimezone);
  const scheduledDisplay = appt.scheduledAt
    ? formatVenueLocalTourDisplay(appt.scheduledAt, venueTimezone)
    : null;
  const isActive = appt.status === "scheduled" || appt.status === "confirmed";
  const isTerminal = appt.status === "completed" || appt.status === "no_show" || appt.status === "cancelled";
  const isPast = d.getTime() < new Date(now).getTime();
  const showOverdue = appt.status === "scheduled" && isPast;
  const showScheduledAside =
    appt.status === "completed" && tourActualDiffersFromScheduled(appt) && Boolean(appt.scheduledAt);
  const whenKind =
    appt.status === "completed" && appt.actualOccurredAt ? "Actually occurred" : "Scheduled";
  const tourSummary = scheduledDisplay
    ? `${scheduledDisplay.dateLabel} · ${scheduledDisplay.timeLabel}`
    : null;
  const outcomeNote = (appt.notes ?? appt.cancellationReason ?? "").trim();
  const recordedAt = recordedLabel(
    appt.status === "completed"
      ? (appt.completedAt ?? appt.updatedAt ?? appt.createdAt)
      : (appt.updatedAt ?? appt.createdAt),
  );

  function openComplete() {
    const prefill = prefillActualFromScheduled({
      scheduledAt: appt.scheduledAt,
      timezone: venueTimezone,
      utcToParts: utcToVenueLocalParts,
    });
    if (prefill.fromScheduled) {
      setActualDate(prefill.date);
      setActualTime(prefill.time);
    } else if (appt.actualOccurredAt && !prefill.scheduledStillAhead) {
      const parts = utcToVenueLocalParts(appt.actualOccurredAt, venueTimezone);
      setActualDate(parts.date);
      setActualTime(parts.time);
    } else {
      setActualDate("");
      setActualTime("");
    }
    setCompleteOpen(true);
  }

  function confirmComplete(note: string) {
    const hasDate = Boolean(actualDate.trim());
    const hasTime = Boolean(actualTime.trim());
    if (hasDate !== hasTime) {
      toast.error("Enter when the tour actually occurred.");
      return;
    }
    void setStatus("completed", undefined, {
      notes: note || null,
      ...(hasDate ? { actualDate, actualTime } : {}),
    });
  }

  async function setStatus(
    status: "scheduled" | "confirmed" | "completed" | "no_show" | "cancelled",
    reason?: string,
    options?: {
      actualDate?: string;
      actualTime?: string;
      notes?: string | null;
      staffCorrection?: boolean;
    },
  ) {
    setPending(true);
    const previousStatus = appt.status;
    const result = await updateTourStatusAction(appt.id, leadId, status, reason, options);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setCompleteOpen(false);
    setNoShowOpen(false);
    setCancelOpen(false);
    setEditOpen(false);
    onChanged();

    if (options?.staffCorrection) {
      toast.success("Tour updated.");
      return;
    }
    if (status === "confirmed") {
      toast.success("Tour marked confirmed.");
      return;
    }
    if (status === "no_show") {
      toast.success("Tour marked as a no-show.", {
        action: {
          label: "Undo",
          onClick: () => {
            void updateTourStatusAction(appt.id, leadId, previousStatus === "confirmed" ? "confirmed" : "scheduled", undefined, {
              staffCorrection: true,
            }).then((undo) => {
              if (undo.ok) {
                toast.success("Tour restored.");
                onChanged();
              } else toast.error(undo.error ?? "Could not undo.");
            });
          },
        },
      });
      return;
    }
    if (status === "completed") {
      toast.success("Tour marked completed.");
      return;
    }
    if (status === "cancelled") {
      toast.success("Tour cancelled.");
      return;
    }
    toast.success("Tour updated.");
  }

  async function reviewConfirmationRequest() {
    setPending(true);
    const result = await previewTourConfirmationRequestAction(appt.id);
    setPending(false);
    if (result.ok) setRequestPreview(result.preview);
    else toast.error(result.error);
  }

  async function sendConfirmationRequest() {
    setPending(true);
    const result = await requestTourConfirmationAction(appt.id, leadId);
    setPending(false);
    if (result.ok) {
      toast.success("Confirmation request sent.");
      setRequestPreview(null);
      onChanged();
    } else toast.error(result.error);
  }

  return (
    <div
      className="htc-lead-tour-appt"
      data-testid={`tour-appointment-row-${appt.id}`}
      data-tour-status={appt.status}
      data-tour-overdue={showOverdue ? "true" : undefined}
    >
      <div className="htc-lead-tour-appt-summary">
        <div className="htc-lead-tour-appt-when min-w-0">
          <p className="htc-lead-tour-appt-date" data-tour-date="">
            {dateLabel}
          </p>
          <p className="htc-lead-tour-appt-time" data-tour-time="">
            <span className="htc-lead-tour-appt-when-kind">{whenKind}</span>
            {" · "}
            {timeLabel}
            {" · "}
            {appt.durationMinutes} min
          </p>
          {showScheduledAside && scheduledDisplay ? (
            <p className="htc-lead-tour-appt-aside">
              Originally scheduled {scheduledDisplay.dateLabel} · {scheduledDisplay.timeLabel}
            </p>
          ) : null}
          {appt.status === "scheduled" && appt.confirmationRequestedAt ? (
            <p className="htc-lead-tour-appt-aside">
              Confirmation requested{" "}
              {new Date(appt.confirmationRequestedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}{" "}
              — awaiting reply
            </p>
          ) : null}
        </div>
        <div className="htc-lead-tour-appt-badges shrink-0">
          <span
            className="htc-tours-status-badge"
            data-tours-status-badge={appt.status}
            data-testid={`tour-appointment-status-${appt.id}`}
          >
            {statusLabel}
          </span>
          {showOverdue ? (
            <span className="htc-lead-tour-overdue" data-tour-overdue-badge="">
              Overdue
            </span>
          ) : null}
        </div>
      </div>

      {isTerminal ? (
        <div className="htc-lead-tour-outcome" data-testid={`tour-appointment-outcome-${appt.id}`}>
          <p className="htc-lead-tour-outcome-line">
            <span className="font-medium text-heading">
              {appt.status === "no_show" ? "No show" : STATUS_LABEL[appt.status]}
            </span>
            {recordedAt ? <span className="text-muted-foreground">{` · Recorded ${recordedAt}`}</span> : null}
          </p>
          {outcomeNote ? (
            <p className="htc-lead-tour-outcome-note" data-testid={`tour-appointment-outcome-note-${appt.id}`}>
              {outcomeNote}
            </p>
          ) : null}
          <div className="htc-lead-tour-outcome-actions">
            {(appt.status === "no_show" || appt.status === "cancelled") ? (
              <button
                type="button"
                className="htc-lead-tour-outcome-link"
                onClick={onScheduleAnother}
                data-testid={`tour-appointment-schedule-another-${appt.id}`}
              >
                Schedule another tour
              </button>
            ) : null}
            {appt.status === "completed" ? (
              <button
                type="button"
                className="htc-lead-tour-outcome-link"
                onClick={() => setEditOpen(true)}
                data-testid={`tour-appointment-add-note-${appt.id}`}
              >
                Add or edit note
              </button>
            ) : null}
            <button
              type="button"
              className="htc-lead-tour-outcome-link"
              onClick={() => setEditOpen(true)}
              data-testid={`tour-appointment-correct-outcome-${appt.id}`}
            >
              Edit outcome
            </button>
          </div>
        </div>
      ) : null}

      {isActive ? (
        <div
          className="htc-lead-tour-appt-actions"
          data-testid={`tour-appointment-actions-${appt.id}`}
        >
          <Button
            variant="outline"
            size="sm"
            className="htc-lead-tour-action-secondary"
            disabled={pending}
            onClick={() => onReschedule(appt.id)}
            data-testid={`tour-appointment-reschedule-${appt.id}`}
          >
            Reschedule
          </Button>
          {appt.status === "scheduled" ? (
            <div className="htc-lead-tour-confirm-actions" data-tour-confirm-actions="">
              <Button
                size="sm"
                className="htc-lead-tour-confirm-primary"
                disabled={pending}
                onClick={() => void setStatus("confirmed")}
              >
                Mark as Confirmed
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="htc-lead-tour-confirm-secondary"
                disabled={pending}
                onClick={() => void reviewConfirmationRequest()}
              >
                Send Confirmation Request
              </Button>
            </div>
          ) : null}
          {(isPast || Boolean(appt.scheduledAt)) && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="htc-lead-tour-action-secondary"
                disabled={pending}
                onClick={openComplete}
              >
                Mark Completed
              </Button>
              {isPast ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="htc-lead-tour-action-secondary"
                  disabled={pending}
                  onClick={() => setNoShowOpen(true)}
                >
                  No Show
                </Button>
              ) : null}
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="htc-lead-tour-action-destructive"
            disabled={pending}
            onClick={() => setCancelOpen(true)}
          >
            Cancel
          </Button>
        </div>
      ) : null}

      <OutcomeConfirmDialog
        open={noShowOpen}
        title="Mark this tour as a no-show?"
        body="We'll record that the tour didn't take place. You can add a note now or update the outcome later."
        summary={tourSummary}
        noteLabel="Add a note (optional)"
        notePlaceholder="For example, couldn't reach the couple, or they called to reschedule."
        primaryLabel="Mark No Show"
        secondaryLabel="Keep Scheduled"
        pending={pending}
        onClose={() => setNoShowOpen(false)}
        onConfirm={(note) => void setStatus("no_show", undefined, { notes: note || null })}
      />
      <OutcomeConfirmDialog
        open={completeOpen}
        title="Mark this tour as completed?"
        body="We'll record that this tour took place. Add a note if there's anything your team should remember."
        summary={tourSummary}
        noteLabel="Add a note (optional)"
        notePlaceholder="For example, loved the garden ceremony space; follow up with pricing."
        primaryLabel="Mark Completed"
        secondaryLabel="Keep Scheduled"
        pending={pending}
        actualOccurrence={{
          date: actualDate,
          time: actualTime,
          onDateChange: setActualDate,
          onTimeChange: setActualTime,
        }}
        onClose={() => setCompleteOpen(false)}
        onConfirm={confirmComplete}
      />
      <OutcomeConfirmDialog
        open={cancelOpen}
        title="Cancel this tour?"
        body="This will cancel the scheduled tour. You can keep a note about why it was cancelled."
        summary={tourSummary}
        noteLabel="Reason or note (optional)"
        notePlaceholder="For example, requested a different date."
        primaryLabel="Cancel Tour"
        secondaryLabel="Keep Tour"
        primaryVariant="destructive"
        pending={pending}
        onClose={() => setCancelOpen(false)}
        onConfirm={(note) => void setStatus("cancelled", note || undefined, { notes: note || null })}
      />
      <EditOutcomeDialog
        open={editOpen}
        appt={appt}
        venueTimezone={venueTimezone}
        pending={pending}
        onClose={() => setEditOpen(false)}
        onSave={(status, note) => void setStatus(status, note || undefined, {
          notes: note || null,
          staffCorrection: true,
        })}
      />
      {requestPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRequestPreview(null)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-heading">Send confirmation request</p>
            <TourSendPreview preview={requestPreview} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" disabled={pending} onClick={() => setRequestPreview(null)}>Back</Button>
              <Button size="sm" disabled={pending || !requestPreview.who} onClick={() => void sendConfirmationRequest()}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send email"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type TourScheduleContextValue = {
  leadId: string;
  now: string;
  venueTimezone: string | null;
  sorted: TourAppointment[];
  copyingLink: boolean;
  openSchedule: () => void;
  openReschedule: (id: string) => void;
  copyLink: () => Promise<void>;
};

const TourScheduleContext = React.createContext<TourScheduleContextValue | null>(null);

function useTourSchedule() {
  const value = React.useContext(TourScheduleContext);
  if (!value) throw new Error("Tour scheduling controls must sit inside TourScheduleRoot.");
  return value;
}

export function TourScheduleRoot({
  leadId,
  tourAppointments,
  now,
  venueTimezone = null,
  children,
}: {
  leadId: string;
  tourAppointments: TourAppointment[];
  now: string;
  venueTimezone?: string | null;
  children: React.ReactNode;
}) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [rescheduleId, setRescheduleId] = React.useState<string | null>(null);
  const [instanceKey, setInstanceKey] = React.useState(0);
  const [copyingLink, setCopyingLink] = React.useState(false);
  const router = useRouter();

  function openSchedule() { setRescheduleId(null); setInstanceKey((k) => k + 1); setSheetOpen(true); }
  function openReschedule(id: string) { setRescheduleId(id); setInstanceKey((k) => k + 1); setSheetOpen(true); }

  async function copyLink() {
    setCopyingLink(true);
    try {
      const path = await getLeadPublicTourSchedulingUrlAction(leadId);
      if (!path) {
        toast.error("Tour scheduling link is not available for this lead.");
        return;
      }
      const url = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(url);
      toast.success(
        "Personal scheduling link copied. Send this when they already inquired — it keeps their preferred date and hold. The Calendar “Copy tour scheduling link” is for general promotion only.",
      );
    } finally {
      setCopyingLink(false);
    }
  }

  const sorted = [...tourAppointments].sort((a, b) => {
    const ac = tourDisplayClockIso(a) ?? "";
    const bc = tourDisplayClockIso(b) ?? "";
    return ac < bc ? 1 : ac > bc ? -1 : 0;
  });

  return (
    <TourScheduleContext.Provider value={{
      leadId, now, venueTimezone: venueTimezone ?? null, sorted, copyingLink, openSchedule, openReschedule, copyLink,
    }}>
      {children}
      <SlotPickerSheet
        open={sheetOpen} onOpenChange={setSheetOpen} leadId={leadId} now={now} instanceKey={instanceKey}
        rescheduleAppointmentId={rescheduleId} onDone={router.refresh}
      />
    </TourScheduleContext.Provider>
  );
}

export function TourScheduleActions({
  includeCopyLink = true,
  includeSchedule = true,
}: {
  includeCopyLink?: boolean;
  /** When false, only the copy-link control is shown (Schedule Tour lives elsewhere). */
  includeSchedule?: boolean;
}) {
  const { copyingLink, copyLink, openSchedule } = useTourSchedule();
  if (!includeCopyLink && !includeSchedule) return null;
  return (
    <div className="htc-lead-tour-schedule-actions space-y-2" data-testid="tour-schedule-actions">
      {includeCopyLink ? (
        <div
          className="htc-lead-tour-personal-link"
          data-testid="lead-personalized-scheduling-link"
        >
          <div className="htc-lead-tour-personal-link-body min-w-0">
            <p className="htc-lead-tour-personal-link-label">Personalized scheduling link</p>
            <p
              className="htc-lead-tour-personal-link-guidance"
              data-testid="lead-scheduling-link-guidance"
            >
              For this lead only — keeps preferred date and hold context. The Calendar page&apos;s{" "}
              <span className="font-medium text-foreground">Copy tour scheduling link</span> is the
              general link for websites, QR codes, and new prospects.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="htc-lead-tour-personal-link-btn"
            disabled={copyingLink}
            onClick={() => void copyLink()}
            data-testid="lead-copy-scheduling-link"
          >
            {copyingLink ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Copy link
          </Button>
        </div>
      ) : null}
      {includeSchedule ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="htc-lead-tour-schedule-btn"
            onClick={openSchedule}
            data-testid="schedule-tour-action"
          >
            <CalendarClock className="mr-1.5 h-3.5 w-3.5" /> Schedule Tour
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function TourAppointmentList() {
  const { sorted, leadId, now, venueTimezone, openReschedule, openSchedule } = useTourSchedule();
  const router = useRouter();
  if (sorted.length === 0) {
    return (
      <div
        className="htc-lead-tour-empty"
        data-testid="tour-appointment-list-empty"
        data-tour-empty="none"
      >
        <p className="htc-lead-tour-empty-title">No tour appointment scheduled</p>
        <p className="htc-lead-tour-empty-copy">
          Use Schedule Tour to book a slot for this lead, or share their personalized scheduling
          link.
        </p>
      </div>
    );
  }
  return (
    <div className="htc-lead-tour-list" data-testid="tour-appointment-list">
      {sorted.map((appt) => (
        <AppointmentRow
          key={appt.id}
          appt={appt}
          leadId={leadId}
          now={now}
          venueTimezone={venueTimezone}
          onReschedule={openReschedule}
          onScheduleAnother={openSchedule}
          onChanged={router.refresh}
        />
      ))}
    </div>
  );
}

export function TourPanel({ leadId, tourAppointments, now, venueTimezone = null }: { leadId: string; tourAppointments: TourAppointment[]; now: string; venueTimezone?: string | null }) {
  return (
    <TourScheduleRoot leadId={leadId} tourAppointments={tourAppointments} now={now} venueTimezone={venueTimezone}>
      <div className="mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Tours</CardTitle>
            <TourScheduleActions />
          </CardHeader>
          <CardContent className="pt-0">
            <TourAppointmentList />
          </CardContent>
        </Card>
      </div>
    </TourScheduleRoot>
  );
}
