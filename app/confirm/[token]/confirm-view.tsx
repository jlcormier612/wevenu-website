"use client";

import * as React from "react";

import { CheckCircle2, Loader2 } from "lucide-react";

import { confirmTourAction } from "@/app/confirm/[token]/actions";
import { Button } from "@/components/ui/button";

export function ConfirmTourView({
  token, venueName, dateStr, timeStr, durationMinutes, contactName,
}: {
  token: string; venueName: string; dateStr: string; timeStr: string; durationMinutes: number; contactName: string | null;
}) {
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const name = contactName?.split(/[\s&]+/)[0] ?? "there";

  function handleConfirm() {
    setError("");
    startTransition(async () => {
      const result = await confirmTourAction(token);
      if (result.ok) setDone(true);
      else setError(result.error ?? "Could not confirm your tour. Please try again.");
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-2">
        <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
        <p className="text-lg font-semibold text-green-800">Tour confirmed</p>
        <p className="text-sm text-green-700">
          Thanks, {name} — we&apos;ll see you {dateStr} at {timeStr}.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 space-y-4 text-center">
      <p className="text-sm text-gray-600">
        Hi {name}, please confirm your {durationMinutes}-minute tour at {venueName}.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button
        type="button"
        onClick={handleConfirm}
        disabled={pending}
        className="w-full text-white hover:opacity-90"
        style={{ backgroundColor: "var(--venue-primary)", borderColor: "var(--venue-primary)" }}
      >
        {pending
          ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Confirming…</>
          : <><CheckCircle2 className="mr-1.5 h-4 w-4" />Confirm my tour</>}
      </Button>
    </div>
  );
}
