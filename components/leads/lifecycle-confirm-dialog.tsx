"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

/**
 * Lightweight lifecycle confirmation (Book This Lead / Move back / Return to Booked).
 * Same interaction pattern as PipelineAutomationConfirmDialog — Cancel is safe default.
 */
export function LeadLifecycleConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  confirming = false,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
}) {
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
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
        aria-labelledby="lead-lifecycle-confirm-title"
        aria-describedby="lead-lifecycle-confirm-desc"
        className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg"
      >
        <h2 id="lead-lifecycle-confirm-title" className="text-base font-semibold text-heading">
          {title}
        </h2>
        <p id="lead-lifecycle-confirm-desc" className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" autoFocus disabled={confirming} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="default" disabled={confirming} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
