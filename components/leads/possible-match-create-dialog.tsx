"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { signalLabel, type DuplicateCandidate } from "@/lib/leads/duplicate-detection";
import { statusLabel } from "@/lib/leads/constants";
import type { IdentityDecision } from "@/lib/identity/decision";

/**
 * Venue identity confirmation before creating a Lead or Client that may
 * already exist. Create does not proceed until the venue chooses.
 */
export function PossibleMatchCreateDialog({
  open,
  matches,
  onDecide,
  onCancel,
  pending,
}: {
  open: boolean;
  matches: DuplicateCandidate[];
  onDecide: (decision: IdentityDecision) => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  const top = matches[0];
  if (!top) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>We may already have this customer</DialogTitle>
          <DialogDescription>
            Matching information suggests this person may already be in your records.
            Choose whether this is the same customer or a different one. The system
            will not decide for you.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border px-3 py-2 text-sm">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Existing</p>
          <p className="font-medium text-heading">{top.displayName}</p>
          {top.email ? <p className="text-muted-foreground">{top.email}</p> : null}
          {top.phone ? <p className="text-muted-foreground">{top.phone}</p> : null}
          {top.salesStage ? (
            <p className="text-muted-foreground">Status: {statusLabel(top.salesStage)}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            Matched by: {top.signals.map(signalLabel).join(", ")}
          </p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Go back
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending || !top.relationshipId}
            onClick={() => {
              if (!top.relationshipId) return;
              onDecide({ action: "use_existing", relationshipId: top.relationshipId });
            }}
          >
            Use existing customer
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => onDecide({ action: "create_new" })}
          >
            Create new customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
