"use client";

/**
 * Pre-submit confirmation before a couple locks their working floor plan
 * for venue review. Same hand-rolled alertdialog pattern as
 * EventOrderZeroTotalConfirmDialog / LibraryDeleteConfirmDialog.
 * Opening this dialog must not submit, lock, or notify.
 */

import * as React from "react";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function FloorPlanSubmitConfirmDialog({
  open,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="presentation"
      data-testid="floor-plan-submit-confirm-dialog"
    >
      <button
        type="button"
        aria-label="Go back and keep editing"
        className="absolute inset-0 bg-black/40"
        disabled={pending}
        onClick={() => {
          if (!pending) onCancel();
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="floor-plan-submit-confirm-title"
        aria-describedby="floor-plan-submit-confirm-desc"
        className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg"
      >
        <h2
          id="floor-plan-submit-confirm-title"
          className="text-base font-semibold text-heading"
        >
          Ready to submit your floor plan?
        </h2>
        <div
          id="floor-plan-submit-confirm-desc"
          className="mt-2 space-y-2 text-sm text-muted-foreground leading-relaxed"
        >
          <p>
            Once you submit, your venue will receive your floor plan for review, and you&apos;ll
            no longer be able to move furniture or make changes until the venue responds. Please
            make sure your arrangement is complete before continuing.
          </p>
          <p>You can still cancel now and keep working on your floor plan.</p>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            autoFocus
            disabled={pending}
            data-testid="floor-plan-submit-confirm-cancel"
            onClick={onCancel}
          >
            Go back and keep editing
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={pending}
            data-testid="floor-plan-submit-confirm-submit"
            onClick={onConfirm}
          >
            {pending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit for venue review"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
