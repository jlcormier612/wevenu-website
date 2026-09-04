"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateEventBookedAtAction } from "@/app/(app)/events/[id]/actions";
import { Field } from "@/components/setup/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPreviewDueDate } from "@/lib/payments/starters";

/**
 * Owner/Manager correction of the booking commitment date.
 * Changing this never rewrites existing payment schedule due dates.
 */
export function EventBookingDateForm({
  eventId,
  bookedAt,
  canEdit,
}: {
  eventId: string;
  bookedAt: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(bookedAt ?? "");
  const [error, setError] = React.useState<string | undefined>();
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setValue(bookedAt ?? "");
  }, [bookedAt]);

  if (!canEdit) {
    return (
      <div className="space-y-1 text-sm">
        <p className="font-medium text-heading">Booking date</p>
        <p className="text-muted-foreground">
          {bookedAt
            ? formatPreviewDueDate(bookedAt)
            : "Not set — ask an Owner or Manager to record when this couple booked."}
        </p>
      </div>
    );
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateEventBookedAtAction(eventId, value);
      if (result.ok) {
        toast.success("Booking date saved. Existing payment due dates were not changed.");
        router.refresh();
        return;
      }
      if (result.errors?.bookedAt) setError(result.errors.bookedAt);
      toast.error(result.message ?? "Could not save the booking date.");
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-heading">Booking date</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The day this couple committed / booked — not the Event day, and not the contract signing date.
          Changing this date does not automatically change existing payment schedule due dates.
        </p>
      </div>
      <Field label="Booking date" htmlFor="event-booked-at" error={error}>
        <Input
          id="event-booked-at"
          type="date"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(undefined);
          }}
        />
      </Field>
      <Button type="button" size="sm" onClick={handleSave} disabled={pending || !value.trim()}>
        {pending ? "Saving…" : bookedAt ? "Update booking date" : "Set booking date"}
      </Button>
    </div>
  );
}
