"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createEventAction } from "@/app/(app)/events/actions";
import { Field } from "@/components/setup/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { eventInputFromVenueEvent } from "@/lib/events/constants";
import type { EventErrors, EventInput, VenueEvent } from "@/lib/events/types";
import { EVENT_TYPES } from "@/lib/leads/constants";

export function EventFormFields({
  input, errors, set, onSubmit, pending, submitLabel = "Create event",
}: {
  input: EventInput;
  errors: EventErrors;
  set: <K extends keyof EventInput>(key: K, v: EventInput[K]) => void;
  onSubmit: () => void;
  pending: boolean;
  submitLabel?: string;
}) {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <Field label="Event name" htmlFor="en" required error={errors.name}>
        <Input id="en" value={input.name} onChange={(e) => set("name", e.target.value)} placeholder="Emily & James Carter — Wedding" aria-invalid={errors.name ? true : undefined} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event type" htmlFor="et">
          <Select value={input.eventType} onValueChange={(v) => set("eventType", v)}>
            <SelectTrigger id="et"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>{EVENT_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Event date" htmlFor="ed" required error={errors.eventDate}>
          <Input id="ed" type="date" value={input.eventDate} onChange={(e) => set("eventDate", e.target.value)} aria-invalid={errors.eventDate ? true : undefined} />
        </Field>
      </div>

      <Separator />
      <p className="text-sm font-medium text-heading">Day-of schedule</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start time" htmlFor="st">
          <Input id="st" type="time" value={input.startTime} onChange={(e) => set("startTime", e.target.value)} />
        </Field>
        <Field label="End time" htmlFor="et2" error={errors.endTime}>
          <Input id="et2" type="time" value={input.endTime} onChange={(e) => set("endTime", e.target.value)} />
        </Field>
        <Field label="Setup begins" htmlFor="su">
          <Input id="su" type="time" value={input.setupTime} onChange={(e) => set("setupTime", e.target.value)} />
        </Field>
        <Field label="Teardown ends" htmlFor="td">
          <Input id="td" type="time" value={input.teardownTime} onChange={(e) => set("teardownTime", e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Guest count" htmlFor="gc" error={errors.guestCount}>
          <Input id="gc" type="number" value={input.guestCount} onChange={(e) => set("guestCount", e.target.value)} placeholder="150" />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="button" onClick={onSubmit} disabled={pending}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving…</> : submitLabel}
        </Button>
      </div>
    </div>
  );
}

export function EventForm({ initial }: { initial: EventInput }) {
  const router = useRouter();
  const [input, setInput] = React.useState<EventInput>(initial);
  const [errors, setErrors] = React.useState<EventErrors>({});
  const [pending, startTransition] = React.useTransition();

  const set = <K extends keyof EventInput>(key: K, v: EventInput[K]) => {
    setInput((p) => ({ ...p, [key]: v }));
    setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  };

  function handleSubmit() {
    startTransition(async () => {
      const result = await createEventAction(input);
      if (result.ok) { toast.success("Event created."); router.push(`/events/${result.eventId}`); return; }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  return <EventFormFields input={input} errors={errors} set={set} onSubmit={handleSubmit} pending={pending} />;
}
