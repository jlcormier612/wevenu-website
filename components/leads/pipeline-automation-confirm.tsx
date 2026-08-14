"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import type { AutomationMessagePreview } from "@/lib/message-sequences/confirm-preview";

const CONFIRM_MESSAGE =
  "This stage has an active Automation. Moving this lead here will enroll them and may send the messages you've configured.";

/**
 * Pre-commit confirmation when a Pipeline stage move would enroll someone
 * in an Automation. Cancel is the safe default (Escape / backdrop / Cancel).
 * Optional first-step message preview is informational only.
 */
export function PipelineAutomationConfirmDialog({
  open,
  onContinue,
  onCancel,
  preview = null,
}: {
  open: boolean;
  onContinue: () => void;
  onCancel: () => void;
  preview?: AutomationMessagePreview | null;
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
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pipeline-automation-confirm-title"
        aria-describedby="pipeline-automation-confirm-desc"
        className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg"
      >
        <h2 id="pipeline-automation-confirm-title" className="text-base font-semibold text-heading">
          Move this lead?
        </h2>
        <p id="pipeline-automation-confirm-desc" className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {CONFIRM_MESSAGE}
        </p>
        {preview && (
          <div className="mt-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              First message
            </p>
            {preview.ok ? (
              <div className="mt-1 space-y-1">
                {preview.subject != null && preview.subject !== "" && (
                  <p className="text-xs font-medium text-foreground/80 line-clamp-2">{preview.subject}</p>
                )}
                <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap">{preview.body}</p>
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">{preview.fallback}</p>
            )}
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" autoFocus onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="default" onClick={onContinue}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

export { CONFIRM_MESSAGE as PIPELINE_AUTOMATION_CONFIRM_MESSAGE };
