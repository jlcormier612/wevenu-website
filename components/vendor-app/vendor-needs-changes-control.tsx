"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { returnPersonalTaskAction } from "@/app/vendor/events/actions";

/**
 * Phase 2 Needs Changes — vendor returns an acked vendor_confirm task to the couple.
 * Required note; never marks the task complete.
 */
export function VendorNeedsChangesControl({
  taskId,
  assignmentId,
  pending: parentPending,
  onReturned,
}: {
  taskId: string;
  assignmentId: string;
  pending?: boolean;
  onReturned?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = pending || Boolean(parentPending);

  function submit() {
    const trimmed = note.trim();
    if (!trimmed) {
      setError("Please tell the couple what needs to change.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await returnPersonalTaskAction(taskId, assignmentId, trimmed);
      if (!result.ok) {
        toast.error(result.message ?? "Could not send this back.");
        return;
      }
      toast.success("Sent back to the couple for changes.");
      setOpen(false);
      setNote("");
      onReturned?.();
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        Needs changes
      </Button>
    );
  }

  return (
    <div className="w-full min-w-[12rem] max-w-xs space-y-2 rounded-md border border-border bg-card p-2 sm:w-56">
      <p className="text-[11px] font-medium text-foreground">What needs to change?</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        disabled={busy}
        placeholder="E.g. Reception playlist is still missing…"
        className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <div className="flex items-center justify-end gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setNote("");
            setError(null);
          }}
        >
          Cancel
        </Button>
        <Button type="button" size="sm" className="h-7" disabled={busy} onClick={submit}>
          {busy ? "Sending…" : "Send back"}
        </Button>
      </div>
    </div>
  );
}
