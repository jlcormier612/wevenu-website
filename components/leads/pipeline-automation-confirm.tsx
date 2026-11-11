"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import type { StageChangeMessagePlan } from "@/lib/message-sequences/confirm-preview";
import { stageChangeStepTimingLabel } from "@/lib/message-sequences/stage-change-message-choice";

/**
 * Pre-commit confirmation when a Pipeline stage move would enroll someone
 * in an Automation. Nothing is queued until Send or Don't send.
 * Cancel is the safe default (Escape / backdrop / Cancel).
 */
export function PipelineAutomationConfirmDialog({
  open,
  onSend,
  onSkip,
  onCancel,
  plan = null,
}: {
  open: boolean;
  onSend: () => void;
  onSkip: () => void;
  onCancel: () => void;
  plan?: StageChangeMessagePlan | null;
}) {
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const steps = plan?.steps ?? [];
  const oneMessage = steps.length === 1;
  function choose(action: () => void) {
    if (busy) return;
    setBusy(true);
    action();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        aria-label="Cancel"
        className="absolute inset-0 bg-black/40"
        onClick={() => { if (!busy) onCancel(); }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pipeline-automation-confirm-title"
        aria-describedby="pipeline-automation-confirm-desc"
        className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg"
      >
        <h2 id="pipeline-automation-confirm-title" className="text-base font-semibold text-heading">
          Send the automation message?
        </h2>
        <p id="pipeline-automation-confirm-desc" className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {oneMessage
            ? "Moving this lead will schedule the message below."
            : steps.length > 1
              ? "Moving this lead will schedule every message listed below."
              : "Moving this lead will run the matching automation. It does not include a customer message."}
          {" "}
          Send message &amp; continue schedules them. Don&apos;t send &amp; continue moves the lead and does not send them this time. Your saved automation stays unchanged. Cancel leaves the lead where they are.
        </p>
        {steps.length > 0 && (
          <div className="mt-3 max-h-52 space-y-2 overflow-y-auto rounded-md border border-border/60 bg-muted/30 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {oneMessage ? "Message" : `${steps.length} messages`}
            </p>
            {steps.map((step, index) => {
              const indexInSequence = steps.slice(0, index).filter((earlier) => earlier.sequenceId === step.sequenceId).length;
              const sameSequenceAsPrevious = index > 0 && steps[index - 1]?.sequenceId === step.sequenceId;
              return (
                <div key={step.stepId} className="space-y-1 border-t border-border/50 pt-2 first:border-t-0 first:pt-0">
                  {!sameSequenceAsPrevious && (
                    <p className="text-xs font-medium text-foreground">{step.sequenceName}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {step.channel === "email" ? "Email" : "Text"}
                    {" · "}
                    {stageChangeStepTimingLabel(step.offsetDays, indexInSequence)}
                  </p>
                  {step.preview.ok ? (
                    <>
                      {step.preview.subject != null && step.preview.subject !== "" && (
                        <p className="text-xs font-medium text-foreground/80 line-clamp-2">{step.preview.subject}</p>
                      )}
                      <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{step.preview.body}</p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">{step.preview.fallback}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {plan?.advancesPipeline && (
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
            Continuing also moves this lead one stage forward for each automation set up to do that. That still happens if you do not send the messages.
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button type="button" variant="outline" autoFocus disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => choose(onSkip)}>
            Don&apos;t send &amp; continue
          </Button>
          <Button type="button" variant="default" disabled={busy} onClick={() => choose(onSend)}>
            Send message &amp; continue
          </Button>
        </div>
      </div>
    </div>
  );
}
