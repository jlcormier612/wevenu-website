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
          ? "Public inquiries can stay open when another event is booked, if your simultaneous-event limit allows."
          : "A booked event now closes that date for new public inquiries.");
        router.refresh();
      } else {
        setAllows(previous);
        toast.error(result.message ?? "Could not save this availability preference.");
      }
    });
  }

  return (
    <fieldset className="space-y-3" disabled={pending} data-testid="simultaneous-public-availability">
      <legend className="text-sm font-medium text-heading">Allow inquiries when another event is booked</legend>
      <p className="text-sm text-muted-foreground">
        Choose how HTC handles public inquiries for dates when your venue already has an event booked.
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
          <span className="block text-sm font-medium text-heading">Close the date when an event is booked</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Once an existing event makes a date unavailable under your venue&apos;s booking rules, HTC won&apos;t accept new public inquiries for that date—even if another space might be free.
          </span>
          <span className="mt-1.5 block text-xs text-muted-foreground">
            Best if your venue generally hosts only one event per day.
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
          <span className="block text-sm font-medium text-heading">Keep the date open for other events</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            HTC can continue accepting public inquiries for a date with an existing booking, as long as your venue&apos;s simultaneous-event limit allows another event. You&apos;ll need to confirm that a suitable space is available before accepting another booking.
          </span>
          <span className="mt-1.5 block text-xs text-muted-foreground">
            Best if your venue can host multiple events in different spaces on the same day.
          </span>
        </span>
      </label>
      <p
        className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground"
        data-testid="simultaneous-public-availability-note"
      >
        <span className="font-medium text-heading">Important. </span>
        Keeping a date open does not mean every space is available. HTC&apos;s public inquiry availability is currently date-based, so you&apos;ll need to confirm the requested space and any scheduling conflicts before booking another event.
      </p>
    </fieldset>
  );
}
