"use client";

import * as React from "react";

import { toast } from "sonner";

import { updateStockSharingAction } from "@/app/(app)/library/inventory/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { StockSharingMode, StockSharingSettings } from "@/lib/inventory/reservations";

/** Venue setting: whether events on the same day can reuse the same stock. */
export function StockSharingSetting({ initial }: { initial: StockSharingSettings }) {
  const [mode, setMode] = React.useState<StockSharingMode>(initial.mode);
  const [hours, setHours] = React.useState(String(initial.turnaroundMinutes / 60));
  const [saved, setSaved] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  const minutes = Math.round(Number(hours) * 60);
  const dirty = mode !== saved.mode || (mode === "by_time" && minutes !== saved.turnaroundMinutes);

  function save() {
    startTransition(async () => {
      const result = await updateStockSharingAction(mode, mode === "by_time" ? minutes : saved.turnaroundMinutes);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setSaved({ mode, turnaroundMinutes: mode === "by_time" ? minutes : saved.turnaroundMinutes });
      toast.success("Stock sharing saved.");
    });
  }

  return (
    <Card data-testid="stock-sharing-setting">
      <CardContent className="space-y-3 pt-6">
        <div>
          <p className="text-sm font-semibold text-heading">When can two events use the same stock?</p>
          <p className="text-xs text-muted-foreground">
            Once a couple approves their Event Order, its items are reserved for their event. Other events that can&apos;t
            share with it see what&apos;s left. Items with a quantity of 0 aren&apos;t tracked. This only warns — it never
            blocks a booking or changes an Event Order.
          </p>
        </div>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as StockSharingMode)} className="gap-2">
          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-3">
            <RadioGroupItem value="same_day" className="mt-0.5" data-testid="stock-sharing-same-day" />
            <span>
              <span className="block text-sm font-medium text-heading">Never on the same day</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Every event on a date needs its own stock.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-3">
            <RadioGroupItem value="by_time" className="mt-0.5" data-testid="stock-sharing-by-time" />
            <span className="space-y-2">
              <span className="block text-sm font-medium text-heading">When their times don&apos;t overlap</span>
              <span className="block text-xs text-muted-foreground">
                A morning shower and an evening wedding can reuse the same chairs if there&apos;s enough time between
                them. Times run from setup to teardown; events without times count as all day.
              </span>
              {mode === "by_time" ? (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  Turnaround needed between events
                  <Input
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className="h-8 w-20 text-sm"
                    data-testid="stock-sharing-turnaround-hours"
                  />
                  hours
                </span>
              ) : null}
            </span>
          </label>
        </RadioGroup>
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={!dirty || pending} onClick={save} data-testid="stock-sharing-save">
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
