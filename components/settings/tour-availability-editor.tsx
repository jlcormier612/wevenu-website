"use client";

import * as React from "react";

import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  addTourAvailabilityExceptionAction,
  removeTourAvailabilityExceptionAction,
  replaceTourAvailabilityWindowsAction,
} from "@/app/(app)/settings/tour-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DAYS_OF_WEEK } from "@/lib/venue/constants";
import type {
  TourAvailabilityException,
  TourAvailabilityWindow,
  TourAvailabilityWindowInput,
} from "@/lib/tours/types";

/** Monday-first for tour availability — a distinct concept from the
 * venue's own week_starts_on display setting, and Monday-first matches
 * how a coordinator naturally thinks about a weekly tour schedule. */
const MONDAY_FIRST_DAYS = [...DAYS_OF_WEEK.slice(1), DAYS_OF_WEEK[0]];

type EditableWindow = TourAvailabilityWindowInput & { key: string };

function toEditable(windows: TourAvailabilityWindow[]): EditableWindow[] {
  return windows.map((w) => ({ key: w.id, dayOfWeek: w.dayOfWeek, startTime: w.startTime, endTime: w.endTime }));
}

export function TourAvailabilityEditor({
  initialWindows,
  initialExceptions,
}: {
  initialWindows: TourAvailabilityWindow[];
  initialExceptions: TourAvailabilityException[];
}) {
  const [windows, setWindows] = React.useState<EditableWindow[]>(() => toEditable(initialWindows));
  const [savingWindows, startSaveWindows] = React.useTransition();

  const [exceptions, setExceptions] = React.useState<TourAvailabilityException[]>(initialExceptions);
  const [newException, setNewException] = React.useState({ startDate: "", endDate: "", label: "" });
  const [savingException, startSaveException] = React.useTransition();

  function windowsForDay(dayOfWeek: number): EditableWindow[] {
    return windows.filter((w) => w.dayOfWeek === dayOfWeek);
  }

  function toggleDay(dayOfWeek: number, enabled: boolean) {
    if (enabled) {
      setWindows((prev) => [...prev, { key: crypto.randomUUID(), dayOfWeek, startTime: "09:00", endTime: "17:00" }]);
    } else {
      setWindows((prev) => prev.filter((w) => w.dayOfWeek !== dayOfWeek));
    }
  }

  function addWindow(dayOfWeek: number) {
    setWindows((prev) => [...prev, { key: crypto.randomUUID(), dayOfWeek, startTime: "09:00", endTime: "17:00" }]);
  }

  function removeWindow(key: string) {
    setWindows((prev) => prev.filter((w) => w.key !== key));
  }

  function updateWindow(key: string, patch: Partial<TourAvailabilityWindowInput>) {
    setWindows((prev) => prev.map((w) => (w.key === key ? { ...w, ...patch } : w)));
  }

  function handleSaveWindows() {
    for (const w of windows) {
      if (w.endTime <= w.startTime) {
        toast.error("Each window's end time must be after its start time.");
        return;
      }
    }
    startSaveWindows(async () => {
      const result = await replaceTourAvailabilityWindowsAction(
        windows.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })),
      );
      if (result.ok) toast.success("Weekly availability saved.");
      else toast.error("Could not save weekly availability.");
    });
  }

  function handleAddException() {
    if (!newException.startDate) {
      toast.error("Choose a start date.");
      return;
    }
    const endDate = newException.endDate || newException.startDate;
    if (endDate < newException.startDate) {
      toast.error("End date must be on or after the start date.");
      return;
    }
    startSaveException(async () => {
      const result = await addTourAvailabilityExceptionAction({
        startDate: newException.startDate, endDate, label: newException.label,
      });
      if (result.ok) {
        toast.success("Blocked date added.");
        setExceptions((prev) => [...prev, {
          id: crypto.randomUUID(), startDate: newException.startDate, endDate, label: newException.label.trim() || null,
        }].sort((a, b) => a.startDate.localeCompare(b.startDate)));
        setNewException({ startDate: "", endDate: "", label: "" });
      } else {
        toast.error("Could not add blocked date.");
      }
    });
  }

  function handleRemoveException(id: string) {
    startSaveException(async () => {
      const result = await removeTourAvailabilityExceptionAction(id);
      if (result.ok) {
        toast.success("Blocked date removed.");
        setExceptions((prev) => prev.filter((e) => e.id !== id));
      } else {
        toast.error("Could not remove blocked date.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Weekly recurring availability */}
      <div className="space-y-3">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weekly Availability</Label>
          <p className="text-xs text-muted-foreground">Set the days and hours tours can be booked. Add more than one window per day if you want a midday gap.</p>
        </div>
        <div className="space-y-2">
          {MONDAY_FIRST_DAYS.map((day) => {
            const dayWindows = windowsForDay(day.value);
            const enabled = dayWindows.length > 0;
            return (
              <div key={day.value} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <Switch checked={enabled} onCheckedChange={(v) => toggleDay(day.value, v)} aria-label={`${day.label} enabled`} />
                  <span className="w-24 text-sm font-medium text-heading">{day.label}</span>
                  {!enabled && <span className="text-sm text-muted-foreground">Closed</span>}
                </div>
                {enabled && (
                  <div className="mt-2 space-y-2 pl-[52px]">
                    {dayWindows.map((w) => (
                      <div key={w.key} className="flex items-center gap-2">
                        <Input type="time" value={w.startTime} onChange={(e) => updateWindow(w.key, { startTime: e.target.value })} className="w-32" aria-label={`${day.label} window start`} />
                        <span className="text-sm text-muted-foreground">to</span>
                        <Input type="time" value={w.endTime} onChange={(e) => updateWindow(w.key, { endTime: e.target.value })} className="w-32" aria-label={`${day.label} window end`} />
                        <button type="button" onClick={() => removeWindow(w.key)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Remove window">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addWindow(day.value)}>
                      <Plus className="mr-1 h-3 w-3" /> Add another window
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={handleSaveWindows} disabled={savingWindows}>
            {savingWindows ? "Saving…" : "Save Weekly Availability"}
          </Button>
        </div>
      </div>

      {/* Exceptions */}
      <div className="space-y-3">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blocked Dates</Label>
          <p className="text-xs text-muted-foreground">Holidays, venue closures, or any date range tours shouldn&apos;t be offered — regardless of your weekly schedule above.</p>
        </div>
        {exceptions.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No blocked dates yet.</p>
        )}
        {exceptions.length > 0 && (
          <div className="space-y-1.5">
            {exceptions.map((exc) => (
              <div key={exc.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-heading">
                    {exc.startDate === exc.endDate ? exc.startDate : `${exc.startDate} – ${exc.endDate}`}
                  </span>
                  {exc.label && <span className="ml-2 text-muted-foreground">{exc.label}</span>}
                </div>
                <button type="button" onClick={() => handleRemoveException(exc.id)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Remove blocked date" disabled={savingException}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Start date</Label>
            <Input type="date" value={newException.startDate} onChange={(e) => setNewException((p) => ({ ...p, startDate: e.target.value }))} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">End date <span className="font-normal">(optional)</span></Label>
            <Input type="date" value={newException.endDate} onChange={(e) => setNewException((p) => ({ ...p, endDate: e.target.value }))} className="w-40" />
          </div>
          <div className="min-w-[160px] flex-1 space-y-1">
            <Label className="text-[10px] text-muted-foreground">Label <span className="font-normal">(optional)</span></Label>
            <Input value={newException.label} onChange={(e) => setNewException((p) => ({ ...p, label: e.target.value }))} placeholder="Christmas, Staff retreat…" />
          </div>
          <Button type="button" size="sm" onClick={handleAddException} disabled={savingException}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>
    </div>
  );
}
