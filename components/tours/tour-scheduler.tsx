"use client";

/**
 * TourScheduler — public tour booking experience.
 *
 * Flow: Date picker → Time slot grid → Contact form → Confirmation
 *
 * This is the "front door" for venue tours.
 * Design: clean, mobile-first, warm. Heritage Sage palette.
 * Every booking creates a lead in Wevenu automatically.
 */

import * as React from "react";

import { ChevronLeft, ChevronRight, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TourSlot, TourVenueInfo } from "@/lib/tours/types";

const SAGE = "#5D6F5D";
const LINEN = "#F7F5F1";
const TAUPE = "#B8AEA1";
const CREAM = "#F5F4F2";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const EVENT_TYPES = ["Wedding","Corporate Event","Social Event","Birthday / Milestone","Other"];

type Step = "calendar" | "form" | "confirm";

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatReadable(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

// ── Calendar ─────────────────────────────────────────────────────────────────

function CalendarPicker({ availableDates, selectedDate, onSelect, month, year, onMonthChange }: {
  availableDates: Set<string>;
  selectedDate: string | null;
  onSelect: (d: string) => void;
  month: number; year: number;
  onMonthChange: (m: number, y: number) => void;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() { if (month === 0) onMonthChange(11, year - 1); else onMonthChange(month - 1, year); }
  function nextMonth() { if (month === 11) onMonthChange(0, year + 1); else onMonthChange(month + 1, year); }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronLeft className="h-4 w-4" /></button>
        <p className="font-semibold text-heading">{MONTHS[month]} {year}</p>
        <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {DAYS.map((d) => <p key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">{d}</p>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const iso = isoDate(year, month, day);
          const isAvail = availableDates.has(iso);
          const isPast = new Date(year, month, day) < today;
          const isSel = iso === selectedDate;
          return (
            <button key={iso} type="button" disabled={!isAvail || isPast}
              onClick={() => onSelect(iso)}
              className={`rounded-lg py-2 text-sm font-medium transition-colors text-center ${
                isSel ? "text-white" : isAvail && !isPast ? "text-heading hover:bg-muted" : "text-muted-foreground/40"
              }`}
              style={isSel ? { background: SAGE } : isAvail && !isPast ? { background: `${SAGE}15` } : {}}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Time Slot Grid ────────────────────────────────────────────────────────────

function TimeSlots({ slots, selectedSlot, onSelect }: { slots: TourSlot[]; selectedSlot: TourSlot | null; onSelect: (s: TourSlot) => void }) {
  if (!slots.length) {
    return <p className="text-sm text-muted-foreground text-center py-6">No available times on this date. Please select a different day.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {slots.map((slot) => {
        const isSel = selectedSlot?.start === slot.start;
        return (
          <button key={slot.start} type="button" onClick={() => onSelect(slot)}
            className="rounded-xl border py-3 text-sm font-medium transition-colors"
            style={isSel ? { background: SAGE, borderColor: SAGE, color: "white" } : { borderColor: "#DED6CA", color: "#333" }}>
            <Clock className="h-3.5 w-3.5 inline mr-1 opacity-60" />
            {slot.time}
          </button>
        );
      })}
    </div>
  );
}

// ── Contact Form ─────────────────────────────────────────────────────────────

type FormFields = {
  firstName: string; lastName: string; partnerName: string;
  email: string; phone: string; eventType: string;
  eventDate: string; guestCount: string; notes: string;
};

const EMPTY: FormFields = { firstName: "", lastName: "", partnerName: "", email: "", phone: "", eventType: "", eventDate: "", guestCount: "", notes: "" };

function ContactForm({ onSubmit, pending }: { onSubmit: (f: FormFields) => void; pending: boolean }) {
  const [f, setF] = React.useState<FormFields>(EMPTY);
  const set = <K extends keyof FormFields>(k: K, v: string) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Your first name *</Label>
          <Input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Emily" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Last name *</Label>
          <Input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Carter" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Partner's name <span className="font-normal text-muted-foreground">(if applicable)</span></Label>
          <Input value={f.partnerName} onChange={(e) => set("partnerName", e.target.value)} placeholder="James Carter" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Email address *</Label>
          <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="emily@example.com" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Phone <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 234-5678" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Event type</Label>
          <select value={f.eventType} onChange={(e) => set("eventType", e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="">Select…</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Approximate event date <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input type="date" value={f.eventDate} onChange={(e) => set("eventDate", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Estimated guest count <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input type="number" min="1" value={f.guestCount} onChange={(e) => set("guestCount", e.target.value)} placeholder="150" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Anything you'd like us to know? <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Questions, specific needs, or anything you'd like to share…" />
        </div>
      </div>
      <Button type="button" className="w-full"
        disabled={!f.firstName.trim() || !f.lastName.trim() || !f.email.trim() || pending}
        onClick={() => onSubmit(f)}>
        {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Booking your tour…</> : "Confirm Tour →"}
      </Button>
    </div>
  );
}

// ── Confirmation ─────────────────────────────────────────────────────────────

function Confirmation({ venueName, scheduledAt, duration }: { venueName: string; scheduledAt: string; duration: number }) {
  return (
    <div className="py-8 text-center space-y-4">
      <div className="h-16 w-16 rounded-full mx-auto flex items-center justify-center" style={{ background: `${SAGE}20` }}>
        <span className="text-3xl">🌿</span>
      </div>
      <div>
        <h2 className="font-heading text-2xl font-semibold text-heading">You're confirmed!</h2>
        <p className="text-sm text-muted-foreground mt-1">We're looking forward to meeting you.</p>
      </div>
      <div className="rounded-xl border border-border bg-muted/30 p-5 text-left space-y-1.5 max-w-xs mx-auto">
        <p className="text-sm font-semibold text-heading">{venueName}</p>
        <p className="text-sm text-muted-foreground">{formatReadable(scheduledAt.slice(0, 10))}</p>
        <p className="text-sm text-muted-foreground">{formatTime(scheduledAt)} · {duration} minutes</p>
      </div>
      <p className="text-xs text-muted-foreground">A confirmation has been sent to your email. We'll follow up with details about your tour.</p>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────

export function TourScheduler({ tourKey, venue }: { tourKey: string; venue: TourVenueInfo }) {
  const today = new Date();
  const [step, setStep] = React.useState<Step>("calendar");
  const [month, setMonth] = React.useState(today.getMonth());
  const [year, setYear] = React.useState(today.getFullYear());
  const [slots, setSlots] = React.useState<TourSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<TourSlot | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState<{ scheduledAt: string; duration: number } | null>(null);

  // Fetch slots for the current month view
  React.useEffect(() => {
    setLoadingSlots(true);
    const start = isoDate(year, month, 1);
    const last = new Date(year, month + 1, 0).getDate();
    const end = isoDate(year, month, last);
    fetch(`/api/tours/slots?key=${tourKey}&start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((d: { slots: TourSlot[] }) => { setSlots(d.slots ?? []); })
      .catch(() => {})
      .finally(() => setLoadingSlots(false));
  }, [tourKey, month, year]);

  const availableDates = new Set(slots.map((s) => s.date));
  const slotsForDate = selectedDate ? slots.filter((s) => s.date === selectedDate) : [];

  function handleDateSelect(d: string) {
    setSelectedDate(d);
    setSelectedSlot(null);
  }

  function handleSlotSelect(s: TourSlot) {
    setSelectedSlot(s);
    setStep("form");
  }

  async function handleFormSubmit(fields: { firstName: string; lastName: string; partnerName: string; email: string; phone: string; eventType: string; eventDate: string; guestCount: string; notes: string }) {
    if (!selectedSlot) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/tours/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: tourKey, slotStart: selectedSlot.start, ...fields, guestCount: fields.guestCount ? parseInt(fields.guestCount) : null }),
      });
      const data = await res.json() as { ok: boolean; error?: string; scheduledAt?: string; duration?: number };
      if (!data.ok) { toast.error(data.error ?? "Could not complete booking. Please try again."); }
      else { setConfirmation({ scheduledAt: data.scheduledAt!, duration: data.duration ?? venue.duration }); setStep("confirm"); }
    } catch { toast.error("Something went wrong. Please try again."); }
    finally { setSubmitting(false); }
  }

  if (step === "confirm" && confirmation) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: LINEN }}>
        <header className="border-b border-[#DED6CA] bg-white px-6 py-4">
          <p className="text-sm font-semibold text-heading">{venue.name}</p>
        </header>
        <main className="flex-1 max-w-md mx-auto w-full px-4 py-8">
          <Confirmation venueName={venue.name} scheduledAt={confirmation.scheduledAt} duration={confirmation.duration} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: LINEN }}>
      {/* Header */}
      <header className="border-b border-[#DED6CA] bg-white px-6 py-4 space-y-0.5">
        <p className="text-xs text-muted-foreground">{venue.name}</p>
        <p className="font-heading text-lg font-semibold text-heading">{venue.headline}</p>
        {venue.description && <p className="text-xs text-muted-foreground">{venue.description}</p>}
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 space-y-6">
        {step === "calendar" && (
          <>
            {/* Calendar */}
            <div className="rounded-2xl border border-border bg-card p-5">
              {loadingSlots ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <CalendarPicker availableDates={availableDates} selectedDate={selectedDate}
                  onSelect={handleDateSelect} month={month} year={year}
                  onMonthChange={(m, y) => { setMonth(m); setYear(y); setSelectedDate(null); setSelectedSlot(null); }} />
              )}
            </div>

            {/* Time slots */}
            {selectedDate && (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <p className="text-sm font-semibold text-heading">{formatReadable(selectedDate)}</p>
                <TimeSlots slots={slotsForDate} selectedSlot={selectedSlot} onSelect={handleSlotSelect} />
              </div>
            )}

            {!selectedDate && !loadingSlots && (
              <p className="text-center text-sm text-muted-foreground">
                {availableDates.size > 0 ? "Select a highlighted date to see available times." : "No tour times available this month. Try the next month."}
              </p>
            )}
          </>
        )}

        {step === "form" && selectedSlot && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div>
              <button type="button" onClick={() => setStep("calendar")} className="text-xs text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1">
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </button>
              <p className="text-sm font-semibold text-heading">
                {formatReadable(selectedSlot.date)} at {selectedSlot.time}
              </p>
              <p className="text-xs text-muted-foreground">{venue.duration}-minute tour at {venue.name}</p>
            </div>
            <ContactForm onSubmit={handleFormSubmit} pending={submitting} />
          </div>
        )}
      </main>

      <footer className="text-center py-4 text-[10px]" style={{ color: TAUPE }}>
        Powered by Wevenu · {venue.name}
      </footer>
    </div>
  );
}
