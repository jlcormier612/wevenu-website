"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateHoldBlocksAvailabilityAction } from "@/app/(app)/settings/availability-actions";

export function HoldAvailabilityControl({
  initialBlocks,
}: {
  initialBlocks: boolean;
}) {
  const router = useRouter();
  const [blocks, setBlocks] = React.useState(initialBlocks);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setBlocks(initialBlocks);
  }, [initialBlocks]);

  function choose(next: boolean) {
    if (next === blocks || pending) return;
    const previous = blocks;
    setBlocks(next);
    startTransition(async () => {
      const result = await updateHoldBlocksAvailabilityAction(next);
      if (result.ok) {
        toast.success(next
          ? "Active holds now close those dates for prospective clients."
          : "Held dates can still appear as available.");
        router.refresh();
      } else {
        setBlocks(previous);
        toast.error(result.message ?? "Could not save this availability preference.");
      }
    });
  }

  return (
    <fieldset className="space-y-3" disabled={pending}>
      <legend className="text-sm font-medium text-heading">When a date is on hold</legend>
      <p className="text-sm text-muted-foreground">
        Choose whether an active date hold should prevent that date from appearing as available to prospective clients.
        A hold is not a booking. Tours and appointments do not close dates.
      </p>
      <label className="flex items-start gap-3 rounded-lg border border-border px-3 py-3">
        <input
          type="radio"
          name="hold-blocks-availability"
          className="mt-1"
          checked={blocks}
          onChange={() => choose(true)}
        />
        <span>
          <span className="block text-sm font-medium text-heading">Hold dates from public availability</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Recommended. An active hold will make the date unavailable on your public availability calendar and inquiry form until the hold is released or converted to a booking.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 rounded-lg border border-border px-3 py-3">
        <input
          type="radio"
          name="hold-blocks-availability"
          className="mt-1"
          checked={!blocks}
          onChange={() => choose(false)}
        />
        <span>
          <span className="block text-sm font-medium text-heading">Keep held dates available</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Held dates can still appear as available to prospective clients. Your team can manage competing inquiries internally.
          </span>
        </span>
      </label>
      <p className="text-xs text-muted-foreground">
        Recommended: keep holds closed to the public if a hold means your team is temporarily reserving the date for a prospective client.
      </p>
    </fieldset>
  );
}
