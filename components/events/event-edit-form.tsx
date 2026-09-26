"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateEventAction } from "@/app/(app)/events/[id]/actions";
import { EventFormFields } from "@/components/events/event-form";
import { useLibraryUnsavedGuard } from "@/components/library/use-library-unsaved-guard";
import { eventInputFromVenueEvent } from "@/lib/events/constants";
import type { EventErrors, EventInput, VenueEvent } from "@/lib/events/types";
import type { VenueSpace } from "@/lib/availability/types";
import type { EventSpaceAssignmentInput } from "@/lib/venue-spaces/assignments";

export function EventEditForm({
  event,
  spaces = [],
  maxSimultaneousEvents = 1,
  spaceOperatingMode = "single",
  initialAssignments = [],
  excludeLeadId,
}: {
  event: VenueEvent;
  spaces?: VenueSpace[];
  maxSimultaneousEvents?: number;
  spaceOperatingMode?: "single" | "multi";
  initialAssignments?: EventSpaceAssignmentInput[];
  excludeLeadId?: string;
}) {
  const router = useRouter();
  const buildInput = React.useCallback((): EventInput => ({
    ...eventInputFromVenueEvent(event),
    spaceAssignments: spaceOperatingMode === "multi" ? initialAssignments : undefined,
  }), [event, initialAssignments, spaceOperatingMode]);
  const [baseline] = React.useState(() => JSON.stringify(buildInput()));
  const [input, setInput] = React.useState<EventInput>(buildInput);
  const [errors, setErrors] = React.useState<EventErrors>({});
  const [pending, startTransition] = React.useTransition();
  const dirty = JSON.stringify(input) !== baseline;
  useLibraryUnsavedGuard(dirty);

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

  return (
    <EventFormFields
      input={input}
      errors={errors}
      set={set}
      onSubmit={handleSubmit}
      pending={pending}
      submitLabel="Save changes"
      spaces={spaces}
      existingEventId={event.id}
      excludeLeadId={excludeLeadId}
      maxSimultaneousEvents={maxSimultaneousEvents}
      spaceOperatingMode={spaceOperatingMode}
    />
  );
}
