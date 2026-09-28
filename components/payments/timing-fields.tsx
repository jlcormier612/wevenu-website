"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import type { PaymentTiming } from "@/lib/payments/constants";
import { parseDaysInput } from "@/lib/payments/parse-days-input";
import type { PlanBuilderLineDraft } from "@/lib/payments/plan-builder";

type TimingUiMode =
  | "due_today"
  | "after_execution"
  | "before_event"
  | "on_event"
  | "fixed"
  | "at_booking"
  | "after_booking";

function committedMode(line: PlanBuilderLineDraft): TimingUiMode {
  if (line.dueDate.trim()) return "fixed";
  if (line.timing.type === "due_today") return "due_today";
  if (line.timing.type === "after_execution") return "after_execution";
  if (line.timing.type === "on_event") return "on_event";
  if (line.timing.type === "at_booking") return "at_booking";
  if (line.timing.type === "after_booking") return "after_booking";
  return "before_event";
}

function committedDays(line: PlanBuilderLineDraft): number | "" {
  if (
    line.timing.type === "before_event"
    || line.timing.type === "after_execution"
    || line.timing.type === "after_booking"
  ) {
    return line.timing.days;
  }
  return "";
}

export { parseDaysInput };

export function TimingFields({
  line,
  onChange,
  today,
}: {
  line: PlanBuilderLineDraft;
  onChange: (timing: PaymentTiming, dueDate: string) => void;
  today?: string | null;
}) {
  const mode = committedMode(line);
  const [daysDraft, setDaysDraft] = React.useState<string | null>(null);
  const daysValue = daysDraft ?? String(committedDays(line));

  React.useEffect(() => {
    setDaysDraft(null);
  }, [line.id, line.timing.type]);

  function commitDays(raw: string, nextMode: TimingUiMode) {
    const parsed = parseDaysInput(raw);
    if (parsed.days == null) {
      setDaysDraft(raw);
      return;
    }
    setDaysDraft(null);
    if (nextMode === "after_execution") {
      onChange({ type: "after_execution", days: parsed.days }, "");
    } else if (nextMode === "after_booking") {
      onChange({ type: "after_booking", days: parsed.days }, "");
    } else {
      onChange({ type: "before_event", days: parsed.days }, "");
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Due date rule</label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={mode}
          onChange={(e) => {
            const v = e.target.value as TimingUiMode;
            setDaysDraft(null);
            if (v === "fixed") {
              onChange(line.timing, line.dueDate || today || "");
              return;
            }
            if (v === "due_today") {
              onChange({ type: "due_today" }, "");
              return;
            }
            if (v === "after_execution") {
              onChange({ type: "after_execution", days: 0 }, "");
              return;
            }
            if (v === "on_event") {
              onChange({ type: "on_event" }, "");
              return;
            }
            if (v === "at_booking") {
              onChange({ type: "at_booking" }, "");
              return;
            }
            if (v === "after_booking") {
              onChange({ type: "after_booking", days: 7 }, "");
              return;
            }
            onChange({ type: "before_event", days: 30 }, "");
          }}
        >
          <option value="due_today">Due today</option>
          <option value="after_execution">Days after contract is fully executed</option>
          <option value="before_event">Days before event</option>
          <option value="on_event">On event date</option>
          <option value="fixed">Specific date</option>
          {(mode === "at_booking" || mode === "after_booking") && (
            <>
              <option value="at_booking">At booking (legacy)</option>
              <option value="after_booking">Days after booking (legacy)</option>
            </>
          )}
        </select>
      </div>
      {mode === "before_event" || mode === "after_execution" || mode === "after_booking" ? (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Days</label>
          <Input
            type="number"
            min={0}
            data-testid="payment-timing-days"
            value={daysValue}
            onChange={(e) => commitDays(e.target.value, mode)}
            onBlur={() => {
              if (daysDraft != null && parseDaysInput(daysDraft).days == null) {
                setDaysDraft(null);
              }
            }}
          />
        </div>
      ) : mode === "fixed" ? (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Date</label>
          <Input
            type="date"
            value={line.dueDate}
            onChange={(e) => onChange(line.timing, e.target.value)}
          />
        </div>
      ) : (
        <div className="flex items-end pb-2 text-xs text-muted-foreground">
          {mode === "due_today"
            ? "Uses today’s date"
            : mode === "on_event"
              ? "Uses the event date"
              : mode === "at_booking"
                ? "Uses the Event booking date (legacy)"
                : null}
        </div>
      )}
    </div>
  );
}
