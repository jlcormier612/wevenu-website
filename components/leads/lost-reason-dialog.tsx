"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LOST_REASONS,
  type LostReasonValue,
  validateLostReasonInput,
} from "@/lib/leads/lost-reasons";

/**
 * Mark-as-Lost confirmation: intent → reason → optional detail → confirm.
 */
export function LostReasonDialog({
  open,
  stageLabel = "Lost",
  confirming = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  stageLabel?: string;
  confirming?: boolean;
  onCancel: () => void;
  onConfirm: (input: { reason: LostReasonValue; detail: string | null }) => void;
}) {
  const [reason, setReason] = React.useState<LostReasonValue | "">("");
  const [detail, setDetail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setReason("");
    setDetail("");
    setError(null);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !confirming) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, confirming]);

  if (!open) return null;

  function submit() {
    if (!reason) {
      setError("Choose a lost reason.");
      return;
    }
    const err = validateLostReasonInput({ reason, detail });
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onConfirm({ reason, detail: detail.trim() || null });
  }

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
        aria-labelledby="lost-reason-title"
        aria-describedby="lost-reason-desc"
        className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-lg"
      >
        <h2 id="lost-reason-title" className="text-base font-semibold text-heading">
          Mark this lead as Lost
        </h2>
        <p id="lost-reason-desc" className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Moving this lead to {stageLabel} removes it from the active pipeline. Choose why the
          opportunity was lost before confirming.
        </p>

        <fieldset className="mt-4 space-y-2" disabled={confirming}>
          <legend className="text-sm font-medium text-foreground">Lost reason</legend>
          {LOST_REASONS.map((r) => (
            <label
              key={r.value}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name="lost-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => {
                  setReason(r.value);
                  setError(null);
                }}
                className="accent-primary"
              />
              {r.label}
            </label>
          ))}
        </fieldset>

        <div className="mt-4 space-y-1.5">
          <Label htmlFor="lost-reason-detail">
            Additional detail{reason === "other" ? " (required)" : " (optional)"}
          </Label>
          <Textarea
            id="lost-reason-detail"
            value={detail}
            onChange={(e) => {
              setDetail(e.target.value);
              setError(null);
            }}
            disabled={confirming}
            rows={3}
            placeholder={reason === "other" ? "Briefly explain…" : "Any context that helps later…"}
            className="text-sm"
          />
        </div>

        {error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={confirming} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={confirming} onClick={submit}>
            {confirming ? "Saving…" : "Mark as Lost"}
          </Button>
        </div>
      </div>
    </div>
  );
}
