"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateEventAction } from "@/app/(app)/events/[id]/actions";
import { EventFormFields } from "@/components/events/event-form";
import { eventInputFromVenueEvent } from "@/lib/events/constants";
import type { EventErrors, EventInput, VenueEvent } from "@/lib/events/types";

export function EventEditForm({ event }: { event: VenueEvent }) {
  const router = useRouter();
  const [input, setInput] = React.useState<EventInput>(() => eventInputFromVenueEvent(event));
  const [errors, setErrors] = React.useState<EventErrors>({});
  const [pending, startTransition] = React.useTransition();

  const set = <K extends keyof EventInput>(key: K, v: EventInput[K]) => {
    setInput((p) => ({ ...p, [key]: v }));
    setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  };

  function handleSubmit() {
    startTransition(async () => {
      const result = await updateEventAction(event.id, input);
      if (result.ok) { toast.success("Event updated."); router.push(`/events/${event.id}`); router.refresh(); return; }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  return <EventFormFields input={input} errors={errors} set={set} onSubmit={handleSubmit} pending={pending} submitLabel="Save changes" />;
}
