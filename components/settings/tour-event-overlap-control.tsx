"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateAllowToursDuringBookedEventsAction } from "@/app/(app)/settings/availability-actions";

export function TourEventOverlapControl({
  initialAllows,
}: {
  initialAllows: boolean;
}) {
  const router = useRouter();
  const [allows, setAllows] = React.useState(initialAllows);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setAllows(initialAllows);
  }, [initialAllows]);

  function choose(next: boolean) {
    if (next === allows || pending) return;
    const previous = allows;
    setAllows(next);
    startTransition(async () => {
      const result = await updateAllowToursDuringBookedEventsAction(next);
      if (result.ok) {
        toast.success(next
          ? "Tours can be scheduled during a booked event."
          : "Tours cannot be scheduled during a booked event.");
        router.refresh();
      } else {
        setAllows(previous);
        toast.error(result.message ?? "Could not save this availability preference.");
      }
    });
  }

  return (
    <fieldset className="mt-6 space-y-3" disabled={pending}>
      <legend className="text-sm font-medium text-heading">Allow tours during booked events</legend>
      <p className="text-sm text-muted-foreground">
        Choose whether couples can schedule a tour while a booked event is occupying the venue.
      </p>
      <label className="flex items-start gap-3 rounded-lg border border-border px-3 py-3">
        <input
          type="radio"
          name="tours-during-booked-events"
          className="mt-1"
          checked={!allows}
          onChange={() => choose(false)}
        />
        <span>
          <span className="block text-sm font-medium text-heading">Off</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Tours cannot be scheduled during a booked event.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 rounded-lg border border-border px-3 py-3">
        <input
          type="radio"
          name="tours-during-booked-events"
          className="mt-1"
          checked={allows}
          onChange={() => choose(true)}
        />
        <span>
          <span className="block text-sm font-medium text-heading">On</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Tours can be scheduled during a booked event. Tour hours, exceptions, and how many tours you can host at once still apply.
          </span>
        </span>
      </label>
    </fieldset>
  );
}
