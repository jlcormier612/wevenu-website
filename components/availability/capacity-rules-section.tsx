"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { saveCapacityRulesAction } from "@/app/(app)/availability/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VenueCapacityRules } from "@/lib/availability/types";

const OPTION_COUNTS = [1, 2, 3, 4, 5, 6, 8, 10];

function CountSelect({ value, onChange, label, hint }: { value: number; onChange: (v: number) => void; label: string; hint: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-heading">{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {OPTION_COUNTS.map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`h-9 w-10 rounded-lg border text-sm font-medium transition-colors ${value === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary/40"}`}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CapacityRulesSection({ initialRules }: { initialRules: VenueCapacityRules | null }) {
  const defaults = { maxSimultaneousEvents: 1, maxSimultaneousTours: 1, minTurnaroundHours: 0 };
  const [maxEvents, setMaxEvents] = React.useState(initialRules?.maxSimultaneousEvents ?? defaults.maxSimultaneousEvents);
  const [maxTours, setMaxTours] = React.useState(initialRules?.maxSimultaneousTours ?? defaults.maxSimultaneousTours);
  const [turnaround, setTurnaround] = React.useState(String(initialRules?.minTurnaroundHours ?? 0));
  const [pending, startTransition] = React.useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await saveCapacityRulesAction({
        maxSimultaneousEvents: maxEvents,
        maxSimultaneousTours: maxTours,
        minTurnaroundHours: parseFloat(turnaround) || 0,
      });
      if (result.ok) toast.success("Capacity rules saved.");
      else toast.error(result.message ?? "Could not save.");
    });
  }

  return (
    <div className="space-y-5">
      <CountSelect
        value={maxEvents}
        onChange={setMaxEvents}
        label="Maximum simultaneous events"
        hint="How many events can take place at your venue at the same time. Most venues select 1."
      />
      <CountSelect
        value={maxTours}
        onChange={setMaxTours}
        label="Maximum simultaneous tours"
        hint="How many venue tours / site visits can run at the same time. Depends on your coordinator capacity."
      />
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-heading">Minimum turnaround between events (hours)</Label>
        <p className="text-xs text-muted-foreground">Buffer time required between events for setup and teardown. Set to 0 if events can be back-to-back.</p>
        <Input
          type="number"
          value={turnaround}
          onChange={(e) => setTurnaround(e.target.value)}
          className="w-24 mt-2"
          min="0"
          step="0.5"
        />
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={pending}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving…</> : "Save capacity rules"}
        </Button>
      </div>
    </div>
  );
}
