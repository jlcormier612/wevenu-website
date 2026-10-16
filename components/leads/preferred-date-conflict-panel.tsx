"use client";

import { Ban, CalendarX, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ConflictItem } from "@/lib/availability/types";

/**
 * Inline soft warning on New Lead when the preferred event date conflicts
 * with canonical availability. Never hard-blocks create.
 */
export function PreferredDateConflictPanel({
  checking,
  checkFailed,
  conflicts,
  acknowledged,
  onChooseAnother,
  onKeepPreferred,
}: {
  checking: boolean;
  checkFailed: boolean;
  conflicts: ConflictItem[];
  acknowledged: boolean;
  onChooseAnother: () => void;
  onKeepPreferred: () => void;
}) {
  if (checking) {
    return (
      <div
        className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground"
        data-testid="preferred-date-checking"
        role="status"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
        Checking availability…
      </div>
    );
  }

  if (checkFailed) {
    return (
      <div
        className="rounded-lg border border-warning/30 bg-warning/8 px-3 py-2.5 space-y-1.5"
        data-testid="preferred-date-check-failed"
        role="status"
      >
        <p className="text-sm text-heading">
          Availability could not be checked right now. You can still save this lead —
          we&apos;ll recheck when you save.
        </p>
      </div>
    );
  }

  const errors = conflicts.filter((c) => c.severity === "error");
  if (errors.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 space-y-2"
      data-testid="preferred-date-conflict"
      role="alert"
    >
      <div className="flex items-center gap-1.5">
        <CalendarX className="h-3.5 w-3.5 text-destructive" />
        <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
          This date may already be unavailable
        </p>
      </div>
      <ul className="space-y-1">
        {errors.map((c, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-destructive">
            <Ban className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{c.message}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Keeping this preferred date does not reserve or book it. Availability is only
        protected when you place a Hold or move a relationship to Booked.
      </p>
      {acknowledged ? (
        <p className="text-xs font-medium text-heading" data-testid="preferred-date-kept">
          You&apos;re keeping this preferred date despite the conflict.
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="preferred-date-choose-another"
            onClick={onChooseAnother}
          >
            Choose another date
          </Button>
          <Button
            type="button"
            size="sm"
            data-testid="preferred-date-keep"
            onClick={onKeepPreferred}
          >
            Keep this preferred date
          </Button>
        </div>
      )}
    </div>
  );
}
