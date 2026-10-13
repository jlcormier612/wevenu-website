"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateAllowSimultaneousPublicAvailabilityAction } from "@/app/(app)/settings/availability-actions";

export function SimultaneousPublicAvailabilityControl({
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
      const result = await updateAllowSimultaneousPublicAvailabilityAction(next);
      if (result.ok) {
        toast.success(next
          ? "A free Event Space can keep a date available when another event is already booked."
          : "A confirmed event now closes that date for prospective clients.");
        router.refresh();
      } else {
        setAllows(previous);
        toast.error(result.message ?? "Could not save this availability preference.");
      }
    });
  }

  return (
    <fieldset className="space-y-3" disabled={pending} data-testid="simultaneous-public-availability">
      <legend className="text-sm font-medium text-heading">When a confirmed event is already on the calendar</legend>
      <p className="text-sm text-muted-foreground">
        Choose whether a confirmed event should close that date for prospective clients on your public availability calendar and inquiry form.
        This is separate from your staff scheduling capacity (how many events your team can book at once).
      </p>
      <label className="flex items-start gap-3 rounded-lg border border-border px-3 py-3">
        <input
          type="radio"
          name="simultaneous-public-availability"
          className="mt-1"
          checked={!allows}
          onChange={() => choose(false)}
        />
        <span>
          <span className="block text-sm font-medium text-heading">Close the date when any event is confirmed</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Recommended. A confirmed event on that date makes the date unavailable for new inquiries — even if another Event Space is free or unassigned.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 rounded-lg border border-border px-3 py-3">
        <input
          type="radio"
          name="simultaneous-public-availability"
          className="mt-1"
          checked={allows}
          onChange={() => choose(true)}
        />
        <span>
          <span className="block text-sm font-medium text-heading">Keep the date available when another space is free</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            A date stays Available if at least one active Event Space can still take a full-day event under your simultaneous capacity and space rules. Overlapping use of the same space remains blocked.
          </span>
        </span>
      </label>
      <p className="text-xs text-muted-foreground">
        Recommended: close the date for the public when a confirmed event means you do not want new same-day event interest, even if a side lawn is technically unused.
      </p>
    </fieldset>
  );
}
