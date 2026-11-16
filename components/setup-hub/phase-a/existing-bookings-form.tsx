"use client";

import * as React from "react";
import Link from "next/link";

import { setExistingBookingsAnswerAction } from "@/app/(app)/setup-hub/actions";
import { Button } from "@/components/ui/button";
import { PHASE_A_MILESTONE_ROUTES } from "@/lib/setup-hub/phase-a-milestones";
import type { ExistingBookingsAnswer } from "@/lib/setup-hub/types";

export function ExistingBookingsForm({
  initialAnswer,
}: {
  initialAnswer: ExistingBookingsAnswer | null;
}) {
  const [answer, setAnswer] = React.useState<ExistingBookingsAnswer | null>(initialAnswer);
  const [saved, setSaved] = React.useState<ExistingBookingsAnswer | null>(initialAnswer);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function save() {
    if (!answer) return;
    setError(null);
    startTransition(async () => {
      const result = await setExistingBookingsAnswerAction(answer);
      if (!result.ok) {
        setError("Could not save your answer. Please try again.");
        return;
      }
      setSaved(answer);
    });
  }

  return (
    <div className="space-y-4" data-testid="phase-a-existing-bookings-form">
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-heading">
          Do you have existing booked events to bring into HTC?
        </legend>
        <p className="text-sm text-muted-foreground">
          We want to make sure your calendar reflects every event you&apos;ve already booked.
        </p>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-3">
          <input
            type="radio"
            name="existing-bookings"
            className="mt-1"
            checked={answer === "yes"}
            onChange={() => setAnswer("yes")}
            data-testid="phase-a-bookings-yes"
          />
          <span className="text-sm text-foreground">
            Yes, I have booked events to bring over.
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-3">
          <input
            type="radio"
            name="existing-bookings"
            className="mt-1"
            checked={answer === "no"}
            onChange={() => setAnswer("no")}
            data-testid="phase-a-bookings-no"
          />
          <span className="text-sm text-foreground">
            No, I don&apos;t have any existing booked events.
          </span>
        </label>
      </fieldset>

      <Button
        type="button"
        disabled={!answer || pending}
        onClick={save}
        data-testid="phase-a-bookings-save"
      >
        Save my answer
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {saved === "yes" ? (
        <div
          className="space-y-2 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm"
          data-testid="phase-a-bookings-yes-followup"
        >
          <p className="font-medium text-heading">We&apos;ll help you bring them over.</p>
          <p className="text-muted-foreground">
            First, make sure your spaces and booking rules are configured. Then we&apos;ll help you
            import your booked clients and events and verify their calendar assignments.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            render={<Link href={PHASE_A_MILESTONE_ROUTES.bringBusiness} />}
          >
            Continue to Bring your business over
          </Button>
        </div>
      ) : null}

      {saved === "no" ? (
        <div
          className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm"
          data-testid="phase-a-bookings-no-followup"
        >
          <p className="font-medium text-heading">Great! You&apos;re starting with a clear calendar.</p>
          <p className="mt-1 text-muted-foreground">
            We&apos;ll still help you check your spaces and booking rules before you begin accepting
            bookings through HTC.
          </p>
        </div>
      ) : null}
    </div>
  );
}
