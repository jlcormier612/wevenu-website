"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { EVENT_ORDER_ZERO_TOTAL_WARNING } from "@/lib/event-orders/zero-total-warning";

/**
 * Pre-commit confirmation when finalizing or sharing an Event Order whose
 * total is exactly $0.00. Cancel is the safe default.
 */
export function EventOrderZeroTotalConfirmDialog({
  open,
  actionLabel,
  onContinue,
  onCancel,
}: {
  open: boolean;
  /** e.g. "Finalize" or "Share" — shown on the Continue button */
  actionLabel: string;
  onContinue: () => void;
  onCancel: () => void;
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
      <button type="button" aria-label="Cancel" className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="event-order-zero-total-title"
        aria-describedby="event-order-zero-total-desc"
        className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg"
      >
        <h2 id="event-order-zero-total-title" className="text-base font-semibold text-heading">
          Event Order totals $0.00
        </h2>
        <p id="event-order-zero-total-desc" className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {EVENT_ORDER_ZERO_TOTAL_WARNING}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" autoFocus onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="default" onClick={onContinue}>
            Continue — {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
