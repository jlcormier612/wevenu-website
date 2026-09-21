"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

/**
 * Confirm move into a Booked reporting-category stage.
 * Explains Lead → booking-file conversion before mutation.
 */
export function PipelineBookedConfirmDialog({
  open,
  stageLabel = "Booked",
  confirming = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  stageLabel?: string;
  confirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !confirming) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, confirming]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="presentation">
      <button
        type="button"
        aria-label="Cancel"
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        disabled={confirming}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pipeline-booked-title"
        aria-describedby="pipeline-booked-desc"
        className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-lg"
      >
        <h2 id="pipeline-booked-title" className="text-base font-semibold text-heading">
          Mark this client as booked?
        </h2>
        <div id="pipeline-booked-desc" className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            You&apos;re booking this date.
          </p>
          <p>
            Moving this relationship to Booked will protect the event date from conflicting bookings.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" autoFocus disabled={confirming} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="default" disabled={confirming} onClick={onConfirm}>
            {confirming ? "Booking…" : "Mark as Booked"}
          </Button>
        </div>
      </div>
    </div>
  );
}
