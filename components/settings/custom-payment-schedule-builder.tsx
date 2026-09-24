"use client";

import * as React from "react";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  OBLIGATION_KIND_OPTIONS,
  type PaymentTiming,
} from "@/lib/payments/constants";
import {
  defaultCustomScheduleTemplate,
  validateCustomScheduleTemplate,
  type CustomScheduleAmountMode,
  type CustomScheduleTemplate,
  type CustomScheduleTemplateItem,
} from "@/lib/payments/custom-default-schedule";
import type { PaymentObligationKind } from "@/lib/payments/types";

function timingMode(timing: PaymentTiming): "at_booking" | "before_event" | "after_booking" {
  if (timing.type === "at_booking") return "at_booking";
  if (timing.type === "after_booking") return "after_booking";
  return "before_event";
}

function TimingEditor({
  timing,
  onChange,
}: {
  timing: PaymentTiming;
  onChange: (t: PaymentTiming) => void;
}) {
  const mode = timingMode(timing);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Due</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={mode}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "at_booking") onChange({ type: "at_booking" });
            else if (v === "after_booking") onChange({ type: "after_booking", days: 7 });
            else onChange({ type: "before_event", days: 30 });
          }}
        >
          <option value="at_booking">At booking</option>
          <option value="before_event">Days before event</option>
          <option value="after_booking">Days after booking</option>
        </select>
      </div>
      {mode === "before_event" || mode === "after_booking" ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Days</Label>
          <Input
            type="number"
            min={0}
            value={
              timing.type === "before_event" || timing.type === "after_booking"
                ? timing.days
                : 0
            }
            onChange={(e) => {
              const days = Math.max(0, Number(e.target.value) || 0);
              onChange(
                mode === "after_booking"
                  ? { type: "after_booking", days }
                  : { type: "before_event", days },
              );
            }}
          />
        </div>
      ) : (
        <p className="flex items-end pb-2 text-xs text-muted-foreground">
          Uses the booking date
        </p>
      )}
    </div>
  );
}

/**
 * Venue Settings — build a reusable Custom payment schedule DEFAULT.
 * Does not create payment_line_items; those are created per booking from this template.
 */
export function CustomPaymentScheduleBuilder({
  value,
  onChange,
}: {
  value: CustomScheduleTemplate | null;
  onChange: (next: CustomScheduleTemplate) => void;
}) {
  const schedule = value ?? defaultCustomScheduleTemplate("percentage");
  const validation = validateCustomScheduleTemplate(schedule);

  function setMode(mode: CustomScheduleAmountMode) {
    onChange({ ...schedule, mode });
  }

  function updateItem(index: number, patch: Partial<CustomScheduleTemplateItem>) {
    onChange({
      ...schedule,
      items: schedule.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    });
  }

  function addItem() {
    const n = schedule.items.length + 1;
    const isFirst = schedule.items.length === 0;
    onChange({
      ...schedule,
      items: [
        ...schedule.items,
        {
          label: isFirst ? "Initial payment" : `Payment ${n}`,
          pctOfTotal: 0,
          amount: 0,
          timing: isFirst
            ? { type: "at_booking" }
            : { type: "before_event", days: 30 },
          obligationKind: (isFirst ? "deposit" : "installment") as PaymentObligationKind,
        },
      ],
    });
  }

  function removeItem(index: number) {
    onChange({
      ...schedule,
      items: schedule.items.filter((_, i) => i !== index),
    });
  }

  const pctSum = schedule.items.reduce((s, it) => s + (Number(it.pctOfTotal) || 0), 0);
  const dollarSum = schedule.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/10 p-4">
      <div>
        <p className="text-sm font-medium text-heading">Your custom payment schedule</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This is a default for new bookings. You can still edit the payment plan on each
          booking. For packages with different prices, prefer percentages.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-heading">Amounts as</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={schedule.mode === "percentage" ? "default" : "outline"}
            onClick={() => setMode("percentage")}
          >
            Percentages
          </Button>
          <Button
            type="button"
            size="sm"
            variant={schedule.mode === "dollar" ? "default" : "outline"}
            onClick={() => setMode("dollar")}
          >
            Dollar amounts
          </Button>
        </div>
        {schedule.mode === "dollar" ? (
          <p className="text-xs text-muted-foreground">
            Dollar schedules apply when a booking&apos;s total matches these amounts exactly.
            Otherwise Hello to Cheers will ask you to set the plan on that booking.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Percentages must total exactly 100%. Amounts are calculated from each booking&apos;s
            commercial total.
          </p>
        )}
      </div>

      <div className="space-y-3">
        {schedule.items.map((item, index) => (
          <div
            key={index}
            className="space-y-2 rounded-md border border-border bg-background p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="grid flex-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <Input
                    value={item.label}
                    onChange={(e) => updateItem(index, { label: e.target.value })}
                    placeholder="Payment name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {schedule.mode === "percentage" ? "Percent" : "Amount"}
                  </Label>
                  <div className="flex items-center gap-2">
                    {schedule.mode === "dollar" ? (
                      <span className="text-sm text-muted-foreground">$</span>
                    ) : null}
                    <Input
                      type="number"
                      min={0}
                      step={schedule.mode === "percentage" ? 1 : 0.01}
                      value={
                        schedule.mode === "percentage" ? item.pctOfTotal : item.amount
                      }
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (schedule.mode === "percentage") {
                          updateItem(index, { pctOfTotal: Number.isFinite(n) ? n : 0 });
                        } else {
                          updateItem(index, { amount: Number.isFinite(n) ? n : 0 });
                        }
                      }}
                    />
                    {schedule.mode === "percentage" ? (
                      <span className="text-sm text-muted-foreground">%</span>
                    ) : null}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="shrink-0 text-muted-foreground"
                onClick={() => removeItem(index)}
                disabled={schedule.items.length <= 1}
                aria-label="Remove installment"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={item.obligationKind}
                  onChange={(e) =>
                    updateItem(index, {
                      obligationKind: e.target.value as PaymentObligationKind,
                    })
                  }
                >
                  {OBLIGATION_KIND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <TimingEditor
                timing={item.timing}
                onChange={(timing) => updateItem(index, { timing })}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" size="sm" variant="outline" onClick={addItem}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add installment
        </Button>
        <p className="text-xs text-muted-foreground">
          {schedule.mode === "percentage"
            ? `Total: ${Math.round(pctSum * 100) / 100}%`
            : `Total: $${dollarSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
        </p>
      </div>

      {!validation.ok ? (
        <ul className="space-y-1 text-sm text-destructive">
          {validation.errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Schedule looks good — save to use it as your default.</p>
      )}
    </div>
  );
}
