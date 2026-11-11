"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ConflictItem } from "@/lib/availability/types";

/**
 * Soft gate on New Lead save when the preferred event date is unavailable under
 * the canonical availability engine. Create is never hard-blocked — a Lead
 * date does not reserve or book the date.
 */
export function LeadDateUnavailableDialog({
  open,
  reasons,
  onGoBack,
  onSaveAnyway,
  pending,
}: {
  open: boolean;
  reasons: ConflictItem[];
  onGoBack: () => void;
  onSaveAnyway: () => void;
  pending?: boolean;
}) {
  const lines = reasons
    .filter((c) => c.severity === "error")
    .map((c) => c.message);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onGoBack(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>This date isn&apos;t currently available</DialogTitle>
          <DialogDescription>
            The preferred event date you entered conflicts with your venue&apos;s current availability.
            You can choose another date, or keep this preferred date and save the lead.
          </DialogDescription>
        </DialogHeader>
        {lines.length > 0 ? (
          <ul className="space-y-1.5 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-heading">
            {lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Saving this lead does not reserve or book the date. Availability is only
          protected when you place a Hold or move a relationship to Booked.
        </p>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onGoBack}
            disabled={pending}
            data-testid="preferred-date-dialog-choose-another"
          >
            Choose another date
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={onSaveAnyway}
            data-testid="preferred-date-dialog-keep"
          >
            Keep this preferred date
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
